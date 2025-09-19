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

interface Vehicle {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  type: 'car' | 'truck' | 'bus';
  weight: number;
  color: string;
  direction: 1 | -1; // 1 for left to right, -1 for right to left
  isOnBridge: boolean;
}

interface BridgeProps {
  bridgeType: 'truss' | 'arch' | 'beam';
  loadPoints: LoadPoint[];
  onAddLoad: (position: [number, number, number]) => void;
  damageState: DamageState;
  vehicles: Vehicle[];
}

// Damage calculation utilities
const calculateDamage = (bridgeType: string, loadPoints: LoadPoint[]): DamageState => {
  const bridgeCapacities = {
    truss: { max: 1800, safe: 1200, critical: 1500 }, // Reduced for more sensitivity
    arch: { max: 2500, safe: 1800, critical: 2200 },  // Reduced for more sensitivity
    beam: { max: 1200, safe: 800, critical: 1000 }    // Reduced for more sensitivity
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
// Enhanced Warren Truss Bridge with damage effects
const TrussBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState }> = ({ loadPoints, damageState }) => {
  const bridgeRef = useRef<THREE.Group>(null);
  
  // Realistic stress color gradient with steel colors
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
    if (maxStress < 100) return '#b0bec5'; // Light steel blue
    if (maxStress < 200) return '#ffd54f'; // Warning yellow
    if (maxStress < 300) return '#ff8a65'; // Orange stress
    return '#e53e3e'; // Critical red
  };

  // Enhanced material for steel members
  const getSteelMaterial = (position: [number, number, number]) => {
    return {
      color: getStressColor(position),
      metalness: 0.8,
      roughness: 0.2,
    };
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
    return -localStress * 0.003 * (1 + damage * 1.5);
  };

  // Collapse: break apart when integrity is very low
  const collapsePosition: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, -2, 0] : [0, 0, 0];
  const collapseRotation: [number, number, number] = damageState.overallIntegrity < 0.1 ? [0, 0, 0.3] : [0, 0, 0];

  // Warren truss dimensions - made more realistic
  const bridgeLength = 28;
  const bridgeHeight = 4.2; // Taller for more realistic proportions
  const deckHeight = 2.2;
  const trussSpacing = 3.5; // Distance between truss panels
  const numPanels = 8; // Number of Warren truss panels
  const trussWidth = 2.0; // Wider distance between left and right trusses

  return (
    <group ref={bridgeRef} position={collapsePosition} rotation={collapseRotation}>
      {/* Warren Truss - Left Side */}
      <group position={[0, 0, -trussWidth/2]}>
        {/* Top chord nodes - larger and more detailed */}
        {Array.from({ length: numPanels + 1 }, (_, i) => {
          const x = -bridgeLength/2 + (i * trussSpacing);
          const y = deckHeight + bridgeHeight + getDamageOffset([x, deckHeight + bridgeHeight, 0]);
          return (
            <group key={`top-left-${i}`} position={[x, y, 0]}>
              <mesh>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial {...getSteelMaterial([x, y, 0])} />
              </mesh>
              {/* Connection plates */}
              <mesh>
                <boxGeometry args={[0.3, 0.3, 0.05]} />
                <meshStandardMaterial color="#455a64" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          );
        })}
        
        {/* Bottom chord nodes */}
        {Array.from({ length: numPanels + 1 }, (_, i) => {
          const x = -bridgeLength/2 + (i * trussSpacing);
          const y = deckHeight + getDamageOffset([x, deckHeight, 0]);
          return (
            <group key={`bottom-left-${i}`} position={[x, y, 0]}>
              <mesh>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial {...getSteelMaterial([x, y, 0])} />
              </mesh>
              {/* Connection plates */}
              <mesh>
                <boxGeometry args={[0.3, 0.3, 0.05]} />
                <meshStandardMaterial color="#455a64" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          );
        })}

        {/* Top chord beams - I-beam profile */}
        {Array.from({ length: numPanels }, (_, i) => {
          const x1 = -bridgeLength/2 + (i * trussSpacing);
          const x2 = -bridgeLength/2 + ((i + 1) * trussSpacing);
          const y = deckHeight + bridgeHeight + getDamageOffset([(x1 + x2)/2, deckHeight + bridgeHeight, 0]);
          const length = Math.sqrt(Math.pow(x2 - x1, 2));
          return (
            <group key={`top-beam-left-${i}`} position={[(x1 + x2)/2, y, 0]}>
              {/* Main I-beam web */}
              <mesh>
                <boxGeometry args={[length, 0.25, 0.08]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Top flange */}
              <mesh position={[0, 0.1, 0]}>
                <boxGeometry args={[length, 0.05, 0.18]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Bottom flange */}
              <mesh position={[0, -0.1, 0]}>
                <boxGeometry args={[length, 0.05, 0.18]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          );
        })}

        {/* Bottom chord beams - I-beam profile */}
        {Array.from({ length: numPanels }, (_, i) => {
          const x1 = -bridgeLength/2 + (i * trussSpacing);
          const x2 = -bridgeLength/2 + ((i + 1) * trussSpacing);
          const y = deckHeight + getDamageOffset([(x1 + x2)/2, deckHeight, 0]);
          const length = Math.sqrt(Math.pow(x2 - x1, 2));
          return (
            <group key={`bottom-beam-left-${i}`} position={[(x1 + x2)/2, y, 0]}>
              {/* Main I-beam web */}
              <mesh>
                <boxGeometry args={[length, 0.25, 0.08]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Top flange */}
              <mesh position={[0, 0.1, 0]}>
                <boxGeometry args={[length, 0.05, 0.18]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Bottom flange */}
              <mesh position={[0, -0.1, 0]}>
                <boxGeometry args={[length, 0.05, 0.18]} />
                <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          );
        })}

        {/* Warren truss diagonal members (zigzag pattern) - angle sections */}
        {Array.from({ length: numPanels * 2 }, (_, i) => {
          const panelIndex = Math.floor(i / 2);
          const isUp = i % 2 === 0; // Alternating up and down diagonals
          
          const x1 = -bridgeLength/2 + (panelIndex * trussSpacing);
          const x2 = -bridgeLength/2 + ((panelIndex + 1) * trussSpacing);
          const xMid = (x1 + x2) / 2;
          
          let startX, startY, endX, endY;
          
          if (isUp) {
            // Diagonal going from bottom-left to top-right
            startX = x1;
            startY = deckHeight + getDamageOffset([startX, deckHeight, 0]);
            endX = xMid;
            endY = deckHeight + bridgeHeight + getDamageOffset([endX, deckHeight + bridgeHeight, 0]);
          } else {
            // Diagonal going from top-left to bottom-right
            startX = xMid;
            startY = deckHeight + bridgeHeight + getDamageOffset([startX, deckHeight + bridgeHeight, 0]);
            endX = x2;
            endY = deckHeight + getDamageOffset([endX, deckHeight, 0]);
          }
          
          const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          const angle = Math.atan2(endY - startY, endX - startX);
          
          return (
            <group key={`diagonal-left-${i}`} 
                  position={[(startX + endX)/2, (startY + endY)/2, 0]} 
                  rotation={[0, 0, angle]}>
              {/* Main angle member */}
              <mesh>
                <boxGeometry args={[length, 0.15, 0.15]} />
                <meshStandardMaterial {...getSteelMaterial([(startX + endX)/2, (startY + endY)/2, 0])} />
              </mesh>
              {/* Angle iron flanges */}
              <mesh position={[0, 0.05, 0.05]}>
                <boxGeometry args={[length, 0.08, 0.08]} />
                <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Warren Truss - Right Side (mirror of left side) */}
      <group position={[0, 0, trussWidth/2]}>
        {/* Top chord nodes */}
        {Array.from({ length: numPanels + 1 }, (_, i) => {
          const x = -bridgeLength/2 + (i * trussSpacing);
          const y = deckHeight + bridgeHeight + getDamageOffset([x, deckHeight + bridgeHeight, 0]);
          return (
            <group key={`top-right-${i}`} position={[x, y, 0]}>
              <mesh>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial {...getSteelMaterial([x, y, 0])} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.3, 0.3, 0.05]} />
                <meshStandardMaterial color="#455a64" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          );
        })}
        
        {/* Bottom chord nodes */}
        {Array.from({ length: numPanels + 1 }, (_, i) => {
          const x = -bridgeLength/2 + (i * trussSpacing);
          const y = deckHeight + getDamageOffset([x, deckHeight, 0]);
          return (
            <group key={`bottom-right-${i}`} position={[x, y, 0]}>
              <mesh>
                <boxGeometry args={[0.3, 0.3, 0.05]} />
                <meshStandardMaterial color="#455a64" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          );
        })}

        {/* Top and bottom chord beams - same I-beam structure as left side */}
        {Array.from({ length: numPanels }, (_, i) => {
          const x1 = -bridgeLength/2 + (i * trussSpacing);
          const x2 = -bridgeLength/2 + ((i + 1) * trussSpacing);
          const yTop = deckHeight + bridgeHeight + getDamageOffset([(x1 + x2)/2, deckHeight + bridgeHeight, 0]);
          const yBottom = deckHeight + getDamageOffset([(x1 + x2)/2, deckHeight, 0]);
          const length = Math.sqrt(Math.pow(x2 - x1, 2));
          
          return (
            <React.Fragment key={`beams-right-${i}`}>
              {/* Top beam */}
              <group position={[(x1 + x2)/2, yTop, 0]}>
                <mesh>
                  <boxGeometry args={[length, 0.25, 0.08]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.1, 0]}>
                  <boxGeometry args={[length, 0.05, 0.18]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.1, 0]}>
                  <boxGeometry args={[length, 0.05, 0.18]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
              </group>
              {/* Bottom beam */}
              <group position={[(x1 + x2)/2, yBottom, 0]}>
                <mesh>
                  <boxGeometry args={[length, 0.25, 0.08]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.1, 0]}>
                  <boxGeometry args={[length, 0.05, 0.18]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.1, 0]}>
                  <boxGeometry args={[length, 0.05, 0.18]} />
                  <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
                </mesh>
              </group>
            </React.Fragment>
          );
        })}

        {/* Warren truss diagonal members - same as left side */}
        {Array.from({ length: numPanels * 2 }, (_, i) => {
          const panelIndex = Math.floor(i / 2);
          const isUp = i % 2 === 0;
          
          const x1 = -bridgeLength/2 + (panelIndex * trussSpacing);
          const x2 = -bridgeLength/2 + ((panelIndex + 1) * trussSpacing);
          const xMid = (x1 + x2) / 2;
          
          let startX, startY, endX, endY;
          
          if (isUp) {
            startX = x1;
            startY = deckHeight + getDamageOffset([startX, deckHeight, 0]);
            endX = xMid;
            endY = deckHeight + bridgeHeight + getDamageOffset([endX, deckHeight + bridgeHeight, 0]);
          } else {
            startX = xMid;
            startY = deckHeight + bridgeHeight + getDamageOffset([startX, deckHeight + bridgeHeight, 0]);
            endX = x2;
            endY = deckHeight + getDamageOffset([endX, deckHeight, 0]);
          }
          
          const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          const angle = Math.atan2(endY - startY, endX - startX);
          
          return (
            <group key={`diagonal-right-${i}`} 
                  position={[(startX + endX)/2, (startY + endY)/2, 0]} 
                  rotation={[0, 0, angle]}>
              <mesh>
                <boxGeometry args={[length, 0.15, 0.15]} />
                <meshStandardMaterial {...getSteelMaterial([(startX + endX)/2, (startY + endY)/2, 0])} />
              </mesh>
              <mesh position={[0, 0.05, 0.05]}>
                <boxGeometry args={[length, 0.08, 0.08]} />
                <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Cross bracing between left and right trusses - enhanced */}
      {Array.from({ length: numPanels + 1 }, (_, i) => {
        const x = -bridgeLength/2 + (i * trussSpacing);
        const yTop = deckHeight + bridgeHeight + getDamageOffset([x, deckHeight + bridgeHeight, 0]);
        const yBottom = deckHeight + getDamageOffset([x, deckHeight, 0]);
        return (
          <React.Fragment key={`cross-${i}`}>
            {/* Top cross brace */}
            <mesh position={[x, yTop, 0]}>
              <boxGeometry args={[0.15, 0.15, trussWidth]} />
              <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Bottom cross brace */}
            <mesh position={[x, yBottom, 0]}>
              <boxGeometry args={[0.15, 0.15, trussWidth]} />
              <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Intermediate cross braces */}
       
          </React.Fragment>
        );
      })}

      {/* Enhanced bridge deck with concrete surface */}
      <group>
        {/* Main concrete deck */}
        <mesh position={[0, deckHeight, 0]}>
          <boxGeometry args={[bridgeLength, 0.4, 2.8]} />
          <meshStandardMaterial color="#9e9e9e" roughness={0.8} />
        </mesh>
        
        {/* Asphalt surface */}
        <mesh position={[0, deckHeight + 0.21, 0]}>
          <boxGeometry args={[bridgeLength, 0.02, 2.6]} />
          <meshStandardMaterial color="#424242" roughness={0.9} />
        </mesh>

        {/* Lane markings */}
        <mesh position={[0, deckHeight + 0.22, 0]}>
          <boxGeometry args={[bridgeLength, 0.005, 0.1]} />
          <meshStandardMaterial color="#ffeb3b" />
        </mesh>
        
        {/* Edge lines */}
        <mesh position={[0, deckHeight + 0.22, 1.2]}>
          <boxGeometry args={[bridgeLength, 0.005, 0.05]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, deckHeight + 0.22, -1.2]}>
          <boxGeometry args={[bridgeLength, 0.005, 0.05]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Enhanced guardrails with posts */}
      {Array.from({ length: 15 }, (_, i) => {
        const x = -bridgeLength/2 + 2 + (i * 1.8);
        return (
          <React.Fragment key={`guardrail-${i}`}>
            {/* Left guardrail post */}
            {/* <mesh position={[x, deckHeight + 0.6, 1.5]}>
              <boxGeometry args={[0.08, 1.2, 0.08]} />
              <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
            </mesh> */}
            {/* Right guardrail post */}
            {/* <mesh position={[x, deckHeight + 0.6, -1.5]}>
              <boxGeometry args={[0.08, 1.2, 0.08]} />
              <meshStandardMaterial color="#546e7a" metalness={0.8} roughness={0.2} />
            </mesh> */}
          </React.Fragment>
        );
      })}
      
      {/* Continuous guardrails */}
      <mesh position={[0, deckHeight + 1.0, 1.5]}>
        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
        <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, deckHeight + 1.0, -1.5]}>
        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
        <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Mid-level guardrails */}
      <mesh position={[0, deckHeight + 0.7, 1.5]}>
        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
        <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, deckHeight + 0.7, -1.5]}>
        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
        <meshStandardMaterial color="#607d8b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Collapse debris if failed */}
      {damageState.overallIntegrity < 0.1 && (
        <group position={[0, -2.5, 0]} rotation={[0, 0, 0.3]}>
          <mesh>
            <boxGeometry args={[bridgeLength, 0.5, 2]} />
            <meshStandardMaterial color="#b71c1c" />
          </mesh>
          {/* Scattered debris */}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={`debris-${i}`} position={[
              (Math.random() - 0.5) * bridgeLength,
              Math.random() * 2,
              (Math.random() - 0.5) * 4
            ]}>
              <boxGeometry args={[
                0.5 + Math.random() * 1.5,
                0.3 + Math.random() * 0.7,
                0.3 + Math.random() * 0.7
              ]} />
              <meshStandardMaterial color="#d32f2f" />
            </mesh>
          ))}
        </group>
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

// Vehicle Component with improved real-time collision detection (Memoized)
const VehicleComponent: React.FC<{ 
  initialVehicle: Vehicle; 
  bridgeType: string; 
  damageState: DamageState;
  allVehicles: React.MutableRefObject<Vehicle[]>;
}> = React.memo(({ initialVehicle, bridgeType, damageState, allVehicles }) => {
  const meshRef = useRef<THREE.Group>(null);
  const vehicleData = useRef(initialVehicle);
  
  // Get bridge height at given x position
  const getBridgeHeight = (x: number): number => {
    const bridgeBaseY = 2.2;
    const totalBridgeLength = 28;
    const deckCurveHeight = 1.5;
    
    // Only apply curve in the bridge section (-14 to 14)
    if (x >= -14 && x <= 14) {
      if (bridgeType === 'arch') {
        return bridgeBaseY + deckCurveHeight * (1 - Math.pow(x / (totalBridgeLength / 2), 2)) + 0.18;
      } else {
        return bridgeBaseY + 0.18; // Flat bridge for truss/beam
      }
    }
    return bridgeBaseY + 0.01; // Road level
  };

  // Check for vehicles ahead in the same lane (using real-time positions)
  const getVehicleAhead = (currentVehicle: Vehicle): Vehicle | null => {
    const vehicles = allVehicles.current;
    const sameDirection = vehicles.filter(v => 
      v.id !== currentVehicle.id && 
      v.direction === currentVehicle.direction &&
      Math.abs(v.position[2] - currentVehicle.position[2]) < 0.5 // Same lane
    );

    let closestVehicle: Vehicle | null = null;
    let minDistance = Infinity;

    for (const vehicle of sameDirection) {
      let distance: number;
      if (currentVehicle.direction === 1) {
        // Going right, check vehicles ahead (higher x)
        distance = vehicle.position[0] - currentVehicle.position[0];
      } else {
        // Going left, check vehicles ahead (lower x)
        distance = currentVehicle.position[0] - vehicle.position[0];
      }

      if (distance > 0 && distance < minDistance && distance < 8) { // Only check nearby vehicles
        minDistance = distance;
        closestVehicle = vehicle;
      }
    }

    return closestVehicle;
  };

  useFrame((state, delta) => {
    if (meshRef.current) {
      const vehicle = vehicleData.current;
      
      // Adjusted speeds - small cars faster than big vehicles
      let baseSpeed: number;
      switch (vehicle.type) {
        case 'car': baseSpeed = 3.0; break;   // Cars fastest (small vehicles)
        case 'bus': baseSpeed = 2.0; break;   // Buses slower (big vehicles)
        case 'truck': baseSpeed = 1.8; break; // Trucks slowest (biggest vehicles)
        default: baseSpeed = 2.5; break;
      }

      // Check for vehicle ahead
      const vehicleAhead = getVehicleAhead(vehicle);
      let currentSpeed = baseSpeed;

      if (vehicleAhead) {
        const safeDistance = vehicle.type === 'truck' ? 4.0 : vehicle.type === 'bus' ? 3.5 : 3.0; // Increased safe distances
        let distance: number;
        
        if (vehicle.direction === 1) {
          distance = vehicleAhead.position[0] - vehicle.position[0];
        } else {
          distance = vehicle.position[0] - vehicleAhead.position[0];
        }

        if (distance < safeDistance * 1.5) { // Give more buffer space
          // Adjust speed based on distance - more gradual following
          const speedRatio = Math.max(0.4, Math.min(1.0, distance / safeDistance)); // Minimum 40% speed
          currentSpeed = baseSpeed * speedRatio;
          
          // Maintain better minimum speed to prevent bunching
          if (distance > 1.5) { // Increased minimum distance before slowing
            currentSpeed = Math.max(currentSpeed, baseSpeed * 0.6); // Higher minimum speed
          }
        }
      }
      
      // Calculate new position
      const newX = vehicle.position[0] + vehicle.direction * currentSpeed * delta;
      const targetY = getBridgeHeight(newX);
      
      // Keep vehicles in their designated lanes
      const laneCenter = vehicle.direction === 1 ? 0.6 : -0.6;
      const newZ = THREE.MathUtils.lerp(vehicle.position[2], laneCenter, 2 * delta);
      
      // Smooth Y transition to follow bridge curve
      const newY = THREE.MathUtils.lerp(vehicle.position[1], targetY, 5 * delta);
      
      // Update internal vehicle data
      vehicle.position = [newX, newY, newZ];
      vehicle.isOnBridge = newX >= -16 && newX <= 16;
      
      // Update the shared vehicles array with current position
      const vehicleIndex = allVehicles.current.findIndex(v => v.id === vehicle.id);
      if (vehicleIndex !== -1) {
        allVehicles.current[vehicleIndex] = { ...vehicle };
      }
      
      // Reset vehicle if it goes too far
      if (newX > 35 || newX < -35) {
        const resetX = vehicle.direction === 1 ? -35 : 35;
        const resetY = getBridgeHeight(resetX);
        vehicle.position = [resetX, resetY, laneCenter];
        vehicle.isOnBridge = false;
      }
      
      // Update mesh position directly (smooth animation)
      meshRef.current.position.set(vehicle.position[0], vehicle.position[1], vehicle.position[2]);
      
      // Face direction of travel
      meshRef.current.rotation.y = vehicle.direction === 1 ? 0 : Math.PI;
    }
  });

  const getVehicleSize = () => {
    switch (initialVehicle.type) {
      case 'truck': return { width: 0.4, height: 0.6, length: 1.2 };
      case 'bus': return { width: 0.35, height: 0.7, length: 2.0 };
      default: return { width: 0.3, height: 0.4, length: 0.8 };
    }
  };

  const size = getVehicleSize();

  return (
    <group ref={meshRef} position={initialVehicle.position}>
      {/* Vehicle body */}
      <mesh position={[0, size.height / 2, 0]}>
        <boxGeometry args={[size.length, size.height, size.width]} />
        <meshStandardMaterial color={initialVehicle.color} />
      </mesh>
      
      {/* Vehicle wheels */}
      <mesh position={[size.length * 0.3, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[size.length * 0.3, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-size.length * 0.3, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-size.length * 0.3, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      
      {/* Vehicle windows */}
      <mesh position={[0, size.height * 0.8, 0]}>
        <boxGeometry args={[size.length * 0.8, size.height * 0.3, size.width * 0.9]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
      </mesh>
    </group>
  );
});

// Load Point Visualization (Memoized)
const LoadPoint: React.FC<{ load: LoadPoint }> = React.memo(({ load }) => {
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
});

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

// Main Bridge Component with damage integration and vehicles (Memoized)
const Bridge: React.FC<BridgeProps> = React.memo(({ bridgeType, loadPoints, onAddLoad, damageState, vehicles }) => {
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
});

// Environment Components (Memoized to prevent unnecessary re-renders)
const Environment: React.FC = React.memo(() => {
  const waterRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (waterRef.current && waterRef.current.material) {
      // Animate water with gentle waves
      const material = waterRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.7 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  // Bridge connection points (where bridge ends)
  const bridgeLeftEnd = -14; // Left bridge end position
  const bridgeRightEnd = 14; // Right bridge end position
  const bridgeHeight = 2.2; // Bridge deck height
  const deckWidth = 2.1; // Bridge deck width

  return (
    <>
      {/* Sky gradient background */}
      <mesh position={[0, 15, -25]}>
        <planeGeometry args={[120, 50]} />
        <meshBasicMaterial color="#87CEEB" />
      </mesh>
      
      {/* Water body beneath bridge with animation - slightly below land to prevent z-fighting */}
      <mesh ref={waterRef} position={[0, 1.45, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 41]} />
        <meshStandardMaterial 
          color="#4B9CD3"
          transparent 
          opacity={0.6}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      
      {/* Large land mass on left side - realistic terrain */}
      <group>
        {/* Main land plateau */}
        <mesh position={[-25, 1.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 50]} />
          <meshStandardMaterial color="#2d5a3d" />
        </mesh>
        
        {/* Land elevation towards bridge */}
        <mesh position={[-20, bridgeHeight - 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 50]} />
          <meshStandardMaterial color="#3a6b4a" />
        </mesh>
        
        {/* Connecting slope to bridge level */}
        <mesh position={[-16.5, bridgeHeight - 0.1, 0]} rotation={[-Math.PI / 2, 0.08, 0]} receiveShadow>
          <planeGeometry args={[5, 50]} />
          <meshStandardMaterial color="#228B22" />
        </mesh>
      </group>
      
      {/* Large land mass on right side - realistic terrain */}
      <group>
        {/* Main land plateau */}
        <mesh position={[25, 1.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 50]} />
          <meshStandardMaterial color="#2d5a3d" />
        </mesh>
        
        {/* Land elevation towards bridge */}
        <mesh position={[20, bridgeHeight - 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 50]} />
          <meshStandardMaterial color="#3a6b4a" />
        </mesh>
        
        {/* Connecting slope to bridge level */}
        <mesh position={[16.5, bridgeHeight - 0.1, 0]} rotation={[-Math.PI / 2, -0.08, 0]} receiveShadow>
          <planeGeometry args={[5, 50]} />
          <meshStandardMaterial color="#228B22" />
        </mesh>
      </group>
      
      {/* Road connecting to left bridge end - exact alignment */}
      <group>
        {/* Main approach road leading to bridge */}
        <mesh position={[-20, bridgeHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, deckWidth]} />
          <meshStandardMaterial color="#2C2C2C" />
        </mesh>
        
        {/* Road connection to bridge - seamless transition */}
        <mesh position={[bridgeLeftEnd - 1, bridgeHeight + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, deckWidth]} />
          <meshStandardMaterial color="#2C2C2C" />
        </mesh>
        
        {/* Road shoulder/edges */}
        <mesh position={[-20, bridgeHeight - 0.05, deckWidth/2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.6]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <mesh position={[-20, bridgeHeight - 0.05, -deckWidth/2 - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.6]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      
      {/* Road connecting to right bridge end - exact alignment */}
      <group>
        {/* Main approach road leading to bridge */}
        <mesh position={[20, bridgeHeight + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, deckWidth]} />
          <meshStandardMaterial color="#2C2C2C" />
        </mesh>
        
        {/* Road connection to bridge - seamless transition */}
        <mesh position={[bridgeRightEnd + 1, bridgeHeight + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, deckWidth]} />
          <meshStandardMaterial color="#2C2C2C" />
        </mesh>
        
        {/* Road shoulder/edges */}
        <mesh position={[20, bridgeHeight - 0.05, deckWidth/2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.6]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <mesh position={[20, bridgeHeight - 0.05, -deckWidth/2 - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 0.6]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>
      
      {/* Road center line markings */}
      <mesh position={[-20, bridgeHeight + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.08]} />
        <meshStandardMaterial color="#FFFF00" />
      </mesh>
      <mesh position={[20, bridgeHeight + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.08]} />
        <meshStandardMaterial color="#FFFF00" />
      </mesh>
      
      {/* Road edge lines */}
      <mesh position={[-20, bridgeHeight + 0.02, deckWidth/2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[-20, bridgeHeight + 0.02, -deckWidth/2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[20, bridgeHeight + 0.02, deckWidth/2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[20, bridgeHeight + 0.02, -deckWidth/2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 0.05]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      
      {/* Trees on left side land mass - distributed across the terrain */}
      {Array.from({ length: 20 }, (_, i) => {
        const x = -35 + Math.random() * 15; // Spread across left land mass
        const z = -20 + Math.random() * 40;
        const height = 2.5 + Math.random() * 2;
        return (
          <group key={`tree-left-${i}`} position={[x, 1.5, z]}>
            {/* Tree trunk */}
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, height]} />
              <meshStandardMaterial color="#654321" />
            </mesh>
            {/* Tree foliage */}
            <mesh position={[0, height + 1, 0]} castShadow>
              <sphereGeometry args={[1 + Math.random() * 0.5]} />
              <meshStandardMaterial color="#228B22" />
            </mesh>
          </group>
        );
      })}
      
      {/* Trees on right side land mass - distributed across the terrain */}
      {Array.from({ length: 25 }, (_, i) => {
        const x = 20 + Math.random() * 20; // Spread across right land mass
        const z = -25 + Math.random() * 50;
        const height = 2.5 + Math.random() * 2;
        return (
          <group key={`tree-right-${i}`} position={[x, 1.5, z]}>
            {/* Tree trunk */}
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.25, height]} />
              <meshStandardMaterial color="#654321" />
            </mesh>
            {/* Tree foliage */}
            <mesh position={[0, height + 1, 0]} castShadow>
              <sphereGeometry args={[1 + Math.random() * 0.5]} />
              <meshStandardMaterial color="#228B22" />
            </mesh>
          </group>
        );
      })}
      
      {/* Bridge abutments/foundations - positioned UNDER the bridge, not blocking the road */}
      {/* Left abutment - under bridge only */}
      <mesh position={[bridgeLeftEnd, bridgeHeight - 1.5, deckWidth/2 + 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[bridgeLeftEnd, bridgeHeight - 1.5, -deckWidth/2 - 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      
      {/* Right abutment - under bridge only */}
      <mesh position={[bridgeRightEnd, bridgeHeight - 1.5, deckWidth/2 + 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[bridgeRightEnd, bridgeHeight - 1.5, -deckWidth/2 - 1.5]} castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      
      {/* Bridge support pillars - under the road area but not blocking traffic */}
      <mesh position={[bridgeLeftEnd, bridgeHeight - 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.7, 3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[bridgeRightEnd, bridgeHeight - 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.7, 3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      
      {/* Retaining walls for road approaches */}
      <mesh position={[-22, bridgeHeight - 0.5, deckWidth/2 + 0.8]} castShadow receiveShadow>
        <boxGeometry args={[16, 1.5, 0.3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[-22, bridgeHeight - 0.5, -deckWidth/2 - 0.8]} castShadow receiveShadow>
        <boxGeometry args={[16, 1.5, 0.3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[22, bridgeHeight - 0.5, deckWidth/2 + 0.8]} castShadow receiveShadow>
        <boxGeometry args={[16, 1.5, 0.3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      <mesh position={[22, bridgeHeight - 0.5, -deckWidth/2 - 0.8]} castShadow receiveShadow>
        <boxGeometry args={[16, 1.5, 0.3]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      
      {/* Some rocks/boulders scattered around for realism */}
      {Array.from({ length: 12 }, (_, i) => {
        const x = -15 + Math.random() * 30;
        const z = -10 + Math.random() * 20;
        const size = 0.3 + Math.random() * 0.5;
        // Don't place rocks on the road
        if (Math.abs(z) > deckWidth/2 + 1) {
          return (
            <mesh key={`rock-${i}`} position={[x, size / 2, z]} castShadow receiveShadow>
              <sphereGeometry args={[size]} />
              <meshStandardMaterial color="#696969" />
            </mesh>
          );
        }
        return null;
      })}
      
      {/* Small buildings/structures on distant land for context */}
      {Array.from({ length: 3 }, (_, i) => {
        const x = -40 + i * 5;
        const z = -15 + Math.random() * 10;
        const height = 3 + Math.random() * 2;
        return (
          <mesh key={`building-left-${i}`} position={[x, 1.5 + height/2, z]} castShadow>
            <boxGeometry args={[2, height, 2]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        );
      })}
      
      {Array.from({ length: 4 }, (_, i) => {
        const x = 35 + i * 4;
        const z = -10 + Math.random() * 15;
        const height = 3 + Math.random() * 2;
        return (
          <mesh key={`building-right-${i}`} position={[x, 1.5 + height/2, z]} castShadow>
            <boxGeometry args={[2, height, 2]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        );
      })}
    </>
  );
});

// Main Simulator Component
interface BridgeSimulatorProps {
  bridgeType?: 'truss' | 'arch' | 'beam';
  loadPoints?: LoadPoint[];
  onBridgeTypeChange?: (type: 'truss' | 'arch' | 'beam') => void;
  onLoadPointsChange?: (loads: LoadPoint[]) => void;
  onVehicleDataChange?: (vehicles: Vehicle[], dynamicLoad: number, damageState: DamageState) => void;
}

const BridgeSimulator: React.FC<BridgeSimulatorProps> = ({
  bridgeType: externalBridgeType,
  loadPoints: externalLoadPoints,
  onBridgeTypeChange,
  onLoadPointsChange,
  onVehicleDataChange
}) => {
  const [internalBridgeType, setInternalBridgeType] = useState<'truss' | 'arch' | 'beam'>('truss');
  const [internalLoadPoints, setInternalLoadPoints] = useState<LoadPoint[]>([]);
  const [currentWeight, setCurrentWeight] = useState(100);
  const vehiclesRef = useRef<Vehicle[]>([]);
  const [realTimeDamageState, setRealTimeDamageState] = useState<DamageState | null>(null);

  const bridgeType = externalBridgeType || internalBridgeType;
  const loadPoints = externalLoadPoints || internalLoadPoints;
  
  // Calculate dynamic vehicle loads in real-time
  const calculateDynamicLoad = useCallback(() => {
    const bridgeStart = -14;
    const bridgeEnd = 14;
    let dynamicLoad = 0;
    const vehiclesOnBridge: Vehicle[] = [];
    
    vehiclesRef.current.forEach(vehicle => {
      const x = vehicle.position[0];
      if (x >= bridgeStart && x <= bridgeEnd) {
        vehicle.isOnBridge = true;
        vehiclesOnBridge.push(vehicle);
        dynamicLoad += vehicle.weight;
      } else {
        vehicle.isOnBridge = false;
      }
    });
    
    return { dynamicLoad, vehiclesOnBridge };
  }, []);
  
  // Calculate total damage state including vehicles
  const calculateTotalDamageState = useCallback(() => {
    const { dynamicLoad } = calculateDynamicLoad();
    const staticLoad = loadPoints.reduce((sum, load) => sum + load.weight, 0);
    const totalLoad = staticLoad + dynamicLoad;
    
    // Create virtual load points for vehicles on bridge
    const vehicleLoadPoints: LoadPoint[] = vehiclesRef.current
      .filter(v => v.isOnBridge)
      .map(v => ({
        id: `vehicle-${v.id}`,
        position: v.position,
        weight: v.weight
      }));
    
    const allLoadPoints = [...loadPoints, ...vehicleLoadPoints];
    return calculateDamage(bridgeType, allLoadPoints);
  }, [bridgeType, loadPoints, calculateDynamicLoad]);
  
  // Calculate dynamic loads for display
  const [currentDynamicLoad, setCurrentDynamicLoad] = useState(0);
  const [vehiclesOnBridgeCount, setVehiclesOnBridgeCount] = useState(0);
  
  // Update analytics in real-time
  React.useEffect(() => {
    const updateAnalytics = () => {
      const { dynamicLoad, vehiclesOnBridge } = calculateDynamicLoad();
      const damageState = calculateTotalDamageState();
      
      // Update internal real-time damage state for bridge status display
      setRealTimeDamageState(damageState);
      setCurrentDynamicLoad(dynamicLoad);
      setVehiclesOnBridgeCount(vehiclesOnBridge.length);
      
      if (onVehicleDataChange) {
        onVehicleDataChange(vehiclesOnBridge, dynamicLoad, damageState);
      }
    };
    
    // Update every frame for real-time analytics
    const interval = setInterval(updateAnalytics, 100); // 10 FPS for smooth updates but not too heavy
    
    return () => clearInterval(interval);
  }, [calculateDynamicLoad, calculateTotalDamageState, onVehicleDataChange]);
  
  // Initialize vehicles
  React.useEffect(() => {
    const initialVehicles: Vehicle[] = [
      // Left to right traffic (right lane) - better spacing
      {
        id: 'car1',
        position: [-25, 2.21, 0.6],
        velocity: [0, 0, 0],
        type: 'car',
        weight: 150,
        color: '#ff4444',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'truck1',
        position: [-35, 2.21, 0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'truck',
        weight: 800,
        color: '#4444ff',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'car3',
        position: [-15, 2.21, 0.6], // Better spacing
        velocity: [0, 0, 0],
        type: 'car',
        weight: 160,
        color: '#ff44ff',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'car4',
        position: [-5, 2.21, 0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'car',
        weight: 145,
        color: '#44ffff',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'bus2',
        position: [-45, 2.21, 0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'bus',
        weight: 650,
        color: '#ff8844',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'car5',
        position: [5, 2.21, 0.6], // Across bridge
        velocity: [0, 0, 0],
        type: 'car',
        weight: 155,
        color: '#8844ff',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'truck2',
        position: [-55, 2.21, 0.6], // Much more spacing
        velocity: [0, 0, 0],
        type: 'truck',
        weight: 850,
        color: '#448844',
        direction: 1,
        isOnBridge: false
      },
      // Additional heavy vehicles for testing
      {
        id: 'heavyTruck1',
        position: [-65, 2.21, 0.6],
        velocity: [0, 0, 0],
        type: 'truck',
        weight: 1200, // Heavy truck
        color: '#ff4444',
        direction: 1,
        isOnBridge: false
      },
      {
        id: 'heavyTruck2',
        position: [65, 2.21, -0.6],
        velocity: [0, 0, 0],
        type: 'truck',
        weight: 1100, // Heavy truck
        color: '#4444ff',
        direction: -1,
        isOnBridge: false
      },
      // Right to left traffic (left lane) - better spacing
      {
        id: 'car2',
        position: [25, 2.21, -0.6],
        velocity: [0, 0, 0],
        type: 'car',
        weight: 140,
        color: '#44ff44',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'bus1',
        position: [35, 2.21, -0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'bus',
        weight: 600,
        color: '#ffff44',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'car6',
        position: [15, 2.21, -0.6], // Better spacing
        velocity: [0, 0, 0],
        type: 'car',
        weight: 135,
        color: '#ff4488',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'car7',
        position: [5, 2.21, -0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'car',
        weight: 165,
        color: '#88ff44',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'truck3',
        position: [45, 2.21, -0.6], // More spacing
        velocity: [0, 0, 0],
        type: 'truck',
        weight: 780,
        color: '#4488ff',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'car8',
        position: [-5, 2.21, -0.6], // Across bridge
        velocity: [0, 0, 0],
        type: 'car',
        weight: 150,
        color: '#ffaa44',
        direction: -1,
        isOnBridge: false
      },
      {
        id: 'bus3',
        position: [55, 2.21, -0.6], // Much more spacing
        velocity: [0, 0, 0],
        type: 'bus',
        weight: 620,
        color: '#aa44ff',
        direction: -1,
        isOnBridge: false
      }
    ];
    vehiclesRef.current = initialVehicles;
  }, []);

  // Update vehicle position (removed to prevent re-renders)
  // const updateVehiclePosition = useCallback((id: string, newPosition: [number, number, number], isOnBridge: boolean) => {
  //   setVehicles(prev => prev.map(vehicle => 
  //     vehicle.id === id 
  //       ? { ...vehicle, position: newPosition, isOnBridge }
  //       : vehicle
  //   ));
  // }, []);
  
  // Calculate damage state (now includes vehicles for real-time updates)
  const damageState = useMemo(() => {
    // Use static load points only for the visual rendering
    // Real-time analytics will be handled separately via callbacks
    return calculateDamage(bridgeType, loadPoints);
  }, [bridgeType, loadPoints]);

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
        
        {/* Vehicles */}
        {vehiclesRef.current.map((vehicle) => (
          <VehicleComponent 
            key={vehicle.id} 
            initialVehicle={vehicle} 
            bridgeType={bridgeType}
            damageState={damageState}
            allVehicles={vehiclesRef}
          />
        ))}
        
        <Bridge 
          bridgeType={bridgeType} 
          loadPoints={loadPoints} 
          onAddLoad={addLoad}
          damageState={damageState}
          vehicles={vehiclesRef.current}
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
      
      {/* Enhanced Status Display - Real-time damage state */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Bridge Status</h3>
          {realTimeDamageState && (
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              LIVE
            </div>
          )}
        </div>
        <div className={`text-lg font-bold mb-2 ${
          (realTimeDamageState || damageState).warningLevel === 'safe' ? 'text-stress-safe' :
          (realTimeDamageState || damageState).warningLevel === 'caution' ? 'text-stress-warning' :
          (realTimeDamageState || damageState).warningLevel === 'danger' ? 'text-stress-danger' : 
          'text-stress-critical'
        }`}>
          {(realTimeDamageState || damageState).warningLevel.toUpperCase()}
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>Integrity: {Math.round((realTimeDamageState || damageState).overallIntegrity * 100)}%</div>
          {(realTimeDamageState || damageState).failureMode !== 'none' && (
            <div className="text-stress-critical font-semibold">
              Failure Mode: {(realTimeDamageState || damageState).failureMode}
            </div>
          )}
          <div>Active Cracks: {(realTimeDamageState || damageState).cracks.length}</div>
          
          {/* Real-time vehicle load information */}
          {currentDynamicLoad > 0 && (
            <div className="pt-2 border-t border-border space-y-1">
              <div className="text-orange-500 font-semibold text-xs">
                🚗 VEHICLES ON BRIDGE: {vehiclesOnBridgeCount}
              </div>
              <div className="text-orange-500 text-xs">
                Dynamic Load: +{currentDynamicLoad}kg
              </div>
            </div>
          )}
          
          {(realTimeDamageState || damageState).overallIntegrity < 0.5 && (
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