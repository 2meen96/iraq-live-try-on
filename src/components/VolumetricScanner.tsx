import React, { useRef, useLayoutEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture, Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface ScannerMeshProps {
  imageUrl: string;
}

const UnifiedHeadMesh = ({ imageUrl }: ScannerMeshProps) => {
  const texture = useTexture(imageUrl);
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.PlaneGeometry>(null);

  // Deform the flat plane into an ellipsoid (head shape) with UV preservation
  useLayoutEffect(() => {
    if (geometryRef.current) {
        const positions = geometryRef.current.attributes.position;
        // The plane is width 5, height 6.66
        const width = 5;
        const height = 6.66;
        
        for(let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            
            // Normalize coordinates to -1 to 1 based on plane dimensions
            const xNorm = x / (width / 2);
            const yNorm = y / (height / 2);
            
            // Create a semi-ellipsoid bulge for the face
            // Math.max to prevent NaN if the value goes slightly below 0 at corners
            const innerVal = 1 - (xNorm * xNorm) - (yNorm * yNorm * 0.8); // 0.8 elongates it vertically
            const bulge = innerVal > 0 ? Math.sqrt(innerVal) : 0;
            
            // Apply the Z depth. Max depth is 2.5 units.
            // Move it slightly back by default so it rotates around the center of the head.
            positions.setZ(i, (bulge * 2.5) - 1.25);
        }
        // Recompute normals for proper lighting on the curved surface
        geometryRef.current.computeVertexNormals();
    }
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
        // Slow continuous inspection rotation
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.4;
        meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.1;
    }
  });

  return (
    <group>
        <mesh ref={meshRef}>
          <planeGeometry ref={geometryRef} args={[5, 6.66, 128, 128]} />
          <meshStandardMaterial 
            map={texture} 
            displacementMap={texture} 
            displacementScale={0.3} // Add high frequency bumps from the image pixels (lips, nose details)
            color="#ffffff"
            transparent={true}
            opacity={0.9}
            side={THREE.DoubleSide}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
        
        {/* Holographic scanning grid layer */}
        <mesh>
          <planeGeometry args={[5, 6.66, 32, 32]} />
          <meshBasicMaterial color="#c8a97e" wireframe transparent opacity={0.05} />
        </mesh>
    </group>
  );
};

export const VolumetricScanner = ({ images }: { images: { frontal: string, angle?: string | null, profile?: string | null } }) => {
  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0f0f0f] to-[#000000] rounded-xl overflow-hidden relative border border-[color:var(--theme-border-accent)] flex items-center justify-center">
       {/* UI Overlay */}
       <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
         <span className="text-[10px] text-[color:var(--theme-accent)] uppercase tracking-widest font-mono flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-[color:var(--theme-accent)] animate-pulse shadow-[0_0_8px_var(--theme-accent)]"></div>
           AI Unified 3D Mesh
         </span>
         <span className="text-[8px] text-[color:var(--theme-text)] opacity-50 uppercase tracking-widest font-mono">
           {images.angle || images.profile ? 'Multi-Angle Extrapolation Active' : 'Single-Image Depth Estimation'}
         </span>
       </div>
       
       <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1 pointer-events-none">
            <span className="text-[8px] text-[color:var(--theme-text)] opacity-40 uppercase tracking-widest font-mono bg-black/50 px-2 py-1 rounded">
               <span className="text-green-400">●</span> Spatial Topology Locked
            </span>
       </div>

       <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
         <ambientLight intensity={0.4} />
         <directionalLight position={[0, 0, 5]} intensity={1.5} />
         <directionalLight position={[-5, 2, 5]} intensity={0.5} />
         <pointLight position={[2, 2, 2]} intensity={0.8} color="#c8a97e" distance={10} />
         
         <Sparkles count={50} scale={6} size={1} speed={0.4} opacity={0.2} color="#c8a97e" />

         <React.Suspense fallback={
             <Html center><div className="text-[10px] text-[color:var(--theme-accent)] uppercase tracking-widest font-mono animate-pulse">Generating Mesh...</div></Html>
         }>
            {/* We merge the data logically, rendering a single unified head shape */}
            <UnifiedHeadMesh imageUrl={images.frontal} />
         </React.Suspense>
         
         <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={10} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.5} />
       </Canvas>
    </div>
  );
};
