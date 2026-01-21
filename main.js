
AFRAME.registerComponent('headset-toggle', {
    init: function() {
        const scene = document.querySelector('a-scene');
        
        this.el.addEventListener('click', () => {
            // Cache le casque
            this.el.setAttribute('visible', false);
            
            // Cache tous les éléments de la vieille scène
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
        });
    }
});