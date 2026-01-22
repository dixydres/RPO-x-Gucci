// ============================================
// OASIS VR SYSTEM - TYPO FIX & OPTIMIZED
// ============================================

window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedObject: null,
    grabbedHand: null, 
    originalHeadsetPos: null,
    originalParent: null,
    originalPosition: null
};

// --- PHYSIQUE : CHUTE AVEC REBOND ---
function dropObject(el) {
    const worldPos = new THREE.Vector3();
    el.object3D.getWorldPosition(worldPos);

    const floorHeight = 0.15;
    const tableHeight = 0.82;
    // Zone du bureau (approximative)
    const isOverTable = (worldPos.x > 0.2 && worldPos.x < 1.4 && worldPos.z > -1.4 && worldPos.z < -0.4);
    const targetY = isOverTable ? tableHeight : floorHeight;

    if (worldPos.y <= targetY) return;

    const distance = worldPos.y - targetY;
    const duration = Math.sqrt(distance / 9.8) * 1000 * 1.5;

    el.removeAttribute('animation__drop');
    el.setAttribute('animation__drop', {
        property: 'position',
        to: `${worldPos.x} ${targetY} ${worldPos.z}`,
        dur: duration,
        easing: 'easeOutBounce'
    });
    
    el.setAttribute('animation__rotate', {
        property: 'rotation',
        to: '0 0 0',
        dur: duration,
        easing: 'linear'
    });
}

// ============================================
// 1. MANETTES VR
// ============================================
AFRAME.registerComponent('vr-controller-grab', {
    init: function () {
        this.el.addEventListener('triggerdown', this.onGrab.bind(this));
        this.el.addEventListener('gripdown', this.onGrab.bind(this));
        this.el.addEventListener('triggerup', this.onRelease.bind(this));
        this.el.addEventListener('gripup', this.onRelease.bind(this));
    },

    onGrab: function () {
        // GESTE DE RETRAIT DU CASQUE
        if (window.oasisState.isInOasis) {
            this.checkRemoveGesture();
            return;
        }

        // GRAB CLASSIQUE
        const intersectedEls = this.el.components.raycaster.intersectedEls;
        if (intersectedEls.length > 0) {
            const hitEl = intersectedEls[0];
            if (hitEl.classList.contains('clickable')) {
                this.grabObject(hitEl);
            }
        }
    },

    checkRemoveGesture: function() {
        const camera = document.getElementById('player-camera');
        const handPos = new THREE.Vector3();
        const headPos = new THREE.Vector3();
        
        this.el.object3D.getWorldPosition(handPos);
        camera.object3D.getWorldPosition(headPos);
        
        // Si la main est à moins de 35cm de la tête
        if (handPos.distanceTo(headPos) < 0.35) {
            const headset = document.getElementById('oasis-headset');
            if (headset && headset.components['headset-toggle']) {
                headset.components['headset-toggle'].exitOasisSequence();
            }
        }
    },

    grabObject: function (el) {
        if (window.oasisState.grabbedObject === el) return;

        // Nettoyage des animations
        el.removeAttribute('animation__drop');
        el.removeAttribute('animation__rotate');
        el.removeAttribute('animation__puton'); 

        window.oasisState.grabbedObject = el;
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedHand = this.el; 
        
        // Attacher l'objet à la main
        this.el.object3D.attach(el.object3D);
        
        el.setAttribute('opacity', 0.8);
        el.emit('grab-start');
    },

    onRelease: function () {
        if (window.oasisState.grabbedObject) {
            const el = window.oasisState.grabbedObject;
            
            // Si l'animation de mise en place est en cours, on ne lâche pas
            if (el.classList.contains('putting-on')) return;

            this.el.sceneEl.object3D.attach(el.object3D);
            
            el.setAttribute('opacity', 1.0);
            window.oasisState.grabbedObject = null;
            window.oasisState.isGrabbing = false;
            window.oasisState.grabbedHand = null;
            
            if (!window.oasisState.isInOasis) {
                dropObject(el);
            }
            el.emit('grab-end');
        }
    }
});

// ============================================
// 2. LOGIQUE CASQUE (C'est ici que tu avais la faute de frappe)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        this.wearThreshold = 0.5; 
        this.camera = document.getElementById('player-camera');
        this.isLoading = false;
        this.isAnimatingOn = false;

        // CORRECTION ICI : addEventListener (sans 'q')
        this.el.addEventListener('click', () => {
             if (!window.oasisState.isInOasis && !this.isLoading) {
                 this.animateToFace(); 
             }
        });
    },

    tick: function() {
        if (window.oasisState.isInOasis || this.isLoading || this.isAnimatingOn) return;

        if (window.oasisState.grabbedObject === this.el) {
            const headsetPos = new THREE.Vector3();
            const cameraPos = new THREE.Vector3();
            this.el.object3D.getWorldPosition(headsetPos);
            this.camera.object3D.getWorldPosition(cameraPos);

            const distance = headsetPos.distanceTo(cameraPos);

            if (distance < this.wearThreshold) {
                this.animateToFace();
            }
        }
    },

    animateToFace: function() {
        this.isAnimatingOn = true;
        this.el.classList.add('putting-on');
        console.log("Mise en place du casque...");

        // On détache de la main pour lisser le mouvement vers la tête
        this.el.sceneEl.object3D.attach(this.el.object3D);
        window.oasisState.grabbedObject = null; 

        const camera = document.getElementById('player-camera');
        const targetPos = new THREE.Vector3();
        
        camera.object3D.getWorldPosition(targetPos);

        this.el.setAttribute('animation__puton', {
            property: 'position',
            to: `${targetPos.x} ${targetPos.y} ${targetPos.z}`,
            dur: 400, 
            easing: 'easeInQuad'
        });

        setTimeout(() => {
            this.startOasisTransition();
            this.el.classList.remove('putting-on');
            this.isAnimatingOn = false;
        }, 400);
    },

    startOasisTransition: function() {
        this.isLoading = true;
        this.el.setAttribute('visible', false); // Cache le cube physique
        
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        const vrLoadingScreen = document.getElementById('vr-loading-screen');
        const vrLoadingBar = document.getElementById('vr-loading-bar');
        const vrLoadingText = document.getElementById('vr-loading-text');

        if(loadingScreen) { loadingScreen.classList.add('active'); loadingScreen.style.display = 'flex'; }
        if(eclipseOverlay) { eclipseOverlay.classList.remove('opening'); eclipseOverlay.classList.add('closing'); }
        if(vrLoadingScreen) vrLoadingScreen.setAttribute('visible', true);

        setTimeout(() => {
            if(loadingContent) loadingContent.classList.add('visible');
            
            const messages = ["RETINAL SCAN...", "AUTHENTICATING...", "CONNECTING...", "LOADING WORLD...", "WELCOME"];
            let progress = 0;
            let messageIndex = 0;
            
            const interval = setInterval(() => {
                progress += 2;
                if(progress > 100) progress = 100;
                
                if(progressBar) progressBar.style.width = progress + '%';
                if(vrLoadingBar) vrLoadingBar.setAttribute('scale', `${progress/100} 1 1`);
                
                const newIndex = Math.floor((progress / 100) * (messages.length - 1));
                if(newIndex !== messageIndex) {
                    messageIndex = newIndex;
                    if(progressText) progressText.textContent = messages[messageIndex];
                    if(vrLoadingText) vrLoadingText.setAttribute('value', messages[messageIndex]);
                }

                if (progress >= 100) {
                    clearInterval(interval);
                    this.enterOasis();
                }
            }, 50);
        }, 1000);
    },

    enterOasis: function() {
        console.log('[OASIS] Entrée dans le monde VR...');
        window.oasisState.isInOasis = true;
        this.isLoading = false;
        
        const scene = document.querySelector('a-scene');
        const vrLoadingScreen = document.getElementById('vr-loading-screen');
        if(vrLoadingScreen) vrLoadingScreen.setAttribute('visible', false);

        // Cacher monde réel
        const objects = scene.querySelectorAll('a-entity:not(#rig):not(#vr-world):not(#player-camera), a-box:not(#oasis-headset), a-plane, a-cylinder');
        objects.forEach(obj => {
            if (!obj.closest('#vr-world') && obj.id !== 'vr-world') {
               obj.setAttribute('visible', false);
            }
        });
        
        // Afficher monde VR et corriger lumières
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
            this.fixVRLighting(vrWorld);
            
            vrWorld.querySelectorAll('*').forEach(child => {
                if(child.setAttribute) child.setAttribute('visible', true);
            });
        }

        // Ciel de fond (couleur sombre pour la nuit/soirée)
        scene.setAttribute('background', 'color: #2c1b18'); 
        scene.setAttribute('fog', 'type: exponential; color: #4a3b3b; density: 0.005');

        // Afficher les contours (Vignette)
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);

        // Fin UI
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        eclipseOverlay.classList.remove('closing'); eclipseOverlay.classList.add('opening');
        setTimeout(() => { loadingScreen.classList.remove('active'); loadingScreen.style.display = 'none'; }, 1000);
    },

    // --- SORTIE DE L'OASIS ---
    exitOasisSequence: function() {
        console.log("RETRAIT DU CASQUE...");
        
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        
        loadingScreen.classList.add('active'); loadingScreen.style.display = 'flex';
        eclipseOverlay.classList.remove('opening'); eclipseOverlay.classList.add('closing');

        setTimeout(() => {
            window.oasisState.isInOasis = false;
            
            // 1. Cacher VR
            const vrWorld = document.getElementById('vr-world');
            if(vrWorld) vrWorld.setAttribute('visible', false);
            
            // 2. Montrer Réel
            const scene = document.querySelector('a-scene');
            const objects = scene.querySelectorAll('a-entity, a-box, a-plane, a-cylinder');
            objects.forEach(obj => {
                if (!obj.closest('#vr-world') && obj.id !== 'vr-world' && obj.id !== 'vr-loading-screen') {
                    obj.setAttribute('visible', true);
                }
            });

            // 3. Remettre le casque physique
            this.el.setAttribute('visible', true);
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            this.el.setAttribute('rotation', '0 0 0');

            // 4. SUPPRIMER LES CONTOURS
            const vrOverlay = document.getElementById('vr-headset-overlay');
            const vrNose = document.getElementById('vr-headset-nose');
            const vrLensTint = document.getElementById('vr-headset-lens-tint');
            
            if(vrOverlay) vrOverlay.setAttribute('visible', false);
            if(vrNose) vrNose.setAttribute('visible', false);
            if(vrLensTint) vrLensTint.setAttribute('visible', false);

            // 5. Reset Ambiance
            scene.setAttribute('background', 'color: #a8aeb5');
            scene.setAttribute('fog', 'type: exponential; color: #8a9098; density: 0.012');

            // Ouvrir les yeux
            eclipseOverlay.classList.remove('closing'); eclipseOverlay.classList.add('opening');
            setTimeout(() => { loadingScreen.classList.remove('active'); loadingScreen.style.display = 'none'; }, 1000);

        }, 1500);
    },

    // --- CORRECTION LUMIÈRE & TEXTURES NOIRES ---
    fixVRLighting: function(vrWorldElement) {
        // 1. Lumière de secours : FAIBLE et CHAUDE
        let light = document.getElementById('global-vr-light');
        if (!light) {
            light = document.createElement('a-entity');
            light.setAttribute('id', 'global-vr-light');
            light.setAttribute('light', 'type: ambient; color: #ffaa77; intensity: 0.3'); 
            vrWorldElement.appendChild(light);
        }

        // 2. Correction matériaux noirs (Contournement du bug Specular Glossiness)
        vrWorldElement.object3D.traverse((node) => {
            if (node.isMesh) {
                if (node.material.metalness > 0.6) {
                    node.material.metalness = 0.2; 
                    node.material.roughness = 0.7; 
                }
                node.material.needsUpdate = true;
            }
        });
    }
});

// ============================================
// 3. DESKTOP SIMULATION (CLAVIER 'C')
// ============================================
AFRAME.registerComponent('virtual-hand', {
    schema: { grabKey: {default: 'c'}, holdDistance: {default: 0.5} },
    init: function() {
        this.camera = document.getElementById('player-camera');
        window.addEventListener('keydown', e => {
            if(e.key.toLowerCase() === this.data.grabKey && !window.oasisState.isGrabbing) this.tryGrab();
        });
        window.addEventListener('keyup', e => {
            if(e.key.toLowerCase() === this.data.grabKey && window.oasisState.isGrabbing) this.releaseGrab();
        });
    },
    tryGrab: function() {
        const els = document.querySelectorAll('.clickable');
        const camPos = new THREE.Vector3(); 
        const camDir = new THREE.Vector3();
        this.camera.object3D.getWorldPosition(camPos);
        this.camera.object3D.getWorldDirection(camDir);
        
        let target = null, minD = 3;
        els.forEach(el => {
            const elPos = new THREE.Vector3(); el.object3D.getWorldPosition(elPos);
            const d = camPos.distanceTo(elPos);
            const angle = camDir.angleTo(elPos.clone().sub(camPos).normalize());
            if(d < minD && angle < 0.5) { target = el; minD = d; }
        });
        if(target) {
            window.oasisState.isGrabbing = true; window.oasisState.grabbedObject = target;
            target.setAttribute('opacity', 0.8);
            target.removeAttribute('animation__drop'); target.removeAttribute('animation__rotate'); 
        }
    },
    releaseGrab: function() {
        if(!window.oasisState.grabbedObject) return;
        const el = window.oasisState.grabbedObject;
        el.setAttribute('opacity', 1.0);
        window.oasisState.isGrabbing = false; window.oasisState.grabbedObject = null;
        if(!window.oasisState.isInOasis) dropObject(el); 
    },
    tick: function() {
        if(window.oasisState.isGrabbing && window.oasisState.grabbedObject && !this.el.sceneEl.is('vr-mode')) {
            const el = window.oasisState.grabbedObject;
            const camPos = new THREE.Vector3(); const camDir = new THREE.Vector3();
            this.camera.object3D.getWorldPosition(camPos); this.camera.object3D.getWorldDirection(camDir);
            const target = camPos.add(camDir.multiplyScalar(this.data.holdDistance));
            el.object3D.position.lerp(target, 0.2);
        }
    }
});

// INIT
document.addEventListener('DOMContentLoaded', () => {
    const rig = document.getElementById('rig');
    if (rig && !rig.hasAttribute('virtual-hand')) rig.setAttribute('virtual-hand', '');
    
    // Fix texture manoir si présent
    AFRAME.registerComponent('fix-mansion-textures', {
        init: function() {
            this.el.addEventListener('model-loaded', () => {
                const mesh = this.el.getObject3D('mesh');
                if(!mesh) return;
                const tex = new THREE.TextureLoader().load('./models/low_poly_mansion/textures/Main_diffuse.png');
                tex.encoding = THREE.sRGBEncoding; tex.flipY = false;
                mesh.traverse(n => { if(n.isMesh) { n.material.map = tex; n.material.needsUpdate = true; } });
            });
        }
    });

    // Fix textures du casque (sRGB + matériaux)
    AFRAME.registerComponent('fix-headset-textures', {
        init: function() {
            this.el.addEventListener('model-loaded', () => {
                const mesh = this.el.getObject3D('mesh');
                if (!mesh) return;
                mesh.traverse(node => {
                    if (node.isMesh && node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(mat => {
                            if (mat.map) { mat.map.encoding = THREE.sRGBEncoding; mat.map.needsUpdate = true; }
                            if (mat.emissiveMap) { mat.emissiveMap.encoding = THREE.sRGBEncoding; mat.emissiveMap.needsUpdate = true; }
                            if (typeof mat.metalness === 'number' && mat.metalness > 0.6) { mat.metalness = 0.2; mat.roughness = 0.7; }
                            mat.needsUpdate = true;
                        });
                    }
                });
            });
        }
    });
});