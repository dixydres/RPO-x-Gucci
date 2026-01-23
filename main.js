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

// ============================================
// LUMIÈRES VACILLANTES - Effet oppressant
// ============================================
AFRAME.registerComponent('flicker-light', {
    schema: {
        intensity: { type: 'number', default: 1 },
        color: { type: 'color', default: '#ff6633' },
        speed: { type: 'number', default: 2 }
    },
    init: function() {
        this.light = this.el.querySelector('[light]');
        this.baseIntensity = this.data.intensity;
        this.time = Math.random() * 100; // Décalage aléatoire
    },
    tick: function(time, delta) {
        if (!this.light) return;
        this.time += delta * 0.001 * this.data.speed;
        
        // Effet de vacillement réaliste
        const flicker = Math.sin(this.time * 10) * 0.1 + 
                       Math.sin(this.time * 23) * 0.05 + 
                       Math.sin(this.time * 47) * 0.03 +
                       Math.random() * 0.08;
        
        const newIntensity = this.baseIntensity * (0.85 + flicker);
        this.light.setAttribute('light', 'intensity', Math.max(0.1, newIntensity));
    }
});

// ============================================
// ANIMATION PARTICULES DE POUSSIÈRE
// ============================================
AFRAME.registerComponent('dust-float', {
    schema: {
        speed: { type: 'number', default: 0.5 },
        range: { type: 'number', default: 0.3 }
    },
    init: function() {
        this.originalPos = this.el.getAttribute('position');
        this.offset = Math.random() * Math.PI * 2;
    },
    tick: function(time) {
        if (!this.originalPos) return;
        const t = time * 0.001 * this.data.speed + this.offset;
        const newY = this.originalPos.y + Math.sin(t) * this.data.range;
        const newX = this.originalPos.x + Math.sin(t * 0.7) * this.data.range * 0.5;
        this.el.setAttribute('position', {
            x: newX,
            y: newY,
            z: this.originalPos.z + Math.cos(t * 0.5) * this.data.range * 0.3
        });
    }
});

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
        this.wearThreshold = 0.18;  // Distance réduite à 18cm pour activation plus proche
        this.camera = document.getElementById('player-camera');
        this.isLoading = false;
        this.isAnimatingOn = false;

        // Clic pour activer le casque
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

        // Ciel de fond - Magnifique coucher de soleil OASIS
        scene.setAttribute('background', 'color: #1a0a1e'); 
        scene.setAttribute('fog', 'type: exponential; color: #FF6B35; density: 0.008');
        
        // Créer un dégradé de coucher de soleil dynamique
        this.createSunsetSky();

        // Afficher les contours (Vignette)
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        const playerHud = document.getElementById('player-hud');
        
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);
        if (playerHud) playerHud.setAttribute('visible', true);

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
            const playerHud = document.getElementById('player-hud');
            
            if(vrOverlay) vrOverlay.setAttribute('visible', false);
            if(vrNose) vrNose.setAttribute('visible', false);
            if(vrLensTint) vrLensTint.setAttribute('visible', false);
            if(playerHud) playerHud.setAttribute('visible', false);
            
            // 4b. Supprimer le ciel sunset
            this.removeSunsetSky();

            // 5. Reset Ambiance - NUIT OPPRESSANTE dans les Stacks
            scene.setAttribute('background', 'color: #020204');
            scene.setAttribute('fog', 'type: exponential; color: #030305; density: 0.055');

            // Ouvrir les yeux
            eclipseOverlay.classList.remove('closing'); eclipseOverlay.classList.add('opening');
            setTimeout(() => { loadingScreen.classList.remove('active'); loadingScreen.style.display = 'none'; }, 1000);

        }, 1500);
    },

    // --- CORRECTION LUMIÈRE & TEXTURES NOIRES ---
    fixVRLighting: function(vrWorldElement) {
        // 1. Lumière de secours : FAIBLE et CHAUDE (coucher de soleil)
        let light = document.getElementById('global-vr-light');
        if (!light) {
            light = document.createElement('a-entity');
            light.setAttribute('id', 'global-vr-light');
            light.setAttribute('light', 'type: ambient; color: #FF8C42; intensity: 0.4'); 
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
    },

    // --- CRÉATION DU CIEL COUCHER DE SOLEIL OASIS ---
    createSunsetSky: function() {
        const scene = document.querySelector('a-scene');
        const vrWorld = document.getElementById('vr-world');
        if (!vrWorld || !scene) return;
        
        // Supprimer l'ancien ciel s'il existe
        const oldSky = document.getElementById('oasis-sunset-sky');
        if (oldSky) oldSky.remove();
        
        // Créer un magnifique ciel de coucher de soleil
        const sunsetSky = document.createElement('a-entity');
        sunsetSky.setAttribute('id', 'oasis-sunset-sky');
        sunsetSky.setAttribute('position', '0 0 0');
        
        // Dôme du ciel avec dégradé de coucher de soleil
        sunsetSky.innerHTML = `
            <!-- Couche horizon orange/rose -->
            <a-cylinder position="0 -50 0" radius="300" height="100" open-ended="true" 
                material="color: #FF6B35; opacity: 0.6; transparent: true; shader: flat; side: back">
            </a-cylinder>
            
            <!-- Couche intermédiaire rose/violet -->
            <a-cylinder position="0 0 0" radius="295" height="150" open-ended="true" 
                material="color: #C73E6D; opacity: 0.4; transparent: true; shader: flat; side: back">
            </a-cylinder>
            
            <!-- Couche haute violet/bleu -->
            <a-cylinder position="0 60 0" radius="290" height="120" open-ended="true" 
                material="color: #6B2D5C; opacity: 0.5; transparent: true; shader: flat; side: back">
            </a-cylinder>
            
            <!-- Soleil couchant amélioré -->
            <a-entity id="sunset-sun-enhanced" position="0 15 -150">
                <!-- Halo externe -->
                <a-sphere radius="25" 
                    material="color: #FF4500; opacity: 0.2; transparent: true; shader: flat"></a-sphere>
                <!-- Halo moyen -->
                <a-sphere radius="15" 
                    material="color: #FF6347; opacity: 0.4; transparent: true; shader: flat"></a-sphere>
                <!-- Soleil principal -->
                <a-sphere radius="8" 
                    material="color: #FFD700; emissive: #FF8C00; emissiveIntensity: 2; shader: flat"></a-sphere>
                <!-- Lumière du soleil -->
                <a-entity light="type: point; color: #FF8C42; intensity: 4; distance: 200; decay: 1"></a-entity>
            </a-entity>
            
            <!-- Nuages de coucher de soleil -->
            <a-entity id="sunset-clouds">
                <!-- Nuages orangés près de l'horizon -->
                <a-sphere position="-80 10 -120" radius="15" scale="3 0.5 1.5"
                    material="color: #FF7F50; opacity: 0.7; transparent: true"></a-sphere>
                <a-sphere position="60 12 -130" radius="18" scale="3.5 0.6 1.8"
                    material="color: #FF6347; opacity: 0.65; transparent: true"></a-sphere>
                <a-sphere position="-40 8 -140" radius="12" scale="2.5 0.4 1.2"
                    material="color: #FFB347; opacity: 0.75; transparent: true"></a-sphere>
                <a-sphere position="100 15 -110" radius="20" scale="4 0.7 2"
                    material="color: #E9967A; opacity: 0.6; transparent: true"></a-sphere>
                <a-sphere position="-120 18 -100" radius="22" scale="3.8 0.5 1.6"
                    material="color: #CD5C5C; opacity: 0.55; transparent: true"></a-sphere>
                
                <!-- Nuages violets plus hauts -->
                <a-sphere position="30 45 -90" radius="25" scale="4 0.8 2"
                    material="color: #9370DB; opacity: 0.4; transparent: true"></a-sphere>
                <a-sphere position="-60 50 -85" radius="20" scale="3.5 0.6 1.5"
                    material="color: #8A2BE2; opacity: 0.35; transparent: true"></a-sphere>
            </a-entity>
            
            <!-- Premières étoiles visibles -->
            <a-entity id="early-stars">
                <a-sphere position="50 80 -60" radius="0.3" material="color: #FFFFFF; emissive: #FFFFFF; shader: flat"></a-sphere>
                <a-sphere position="-70 90 -50" radius="0.25" material="color: #FFFACD; emissive: #FFFACD; shader: flat"></a-sphere>
                <a-sphere position="80 100 -40" radius="0.35" material="color: #FFFFFF; emissive: #FFFFFF; shader: flat"></a-sphere>
                <a-sphere position="-30 95 -70" radius="0.2" material="color: #F0E68C; emissive: #F0E68C; shader: flat"></a-sphere>
                <a-sphere position="20 110 -55" radius="0.28" material="color: #FFFFFF; emissive: #FFFFFF; shader: flat"></a-sphere>
                <a-sphere position="-90 85 -45" radius="0.32" material="color: #FFE4B5; emissive: #FFE4B5; shader: flat"></a-sphere>
            </a-entity>
        `;
        
        vrWorld.appendChild(sunsetSky);
    },
    
    // --- SUPPRESSION DU CIEL COUCHER DE SOLEIL ---
    removeSunsetSky: function() {
        const sunsetSky = document.getElementById('oasis-sunset-sky');
        if (sunsetSky) sunsetSky.remove();
    }
});

// ============================================
// 3. DESKTOP SIMULATION (CLAVIER 'C' pour grab)
// Pour sortir de l'OASIS: utilisez le geste de retrait en VR (main près de la tête)
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