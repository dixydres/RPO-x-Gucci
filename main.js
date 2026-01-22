// ============================================
// OASIS VR HEADSET SYSTEM - Ready Player One x Gucci
// VERSION 2.0 - Desktop + VR Support avec simulation clavier
// ============================================

// Global headset state
window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedObject: null,
    grabbedHand: null,
    originalHeadsetPos: null,
    originalRigPos: null,
    grabOffset: new THREE.Vector3(),
    grabDistance: 1.5 // Distance de l'objet devant la caméra quand grabé
};

// ============================================
// COMPOSANT MAIN VIRTUELLE (DESKTOP SIMULATION)
// Simule une main contrôlée par le regard + touche C
// ============================================
AFRAME.registerComponent('virtual-hand', {
    schema: {
        grabKey: { type: 'string', default: 'c' },
        grabDistance: { type: 'number', default: 2.0 }
    },

    init: function() {
        this.isGrabbing = false;
        this.camera = null;
        this.grabbedObject = null;
        this.grabStartDistance = 0;
        this.originalColor = null;
        
        // Attendre que la scène soit prête
        const scene = this.el.sceneEl;
        if (scene.hasLoaded) {
            this.onSceneLoaded();
        } else {
            scene.addEventListener('loaded', () => this.onSceneLoaded());
        }
        
        // Bind des événements clavier
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    },
    
    onSceneLoaded: function() {
        this.camera = document.getElementById('player-camera');
        console.log('[OASIS] Virtual Hand initialized - Press C to grab objects');
        console.log('[OASIS] Camera found:', !!this.camera);
    },

    onKeyDown: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey && !event.repeat) {
            console.log('[OASIS] C key pressed - trying to grab');
            this.tryGrab();
        }
    },

    onKeyUp: function(event) {
        if (event.key.toLowerCase() === this.data.grabKey) {
            console.log('[OASIS] C key released');
            this.releaseGrab();
        }
    },

    tryGrab: function() {
        if (this.isGrabbing) return;
        if (!this.camera) {
            this.camera = document.getElementById('player-camera');
        }
        if (!this.camera) {
            console.log('[OASIS] Camera not found!');
            return;
        }
        
        // Méthode 1: Utiliser le curseur/raycaster natif d'A-Frame
        const cursorComponent = this.camera.components.cursor;
        if (cursorComponent && cursorComponent.intersectedEl) {
            const targetEl = cursorComponent.intersectedEl;
            if (targetEl.classList.contains('clickable')) {
                const cameraPos = new THREE.Vector3();
                const targetPos = new THREE.Vector3();
                this.camera.object3D.getWorldPosition(cameraPos);
                targetEl.object3D.getWorldPosition(targetPos);
                const distance = cameraPos.distanceTo(targetPos);
                
                console.log('[OASIS] Cursor hit:', targetEl.id, 'distance:', distance);
                this.startGrab(targetEl, Math.min(distance, 1.5));
                return;
            }
        }
        
        // Méthode 2: Chercher les objets clickables dans le champ de vision
        const clickables = document.querySelectorAll('.clickable');
        const cameraPos = new THREE.Vector3();
        const cameraDir = new THREE.Vector3();
        
        this.camera.object3D.getWorldPosition(cameraPos);
        this.camera.object3D.getWorldDirection(cameraDir);
        
        let closestEl = null;
        let closestDistance = Infinity;
        let closestAngle = Infinity;
        
        clickables.forEach(el => {
            const elPos = new THREE.Vector3();
            el.object3D.getWorldPosition(elPos);
            
            const toObject = new THREE.Vector3().subVectors(elPos, cameraPos);
            const distance = toObject.length();
            
            // Vérifier si l'objet est devant nous (angle < 45 degrés)
            toObject.normalize();
            const angle = Math.acos(cameraDir.dot(toObject)) * (180 / Math.PI);
            
            if (distance < this.data.grabDistance && angle < 45) {
                // Prioriser par angle (plus on regarde directement, mieux c'est)
                if (angle < closestAngle) {
                    closestEl = el;
                    closestDistance = distance;
                    closestAngle = angle;
                }
            }
        });
        
        if (closestEl) {
            console.log('[OASIS] Found object in view:', closestEl.id, 'distance:', closestDistance, 'angle:', closestAngle);
            this.startGrab(closestEl, Math.min(closestDistance, 1.5));
        } else {
            console.log('[OASIS] No grabbable object found in view');
        }
    },

    startGrab: function(targetEl, distance) {
        this.isGrabbing = true;
        this.grabbedObject = targetEl;
        this.grabStartDistance = Math.min(distance, 1.5); // Limiter la distance max
        
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedObject = targetEl;
        
        // Feedback visuel - changer la couleur en jaune
        const material = targetEl.getAttribute('material');
        this.originalColor = targetEl.getAttribute('color') || (material ? material.color : '#000000');
        targetEl.setAttribute('color', '#FFD700');
        
        // Émettre un événement de grab
        targetEl.emit('grab-start', { hand: 'virtual' });
        
        console.log('[OASIS] ✓ Object grabbed:', targetEl.id || 'unnamed', '- Color changed to yellow');
    },

    releaseGrab: function() {
        if (!this.isGrabbing || !this.grabbedObject) return;
        
        const targetEl = this.grabbedObject;
        
        // Restaurer la couleur originale (sauf si dans l'OASIS)
        if (!window.oasisState.isInOasis && this.originalColor) {
            targetEl.setAttribute('color', this.originalColor);
            console.log('[OASIS] Color restored to:', this.originalColor);
        }
        
        // Émettre un événement de release
        targetEl.emit('grab-end', { hand: 'virtual' });
        
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedObject = null;
        
        this.isGrabbing = false;
        this.grabbedObject = null;
        
        console.log('[OASIS] Object released');
    },

    tick: function() {
        if (!this.isGrabbing || !this.grabbedObject) return;
        if (!this.camera) return;
        
        const camera = this.camera.object3D;
        const cameraWorldPos = new THREE.Vector3();
        const cameraWorldDir = new THREE.Vector3();
        
        camera.getWorldPosition(cameraWorldPos);
        camera.getWorldDirection(cameraWorldDir);
        
        // Calculer la nouvelle position de l'objet devant la caméra
        const targetPos = new THREE.Vector3();
        targetPos.copy(cameraWorldPos);
        targetPos.addScaledVector(cameraWorldDir, this.grabStartDistance);
        
        // Léger décalage vers le bas pour effet naturel
        targetPos.y -= 0.1;
        
        // Convertir en position locale si l'objet a un parent
        const objectParent = this.grabbedObject.object3D.parent;
        if (objectParent && objectParent.type !== 'Scene') {
            // Obtenir la matrice monde inverse du parent
            const parentInverse = new THREE.Matrix4();
            objectParent.updateWorldMatrix(true, false);
            parentInverse.copy(objectParent.matrixWorld).invert();
            targetPos.applyMatrix4(parentInverse);
        }
        
        // Appliquer la position avec smoothing
        const currentPos = this.grabbedObject.object3D.position;
        currentPos.lerp(targetPos, 0.25);
    },

    remove: function() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }
});

// ============================================
// VR CLICK HANDLING
// ============================================
function setupVRClickHandling() {
    const hands = document.querySelectorAll('[hand-controls]');
    
    hands.forEach(hand => {
        hand.addEventListener('raycaster-intersection', (e) => {
            if (e.detail.intersections.length > 0) {
                const intersectedEl = e.detail.intersections[0].object.el;
                if (intersectedEl && intersectedEl.classList.contains('clickable')) {
                    intersectedEl.dispatchEvent(new Event('click'));
                }
            }
        });
    });
}

// ============================================
// MAIN COMPONENT - HEADSET TOGGLE (GRAB + WEAR)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        const rig = document.getElementById('rig');
        
        // Save initial positions
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        window.oasisState.originalRigPos = rig ? rig.getAttribute('position') : {x: 0, y: 0, z: 0};
        
        // Distances pour le grab VR
        this.grabDistance = 0.50;
        this.wearDistance = 0.30;
        
        // Timer pour le wear automatique
        this.wearTimer = null;
        this.wearDelay = 1500; // 1.5 secondes de maintien pour enfiler
        
        // Setup VR hand grab
        this.setupHandGrab();
        
        // Écouter les événements de grab de la main virtuelle
        this.el.addEventListener('grab-start', (e) => {
            console.log('[OASIS] Headset grab started');
            this.onVirtualGrabStart();
        });
        
        this.el.addEventListener('grab-end', (e) => {
            console.log('[OASIS] Headset grab ended');
            this.onVirtualGrabEnd();
        });
        
        // Classic click event (PC mouse only) - entrée directe dans l'OASIS
        this.el.addEventListener('click', () => {
            const scene = this.el.sceneEl;
            const isInVR = scene.is('vr-mode');
            
            // En mode desktop sans VR, le clic entre directement dans l'OASIS
            if (!window.oasisState.isInOasis && !isInVR && !window.oasisState.isGrabbing) {
                this.startOasisTransition();
            }
        });
        
        // Écouter la touche R pour retirer le casque depuis l'OASIS
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r' && window.oasisState.isInOasis) {
                this.removeHeadset();
            }
        });
    },
    
    onVirtualGrabStart: function() {
        // Démarrer un timer - si l'objet est maintenu assez longtemps près de la tête, on enfile
        this.wearTimer = setTimeout(() => {
            if (window.oasisState.isGrabbing && !window.oasisState.isInOasis) {
                this.wearHeadset();
            }
        }, this.wearDelay);
    },
    
    onVirtualGrabEnd: function() {
        // Annuler le timer
        if (this.wearTimer) {
            clearTimeout(this.wearTimer);
            this.wearTimer = null;
        }
        
        // Si pas dans l'OASIS, remettre le casque à sa position originale
        if (!window.oasisState.isInOasis) {
            setTimeout(() => {
                this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
                this.el.setAttribute('color', '#000000');
            }, 100);
        }
    },
    
    setupHandGrab: function() {
        const self = this;
        const scene = this.el.sceneEl;
        
        if (!scene.hasLoaded) {
            scene.addEventListener('loaded', () => this.setupHandGrab());
            return;
        }
        
        const hands = document.querySelectorAll('[hand-controls]');
        
        hands.forEach((hand, idx) => {
            // Trigger VR controller
            hand.addEventListener('triggerdown', () => {
                this.handleVRGrab(hand);
            });
            
            hand.addEventListener('triggerup', () => {
                this.handleVRRelease(hand);
            });
            
            // Grip VR controller
            hand.addEventListener('gripdown', () => {
                this.handleVRGrab(hand);
            });
            
            hand.addEventListener('gripup', () => {
                this.handleVRRelease(hand);
            });
        });
    },
    
    handleVRGrab: function(hand) {
        const headsetPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
        const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
        const distance = headsetPos.distanceTo(handPos);
        
        if (distance < this.grabDistance && !window.oasisState.isInOasis) {
            this.grabHeadsetVR(hand);
        } else if (window.oasisState.isInOasis && this.isNearHead(hand)) {
            this.removeHeadset();
        }
    },
    
    handleVRRelease: function(hand) {
        if (window.oasisState.isGrabbing && window.oasisState.grabbedHand === hand) {
            this.releaseHeadsetVR();
        }
    },
    
    isNearHead: function(hand) {
        const camera = document.getElementById('player-camera');
        const cameraPos = camera.object3D.getWorldPosition(new THREE.Vector3());
        const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
        return cameraPos.distanceTo(handPos) < this.wearDistance;
    },
    
    grabHeadsetVR: function(hand) {
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedHand = hand;
        
        this.el.setAttribute('visible', true);
        this.el.setAttribute('color', '#FFD700');
        
        // Suivre la main VR en temps réel
        this.followHand = () => {
            if (window.oasisState.isGrabbing && window.oasisState.grabbedHand) {
                const handWorldPos = window.oasisState.grabbedHand.object3D.getWorldPosition(new THREE.Vector3());
                this.el.object3D.position.copy(handWorldPos);
                
                // Vérifier si proche de la tête
                const camera = document.getElementById('player-camera');
                const cameraWorldPos = camera.object3D.getWorldPosition(new THREE.Vector3());
                const headsetWorldPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
                const distanceToHead = cameraWorldPos.distanceTo(headsetWorldPos);
                
                if (distanceToHead < this.wearDistance) {
                    this.wearHeadset();
                }
            }
        };
        
        this.el.sceneEl.addEventListener('tick', this.followHand);
    },
    
    releaseHeadsetVR: function() {
        if (this.followHand) {
            this.el.sceneEl.removeEventListener('tick', this.followHand);
            this.followHand = null;
        }
        
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        
        if (!window.oasisState.isInOasis) {
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            this.el.setAttribute('color', '#000000');
        }
    },
    
    wearHeadset: function() {
        // Arrêter le tracking VR
        if (this.followHand) {
            this.el.sceneEl.removeEventListener('tick', this.followHand);
            this.followHand = null;
        }
        
        // Annuler le timer de wear
        if (this.wearTimer) {
            clearTimeout(this.wearTimer);
            this.wearTimer = null;
        }
        
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        window.oasisState.grabbedObject = null;
        
        this.el.setAttribute('visible', false);
        this.el.setAttribute('color', '#000000');
        
        this.startOasisTransition();
    },
    
    startOasisTransition: function() {
        const self = this;
        
        this.el.setAttribute('visible', false);
        
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (!loadingScreen || !eclipseOverlay || !loadingContent) {
            setTimeout(() => this.enterOasis(), 500);
            return;
        }
        
        loadingScreen.classList.add('active');
        loadingScreen.style.display = 'flex';
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        setTimeout(() => {
            loadingContent.classList.add('visible');
            
            const messages = [
                "System initialization...",
                "Connecting to OASIS servers...",
                "Loading environment...",
                "Neural synchronization...",
                "Sensor calibration...",
                "Welcome to the OASIS"
            ];
            
            let progress = 0;
            let messageIndex = 0;
            
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15 + 5;
                if (progress > 100) progress = 100;
                
                progressBar.style.width = progress + '%';
                
                const newIndex = Math.min(Math.floor(progress / 20), messages.length - 1);
                if (newIndex !== messageIndex) {
                    messageIndex = newIndex;
                    progressText.textContent = messages[messageIndex];
                }
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    
                    setTimeout(() => {
                        self.enterOasis();
                        eclipseOverlay.classList.remove('closing');
                        eclipseOverlay.classList.add('opening');
                        loadingContent.classList.remove('visible');
                        
                        setTimeout(() => {
                            loadingScreen.classList.remove('active');
                            loadingScreen.style.display = 'none'; // Force hide
                            eclipseOverlay.classList.remove('opening');
                            progressBar.style.width = '0%';
                            progressText.textContent = 'System initialization...';
                            console.log('[OASIS] Loading screen hidden');
                        }, 1500);
                    }, 800);
                }
            }, 150);
        }, 1200);
    },
    
    enterOasis: function() {
        const scene = document.querySelector('a-scene');
        
        console.log('[OASIS] Entering OASIS...');
        
        window.oasisState.isInOasis = true;
        
        this.el.setAttribute('visible', false);
        
        // D'abord, afficher le monde VR AVANT de masquer les autres éléments
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
            // S'assurer que tous les enfants sont aussi visibles
            vrWorld.querySelectorAll('*').forEach(child => {
                if (child.setAttribute) {
                    child.setAttribute('visible', true);
                }
            });
            console.log('[OASIS] VR World set to visible');
        } else {
            console.error('[OASIS] ERROR: vr-world not found!');
        }
        
        // Masquer les éléments de l'ancienne scène (SAUF le rig et vr-world)
        const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
        allEntities.forEach(entity => {
            const id = entity.getAttribute('id');
            // Ne pas toucher au rig, vr-world, ou leurs enfants
            if (id !== 'rig' && 
                id !== 'vr-world' && 
                id !== 'player-camera' &&
                !entity.closest('#rig') && 
                !entity.closest('#vr-world')) {
                entity.setAttribute('visible', false);
            }
        });
        
        // Masquer les anciennes lumières
        const oldLights = document.querySelectorAll('[light]:not(#vr-sun):not(#vr-ambient):not(#vr-sunset-lights):not([id^="mansion"])');
        oldLights.forEach(light => {
            if (!light.closest('#vr-world') && !light.closest('#vr-sunset-lights') && !light.closest('#rig')) {
                light.setAttribute('visible', false);
            }
        });
        
        // Background sunset
        scene.setAttribute('background', 'color: #FFB88C');
        scene.setAttribute('fog', 'type: exponential; color: #FFD4B8; density: 0.008');
        
        // Téléporter le joueur
        const rig = document.getElementById('rig');
        if (rig) {
            rig.setAttribute('position', '0 16 -56.69');
            console.log('[OASIS] Player teleported to OASIS');
        }
        
        // Afficher les effets de casque VR
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);
        
        // Afficher le HUD
        const removeHud = document.getElementById('remove-headset-hud');
        if (removeHud) {
            removeHud.classList.add('visible');
            removeHud.innerHTML = 'Press <kbd style="background:#333;padding:2px 8px;border-radius:3px;">R</kbd> to leave the OASIS';
        }
        
        console.log('[OASIS] Welcome to the OASIS!');
    },
    
    removeHeadset: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        
        // Masquer le HUD
        const removeHud = document.getElementById('remove-headset-hud');
        if (removeHud) {
            removeHud.classList.remove('visible');
        }
        
        loadingScreen.classList.add('active');
        loadingScreen.style.display = 'flex';
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        setTimeout(() => {
            window.oasisState.isInOasis = false;
            
            // Masquer le monde VR
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', false);
            }
            
            // Masquer les overlays du casque
            const vrOverlay = document.getElementById('vr-headset-overlay');
            const vrNose = document.getElementById('vr-headset-nose');
            const vrLensTint = document.getElementById('vr-headset-lens-tint');
            if (vrOverlay) vrOverlay.setAttribute('visible', false);
            if (vrNose) vrNose.setAttribute('visible', false);
            if (vrLensTint) vrLensTint.setAttribute('visible', false);
            
            // Restaurer la scène originale
            const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
            allEntities.forEach(entity => {
                const id = entity.getAttribute('id');
                if (id !== 'vr-world' && !entity.closest('#vr-world')) {
                    entity.setAttribute('visible', true);
                }
            });
            
            // Restaurer le background original
            scene.setAttribute('background', 'color: #a8aeb5');
            scene.setAttribute('fog', 'type: exponential; color: #8a9098; density: 0.012');
            
            // Remettre le rig à sa position d'origine
            const rig = document.getElementById('rig');
            if (rig && window.oasisState.originalRigPos) {
                rig.setAttribute('position', window.oasisState.originalRigPos);
            }
            
            // Remettre le casque à sa position d'origine
            self.el.setAttribute('visible', true);
            self.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            
            // Animation d'ouverture
            eclipseOverlay.classList.remove('closing');
            eclipseOverlay.classList.add('opening');
            
            setTimeout(() => {
                loadingScreen.classList.remove('active');
                eclipseOverlay.classList.remove('opening');
            }, 1500);
            
            console.log('[OASIS] You left the OASIS');
        }, 1200);
    }
});

// ============================================
// COMPONENT FOR MANSION TEXTURES
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
                            if (mat.map) {
                                mat.map.needsUpdate = true;
                            }
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
    const scene = document.querySelector('a-scene');
    
    if (scene.hasLoaded) {
        initializeOasisSystem();
    } else {
        scene.addEventListener('loaded', initializeOasisSystem);
    }
});

function initializeOasisSystem() {
    // Setup VR click handling
    setupVRClickHandling();
    
    // Add virtual-hand component to the rig for desktop control
    const rig = document.getElementById('rig');
    console.log('[OASIS] Rig found:', !!rig);
    
    if (rig && !rig.hasAttribute('virtual-hand')) {
        rig.setAttribute('virtual-hand', '');
        console.log('[OASIS] Virtual-hand component added to rig');
    }
    
    // Vérifier que le casque existe
    const headset = document.getElementById('oasis-headset');
    console.log('[OASIS] Headset found:', !!headset);
    if (headset) {
        console.log('[OASIS] Headset position:', headset.getAttribute('position'));
    }
    
    // Vérifier que vr-world existe
    const vrWorld = document.getElementById('vr-world');
    console.log('[OASIS] VR World found:', !!vrWorld);
    
    console.log('[OASIS] System initialized');
    console.log('[OASIS] Controls:');
    console.log('  - C (hold): Grab objects');
    console.log('  - Click on headset: Enter OASIS directly');
    console.log('  - R: Leave OASIS');
    console.log('  - WASD: Move around');
    console.log('  - Mouse: Look around');
}
