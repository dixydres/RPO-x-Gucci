
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
            
            // Change le background en ciel bleu
            scene.setAttribute('background', 'color: #87CEEB');
            scene.setAttribute('fog', 'type: linear; color: #87CEEB; near: 10; far: 100');
            
            // Affiche le nouveau monde VR
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', true);
            }
            
            // Affiche l'effet de bordure noire du casque VR (simulation de porter le casque)
            const vrOverlay = document.getElementById('vr-headset-overlay');
            if (vrOverlay) {
                vrOverlay.setAttribute('visible', true);
            }
        });
    }
});
