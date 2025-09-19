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
  
  // Realistic stress color gradient
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const dist = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) +
        Math.pow(position[2] - load.position[2], 2)
      );
      maxStress += load.weight / (1 + dist * 2);
    });
    // Damage amplifies stress
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 2.5;
    maxStress *= damageMultiplier;
    if (maxStress < 100) return '#22c55e'; // green
    if (maxStress < 200) return '#eab308'; // yellow
    if (maxStress < 300) return '#ef4444'; // red
    return '#dc2626'; // dark red
  };

  // Realistic deformation: nodes sag based on local stress
  const getDamageOffset = (position: [number, number, number]) => {
    let localStress = 0;
    loadPoints.forEach(load => {
      const dist = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) +
        Math.pow(position[2] - load.position[2], 2)
      );
      localStress += load.weight / (1 + dist * 2);
    });
    const damage = 1 - damageState.overallIntegrity;
    // Sag more as damage increases
    return -localStress * 0.005 * (1 + damage * 2);
  };

  // Collapse: break apart when integrity is very low
  const collapsePosition: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, -2, 0] : [0, 0, 0];
  const collapseRotation: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, 0, 0.5] : [0, 0, 0];

  return (
    <group ref={bridgeRef} position={collapsePosition} rotation={collapseRotation}>
      {/* Truss nodes and beams */}
      {Array.from({ length: 9 }, (_, i) => {
        const x = -4 + i;
        const y = 2 + getDamageOffset([x, 2, 0]);
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color={getStressColor([x, y, 0])} />
          </mesh>
        );
      })}
      {/* Truss beams */}
      {Array.from({ length: 8 }, (_, i) => {
        const x1 = -4 + i;
        const x2 = x1 + 1;
        const y1 = 2 + getDamageOffset([x1, 2, 0]);
        const y2 = 2 + getDamageOffset([x2, 2, 0]);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[1, 0.1, 0.2]} />
            <meshStandardMaterial color={getStressColor([(x1 + x2) / 2, (y1 + y2) / 2, 0])} />
          </mesh>
        );
      })}
      {/* Collapse debris if failed */}
      {damageState.overallIntegrity < 0.1 && (
        <mesh position={[0, -2.5, 0]} rotation={[0, 0, 0.7]}>
          <boxGeometry args={[8, 0.2, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      )}
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
  
  // Realistic arch stress color
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const dist = Math.sqrt(
        Math.pow(position[0] - load.position[0], 2) +
        Math.pow(position[2] - load.position[2], 2)
      );
      maxStress += load.weight / (1 + dist * 2);
    });
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 2;
    maxStress *= damageMultiplier;
    if (maxStress < 150) return '#c97a3d'; // wood color
    if (maxStress < 250) return '#eab308';
    if (maxStress < 350) return '#ef4444';
    return '#dc2626';
  };

  // Arch deformation: arch sags and flattens as integrity drops
  const getArchY = (x: number) => {
    const archHeight = 2.2 - Math.abs(x) * 0.12;
    const damage = 1 - damageState.overallIntegrity;
    return archHeight - damage * Math.abs(x) * 0.18;
  };

  // Collapse effect
  const collapsePosition: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, -2, 0] : [0, 0, 0];
  const collapseRotation: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, 0, -0.5] : [0, 0, 0];

  // Arch curve points for two arches (z = -archOffset, z = +archOffset)
  const archHeight = 7.0; // much taller arch
  const archSpan = 28; // arch spans the full bridge length
  const totalBridgeLength = 28; // total bridge length
  const archBaseY = 2.2;
  const archOffset = 0.7; // increased arch spacing
  const archPointsLeft: [number, number, number][] = Array.from({ length: 48 }, (_, i) => {
    const t = i / 47;
    const x = -archSpan / 2 + t * archSpan;
    const y = archBaseY + archHeight * (1 - Math.pow((x / (archSpan / 2)), 2));
    return [x, y, -archOffset];
  });
  const archPointsRight: [number, number, number][] = Array.from({ length: 48 }, (_, i) => {
    const t = i / 47;
    const x = -archSpan / 2 + t * archSpan;
    const y = archBaseY + archHeight * (1 - Math.pow((x / (archSpan / 2)), 2));
    return [x, y, archOffset];
  });

  // Deck points (smooth continuous surface)
  const deckY = archBaseY;
  const deckWidth = archOffset * 3.2; // wider deck for vehicles
  const deckCurveHeight = 1.5; // moderate curve height for smooth arch
  const deckPoints: [number, number, number][] = Array.from({ length: 48 }, (_, i) => {
    const x = -totalBridgeLength / 2 + i * (totalBridgeLength / 47);
    // Only apply curve in the arch section
    const y = deckY + (Math.abs(x) <= archSpan / 2 
      ? deckCurveHeight * (1 - Math.pow(x / (archSpan / 2), 2))
      : 0);
    return [x, y, 0];
  });

  return (
    <group ref={bridgeRef} position={collapsePosition} rotation={collapseRotation}>
      {/* Left arch */}
      <Line
        points={archPointsLeft}
        color="#c97a3d"
        lineWidth={8}
      />
      {/* Right arch */}
      <Line
        points={archPointsRight}
        color="#c97a3d"
        lineWidth={8}
      />
      {/* Connect arches with horizontal beams */}
      {Array.from({ length: 12 }, (_, i) => {
        const idx = i * 4;
        if (idx >= archPointsLeft.length || idx >= archPointsRight.length) return null;
        const left = archPointsLeft[idx];
        const right = archPointsRight[idx];
        return (
          <mesh key={i} position={[(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, 0]}>
            <boxGeometry args={[0.08, 0.08, deckWidth]} />
            <meshStandardMaterial color="#a0522d" />
          </mesh>
        );
      })}
      {/* Continuous bridge deck surface with wooden planks texture */}
      <group>
        {Array.from({ length: 1 }, (_, i) => {
          const vertices = [];
          const uvs = [];
          const indices = [];
          const segments = 50;

          for (let i = 0; i <= segments; i++) {
            const x = -totalBridgeLength / 2 + (i * totalBridgeLength / segments);
            const y = deckY + deckCurveHeight * Math.pow(1 - Math.pow(x / (totalBridgeLength / 2), 2), 0.8);
            
            // Add vertices for both sides of the deck
            vertices.push(x, y, -deckWidth / 2); // Left side
            vertices.push(x, y, deckWidth / 2);  // Right side
            
            // UV coordinates for texture mapping
            uvs.push(i / segments, 0);
            uvs.push(i / segments, 1);
            
            // Create triangles
            if (i < segments) {
              const base = i * 2;
              indices.push(base, base + 1, base + 2);
              indices.push(base + 1, base + 3, base + 2);
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
          geometry.setIndex(indices);

          return (
            <>
              {/* Main wooden surface with planks texture */}
              <mesh key="deck-base" geometry={geometry}>
                <meshStandardMaterial 
                  color="#995D27"
                  roughness={0.9}
                  metalness={0.0}
                />
              </mesh>
              
              {/* Bottom surface for thickness */}
              <mesh key="deck-bottom" geometry={geometry} position={[0, -0.4, 0]}>
                <meshStandardMaterial 
                  color="#995D27"
                  roughness={0.9}
                  metalness={0.0}
                />
              </mesh>

              {/* Planks overlay for texture */}
              <mesh key="planks-texture" geometry={geometry} position={[0, 0.01, 0]}>
                <meshBasicMaterial 
                  color="#995D27"
                  opacity={1.0}
                  transparent={false}
                />
              </mesh>
            </>
          );
        })}
      </group>
      {/* Railings (both sides, realistic posts and bars) */}
      {/* Railings that follow the deck curve */}
      {(() => {
        const segments = 48;
        const vertices = [];
        const railHeight = 0.7;
        
        // Calculate vertices for the curved path
        for (let i = 0; i <= segments; i++) {
          const x = -totalBridgeLength / 2 + (i * totalBridgeLength / segments);
          const y = deckY + deckCurveHeight * Math.pow(1 - Math.pow(x / (totalBridgeLength / 2), 2), 0.8) + 0.18;
          vertices.push([x, y]);
        }

        return (
          <>
            {/* Left side railings */}
            {vertices.map((pos, i) => {
              if (i % 2 === 0) {
                return (
                  <mesh key={`post-left-${i}`} position={[pos[0], pos[1] + railHeight/2, -deckWidth/2 - 0.09]}>
                    <boxGeometry args={[0.04, railHeight, 0.04]} />
                    <meshStandardMaterial color="#a0522d" />
                  </mesh>
                );
              }
            })}

            {/* Right side railings */}
            {vertices.map((pos, i) => {
              if (i % 2 === 0) {
                return (
                  <mesh key={`post-right-${i}`} position={[pos[0], pos[1] + railHeight/2, deckWidth/2 + 0.09]}>
                    <boxGeometry args={[0.04, railHeight, 0.04]} />
                    <meshStandardMaterial color="#a0522d" />
                  </mesh>
                );
              }
            })}

            {/* Horizontal rails - using curved geometry */}
            {[0, 1, 2, 3].map((level) => {
              const railGeometryLeft = new THREE.BufferGeometry();
              const railGeometryRight = new THREE.BufferGeometry();
              const railVerts = [];
              const railVertsRight = [];

              // Adjust height and thickness based on level
              const height = level === 0 ? 0.15 : (level === 3 ? 0.7 : 0.25 + level * 0.2);
              const thickness = level === 0 ? 0.08 : 0.04; // Bottom rail is thicker

              vertices.forEach((pos) => {
                railVerts.push(
                  pos[0], pos[1] + height, -deckWidth/2 + 0.05
                );
                railVertsRight.push(
                  pos[0], pos[1] + height, deckWidth/2 - 0.05
                );
              });

              railGeometryLeft.setAttribute('position', new THREE.Float32BufferAttribute(railVerts, 3));
              railGeometryRight.setAttribute('position', new THREE.Float32BufferAttribute(railVertsRight, 3));

              return (
                <group key={`rails-level-${level}`}>
                  <group>
                    {vertices.map((pos, i) => {
                      if (i < vertices.length - 1) {
                        const nextPos = vertices[i + 1];
                        const length = Math.sqrt(
                          Math.pow(nextPos[0] - pos[0], 2) + 
                          Math.pow(nextPos[1] - pos[1], 2)
                        );
                        const angle = Math.atan2(nextPos[1] - pos[1], nextPos[0] - pos[0]);
                        const midX = (pos[0] + nextPos[0]) / 2;
                        const midY = (pos[1] + nextPos[1]) / 2;

                        return (
                          <>
                            <mesh 
                              key={`rail-left-${level}-${i}`}
                              position={[midX, midY + 0.25 + level * 0.2, -deckWidth/2 + 0.05]}
                              rotation={[0, 0, angle]}
                            >
                              <boxGeometry args={[length, level === 0 ? 0.08 : 0.04, level === 0 ? 0.08 : 0.04]} />
                              <meshStandardMaterial color={level === 0 ? "#8B4513" : "#a0522d"} />
                            </mesh>
                            <mesh 
                              key={`rail-right-${level}-${i}`}
                              position={[midX, midY + (level === 0 ? 0.15 : (level === 3 ? 0.7 : 0.25 + level * 0.2)), deckWidth/2 - 0.05]}
                              rotation={[0, 0, angle]}
                            >
                              <boxGeometry args={[length, level === 0 ? 0.08 : 0.04, level === 0 ? 0.08 : 0.04]} />
                              <meshStandardMaterial color={level === 0 ? "#8B4513" : "#a0522d"} />
                            </mesh>
                          </>
                        );
                      }
                      return null;
                    })}
                  </group>
                </group>
              );
            })}
          </>
        );
      })()}
      {/* Cables/suspenders spanning the full bridge length */}
      {Array.from({ length: 21 }, (_, i) => {
        const x = -totalBridgeLength / 2 + i * (totalBridgeLength / 20);
        const y = archBaseY + archHeight * (1 - Math.pow((x / (totalBridgeLength / 2)), 2));
        const deckY = archBaseY + deckCurveHeight * (1 - Math.pow(x / (totalBridgeLength / 2), 2)) + 0.18;
        
        const archPtLeft: [number, number, number] = [x, y, -archOffset];
        const archPtRight: [number, number, number] = [x, y, archOffset];
        const deckPtLeft: [number, number, number] = [x, deckY, -deckWidth / 2 - 0.09];
        const deckPtRight: [number, number, number] = [x, deckY, deckWidth / 2 + 0.09];
        
        return (
          <group key={`cables-${i}`}>
            <Line
              points={[archPtLeft, deckPtLeft]}
              color="#cccccc"
              lineWidth={2}
            />
            <Line
              points={[archPtRight, deckPtRight]}
              color="#cccccc"
              lineWidth={2}
            />
          </group>
        );
      })}
      {/* Collapse debris if failed */}
      {damageState.overallIntegrity < 0.1 && (
        <mesh position={[0, -2.5, 0]} rotation={[0, 0, -0.7]}>
          <boxGeometry args={[8, 0.2, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      )}
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
  
  // Realistic beam stress color
  const getStressColor = (position: [number, number, number]) => {
    let maxStress = 0;
    loadPoints.forEach(load => {
      const dist = Math.abs(position[0] - load.position[0]);
      maxStress += load.weight / (1 + dist * 1.5);
    });
    const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 3.5;
    maxStress *= damageMultiplier;
    if (maxStress < 80) return '#22c55e';
    if (maxStress < 160) return '#eab308';
    if (maxStress < 240) return '#ef4444';
    return '#dc2626';
  };

  // Realistic bending: beam sags more as load and damage increase
  const getBendingOffset = (x: number) => {
    let totalBend = 0;
    loadPoints.forEach(load => {
      const dist = Math.abs(x - load.position[0]);
      totalBend += load.weight * Math.max(0, 4 - dist) / 400;
    });
    const damageAmplifier = 1 + (1 - damageState.overallIntegrity) * 3;
    return -totalBend * damageAmplifier;
  };

  // Extreme bending/collapse
  const collapsePosition: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, -2, 0] : [0, 0, 0];
  const collapseRotation: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, 0, 0.7] : [0, 0, 0];

  return (
    <group ref={bridgeRef} position={collapsePosition} rotation={collapseRotation}>
      {/* Beam nodes */}
      {Array.from({ length: 32 }, (_, i) => {
        const x = -4 + i * 0.25;
        const y = 2 + getBendingOffset(x);
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color={getStressColor([x, y, 0])} />
          </mesh>
        );
      })}
      {/* Beam body */}
      {Array.from({ length: 31 }, (_, i) => {
        const x1 = -4 + i * 0.25;
        const x2 = x1 + 0.25;
        const y1 = 2 + getBendingOffset(x1);
        const y2 = 2 + getBendingOffset(x2);
        return (
          <mesh key={i} position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]}>
            <boxGeometry args={[0.25, 0.08, 0.18]} />
            <meshStandardMaterial color={getStressColor([(x1 + x2) / 2, (y1 + y2) / 2, 0])} />
          </mesh>
        );
      })}
      {/* Collapse debris if failed */}
      {damageState.overallIntegrity < 0.1 && (
        <mesh position={[0, -2.5, 0]} rotation={[0, 0, 0.7]}>
          <boxGeometry args={[8, 0.2, 1]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      )}
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

// Environment Components
const Environment: React.FC = () => {
  const waterRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (waterRef.current && waterRef.current.material) {
      // Animate water with gentle waves
      const material = waterRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <>
      {/* Sky gradient background */}
      <mesh position={[0, 15, -25]}>
        <planeGeometry args={[120, 50]} />
        <meshBasicMaterial color="#87CEEB" />
      </mesh>
      
      {/* Water body beneath bridge with animation */}
      <mesh ref={waterRef} position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 41]} />
        <meshStandardMaterial 
          color="#4B9CD3"
          transparent 
          opacity={0.6}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      
      {/* Land/terrain on left side */}
      <mesh position={[-20, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 40]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      
      {/* Land/terrain on right side */}
      <mesh position={[20, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 40]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      
      {/* Approach road left */}
      <mesh position={[-19, 3.2, 0]} rotation={[-Math.PI / 2, -0.1, 0]}>
        <planeGeometry args={[10, 3.8]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      
      {/* Approach road right */}
      <mesh position={[19, 3.2, 0]} rotation={[-Math.PI / 2, 0.1, 0]}>
        <planeGeometry args={[10, 3.8]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      
      {/* Road markings */}
      <mesh position={[-17, 2.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 3]} />
        <meshStandardMaterial color="#FFFF00" />
      </mesh>
      <mesh position={[17, 2.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 3]} />
        <meshStandardMaterial color="#FFFF00" />
      </mesh>
      
      {/* Extended land surface */}
      <mesh position={[-17, 2.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 20]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[17, 2.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 20]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      
      {/* Trees on left side */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -22 + Math.random() * 10;
        const z = -15 + Math.random() * 30;
        const height = 2.5 + Math.random() * 1.5;
        return (
          <group key={`tree-left-${i}`} position={[x, 0, z]}>
            {/* Tree trunk */}
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, height]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Tree foliage */}
            <mesh position={[0, height + 1, 0]} castShadow>
              <sphereGeometry args={[1 + Math.random() * 0.5]} />
              <meshStandardMaterial color="#228B22" />
            </mesh>
          </group>
        );
      })}
      
      {/* Trees on right side - more spread out */}
      {Array.from({ length: 18 }, (_, i) => {
        const x = 35 - Math.random() * 15;
        const z = -25 + Math.random() * 50;
        const height = 2.5 + Math.random() * 1.5;
        return (
          <group key={`tree-right-${i}`} position={[x, 0, z]}>
            {/* Tree trunk */}
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, height]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Tree foliage */}
            <mesh position={[0, height + 1, 0]} castShadow>
              <sphereGeometry args={[1 + Math.random() * 0.5]} />
              <meshStandardMaterial color="#228B22" />
            </mesh>
          </group>
        );
      })}
      
      {/* Bridge abutments/foundations */}
      <mesh position={[-14, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 3, 4.5]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[14, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 3, 4.5]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      
      {/* Some rocks/boulders for realism */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -10 + Math.random() * 20;
        const z = -8 + Math.random() * 16;
        const size = 0.3 + Math.random() * 0.4;
        return (
          <mesh key={`rock-${i}`} position={[x, size / 2, z]} castShadow receiveShadow>
            <sphereGeometry args={[size]} />
            <meshStandardMaterial color="#808080" />
          </mesh>
        );
      })}
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
        camera={{ position: [25, 18, 25], fov: 60 }}
        className="scene-container"
        shadows
      >
        {/* Enhanced lighting for realistic environment */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 20, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <pointLight position={[0, 15, 0]} intensity={0.4} color="#fff" />
        
        {/* Environment (sky, water, land, trees) */}
        <Environment />
        
        <Bridge 
          bridgeType={bridgeType} 
          loadPoints={loadPoints} 
          onAddLoad={addLoad}
          damageState={damageState}
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={6}
          maxDistance={30}
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