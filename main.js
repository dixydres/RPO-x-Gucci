// ============================================
// OASIS VR SYSTEM - FINAL FLUID & LIGHTING FIX
// ============================================

window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedObject: null,
    grabbedHand: null, // 'left' ou 'right' ou null
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
    // Zone approximative du bureau
    const isOverTable = (worldPos.x > 0.2 && worldPos.x < 1.4 && worldPos.z > -1.4 && worldPos.z < -0.4);
    const targetY = isOverTable ? tableHeight : floorHeight;

    if (worldPos.y <= targetY) return;

    const distance = worldPos.y - targetY;
    const duration = Math.sqrt(distance / 9.8) * 1000 * 1.5; // Vitesse ajustée

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
// 1. MANETTES VR (GRAB + REMOVE GESTURE)
// ============================================
AFRAME.registerComponent('vr-controller-grab', {
    init: function () {
        this.el.addEventListener('triggerdown', this.onGrab.bind(this));
        this.el.addEventListener('gripdown', this.onGrab.bind(this));
        this.el.addEventListener('triggerup', this.onRelease.bind(this));
        this.el.addEventListener('gripup', this.onRelease.bind(this));
        
        // Pour savoir quelle main c'est (left/right)
        this.handSide = this.el.getAttribute('hand-controls') ? this.el.getAttribute('hand-controls').hand : 'unknown';
    },

    onGrab: function () {
        // SCÉNARIO 1 : Je suis dans l'OASIS et je veux l'enlever
        if (window.oasisState.isInOasis) {
            this.checkRemoveGesture();
            return;
        }

        // SCÉNARIO 2 : Je veux attraper le casque (Monde réel)
        const intersectedEls = this.el.components.raycaster.intersectedEls;
        if (intersectedEls.length > 0) {
            const hitEl = intersectedEls[0];
            if (hitEl.classList.contains('clickable')) {
                this.grabObject(hitEl);
            }
        }
    },

    checkRemoveGesture: function() {
        // Si la main est proche de la tête (< 30cm) et qu'on appuie sur le bouton
        const camera = document.getElementById('player-camera');
        const handPos = new THREE.Vector3();
        const headPos = new THREE.Vector3();
        
        this.el.object3D.getWorldPosition(handPos);
        camera.object3D.getWorldPosition(headPos);
        
        if (handPos.distanceTo(headPos) < 0.35) {
            // On déclenche la sortie !
            const headset = document.getElementById('oasis-headset');
            if (headset && headset.components['headset-toggle']) {
                headset.components['headset-toggle'].exitOasisSequence();
            }
        }
    },

    grabObject: function (el) {
        if (window.oasisState.grabbedObject === el) return;

        // Stop animations
        el.removeAttribute('animation__drop');
        el.removeAttribute('animation__rotate');
        // Stop animation de mise en place si elle était en cours
        el.removeAttribute('animation__puton'); 

        window.oasisState.grabbedObject = el;
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedHand = this.el; // On sauvegarde quelle main tient l'objet
        
        window.oasisState.originalParent = el.object3D.parent;
        window.oasisState.originalPosition = el.object3D.position.clone();

        this.el.object3D.attach(el.object3D);
        el.setAttribute('opacity', 0.8);
        el.emit('grab-start');
    },

    onRelease: function () {
        if (window.oasisState.grabbedObject) {
            const el = window.oasisState.grabbedObject;
            
            // Si on est en train de le mettre (animation en cours), on ne le lâche pas vraiment
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
// 2. LOGIQUE CASQUE (ANIMATION & CHARGEMENT)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        this.wearThreshold = 0.5; // Distance activation
        this.camera = document.getElementById('player-camera');
        this.isLoading = false;
        this.isAnimatingOn = false;

        // PC Click
        this.el.addEventListener('click', () => {
             if (!window.oasisState.isInOasis && !this.isLoading) {
                 this.animateToFace(); // On lance l'animation même sur PC
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

            // Si proche, on lance l'animation d'aspiration (Snap)
            if (distance < this.wearThreshold) {
                this.animateToFace();
            }
        }
    },

    // --- ANIMATION FLUIDE DE MISE EN PLACE ---
    animateToFace: function() {
        this.isAnimatingOn = true;
        this.el.classList.add('putting-on'); // Empêche de le lâcher accidentellement
        console.log("SNAP! Headset attracting to face...");

        // Détacher de la main pour le lisser vers la caméra
        this.el.sceneEl.object3D.attach(this.el.object3D);
        window.oasisState.grabbedObject = null; // On libère la logique de grab

        // Calculer position cible (exactement sur les yeux)
        const camera = document.getElementById('player-camera');
        const targetPos = new THREE.Vector3();
        const targetRot = new THREE.Quaternion();
        
        // On veut qu'il finisse un peu devant les yeux (0, 0, -0.1) relative à la caméra
        // Mais pour l'animation world, on vise la caméra
        camera.object3D.getWorldPosition(targetPos);
        camera.object3D.getWorldQuaternion(targetRot);

        // Animation A-Frame
        this.el.setAttribute('animation__puton', {
            property: 'position',
            to: `${targetPos.x} ${targetPos.y} ${targetPos.z}`,
            dur: 400, // 400ms d'animation rapide
            easing: 'easeInQuad'
        });

        // À la fin de l'animation
        setTimeout(() => {
            this.startOasisTransition();
            this.el.classList.remove('putting-on');
            this.isAnimatingOn = false;
        }, 400);
    },

    startOasisTransition: function() {
        this.isLoading = true;
        this.el.setAttribute('visible', false); // POUF disparu (il est sur la tête)
        
        // Gérer les écrans
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        // Mode VR (Écran 3D)
        const vrLoadingScreen = document.getElementById('vr-loading-screen');
        const vrLoadingBar = document.getElementById('vr-loading-bar');
        const vrLoadingText = document.getElementById('vr-loading-text');

        if(loadingScreen) { loadingScreen.classList.add('active'); loadingScreen.style.display = 'flex'; }
        if(eclipseOverlay) { eclipseOverlay.classList.remove('opening'); eclipseOverlay.classList.add('closing'); }
        if(vrLoadingScreen) vrLoadingScreen.setAttribute('visible', true);

        // Déroulement chargement
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
        console.log('[OASIS] Entering...');
        window.oasisState.isInOasis = true;
        this.isLoading = false;
        
        const scene = document.querySelector('a-scene');
        const vrLoadingScreen = document.getElementById('vr-loading-screen');
        if(vrLoadingScreen) vrLoadingScreen.setAttribute('visible', false);

        // 1. Cacher le monde réel
        const objects = scene.querySelectorAll('a-entity:not(#rig):not(#vr-world):not(#player-camera), a-box:not(#oasis-headset), a-plane, a-cylinder');
        objects.forEach(obj => {
            if (!obj.closest('#vr-world') && obj.id !== 'vr-world') {
               obj.setAttribute('visible', false);
            }
        });
        
        // 2. Afficher et FIXER le monde VR (Lumières)
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
            this.fixVRLighting(vrWorld); // <--- LE SAUVETEUR DE LUMIÈRE
            
            // Force visibilité enfants
            vrWorld.querySelectorAll('*').forEach(child => {
                if(child.setAttribute) child.setAttribute('visible', true);
            });
        }

        // 3. Ambiance
        scene.setAttribute('background', 'color: #87CEEB'); // Ciel bleu clair (plus lumineux que le coucher de soleil)
        scene.setAttribute('fog', 'type: exponential; color: #FFFFFF; density: 0.002'); // Brouillard blanc léger

        // 4. Masque VR
        const vrOverlay = document.getElementById('vr-headset-overlay');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);

        // 5. Nettoyer UI
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        eclipseOverlay.classList.remove('closing'); eclipseOverlay.classList.add('opening');
        setTimeout(() => { loadingScreen.classList.remove('active'); loadingScreen.style.display = 'none'; }, 1000);
    },

    // --- NOUVELLE FONCTION POUR SORTIR ---
    exitOasisSequence: function() {
        console.log("REMOVING HEADSET...");
        // Même logique inverse : Écran noir -> Retour caravane
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        
        loadingScreen.classList.add('active'); loadingScreen.style.display = 'flex';
        eclipseOverlay.classList.remove('opening'); eclipseOverlay.classList.add('closing');

        setTimeout(() => {
            window.oasisState.isInOasis = false;
            // 1. Cacher VR, Montrer Réel
            const vrWorld = document.getElementById('vr-world');
            if(vrWorld) vrWorld.setAttribute('visible', false);
            
            const scene = document.querySelector('a-scene');
            const objects = scene.querySelectorAll('a-entity, a-box, a-plane, a-cylinder');
            objects.forEach(obj => {
                // Réafficher tout ce qui n'est pas VR
                if (!obj.closest('#vr-world') && obj.id !== 'vr-world' && obj.id !== 'vr-loading-screen') {
                    obj.setAttribute('visible', true);
                }
            });

            // 2. Remettre le casque sur la table (ou par terre)
            this.el.setAttribute('visible', true);
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            this.el.setAttribute('rotation', '0 0 0');

            // 3. Masque VR off
            const vrOverlay = document.getElementById('vr-headset-overlay');
            if(vrOverlay) vrOverlay.setAttribute('visible', false);

            // 4. Reset Ambiance
            scene.setAttribute('background', 'color: #a8aeb5');
            scene.setAttribute('fog', 'type: exponential; color: #8a9098; density: 0.012');

            // Ouvrir les yeux
            eclipseOverlay.classList.remove('closing'); eclipseOverlay.classList.add('opening');
            setTimeout(() => { loadingScreen.classList.remove('active'); loadingScreen.style.display = 'none'; }, 1000);

        }, 1500);
    },

    // --- LE SAUVETEUR DE LUMIÈRE ---
    fixVRLighting: function(vrWorldElement) {
        // 1. Ajouter une lumière ambiante globale FORTE si elle n'existe pas
        let light = document.getElementById('global-vr-light');
        if (!light) {
            light = document.createElement('a-entity');
            light.setAttribute('id', 'global-vr-light');
            light.setAttribute('light', 'type: ambient; color: #ffffff; intensity: 1.2'); // Lumière blanche forte
            vrWorldElement.appendChild(light);
            console.log("Lumière de secours ajoutée !");
        }

        // 2. Parcourir tous les objets 3D pour corriger les matériaux noirs
        vrWorldElement.object3D.traverse((node) => {
            if (node.isMesh) {
                // Si le matériau est métallique mais sans envMap, il apparaît noir
                if (node.material.metalness > 0.5) {
                    node.material.metalness = 0.1; // On réduit le métal pour qu'il prenne la lumière
                    node.material.roughness = 0.8; // On augmente la rugosité
                }
                // S'assurer que la texture n'est pas trop sombre
                if (node.material.emissive) {
                    // Optionnel : ajouter une petite émission pour qu'il brille un peu dans le noir
                    // node.material.emissive.setHex(0x222222); 
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
            target.removeAttribute('animation__drop'); target.removeAttribute('animation__rotate'); // Stop drop
        }
    },
    releaseGrab: function() {
        if(!window.oasisState.grabbedObject) return;
        const el = window.oasisState.grabbedObject;
        el.setAttribute('opacity', 1.0);
        window.oasisState.isGrabbing = false; window.oasisState.grabbedObject = null;
        if(!window.oasisState.isInOasis) dropObject(el); // Chute
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
});