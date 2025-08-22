import React, { useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Cylinder, Sphere } from '@react-three/drei';
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import * as THREE from 'three';

interface LoadPoint {
  id: string;
  position: [number, number, number];
  weight: number;
}

interface BridgeProps {
  bridgeType: 'truss' | 'arch' | 'beam';
  loadPoints: LoadPoint[];
  onAddLoad: (position: [number, number, number]) => void;
}

// Truss Bridge Component
const TrussBridge: React.FC<{ loadPoints: LoadPoint[] }> = ({ loadPoints }) => {
  const bridgeRef = useRef<THREE.Group>(null);
  
  // Calculate stress colors based on load proximity
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const distance = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) + 
        Math.pow(position[2] - load.position[2], 2)
      );
      const stress = load.weight / (distance + 1);
      maxStress = Math.max(maxStress, stress);
    });
    
    if (maxStress < 100) return '#22c55e'; // Safe - green
    if (maxStress < 200) return '#eab308'; // Warning - yellow  
    if (maxStress < 300) return '#ef4444'; // Danger - red
    return '#dc2626'; // Critical - dark red
  };

  return (
    <group ref={bridgeRef} position={[0, 0, 0]}>
      {/* Main deck */}
      <Box args={[8, 0.2, 1]} position={[0, 2, 0]}>
        <meshStandardMaterial color={getStressColor([0, 2, 0])} />
      </Box>
      
      {/* Support beams */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = -4 + i;
        return (
          <group key={i}>
            {/* Vertical supports */}
            <Box args={[0.1, 2, 0.1]} position={[x, 1, 0]}>
              <meshStandardMaterial color={getStressColor([x, 1, 0])} />
            </Box>
            {/* Diagonal supports */}
            {i < 8 && (
              <>
                <Box args={[0.05, 1.4, 0.05]} position={[x + 0.5, 1, 0]} rotation={[0, 0, Math.PI / 4]}>
                  <meshStandardMaterial color={getStressColor([x + 0.5, 1, 0])} />
                </Box>
                <Box args={[0.05, 1.4, 0.05]} position={[x + 0.5, 1, 0]} rotation={[0, 0, -Math.PI / 4]}>
                  <meshStandardMaterial color={getStressColor([x + 0.5, 1, 0])} />
                </Box>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
};

// Arch Bridge Component
const ArchBridge: React.FC<{ loadPoints: LoadPoint[] }> = ({ loadPoints }) => {
  const bridgeRef = useRef<THREE.Group>(null);
  
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const distance = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) + 
        Math.pow(position[2] - load.position[2], 2)
      );
      const stress = load.weight / (distance + 1);
      maxStress = Math.max(maxStress, stress);
    });
    
    if (maxStress < 150) return '#22c55e';
    if (maxStress < 250) return '#eab308';
    if (maxStress < 350) return '#ef4444';
    return '#dc2626';
  };

  return (
    <group ref={bridgeRef}>
      {/* Bridge deck */}
      <Box args={[8, 0.2, 1]} position={[0, 2, 0]}>
        <meshStandardMaterial color={getStressColor([0, 2, 0])} />
      </Box>
      
      {/* Arch structure */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 15) * Math.PI;
        const x = Math.cos(angle) * 4;
        const y = Math.sin(angle) * 2;
        return (
          <Box key={i} args={[0.3, 0.3, 0.8]} position={[x, y, 0]} rotation={[0, 0, angle]}>
            <meshStandardMaterial color={getStressColor([x, y, 0])} />
          </Box>
        );
      })}
    </group>
  );
};

// Beam Bridge Component
const BeamBridge: React.FC<{ loadPoints: LoadPoint[] }> = ({ loadPoints }) => {
  const bridgeRef = useRef<THREE.Group>(null);
  
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const distance = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) + 
        Math.pow(position[2] - load.position[2], 2)
      );
      const stress = load.weight / (distance + 1);
      maxStress = Math.max(maxStress, stress);
    });
    
    if (maxStress < 80) return '#22c55e';
    if (maxStress < 160) return '#eab308';
    if (maxStress < 240) return '#ef4444';
    return '#dc2626';
  };

  // Simulate bridge bending under load
  const getBendingOffset = (x: number) => {
    let totalBend = 0;
    loadPoints.forEach(load => {
      const distance = Math.abs(x - load.position[0]);
      const bendingForce = load.weight / 1000;
      const bend = bendingForce * Math.exp(-distance * 0.5);
      totalBend += bend;
    });
    return -totalBend * 0.1; // Negative for downward bending
  };

  return (
    <group ref={bridgeRef}>
      {/* Bridge deck with bending simulation */}
      {Array.from({ length: 32 }, (_, i) => {
        const x = -4 + (i * 8) / 31;
        const bend = getBendingOffset(x);
        return (
          <Box key={i} args={[0.25, 0.4, 1]} position={[x, 2 + bend, 0]}>
            <meshStandardMaterial color={getStressColor([x, 2, 0])} />
          </Box>
        );
      })}
      
      {/* Support pillars */}
      <Box args={[0.4, 2, 0.4]} position={[-3, 1, 0]}>
        <meshStandardMaterial color={getStressColor([-3, 1, 0])} />
      </Box>
      <Box args={[0.4, 2, 0.4]} position={[3, 1, 0]}>
        <meshStandardMaterial color={getStressColor([3, 1, 0])} />
      </Box>
    </group>
  );
};

// Load Point Visualization
const LoadPoint: React.FC<{ load: LoadPoint }> = ({ load }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime;
    }
  });

  return (
    <group position={load.position}>
      <Sphere ref={meshRef} args={[0.2]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
      </Sphere>
      <Cylinder args={[0.05, 0.05, 0.5]} position={[0, 0.25, 0]}>
        <meshStandardMaterial color="#dc2626" />
      </Cylinder>
      <Text
        position={[0, 0.8, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {load.weight}kg
      </Text>
    </group>
  );
};

// Click Handler for Adding Loads
const ClickHandler: React.FC<{ onAddLoad: (position: [number, number, number]) => void }> = ({ onAddLoad }) => {
  const { camera, raycaster } = useThree();
  
  const handleClick = useCallback((event: any) => {
    const mouse = new THREE.Vector2(
      (event.point.x / 4) * 2 - 1,
      (event.point.z / 4) * 2 - 1
    );
    
    // Simplified click handling - use the intersection point directly
    const x = Math.max(-4, Math.min(4, event.point.x));
    const z = Math.max(-2, Math.min(2, event.point.z));
    
    onAddLoad([x, 2.2, z]);
  }, [onAddLoad]);

  return (
    <mesh onClick={handleClick} visible={false} position={[0, 2, 0]}>
      <planeGeometry args={[8, 4]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
};

// Main Bridge Component
const Bridge: React.FC<BridgeProps> = ({ bridgeType, loadPoints, onAddLoad }) => {
  const renderBridge = () => {
    switch (bridgeType) {
      case 'truss':
        return <TrussBridge loadPoints={loadPoints} />;
      case 'arch':
        return <ArchBridge loadPoints={loadPoints} />;
      case 'beam':
        return <BeamBridge loadPoints={loadPoints} />;
      default:
        return <TrussBridge loadPoints={loadPoints} />;
    }
  };

  return (
    <>
      {renderBridge()}
      {loadPoints.map((load) => (
        <LoadPoint key={load.id} load={load} />
      ))}
      <ClickHandler onAddLoad={onAddLoad} />
    </>
  );
};

// Main Simulator Component
interface BridgeSimulatorProps {
  bridgeType?: 'truss' | 'arch' | 'beam';
  loadPoints?: LoadPoint[];
  onBridgeTypeChange?: (type: 'truss' | 'arch' | 'beam') => void;
  onLoadPointsChange?: (loads: LoadPoint[]) => void;
}

const BridgeSimulator: React.FC<BridgeSimulatorProps> = ({
  bridgeType: externalBridgeType,
  loadPoints: externalLoadPoints,
  onBridgeTypeChange,
  onLoadPointsChange
}) => {
  const [internalBridgeType, setInternalBridgeType] = useState<'truss' | 'arch' | 'beam'>('truss');
  const [internalLoadPoints, setInternalLoadPoints] = useState<LoadPoint[]>([]);
  const [currentWeight, setCurrentWeight] = useState(100);

  const bridgeType = externalBridgeType || internalBridgeType;
  const loadPoints = externalLoadPoints || internalLoadPoints;

  const addLoad = useCallback((position: [number, number, number]) => {
    const newLoad: LoadPoint = {
      id: Date.now().toString(),
      position,
      weight: currentWeight
    };
    const newLoadPoints = [...loadPoints, newLoad];
    
    if (onLoadPointsChange) {
      onLoadPointsChange(newLoadPoints);
    } else {
      setInternalLoadPoints(newLoadPoints);
    }
  }, [currentWeight, loadPoints, onLoadPointsChange]);

  const clearLoads = useCallback(() => {
    if (onLoadPointsChange) {
      onLoadPointsChange([]);
    } else {
      setInternalLoadPoints([]);
    }
  }, [onLoadPointsChange]);

  const handleBridgeTypeChange = useCallback((type: 'truss' | 'arch' | 'beam') => {
    if (onBridgeTypeChange) {
      onBridgeTypeChange(type);
    } else {
      setInternalBridgeType(type);
    }
  }, [onBridgeTypeChange]);

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 60 }}
        className="scene-container"
        shadows
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[0, 10, 0]} intensity={0.5} />
        
        <Bridge 
          bridgeType={bridgeType} 
          loadPoints={loadPoints} 
          onAddLoad={addLoad}
        />
        
        {/* Ground plane */}
        <mesh position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={4}
          maxDistance={20}
        />
      </Canvas>
      
      {/* Simulation Controls */}
      <div className="absolute top-4 left-4 space-y-4">
        <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border">
          <h3 className="font-semibold mb-3">Bridge Type</h3>
          <div className="flex gap-2">
            {['truss', 'arch', 'beam'].map((type) => (
              <button
                key={type}
                onClick={() => handleBridgeTypeChange(type as any)}
                className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                  bridgeType === type
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border">
          <h3 className="font-semibold mb-3">Load Weight</h3>
          <input
            type="range"
            min="50"
            max="500"
            step="25"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(Number(e.target.value))}
            className="w-full mb-2"
          />
          <div className="text-sm text-muted-foreground">{currentWeight} kg</div>
        </div>
        
        <button
          onClick={clearLoads}
          className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
        >
          Clear All Loads
        </button>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border max-w-sm">
        <h3 className="font-semibold mb-2">Instructions</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Click on the bridge to add loads</li>
          <li>• Drag to rotate, scroll to zoom</li>
          <li>• Colors show stress levels:</li>
          <li className="stress-safe">  Green = Safe</li>
          <li className="stress-warning">  Yellow = Warning</li>
          <li className="stress-danger">  Red = Danger</li>
        </ul>
      </div>
    </div>
  );
};

export default BridgeSimulator;