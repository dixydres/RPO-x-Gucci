
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

AFRAME.registerComponent('headset-toggle', {
    init: function() {
        const scene = document.querySelector('a-scene');
        
        this.el.addEventListener('click', () => {
            // Cache le cube lui-même
            this.el.setAttribute('visible', false);
            
            // Cache TOUS les éléments de l'ancienne scène (sauf rig et vr-world)
            const allEntities = scene.querySelectorAll('a-entity, a-plane, a-box, a-cylinder, a-sphere');
            allEntities.forEach(entity => {
                const id = entity.getAttribute('id');
                // Garde seulement le rig et vr-world visibles
                if (id !== 'rig' && id !== 'vr-world' && !entity.closest('#rig') && !entity.closest('#vr-world')) {
                    entity.setAttribute('visible', false);
                }
            });
            
            // Cache tous les anciens lights
            const oldLights = document.querySelectorAll('[light]:not(#vr-sun):not(#vr-ambient)');
            oldLights.forEach(light => {
                light.setAttribute('visible', false);
            });
            
            // Change le background en ciel bleu clair céleste (impression d'être dans les nuages)
            scene.setAttribute('background', 'color: #B8D4E8');
            // Brouillard blanc pour l'effet nuages
            scene.setAttribute('fog', 'type: exponential; color: #FFFFFF; density: 0.015');
            
            // Affiche le nouveau monde VR
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', true);
            }
            
            // Téléporte le joueur sur une petite île flottante (îlot avec temple lointain)
            const rig = document.getElementById('rig');
            if (rig) {
                // Position de l'îlot avec temple: position="0 12 -120"
                // On place le joueur un peu au-dessus: y=14.5 (sur le gazon)
                rig.setAttribute('position', '0 16 -56.69');
            }
            
            // Affiche l'effet de bordure noire du casque VR (simulation de porter le casque)
            const vrOverlay = document.getElementById('vr-headset-overlay');
            if (vrOverlay) {
                vrOverlay.setAttribute('visible', true);
            }
        });
    }
});

// Composant pour forcer le chargement correct des textures du mansion
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
                            // Applique la texture seulement au matériau "Main"
                            if (mat.name === 'Main') {
                                mat.map = texture;
                                mat.needsUpdate = true;
                            }
                            // Force le rafraîchissement de tous les matériaux
                            if (mat.map) {
                                mat.map.needsUpdate = true;
                            }
                            // Active les couleurs vertex si disponibles
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
