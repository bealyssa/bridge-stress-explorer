import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Cylinder, Sphere, Line } from '@react-three/drei';
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import * as THREE from 'three';
import DamageVisualization from './DamageVisualization';

interface LoadPoint {
  id: string;
  position: [number, number, number];
  weight: number;
}

interface CrackData {
  id: string;
  points: [number, number, number][];
  severity: number; // 0-1, where 1 is complete failure
  type: 'surface' | 'structural' | 'critical';
}

interface DamageState {
  cracks: CrackData[];
  overallIntegrity: number; // 0-1, where 0 is complete failure
  failureMode: 'none' | 'bending' | 'shear' | 'buckling' | 'collapse';
  warningLevel: 'safe' | 'caution' | 'danger' | 'critical' | 'failure';
}

interface BridgeProps {
  bridgeType: 'truss' | 'arch' | 'beam';
  loadPoints: LoadPoint[];
  onAddLoad: (position: [number, number, number]) => void;
  damageState: DamageState;
}

// Damage calculation utilities
const calculateDamage = (bridgeType: string, loadPoints: LoadPoint[]): DamageState => {
  const bridgeCapacities = {
    truss: { max: 2000, safe: 1600, critical: 1800 },
    arch: { max: 3000, safe: 2400, critical: 2700 },
    beam: { max: 1500, safe: 1200, critical: 1350 }
  };

  const capacity = bridgeCapacities[bridgeType as keyof typeof bridgeCapacities];
  const totalWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
  
  let damageState: DamageState = {
    cracks: [],
    overallIntegrity: 1,
    failureMode: 'none',
    warningLevel: 'safe'
  };

  // Calculate overall integrity
  if (totalWeight > capacity.max) {
    damageState.overallIntegrity = Math.max(0, 1 - (totalWeight - capacity.max) / capacity.max);
    damageState.failureMode = 'collapse';
    damageState.warningLevel = 'failure';
  } else if (totalWeight > capacity.critical) {
    damageState.overallIntegrity = 0.3 + (0.7 * (capacity.max - totalWeight) / (capacity.max - capacity.critical));
    damageState.failureMode = bridgeType === 'beam' ? 'bending' : bridgeType === 'truss' ? 'buckling' : 'shear';
    damageState.warningLevel = 'critical';
  } else if (totalWeight > capacity.safe) {
    damageState.overallIntegrity = 0.7 + (0.3 * (capacity.critical - totalWeight) / (capacity.critical - capacity.safe));
    damageState.warningLevel = 'danger';
  } else if (totalWeight > capacity.safe * 0.8) {
    damageState.warningLevel = 'caution';
  }

  // Generate cracks based on damage
  if (damageState.overallIntegrity < 0.8) {
    damageState.cracks = generateCracks(bridgeType, loadPoints, damageState.overallIntegrity);
  }

  return damageState;
};

const generateCracks = (bridgeType: string, loadPoints: LoadPoint[], integrity: number): CrackData[] => {
  const cracks: CrackData[] = [];
  const damageLevel = 1 - integrity;

  loadPoints.forEach((load, index) => {
    const stressRadius = (load.weight / 200) * damageLevel;
    
    if (damageLevel > 0.2) {
      // Surface cracks around high-stress areas
      const numCracks = Math.floor(damageLevel * 5);
      for (let i = 0; i < numCracks; i++) {
        const angle = (i / numCracks) * Math.PI * 2;
        const crackLength = stressRadius * (0.5 + Math.random() * 0.5);
        
        cracks.push({
          id: `surface-${index}-${i}`,
          points: [
            load.position,
            [
              load.position[0] + Math.cos(angle) * crackLength,
              load.position[1] - 0.1,
              load.position[2] + Math.sin(angle) * crackLength
            ]
          ],
          severity: Math.min(1, damageLevel * 1.5),
          type: 'surface'
        });
      }
    }

    if (damageLevel > 0.5) {
      // Structural cracks for severe damage
      cracks.push({
        id: `structural-${index}`,
        points: [
          [load.position[0] - 1, load.position[1], load.position[2]],
          [load.position[0] + 1, load.position[1], load.position[2]]
        ],
        severity: damageLevel,
        type: 'structural'
      });
    }

    if (damageLevel > 0.8) {
      // Critical failure cracks
      cracks.push({
        id: `critical-${index}`,
        points: [
          [load.position[0], load.position[1] + 0.5, load.position[2]],
          [load.position[0], load.position[1] - 0.5, load.position[2]]
        ],
        severity: 1,
        type: 'critical'
      });
    }
  });

  return cracks;
};

// Enhanced Truss Bridge with damage effects
const TrussBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState }> = ({ loadPoints, damageState }) => {
  const bridgeRef = useRef<THREE.Group>(null);
  
  // Enhanced stress calculation including damage
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
    
    // Apply damage multiplier
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 2;
    maxStress *= damageMultiplier;
    
    if (maxStress < 100) return '#22c55e'; // Safe - green
    if (maxStress < 200) return '#eab308'; // Warning - yellow  
    if (maxStress < 300) return '#ef4444'; // Danger - red
    return '#dc2626'; // Critical - dark red
  };

  // Apply damage deformation
  const getDamageOffset = (position: [number, number, number]) => {
    const damage = 1 - damageState.overallIntegrity;
    const randomOffset = damage * 0.2 * (Math.random() - 0.5);
    return damage > 0.3 ? randomOffset : 0;
  };

  return (
    <group ref={bridgeRef} position={[0, 0, 0]}>
      {/* Main deck with potential sagging */}
      <Box 
        args={[8, 0.2, 1]} 
        position={[0, 2 + getDamageOffset([0, 2, 0]), 0]}
        rotation={damageState.overallIntegrity < 0.5 ? [0, 0, (1 - damageState.overallIntegrity) * 0.1] : [0, 0, 0]}
      >
        <meshStandardMaterial 
          color={getStressColor([0, 2, 0])} 
          roughness={damageState.overallIntegrity < 0.7 ? 0.8 : 0.4}
        />
      </Box>
      
      {/* Support beams with damage effects */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = -4 + i;
        const damageOffset = getDamageOffset([x, 1, 0]);
        const isCriticallyDamaged = damageState.overallIntegrity < 0.3;
        
        return (
          <group key={i}>
            {/* Vertical supports */}
            <Box 
              args={[0.1, 2, 0.1]} 
              position={[x + damageOffset, 1, 0]}
              rotation={isCriticallyDamaged ? [0, 0, damageOffset * 2] : [0, 0, 0]}
            >
              <meshStandardMaterial 
                color={getStressColor([x, 1, 0])} 
                roughness={damageState.overallIntegrity < 0.7 ? 0.9 : 0.4}
              />
            </Box>
            {/* Diagonal supports with potential failure */}
            {i < 8 && damageState.overallIntegrity > 0.2 && (
              <>
                <Box 
                  args={[0.05, 1.4, 0.05]} 
                  position={[x + 0.5 + damageOffset, 1, 0]} 
                  rotation={[0, 0, Math.PI / 4 + damageOffset]}
                >
                  <meshStandardMaterial 
                    color={getStressColor([x + 0.5, 1, 0])}
                    transparent
                    opacity={damageState.overallIntegrity < 0.5 ? 0.7 : 1}
                  />
                </Box>
                <Box 
                  args={[0.05, 1.4, 0.05]} 
                  position={[x + 0.5 + damageOffset, 1, 0]} 
                  rotation={[0, 0, -Math.PI / 4 - damageOffset]}
                >
                  <meshStandardMaterial 
                    color={getStressColor([x + 0.5, 1, 0])}
                    transparent
                    opacity={damageState.overallIntegrity < 0.5 ? 0.7 : 1}
                  />
                </Box>
              </>
            )}
          </group>
        );
      })}
      
      {/* Damage visualization */}
      <DamageVisualization 
        cracks={damageState.cracks}
        integrity={damageState.overallIntegrity}
        failureMode={damageState.failureMode}
      />
    </group>
  );
};

// Enhanced Arch Bridge with damage effects
const ArchBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState }> = ({ loadPoints, damageState }) => {
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
    
    // Apply damage multiplier
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 1.5;
    maxStress *= damageMultiplier;
    
    if (maxStress < 150) return '#22c55e';
    if (maxStress < 250) return '#eab308';
    if (maxStress < 350) return '#ef4444';
    return '#dc2626';
  };

  return (
    <group ref={bridgeRef}>
      {/* Bridge deck with potential cracking */}
      <Box 
        args={[8, 0.2, 1]} 
        position={[0, 2, 0]}
        rotation={damageState.overallIntegrity < 0.4 ? [0, 0, (1 - damageState.overallIntegrity) * 0.05] : [0, 0, 0]}
      >
        <meshStandardMaterial 
          color={getStressColor([0, 2, 0])}
          roughness={damageState.overallIntegrity < 0.6 ? 0.9 : 0.3}
        />
      </Box>
      
      {/* Arch structure with keystone failure simulation */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 15) * Math.PI;
        const x = Math.cos(angle) * 4;
        const y = Math.sin(angle) * 2;
        const isKeystone = i === 7 || i === 8; // Center stones
        const keystoneFailure = isKeystone && damageState.overallIntegrity < 0.3;
        
        if (keystoneFailure) return null; // Keystone has failed
        
        return (
          <Box 
            key={i} 
            args={[0.3, 0.3, 0.8]} 
            position={[x, y, 0]} 
            rotation={[0, 0, angle + (damageState.overallIntegrity < 0.5 ? (Math.random() - 0.5) * 0.2 : 0)]}
          >
            <meshStandardMaterial 
              color={getStressColor([x, y, 0])}
              transparent
              opacity={damageState.overallIntegrity < 0.4 ? 0.8 : 1}
              roughness={damageState.overallIntegrity < 0.6 ? 0.8 : 0.4}
            />
          </Box>
        );
      })}
      
      {/* Damage visualization */}
      <DamageVisualization 
        cracks={damageState.cracks}
        integrity={damageState.overallIntegrity}
        failureMode={damageState.failureMode}
      />
    </group>
  );
};

// Enhanced Beam Bridge with realistic bending and failure
const BeamBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState }> = ({ loadPoints, damageState }) => {
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
    
    // Apply damage multiplier - beams are more susceptible to failure
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 3;
    maxStress *= damageMultiplier;
    
    if (maxStress < 80) return '#22c55e';
    if (maxStress < 160) return '#eab308';
    if (maxStress < 240) return '#ef4444';
    return '#dc2626';
  };

  // Enhanced bending simulation with damage effects
  const getBendingOffset = (x: number) => {
    let totalBend = 0;
    loadPoints.forEach(load => {
      const distance = Math.abs(x - load.position[0]);
      const bendingForce = load.weight / 1000;
      const bend = bendingForce * Math.exp(-distance * 0.5);
      totalBend += bend;
    });
    
    // Amplify bending with damage
    const damageAmplifier = 1 + (1 - damageState.overallIntegrity) * 2;
    return -totalBend * 0.1 * damageAmplifier; // Negative for downward bending
  };

  // Get rotation for extreme bending
  const getBendingRotation = (x: number) => {
    if (damageState.overallIntegrity > 0.4) return 0;
    const damage = 1 - damageState.overallIntegrity;
    return (Math.sin(x) * damage * 0.3);
  };

  return (
    <group ref={bridgeRef}>
      {/* Bridge deck with progressive failure simulation */}
      {Array.from({ length: 32 }, (_, i) => {
        const x = -4 + (i * 8) / 31;
        const bend = getBendingOffset(x);
        const rotation = getBendingRotation(x);
        const centerFailure = Math.abs(x) < 0.5 && damageState.overallIntegrity < 0.2;
        
        if (centerFailure) return null; // Center section has collapsed
        
        return (
          <Box 
            key={i} 
            args={[0.25, 0.4, 1]} 
            position={[x, 2 + bend, 0]}
            rotation={[0, 0, rotation]}
          >
            <meshStandardMaterial 
              color={getStressColor([x, 2, 0])}
              transparent
              opacity={damageState.overallIntegrity < 0.3 ? 0.7 : 1}
              roughness={damageState.overallIntegrity < 0.6 ? 0.9 : 0.4}
            />
          </Box>
        );
      })}
      
      {/* Support pillars with potential foundation failure */}
      <Box 
        args={[0.4, 2, 0.4]} 
        position={[-3, 1, 0]}
        rotation={damageState.overallIntegrity < 0.3 ? [0, 0, (1 - damageState.overallIntegrity) * 0.2] : [0, 0, 0]}
      >
        <meshStandardMaterial 
          color={getStressColor([-3, 1, 0])}
          roughness={damageState.overallIntegrity < 0.6 ? 0.8 : 0.4}
        />
      </Box>
      <Box 
        args={[0.4, 2, 0.4]} 
        position={[3, 1, 0]}
        rotation={damageState.overallIntegrity < 0.3 ? [0, 0, -(1 - damageState.overallIntegrity) * 0.2] : [0, 0, 0]}
      >
        <meshStandardMaterial 
          color={getStressColor([3, 1, 0])}
          roughness={damageState.overallIntegrity < 0.6 ? 0.8 : 0.4}
        />
      </Box>
      
      {/* Damage visualization */}
      <DamageVisualization 
        cracks={damageState.cracks}
        integrity={damageState.overallIntegrity}
        failureMode={damageState.failureMode}
      />
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

// Main Bridge Component with damage integration
const Bridge: React.FC<BridgeProps> = ({ bridgeType, loadPoints, onAddLoad, damageState }) => {
  const renderBridge = () => {
    switch (bridgeType) {
      case 'truss':
        return <TrussBridge loadPoints={loadPoints} damageState={damageState} />;
      case 'arch':
        return <ArchBridge loadPoints={loadPoints} damageState={damageState} />;
      case 'beam':
        return <BeamBridge loadPoints={loadPoints} damageState={damageState} />;
      default:
        return <TrussBridge loadPoints={loadPoints} damageState={damageState} />;
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
  
  // Calculate damage state in real-time
  const damageState = useMemo(() => 
    calculateDamage(bridgeType, loadPoints), 
    [bridgeType, loadPoints]
  );

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
          damageState={damageState}
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
      
      {/* Enhanced Status Display */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border max-w-sm">
        <h3 className="font-semibold mb-2">Bridge Status</h3>
        <div className={`text-lg font-bold mb-2 ${
          damageState.warningLevel === 'safe' ? 'text-stress-safe' :
          damageState.warningLevel === 'caution' ? 'text-stress-warning' :
          damageState.warningLevel === 'danger' ? 'text-stress-danger' : 
          'text-stress-critical'
        }`}>
          {damageState.warningLevel.toUpperCase()}
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>Integrity: {Math.round(damageState.overallIntegrity * 100)}%</div>
          {damageState.failureMode !== 'none' && (
            <div className="text-stress-critical font-semibold">
              Failure Mode: {damageState.failureMode}
            </div>
          )}
          <div>Active Cracks: {damageState.cracks.length}</div>
          
          {damageState.overallIntegrity < 0.5 && (
            <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs">
              ⚠️ Critical structural damage detected!
            </div>
          )}
        </div>
        
        <div className="mt-3 pt-2 border-t border-border">
          <h4 className="font-semibold text-xs mb-1">Controls</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Click bridge to add loads</li>
            <li>• Drag to rotate, scroll to zoom</li>
            <li>• Watch for structural damage</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BridgeSimulator;