// ============================================
// OASIS VR HEADSET SYSTEM - FIXED VERSION
// ============================================

window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedObject: null,
    // Sauvegarde pour restaurer si on lâche l'objet
    originalParent: null, 
    originalPosition: null,
    originalHeadsetPos: null
};

// ============================================
// 1. GESTION DE LA MAIN VIRTUELLE (CLAVIER 'C' - DESKTOP)
// ============================================
AFRAME.registerComponent('virtual-hand', {
    schema: {
        grabKey: { type: 'string', default: 'c' },
        holdDistance: { type: 'number', default: 0.6 } // Distance proche pour simuler le port
    },

    init: function() {
        this.camera = document.getElementById('player-camera');
        this.isGrabbing = false;
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    },

    onKeyDown: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey && !this.isGrabbing) {
            this.tryGrab();
        }
    },

    onKeyUp: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey && this.isGrabbing) {
            this.releaseGrab();
        }
    },

    tryGrab: function() {
        // Chercher les objets interactifs devant la caméra
        const clickables = document.querySelectorAll('.clickable');
        const cameraPos = new THREE.Vector3();
        const cameraDir = new THREE.Vector3();
        
        this.camera.object3D.getWorldPosition(cameraPos);
        this.camera.object3D.getWorldDirection(cameraDir);
        
        let closestEl = null;
        let minDist = 3.0; 

        clickables.forEach(el => {
            const elPos = new THREE.Vector3();
            el.object3D.getWorldPosition(elPos);
            const dist = cameraPos.distanceTo(elPos);
            const dirToObject = elPos.clone().sub(cameraPos).normalize();
            const angle = cameraDir.angleTo(dirToObject);

            // Si l'objet est proche et devant nous
            if (dist < minDist && angle < 0.5) { 
                closestEl = el;
                minDist = dist;
            }
        });

        if (closestEl) {
            this.startGrab(closestEl);
        }
    },

    startGrab: function(el) {
        this.isGrabbing = true;
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedObject = el;
        el.setAttribute('opacity', 0.8);
        el.emit('grab-start'); 
    },

    releaseGrab: function() {
        if (!window.oasisState.grabbedObject) return;
        const el = window.oasisState.grabbedObject;
        el.setAttribute('opacity', 1.0);
        
        // Si on n'est pas entré dans l'Oasis, on remet le casque à sa place
        if (!window.oasisState.isInOasis && el.id === 'oasis-headset') {
             setTimeout(() => {
                if(window.oasisState.originalHeadsetPos) {
                    el.setAttribute('position', window.oasisState.originalHeadsetPos);
                }
             }, 100);
        }

        this.isGrabbing = false;
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedObject = null;
        el.emit('grab-end');
    },

    tick: function() {
        // Met à jour la position de l'objet devant la caméra
        if (this.isGrabbing && window.oasisState.grabbedObject) {
            const el = window.oasisState.grabbedObject;
            const cameraPos = new THREE.Vector3();
            const cameraDir = new THREE.Vector3();
            this.camera.object3D.getWorldPosition(cameraPos);
            this.camera.object3D.getWorldDirection(cameraDir);

            // On place l'objet à 60cm devant les yeux (assez près pour déclencher le port)
            const targetPos = cameraPos.add(cameraDir.multiplyScalar(this.data.holdDistance));
            el.object3D.position.lerp(targetPos, 0.2);
        }
    }
});

// ============================================
// 2. GESTION DU GRAB MANETTES (VR HANDS)
// ============================================
AFRAME.registerComponent('vr-controller-grab', {
    init: function () {
        // Écoute les boutons Grip et Trigger
        this.el.addEventListener('triggerdown', this.onGrab.bind(this));
        this.el.addEventListener('gripdown', this.onGrab.bind(this));
        
        this.el.addEventListener('triggerup', this.onRelease.bind(this));
        this.el.addEventListener('gripup', this.onRelease.bind(this));
    },

    onGrab: function () {
        // Vérifie si le raycaster de la main touche quelque chose
        const intersectedEls = this.el.components.raycaster.intersectedEls;
        
        if (intersectedEls.length > 0) {
            const hitEl = intersectedEls[0];
            if (hitEl.classList.contains('clickable')) {
                this.grabObject(hitEl);
            }
        }
    },

    grabObject: function (el) {
        if (window.oasisState.grabbedObject === el) return;

        console.log("VR GRAB: Object grabbed");
        window.oasisState.grabbedObject = el;
        
        // Sauvegarde état initial
        window.oasisState.originalParent = el.object3D.parent;
        window.oasisState.originalPosition = el.object3D.position.clone();

        // **MAGIE : On attache l'objet à la main (Parenting)**
        // L'objet devient un "enfant" de la main et suit tous ses mouvements
        this.el.object3D.attach(el.object3D);
        
        el.setAttribute('opacity', 0.8);
    },

    onRelease: function () {
        if (window.oasisState.grabbedObject) {
            console.log("VR GRAB: Object released");
            const el = window.oasisState.grabbedObject;
            
            // On rattache l'objet à la scène
            this.el.sceneEl.object3D.attach(el.object3D);
            
            el.setAttribute('opacity', 1.0);
            window.oasisState.grabbedObject = null;
            
            // Si on lache le casque et qu'on est pas dans l'Oasis, il retourne à sa place
            // (Optionnel, tu peux aussi laisser la physique faire si tu en as)
             if (!window.oasisState.isInOasis && el.id === 'oasis-headset') {
                 if(window.oasisState.originalHeadsetPos) {
                    el.setAttribute('position', window.oasisState.originalHeadsetPos);
                 }
            }
        }
    }
});


// ============================================
// 3. LOGIQUE DU CASQUE (HEADSET TOGGLE & LOAD)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        this.wearThreshold = 0.5; // 50cm du visage = on met le casque
        this.camera = document.getElementById('player-camera');
        this.isLoading = false;

        // Clic souris direct pour debug ou desktop rapide
        this.el.addEventListener('click', () => {
             if (!window.oasisState.isInOasis && !this.isLoading) {
                 this.triggerLoadingSequence();
             }
        });
    },

    tick: function() {
        if (window.oasisState.isInOasis || this.isLoading) return;

        // On vérifie la distance SEULEMENT si l'objet est attrapé
        if (window.oasisState.grabbedObject === this.el) {
            
            const headsetPos = new THREE.Vector3();
            const cameraPos = new THREE.Vector3();
            this.el.object3D.getWorldPosition(headsetPos);
            this.camera.object3D.getWorldPosition(cameraPos);

            const distance = headsetPos.distanceTo(cameraPos);

            // Si le casque est proche de la tête
            if (distance < this.wearThreshold) {
                this.triggerLoadingSequence();
            }
        }
    },

    triggerLoadingSequence: function() {
        console.log("HEADSET DETECTED ON HEAD -> LOADING");
        this.isLoading = true;
        
        // Cacher le casque 3D physique
        this.el.setAttribute('visible', false);
        
        // Lancer l'UI de chargement
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const overlay = document.getElementById('eclipse-overlay');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        loadingScreen.classList.add('active'); 
        overlay.classList.remove('opening');
        overlay.classList.add('closing'); // Effet fermeture iris

        // Simulation progression
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            if(progressBar) progressBar.style.width = progress + '%';
            
            if(progressText) {
                if(progress < 30) progressText.innerText = "RETINAL SCAN...";
                else if(progress < 60) progressText.innerText = "LOGGING INTO OASIS SERVERS...";
                else if(progress < 90) progressText.innerText = "LOADING AVATAR...";
                else progressText.innerText = "WELCOME, PARZIVAL";
            }

            if (progress >= 100) {
                clearInterval(interval);
                this.enterOasis();
            }
        }, 50);
    },

    enterOasis: function() {
        window.oasisState.isInOasis = true;
        this.isLoading = false;

        // 1. Cacher le monde réel (tout sauf le Rig et le monde VR)
        const scene = document.querySelector('a-scene');
        const objects = scene.querySelectorAll('a-entity:not(#rig):not(#vr-world):not(#player-camera), a-box:not(#oasis-headset), a-plane, a-cylinder');
        
        objects.forEach(obj => {
            if (!obj.closest('#vr-world') && obj.id !== 'vr-world') {
               obj.setAttribute('visible', false);
            }
        });
        
        // 2. Afficher le monde VR
        const vrWorld = document.getElementById('vr-world');
        if(vrWorld) vrWorld.setAttribute('visible', true);

        // 3. Ambiance
        scene.setAttribute('background', 'color: #FFB88C'); 
        scene.setAttribute('fog', 'type: exponential; color: #FFD4B8; density: 0.005');

        // 4. Activer le HUD du casque (Vignette)
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);

        // 5. Fin chargement
        const overlay = document.getElementById('eclipse-overlay');
        const loadingScreen = document.getElementById('oasis-loading-screen');
        
        overlay.classList.remove('closing');
        overlay.classList.add('opening'); 

        setTimeout(() => {
            loadingScreen.classList.remove('active');
            const hud = document.getElementById('remove-headset-hud');
            if(hud) hud.classList.add('visible');
        }, 1000);

        // Touche R pour sortir
        window.addEventListener('keydown', (e) => {
            if(e.key.toLowerCase() === 'r' && window.oasisState.isInOasis) {
                location.reload(); 
            }
        });
    }
});