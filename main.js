// ============================================
// OASIS VR HEADSET SYSTEM - Ready Player One x Gucci
// ============================================

// Global headset state
window.oasisState = {
    isInOasis: false,
    isGrabbing: false,
    grabbedHand: null,
    originalHeadsetPos: null,
    originalRigPos: null
};

// Handle VR clicks with controllers
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
// MAIN COMPONENT - HEADSET TOGGLE (GRAB + WEAR)
// ============================================
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        const camera = document.getElementById('player-camera');
        const rig = document.getElementById('rig');
        
        // Save initial positions
        window.oasisState.originalHeadsetPos = this.el.getAttribute('position');
        window.oasisState.originalRigPos = rig ? rig.getAttribute('position') : {x: 0, y: 0, z: 0};
        
        // Grab state
        this.isBeingGrabbed = false;
        this.grabDistance = 0.50;
        this.wearDistance = 0.25;
        
        // Setup hand grab
        this.setupHandGrab();
        
        // Classic click event (PC mouse only)
        this.el.addEventListener('click', () => {
            const scene = this.el.sceneEl;
            const isInVR = scene.is('vr-mode');
            
            if (!window.oasisState.isInOasis && !isInVR) {
                this.startOasisTransition();
            }
        });
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
            hand.addEventListener('triggerdown', (evt) => {
                const headsetPos = self.el.object3D.getWorldPosition(new THREE.Vector3());
                const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
                const distance = headsetPos.distanceTo(handPos);
                
                if (distance < self.grabDistance && !window.oasisState.isInOasis) {
                    self.grabHeadset(hand);
                } else if (window.oasisState.isInOasis && self.isNearHead(hand)) {
                    self.removeHeadset();
                }
            });
            
            hand.addEventListener('triggerup', () => {
                if (self.isBeingGrabbed && window.oasisState.grabbedHand === hand) {
                    self.releaseHeadset();
                }
            });
            
            hand.addEventListener('gripdown', (evt) => {
                const headsetPos = self.el.object3D.getWorldPosition(new THREE.Vector3());
                const handPos = hand.object3D.getWorldPosition(new THREE.Vector3());
                const distance = headsetPos.distanceTo(handPos);
                
                if (distance < self.grabDistance && !window.oasisState.isInOasis) {
                    self.grabHeadset(hand);
                } else if (window.oasisState.isInOasis && self.isNearHead(hand)) {
                    self.removeHeadset();
                }
            });
            
            hand.addEventListener('gripup', () => {
                if (self.isBeingGrabbed && window.oasisState.grabbedHand === hand) {
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
        
        // Make headset visible
        this.el.setAttribute('visible', true);
        this.el.setAttribute('color', '#FFD700');
        
        // Follow hand in real-time
        this.followHand = () => {
            if (this.isBeingGrabbed && window.oasisState.grabbedHand) {
                // Get hand world position
                const handWorldPos = window.oasisState.grabbedHand.object3D.getWorldPosition(new THREE.Vector3());
                
                // Update headset position
                this.el.object3D.position.copy(handWorldPos);
                
                // Check if headset is near head
                const camera = document.getElementById('player-camera');
                const cameraWorldPos = camera.object3D.getWorldPosition(new THREE.Vector3());
                const headsetWorldPos = this.el.object3D.getWorldPosition(new THREE.Vector3());
                const distanceToHead = cameraWorldPos.distanceTo(headsetWorldPos);
                
                // If close to head, wear headset
                if (distanceToHead < this.wearDistance) {
                    this.wearHeadset();
                }
            }
        };
        
        // Enable tracking on each frame
        this.el.sceneEl.addEventListener('tick', this.followHand);
    },
    
    releaseHeadset: function() {
        if (this.followHand) {
            this.el.sceneEl.removeEventListener('tick', this.followHand);
            this.followHand = null;
        }
        
        this.isBeingGrabbed = false;
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        
        // Reset headset to original position (if not in Oasis)
        if (!window.oasisState.isInOasis) {
            this.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            this.el.setAttribute('color', '#000000');
        }
    },
    
    wearHeadset: function() {
        // Stop tracking
        if (this.followHand) {
            this.el.sceneEl.removeEventListener('tick', this.followHand);
            this.followHand = null;
        }
        
        this.isBeingGrabbed = false;
        window.oasisState.isGrabbing = false;
        window.oasisState.grabbedHand = null;
        
        // Hide headset
        this.el.setAttribute('visible', false);
        this.el.setAttribute('color', '#000000');
        
        // Launch transition to Oasis
        this.startOasisTransition();
    },
    
    startOasisTransition: function() {
        const self = this;
        const scene = document.querySelector('a-scene');
        
        // Hide headset before showing loading screen
        this.el.setAttribute('visible', false);
        
        // Get loading screen elements
        const loadingScreen = document.getElementById('oasis-loading-screen');
        const eclipseOverlay = document.getElementById('eclipse-overlay');
        const loadingContent = document.getElementById('loading-content');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (!loadingScreen || !eclipseOverlay || !loadingContent) {
            // Fallback - go directly to Oasis
            setTimeout(() => this.enterOasis(), 500);
            return;
        }
        
        // Show loading screen
        loadingScreen.classList.add('active');
        loadingScreen.style.display = 'flex';
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        setTimeout(() => {
            loadingContent.classList.add('visible');
            
            // Loading messages
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
                
                // Update message
                const newIndex = Math.min(Math.floor(progress / 20), messages.length - 1);
                if (newIndex !== messageIndex) {
                    messageIndex = newIndex;
                    progressText.textContent = messages[messageIndex];
                }
                
                if (progress >= 100) {
                    clearInterval(progressInterval);
                    
                    // Transition to Oasis after delay
                    setTimeout(() => {
                        self.enterOasis();
                        eclipseOverlay.classList.remove('closing');
                        eclipseOverlay.classList.add('opening');
                        loadingContent.classList.remove('visible');
                        
                        setTimeout(() => {
                            loadingScreen.classList.remove('active');
                            eclipseOverlay.classList.remove('opening');
                            progressBar.style.width = '0%';
                            progressText.textContent = 'System initialization...';
                        }, 1500);
                    }, 800);
                }
            }, 150);
        }, 1200);
    },
    
    enterOasis: function() {
        const scene = document.querySelector('a-scene');
        
        window.oasisState.isInOasis = true;
        
        // Hide headset
        this.el.setAttribute('visible', false);
        
        // Hide all old scene elements
        const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
        allEntities.forEach(entity => {
            const id = entity.getAttribute('id');
            if (id !== 'rig' && id !== 'vr-world' && !entity.closest('#rig') && !entity.closest('#vr-world')) {
                entity.setAttribute('visible', false);
            }
        });
        
        // Hide old lights
        const oldLights = document.querySelectorAll('[light]:not(#vr-sun):not(#vr-ambient):not(#vr-sunset-lights):not([id^="mansion"])');
        oldLights.forEach(light => {
            if (!light.closest('#vr-world') && !light.closest('#vr-sunset-lights')) {
                light.setAttribute('visible', false);
            }
        });
        
        // Set background to sunset sky
        scene.setAttribute('background', 'color: #FFB88C');
        scene.setAttribute('fog', 'type: exponential; color: #FFD4B8; density: 0.008');
        
        // Show new VR world
        const vrWorld = document.getElementById('vr-world');
        if (vrWorld) {
            vrWorld.setAttribute('visible', true);
        }
        
        // Teleport player to Oasis
        const rig = document.getElementById('rig');
        if (rig) {
            rig.setAttribute('position', '0 16 -56.69');
        }
        
        // Show VR headset overlay effect
        const vrOverlay = document.getElementById('vr-headset-overlay');
        const vrNose = document.getElementById('vr-headset-nose');
        const vrLensTint = document.getElementById('vr-headset-lens-tint');
        if (vrOverlay) vrOverlay.setAttribute('visible', true);
        if (vrNose) vrNose.setAttribute('visible', true);
        if (vrLensTint) vrLensTint.setAttribute('visible', true);
        
        // Show HUD to remove headset
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
        
        // Hide HUD
        const removeHud = document.getElementById('remove-headset-hud');
        if (removeHud) {
            removeHud.classList.remove('visible');
        }
        
        // Eclipse closing animation
        loadingScreen.classList.add('active');
        eclipseOverlay.classList.remove('opening');
        eclipseOverlay.classList.add('closing');
        
        setTimeout(() => {
            // Return to real world
            window.oasisState.isInOasis = false;
            
            // Hide VR world
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', false);
            }
            
            // Hide headset overlay
            const vrOverlay = document.getElementById('vr-headset-overlay');
            const vrNose = document.getElementById('vr-headset-nose');
            const vrLensTint = document.getElementById('vr-headset-lens-tint');
            if (vrOverlay) vrOverlay.setAttribute('visible', false);
            if (vrNose) vrNose.setAttribute('visible', false);
            if (vrLensTint) vrLensTint.setAttribute('visible', false);
            
            // Restore original scene
            const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
            allEntities.forEach(entity => {
                const id = entity.getAttribute('id');
                if (id !== 'vr-world' && !entity.closest('#vr-world')) {
                    entity.setAttribute('visible', true);
                }
            });
            
            // Restore original background
            scene.setAttribute('background', 'color: #a8aeb5');
            scene.setAttribute('fog', 'type: exponential; color: #8a9098; density: 0.012');
            
            // Reset rig to original position
            const rig = document.getElementById('rig');
            if (rig && window.oasisState.originalRigPos) {
                rig.setAttribute('position', window.oasisState.originalRigPos);
            }
            
            // Reset headset to original position
            self.el.setAttribute('visible', true);
            self.el.setAttribute('position', window.oasisState.originalHeadsetPos);
            
            // Eclipse opening animation
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
