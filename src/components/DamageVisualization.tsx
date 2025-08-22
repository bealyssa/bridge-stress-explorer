import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface CrackData {
  id: string;
  points: [number, number, number][];
  severity: number;
  type: 'surface' | 'structural' | 'critical';
}

interface DamageVisualizationProps {
  cracks: CrackData[];
  integrity: number;
  failureMode: string;
}

// Crack Line Component  
const CrackLine: React.FC<{ crack: CrackData }> = ({ crack }) => {
  const lineRef = useRef<any>(null);
  
  useFrame((state) => {
    if (lineRef.current && crack.type === 'critical') {
      // Animate critical cracks with pulsing effect
      if (lineRef.current.material && 'opacity' in lineRef.current.material) {
        lineRef.current.material.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
      }
    }
  });

  const getCrackColor = () => {
    switch (crack.type) {
      case 'surface': return '#8b5cf6'; // Purple for surface cracks
      case 'structural': return '#ef4444'; // Red for structural damage
      case 'critical': return '#dc2626'; // Dark red for critical failure
      default: return '#6b7280';
    }
  };

  const getLineWidth = () => {
    return crack.severity * 8 + 2; // Width based on severity
  };

  return (
    <Line
      ref={lineRef}
      points={crack.points}
      color={getCrackColor()}
      lineWidth={getLineWidth()}
      transparent
      opacity={crack.severity * 0.8 + 0.2}
    />
  );
};

// Debris Particles for Critical Failure
const DebrisParticle: React.FC<{ position: [number, number, number]; velocity: [number, number, number] }> = ({ 
  position: initialPosition, 
  velocity 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const position = useRef(initialPosition);
  const vel = useRef(velocity);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Apply gravity and movement
      vel.current[1] -= delta * 9.8; // Gravity
      position.current[0] += vel.current[0] * delta;
      position.current[1] += vel.current[1] * delta;
      position.current[2] += vel.current[2] * delta;

      // Stop at ground level
      if (position.current[1] <= 0) {
        position.current[1] = 0;
        vel.current = [0, 0, 0];
      }

      meshRef.current.position.set(...position.current);
      meshRef.current.rotation.x += delta * 2;
      meshRef.current.rotation.y += delta * 1.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color="#8b5cf6" />
    </mesh>
  );
};

// Main Damage Visualization Component
const DamageVisualization: React.FC<DamageVisualizationProps> = ({ 
  cracks, 
  integrity, 
  failureMode 
}) => {
  const debrisParticles = React.useMemo(() => {
    if (integrity > 0.3 || failureMode === 'none') return [];
    
    // Generate debris particles for critical damage
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        id: i,
        position: [
          (Math.random() - 0.5) * 8,
          2 + Math.random() * 2,
          (Math.random() - 0.5) * 2
        ] as [number, number, number],
        velocity: [
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        ] as [number, number, number]
      });
    }
    return particles;
  }, [integrity, failureMode]);

  return (
    <group>
      {/* Render cracks */}
      {cracks.map((crack) => (
        <CrackLine key={crack.id} crack={crack} />
      ))}
      
      {/* Structural deformation indicators */}
      {integrity < 0.7 && (
        <>
          {/* Stress concentration points */}
          <Sphere args={[0.1]} position={[0, 2.1, 0]}>
            <meshStandardMaterial 
              color="#ef4444" 
              emissive="#ef4444" 
              emissiveIntensity={0.5}
              transparent
              opacity={0.7}
            />
          </Sphere>
          
          {/* Deformation warning indicators */}
          {Array.from({ length: 3 }, (_, i) => (
            <Sphere key={i} args={[0.05]} position={[-2 + i * 2, 2.05, 0]}>
              <meshStandardMaterial 
                color="#fbbf24" 
                emissive="#fbbf24" 
                emissiveIntensity={0.3}
              />
            </Sphere>
          ))}
        </>
      )}
      
      {/* Critical failure effects */}
      {integrity < 0.3 && (
        <>
          {/* Dust/smoke effect simulation */}
          {Array.from({ length: 10 }, (_, i) => (
            <Sphere key={`dust-${i}`} args={[0.03]} position={[
              (Math.random() - 0.5) * 6,
              1.8 + Math.random() * 0.5,
              (Math.random() - 0.5) * 1
            ]}>
              <meshBasicMaterial 
                color="#9ca3af" 
                transparent 
                opacity={0.3}
              />
            </Sphere>
          ))}
          
          {/* Debris particles */}
          {debrisParticles.map((particle) => (
            <DebrisParticle
              key={particle.id}
              position={particle.position}
              velocity={particle.velocity}
            />
          ))}
        </>
      )}
      
      {/* Complete failure visualization */}
      {integrity < 0.1 && (
        <group>
          {/* Collapse effect - split bridge sections */}
          <mesh position={[-2, 1.5, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[3, 0.2, 1]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[2, 1.2, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[3, 0.2, 1]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        </group>
      )}
    </group>
  );
};

export default DamageVisualization;