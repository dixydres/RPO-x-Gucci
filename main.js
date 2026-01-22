// ============================================
// OASIS VR SYSTEM - GRAVITY & LOADING EDITION
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

// --- FONCTION UTILITAIRE : SIMULATION DE GRAVITÉ ---
function dropObject(el) {
    // Récupérer la position mondiale actuelle de l'objet
    const worldPos = new THREE.Vector3();
    el.object3D.getWorldPosition(worldPos);

    // Définir la hauteur du sol et de la table
    const floorHeight = 0.15; // Un peu au-dessus du vrai sol
    const tableHeight = 0.82; // Hauteur de ton bureau
    
    // Définir la zone de la table (coordonnées approximatives basées sur ta scène)
    // Le bureau est environ à x=0.8, z=-1
    const isOverTable = (worldPos.x > 0.2 && worldPos.x < 1.4 && worldPos.z > -1.4 && worldPos.z < -0.4);

    // Quelle est la cible de chute ?
    const targetY = isOverTable ? tableHeight : floorHeight;

    // Si l'objet est déjà plus bas que la cible, on ne fait rien
    if (worldPos.y <= targetY) return;

    // Calculer la durée de la chute (plus c'est haut, plus c'est long)
    const distance = worldPos.y - targetY;
    const duration = Math.sqrt(distance / 9.8) * 1000 * 2; // Formule physique simplifiée (t = sqrt(2d/g))

    // Animation de chute avec rebond (easeOutBounce)
    el.removeAttribute('animation__drop'); // Nettoyer ancienne anim
    el.setAttribute('animation__drop', {
        property: 'position',
        to: `${worldPos.x} ${targetY} ${worldPos.z}`,
        dur: duration,
        easing: 'easeOutBounce' // Effet de rebond réaliste
    });
    
    // Reset de la rotation pour qu'il retombe "à plat" (optionnel, plus propre)
    el.setAttribute('animation__rotate', {
        property: 'rotation',
        to: '0 0 0',
        dur: duration,
        easing: 'linear'
    });
}

// ============================================
// 1. GESTION DES MANETTES VR
// ============================================
AFRAME.registerComponent('vr-controller-grab', {
    init: function () {
        this.el.addEventListener('triggerdown', this.onGrab.bind(this));
        this.el.addEventListener('gripdown', this.onGrab.bind(this));
        this.el.addEventListener('triggerup', this.onRelease.bind(this));
        this.el.addEventListener('gripup', this.onRelease.bind(this));
    },

    onGrab: function () {
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

        // Arrêter toute animation de chute en cours si on l'attrape au vol
        el.removeAttribute('animation__drop');
        el.removeAttribute('animation__rotate');

        window.oasisState.grabbedObject = el;
        window.oasisState.isGrabbing = true;
        
        // Sauvegarde état
        window.oasisState.originalParent = el.object3D.parent;
        window.oasisState.originalPosition = el.object3D.position.clone();

        // ATTACHEMENT PHYSIQUE (Parenting)
        this.el.object3D.attach(el.object3D);
        
        el.setAttribute('opacity', 0.8);
        el.emit('grab-start');
    },

    onRelease: function () {
        if (window.oasisState.grabbedObject) {
            const el = window.oasisState.grabbedObject;
            
            // Détachement : on remet l'objet dans la scène
            this.el.sceneEl.object3D.attach(el.object3D);
            
            el.setAttribute('opacity', 1.0);
            window.oasisState.grabbedObject = null;
            window.oasisState.isGrabbing = false;
            
            // MODIFICATION ICI : Au lieu de le remettre à sa place, on le fait tomber
            if (!window.oasisState.isInOasis) {
                dropObject(el);
            }
            
            el.emit('grab-end');
        }
    }
});

// ============================================
// 2. GESTION CLAVIER (DESKTOP)
// ============================================
AFRAME.registerComponent('virtual-hand', {
    schema: {
        grabKey: { type: 'string', default: 'c' },
        holdDistance: { type: 'number', default: 0.5 } 
    },

    init: function() {
        this.camera = document.getElementById('player-camera');
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    },

    onKeyDown: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey && !window.oasisState.isGrabbing) {
            this.tryGrab();
        }
    },

    onKeyUp: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey && window.oasisState.isGrabbing) {
            this.releaseGrab();
        }
    },

    tryGrab: function() {
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

            if (dist < minDist && angle < 0.6) { 
                closestEl = el;
                minDist = dist;
            }
        });

        if (closestEl) {
            this.startGrab(closestEl);
        }
    },

    startGrab: function(el) {
        // Stop drop animation
        el.removeAttribute('animation__drop');
        el.removeAttribute('animation__rotate');

        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedObject = el;
        el.setAttribute('opacity', 0.8);
    },

    releaseGrab: function() {
        if (!window.oasisState.grabbedObject) return;
        const el = window.oasisState.grabbedObject;
        el.setAttribute('opacity', 1.0);
        
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedObject = null;

        // MODIFICATION ICI : Gravité
        if (!window.oasisState.isInOasis) {
            dropObject(el);
        }
    },

    tick: function() {
        if (window.oasisState.isGrabbing && window.oasisState.grabbedObject && !this.el.sceneEl.is('vr-mode')) {
            const el = window.oasisState.grabbedObject;
            const cameraPos = new THREE.Vector3();
            const cameraDir = new THREE.Vector3();
            this.camera.object3D.getWorldPosition(cameraPos);
            this.camera.object3D.getWorldDirection(cameraDir);

            const targetPos = cameraPos.add(cameraDir.multiplyScalar(this.data.holdDistance));
            el.object3D.position.lerp(targetPos, 0.2);
        }
    }
});

// ============================================
// 3. LOGIQUE DU CASQUE (HEADSET TOGGLE)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        // J'ai augmenté la distance à 0.6 pour que ce soit plus facile à déclencher
        this.wearThreshold = 0.6; 
        this.camera = document.getElementById('player-camera');
        this.isLoading = false;

        // Clic direct (PC souris)
        this.el.addEventListener('click', () => {
             if (!window.oasisState.isInOasis && !this.isLoading) {
                 this.startOasisTransition();
             }
        });
    },

    tick: function() {
        if (window.oasisState.isInOasis || this.isLoading) return;

        // Si l'objet est tenu
        if (window.oasisState.grabbedObject === this.el) {
            const headsetPos = new THREE.Vector3();
            const cameraPos = new THREE.Vector3();
            this.el.object3D.getWorldPosition(headsetPos);
            this.camera.object3D.getWorldPosition(cameraPos);

            const distance = headsetPos.distanceTo(cameraPos);

            // Si le casque est proche de la tête
            if (distance < this.wearThreshold) {
                // On lâche l'objet virtuellement pour qu'il disparaisse
                if(window.oasisState.grabbedObject) {
                    window.oasisState.grabbedObject.setAttribute('visible', false);
                    window.oasisState.grabbedObject = null;
                    window.oasisState.isGrabbing = false;
                }
                this.startOasisTransition();
            }
        }
    },

    startOasisTransition: function() {
        console.log("CHARGEMENT OASIS...");
        this.isLoading = true;
        this.el.setAttribute('visible', false);
        
        // Récupérer les éléments HTML de l'écran de chargement
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        // Activer l'écran
        loadingScreen.classList.add('active'); // CSS display:flex
        loadingScreen.style.display = 'flex'; // Sécurité
        
        // Animation iris qui se ferme
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        // Déroulement du chargement
        setTimeout(() => {
            if(loadingContent) loadingContent.classList.add('visible');
            
            const messages = [
                "RETINAL SCAN...",
                "AUTHENTICATION: WADE WATTS",
                "CONNECTING TO OASIS...",
                "LOADING: SECTOR 7G",
                "SYNCING HAPTICS...",
                "WELCOME PARZIVAL"
            ];
            
            let progress = 0;
            let messageIndex = 0;
            
            const progressInterval = setInterval(() => {
                progress += Math.random() * 4 + 1; // Vitesse variable
                if (progress > 100) progress = 100;
                
                if(progressBar) progressBar.style.width = progress + '%';
                
                const newIndex = Math.min(Math.floor(progress / 18), messages.length - 1);
                if (newIndex !== messageIndex && progressText) {
                    messageIndex = newIndex;
                    progressText.textContent = messages[messageIndex];
                }
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    this.enterOasis();
                }
            }, 80); // Vitesse de mise à jour
        }, 1000);
    },

    enterOasis: function() {
        window.oasisState.isInOasis = true;
        this.isLoading = false;
        
        const scene = document.querySelector('a-scene');
        
        // 1. Cacher le monde réel (Caravane)
        // On cache tout sauf ce qui est nécessaire pour l'Oasis
        const objects = scene.querySelectorAll('a-entity:not(#rig):not(#vr-world):not(#player-camera), a-box:not(#oasis-headset), a-plane, a-cylinder');
        objects.forEach(obj => {
            if (!obj.closest('#vr-world') && obj.id !== 'vr-world') {
               obj.setAttribute('visible', false);
            }
        });
        
        // 2. Afficher le monde VR (Jardin)
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
            // Force la visibilité des enfants
            vrWorld.querySelectorAll('*').forEach(child => {
                if (child.setAttribute) child.setAttribute('visible', true);
            });
        }

        // 3. Changer l'ambiance (Ciel, Brouillard)
        scene.setAttribute('background', 'color: #FFB88C');
        scene.setAttribute('fog', 'type: exponential; color: #FFD4B8; density: 0.005');

        // 4. Activer le masque VR (HUD)
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);

        // 5. Retirer l'écran de chargement
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        
        eclipseOverlay.classList.remove('closing');
        eclipseOverlay.classList.add('opening'); // Iris s'ouvre
        
        setTimeout(() => {
            loadingScreen.classList.remove('active');
            loadingScreen.style.display = 'none';
            // Afficher l'aide pour sortir
            const hud = document.getElementById('remove-headset-hud');
            if(hud) hud.classList.add('visible');
        }, 1500);

        // Gérer la sortie (Touche R ou futur geste)
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r' && window.oasisState.isInOasis) {
                location.reload(); // Pour l'instant, recharger est le moyen le plus propre de sortir
            }
        });
    }
});

// ============================================
// 4. FIX TEXTURES MANOIR (Pour que ce soit joli)
// ============================================
AFRAME.registerComponent('fix-mansion-textures', {
    init: function() {
        this.el.addEventListener('model-loaded', () => {
            const mesh = this.el.getObject3D('mesh');
            if (mesh) {
                const textureLoader = new THREE.TextureLoader();
                const texture = textureLoader.load('./models/low_poly_mansion/textures/Main_diffuse.png');
                texture.encoding = THREE.sRGBEncoding;
                texture.flipY = false;
                
                mesh.traverse((node) => {
                    if (node.isMesh && node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(mat => {
                            if (mat.name === 'Main') {
                                mat.map = texture;
                                mat.needsUpdate = true;
                            }
                            if (mat.map) mat.map.needsUpdate = true;
                            if (node.geometry && node.geometry.attributes.color) {
                                mat.vertexColors = true;
                            }
                            mat.needsUpdate = true;
                        });
                    }
                });
            }
        });
    }
});

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[OASIS] System Ready. Gravity Enabled.');
    
    // Auto-setup du rig
    const rig = document.getElementById('rig');
    if (rig && !rig.hasAttribute('virtual-hand')) {
        rig.setAttribute('virtual-hand', '');
    }
});