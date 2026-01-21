
// ============================================
// SYSTÈME DE CASQUE VR OASIS - Ready Player One x Gucci
// ============================================

// État global du casque
window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedHand: null,
    originalHeadsetPos: null,
    originalRigPos: null
};

// Gestion des clics VR avec les manettes
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

document.querySelector('a-scene').addEventListener('loaded', setupVRClickHandling);
if (document.querySelector('a-scene').hasLoaded) {
    setupVRClickHandling();
}

// ============================================
// COMPOSANT PRINCIPAL - HEADSET TOGGLE (GRAB + WEAR)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        const camera = document.getElementById('player-camera');
        const rig = document.getElementById('rig');
        
        console.log('=== HEADSET-TOGGLE INIT ===');
        console.log('Headset element:', this.el);
        console.log('Headset position:', this.el.getAttribute('position'));
        
        // Sauvegarde position initiale du casque et du rig
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        window.oasisState.originalRigPos = rig ? rig.getAttribute('position') : {x: 0, y: 0, z: 0};
        
        // État du grab
        this.isBeingGrabbed = false;
        this.grabDistance = 0.35; // Distance max pour grab (35cm)
        this.wearDistance = 0.30; // Distance de la tête pour porter le casque (30cm)
        
        // Setup hands
        this.setupHandGrab();
        
        // Event click classique (pour souris PC uniquement)
        this.el.addEventListener('click', () => {
            console.log('Click sur le casque détecté!');
            // Vérifier qu'on n'est pas en mode VR
            const scene = this.el.sceneEl;
            const isInVR = scene.is('vr-mode');
            console.log('Is in VR mode?', isInVR);
            
            if (!window.oasisState.isInOasis && !isInVR) {
                console.log('Click PC mode - lancement transition');
                this.startOasisTransition();
            }
        });
    },
    
    setupHandGrab: function() {
        const self = this;
        const scene = this.el.sceneEl;
        
        // Attendre que la scène soit chargée avant de setup les hands
        if (!scene.hasLoaded) {
            scene.addEventListener('loaded', () => this.setupHandGrab());
            return;
        }
        
        const hands = document.querySelectorAll('[hand-controls]');
        console.log(`Setup grab: ${hands.length} hands trouvées`);
        
        hands.forEach((hand, idx) => {
            console.log(`Hand ${idx}:`, hand.getAttribute('hand-controls'));
            
            // A-Frame hand-controls utilise des événements spécifiques
            // On utilise 'triggerdown' pour attraper
            hand.addEventListener('triggerdown', (evt) => {
                console.log(`Triggerdown sur hand ${idx}`);
                const headsetPos = self.el.object3D.getWorldPosition(new THREE.Vector3());
                const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
                const distance = headsetPos.distanceTo(handPos);
                console.log(`Distance main-casque: ${distance.toFixed(2)}m`);
                
                if (distance < self.grabDistance && !window.oasisState.isInOasis) {
                    console.log('✅ Grab déclenché!');
                    self.grabHeadset(hand);
                } else if (window.oasisState.isInOasis && self.isNearHead(hand)) {
                    console.log('✅ Remove casque déclenché!');
                    self.removeHeadset();
                }
            });
            
            // Sur triggerup pour relâcher
            hand.addEventListener('triggerup', () => {
                if (self.isBeingGrabbed && window.oasisState.grabbedHand === hand) {
                    console.log('Release casque!');
                    self.releaseHeadset();
                }
            });
            
            // Ajout aussi sur 'gripdown' pour les contrôleurs qui l'utilisent
            hand.addEventListener('gripdown', (evt) => {
                console.log(`Gripdown sur hand ${idx}`);
                const headsetPos = self.el.object3D.getWorldPosition(new THREE.Vector3());
                const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
                const distance = headsetPos.distanceTo(handPos);
                console.log(`Distance main-casque (grip): ${distance.toFixed(2)}m`);
                
                if (distance < self.grabDistance && !window.oasisState.isInOasis) {
                    console.log('✅ Grab via grip déclenché!');
                    self.grabHeadset(hand);
                } else if (window.oasisState.isInOasis && self.isNearHead(hand)) {
                    console.log('✅ Remove casque via grip!');
                    self.removeHeadset();
                }
            });
            
            hand.addEventListener('gripup', () => {
                if (self.isBeingGrabbed && window.oasisState.grabbedHand === hand) {
                    console.log('Release casque (grip)!');
                    self.releaseHeadset();
                }
            });
        });
    },
    
    isNearHeadset: function(hand) {
        const headsetPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
        const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
        return headsetPos.distanceTo(handPos) < this.grabDistance;
    },
    
    isNearHead: function(hand) {
        const camera = document.getElementById('player-camera');
        const cameraPos = camera.object3D.getWorldPosition(new THREE.Vector3());
        const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
        return cameraPos.distanceTo(handPos) < this.wearDistance;
    },
    
    grabHeadset: function(hand) {
        this.isBeingGrabbed = true;
        window.oasisState.isGrabbing = true;
        window.oasisState.grabbedHand = hand;
        
        console.log('grabHeadset called, hand:', hand);
        
        // Attache le casque à la main
        thisuivi de la main
        this.followHand = () => {
            if (this.isBeingGrabbed && window.oasisState.grabbedHand) {
                const handPos = window.oasisState.grabbedHand.object3D.getWorldPosition(new THREE.Vector3());
                this.el.object3D.position.copy(handPos);
                
                // Vérifie si proche de la tête pour porter
                const camera = document.getElementById('player-camera');
                const cameraWorldPos = camera.object3D.getWorldPosition(new THREE.Vector3());
                const headsetWorldPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
                
                if (cameraWorldPos.distanceTo(headsetWorldPos) < this.wearDistance) {
                    console.log('Casque proche de la tête - wear!');ector3());
                
                if (cameraWorldPos.distanceTo(headsetWorldPos) < this.wearDistance) {
                    this.wearHeadset();
                }
            }
        };
        
        this.el.sceneEl.addEventListener('tick', this.followHand);
    },
    
    releaseHeadset: function() {
        if (this.followHand) {
            this.el.sceneEl.removeEventListener('tick', this.followHand);
        }
        // remove mouse move
        if (this._mouseFallback) {
            window.removeEventListener('mousemove', this._mouseMoveHandler);
            this._mouseFallback = false;
        }
        this.isBeingGrabbed = false;
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        
        // Remet le casque à sa position originale
        if (!window.oasisState.isInOasis) {
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
        }
    },
    
        this.isBeingGrabbed = false;
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        
        // Remet le casque à sa position originale
        if (!window.oasisState.isInOasis) {
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos
        // Lance la transition vers l'Oasis
        this.startOasisTransition();
    },
    
    startOasisTransition: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        
        console.log('=== OASIS TRANSITION START ===');
        
        // Affiche l'écran de chargement
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        console.log('Loading screen:', loadingScreen);
        console.log('Eclipse overlay:', eclipseOverlay);
        console.log('Loading content:', loadingContent);
        
        if (!loadingScreen || !eclipseOverlay || !loadingContent) {
            console.error('Éléments DOM manquants! Utilisation du fallback...');
            // Fallback - passe directement à l'Oasis
            setTimeout(() => this.enterOasis(), 500);
            return;
        }
        
        loadingScreen.classList.add('active');
        // Fallback: forcer l'affichage inline si la classe ne suffit pas (desktop)
        loadingScreen.style.display = 'flex';
        
        // Animation éclipse qui se ferme
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        // Vérifier visuellement que l'overlay est visible
        console.log('Computed loading screen display:', window.getComputedStyle(loadingScreen).display);
        
        // Après la fermeture de l'éclipse, affiche le contenu
        setTimeout(() => {
            loadingContent.classList.add('visible');
            
            // Messages de chargement luxe
            const messages = [
                "Initialisation du système...",
                "Connexion aux serveurs OASIS...",
                "Chargement de l'environnement...",
                "Synchronisation neurale...",
                "Calibration sensorielle...",
                "Bienvenue dans l'OASIS"
            ];
            
            let progress = 0;
            let messageIndex = 0;
            
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15 + 5;
                if (progress > 100) progress = 100;
                
                progressBar.style.width = progress + '%';
                
                // Change le message
                const newIndex = Math.min(Math.floor(progress / 20), messages.length - 1);
                if (newIndex !== messageIndex) {
                    messageIndex = newIndex;
                    progressText.textContent = messages[messageIndex];
                }
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    
                    // Transition vers l'Oasis après un court délai
                    setTimeout(() => {
                        self.enterOasis();
                        
                        // Animation éclipse qui s'ouvre
                        eclipseOverlay.classList.remove('closing');
                        eclipseOverlay.classList.add('opening');
                        
                        // Cache le contenu
                        loadingContent.classList.remove('visible');
                        
                        // Cache l'écran de chargement après l'animation
                        setTimeout(() => {
                            loadingScreen.classList.remove('active');
                            eclipseOverlay.classList.remove('opening');
                            progressBar.style.width = '0%';
                            progressText.textContent = 'Initialisation du système...';
                        }, 1500);
                    }, 800);
                }
            }, 150);
        }, 1200);
    },
    
    enterOasis: function() {
        const scene = document.querySelector('a-scene');
        
        window.oasisState.isInOasis = true;
        
        // Cache le casque
        this.el.setAttribute('visible', false);
        
        // Cache TOUS les éléments de l'ancienne scène (sauf rig et vr-world)
        const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
        allEntities.forEach(entity => {
            const id = entity.getAttribute('id');
            if (id !== 'rig' && id !== 'vr-world' && !entity.closest('#rig') && !entity.closest('#vr-world')) {
                entity.setAttribute('visible', false);
            }
        });
        
        // Cache tous les anciens lights
        const oldLights = document.querySelectorAll('[light]:not(#vr-sun):not(#vr-ambient):not(#vr-sunset-lights):not([id^="mansion"])');
        oldLights.forEach(light => {
            if (!light.closest('#vr-world') && !light.closest('#vr-sunset-lights')) {
                light.setAttribute('visible', false);
            }
        });
        
        // Change le background en ciel de coucher de soleil
        scene.setAttribute('background', 'color: #FFB88C');
        scene.setAttribute('fog', 'type: exponential; color: #FFD4B8; density: 0.008');
        
        // Affiche le nouveau monde VR
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
        }
        
        // Téléporte le joueur
        const rig = document.getElementById('rig');
        if (rig) {
            rig.setAttribute('position', '0 16 -56.69');
        }
        
        // Affiche l'effet de bordure noire du casque VR
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);
        
        // Affiche le HUD pour retirer le casque
        const removeHud = document.getElementById('remove-headset-hud');
        if (removeHud) {
            removeHud.classList.add('visible');
        }
    },
    
    removeHeadset: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        
        // Cache le HUD
        const removeHud = document.getElementById('remove-headset-hud');
        if (removeHud) {
            removeHud.classList.remove('visible');
        }
        
        // Animation éclipse de fermeture
        loadingScreen.classList.add('active');
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        setTimeout(() => {
            // Retour au monde réel
            window.oasisState.isInOasis = false;
            
            // Cache le monde VR
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', false);
            }
            
            // Cache l'overlay du casque
            const vrOverlay = document.getElementById('vr-headset-overlay');
            const vrNose = document.getElementById('vr-headset-nose');
            const vrLensTint = document.getElementById('vr-headset-lens-tint');
            if (vrOverlay) vrOverlay.setAttribute('visible', false);
            if (vrNose) vrNose.setAttribute('visible', false);
            if (vrLensTint) vrLensTint.setAttribute('visible', false);
            
            // Restaure la scène originale
            const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
            allEntities.forEach(entity => {
                const id = entity.getAttribute('id');
                if (id !== 'vr-world' && !entity.closest('#vr-world')) {
                    entity.setAttribute('visible', true);
                }
            });
            
            // Restaure le background original
            scene.setAttribute('background', 'color: #a8aeb5');
            scene.setAttribute('fog', 'type: exponential; color: #8a9098; density: 0.012');
            
            // Remet le rig à sa position originale
            const rig = document.getElementById('rig');
            if (rig && window.oasisState.originalRigPos) {
                rig.setAttribute('position', window.oasisState.originalRigPos);
            }
            
            // Remet le casque visible à sa position
            self.el.setAttribute('visible', true);
            self.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            
            // Animation éclipse qui s'ouvre
            eclipseOverlay.classList.remove('closing');
            eclipseOverlay.classList.add('opening');
            
            setTimeout(() => {
                loadingScreen.classList.remove('active');
                eclipseOverlay.classList.remove('opening');
            }, 1500);
        }, 1200);
    }
});

// ============================================
// COMPOSANT POUR TEXTURES DU MANSION
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
