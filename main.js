
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
            this.el.setAttribute('visible', false);
            
            const elementsToHide = [
                'caravan',
                'parallax-close',
                'parallax-mid',
                'floor',
                'headset-overlay'
            ];
            
            elementsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.setAttribute('visible', false);
            });
            
            const oldLights = document.querySelectorAll('[light]:not(#vr-sun):not(#vr-ambient)');
            oldLights.forEach(light => {
                light.setAttribute('visible', false);
            });
            
            scene.setAttribute('background', 'color: #87CEEB');
            scene.setAttribute('fog', 'type: linear; color: #87CEEB; near: 10; far: 100');
            
            const vrWorld = document.getElementById('vr-world');
            if (vrWorld) {
                vrWorld.setAttribute('visible', true);
            }
        });
    }
});
