import 'aframe';
import './App.css';

export default function App() {
  return (
    <a-scene 
      embedded 
      vr-mode-ui="enabled: true"
      
    >
      {/* === ASSETS === */}
      <a-assets>
        <a-asset-item id="rv-model" src="/models/caravan/RV.glb"></a-asset-item>
      </a-assets>

      {/* === ATMOSPHÈRE === */}
      <a-sky color="#8a9aa5" />

      {/* === ÉCLAIRAGE === */}
      <a-light type="ambient" color="#7a8a9a" intensity="0.7" />
      <a-light type="directional" color="#b8c8d8" intensity="0.6" position="5 25 -30" />
      <a-light type="point" color="#ffc888" intensity="0.3" position="0 8 -20" distance="40" />

      {/* === CAMERA RIG VR === */}
      <a-entity id="rig" position="0 0 12">
        <a-camera 
          position="0 1.6 0" 
          look-controls 
          wasd-controls="acceleration: 15"
        >
          <a-cursor color="#ffffff" opacity="0.8" />
        </a-camera>
      </a-entity>

      {/* === SOL === */}
      <a-plane 
        position="0 0 0" 
        rotation="-90 0 0" 
        width="50" 
        height="150" 
        material="color: #4a4a45; roughness: 0.95"
      />


      <a-entity position="-5 0 8">
        {/* Poteaux verticaux */}
        <a-cylinder position="0 12 0" radius="0.12" height="24" material="color: #5a4a3a; metalness: 0.6; roughness: 0.8" />
        <a-cylinder position="2 12 0" radius="0.12" height="24" material="color: #5a4a3a; metalness: 0.6; roughness: 0.8" />
        <a-cylinder position="0 12 -2" radius="0.12" height="24" material="color: #5a4a3a; metalness: 0.6; roughness: 0.8" />
        <a-cylinder position="2 12 -2" radius="0.12" height="24" material="color: #5a4a3a; metalness: 0.6; roughness: 0.8" />
        
 </a-entity>

      {/* === CARAVANE RV === */}
      <a-entity 
        id="caravan"
        gltf-model="#rv-model"
        position="0 0 -8"
        rotation="0 -15 0"
        scale="1 1 1"
      ></a-entity>

    </a-scene>
  );
}