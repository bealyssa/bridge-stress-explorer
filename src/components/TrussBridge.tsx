import React, { useRef } from 'react';
import * as THREE from 'three';
import DamageVisualization from './DamageVisualization';

interface LoadPoint {
    id: string;
    position: [number, number, number];
    weight: number;
}

interface DamageState {
    cracks: any[];
    overallIntegrity: number;
    failureMode: string;
    warningLevel: string;
}

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
            <group position={[0, 0, -trussWidth / 2]}>
                {/* Top chord nodes - larger and more detailed */}
                {Array.from({ length: numPanels + 1 }, (_, i) => {
                    const x = -bridgeLength / 2 + (i * trussSpacing);
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
                    const x = -bridgeLength / 2 + (i * trussSpacing);
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
                    const x1 = -bridgeLength / 2 + (i * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                    const y = deckHeight + bridgeHeight + getDamageOffset([(x1 + x2) / 2, deckHeight + bridgeHeight, 0]);
                    const length = Math.sqrt(Math.pow(x2 - x1, 2));
                    return (
                        <group key={`top-beam-left-${i}`} position={[(x1 + x2) / 2, y, 0]}>
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
                    const x1 = -bridgeLength / 2 + (i * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                    const y = deckHeight + getDamageOffset([(x1 + x2) / 2, deckHeight, 0]);
                    const length = Math.sqrt(Math.pow(x2 - x1, 2));
                    return (
                        <group key={`bottom-beam-left-${i}`} position={[(x1 + x2) / 2, y, 0]}>
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

                    const x1 = -bridgeLength / 2 + (panelIndex * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((panelIndex + 1) * trussSpacing);
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
                            position={[(startX + endX) / 2, (startY + endY) / 2, 0]}
                            rotation={[0, 0, angle]}>
                            {/* Main angle member */}
                            <mesh>
                                <boxGeometry args={[length, 0.15, 0.15]} />
                                <meshStandardMaterial {...getSteelMaterial([(startX + endX) / 2, (startY + endY) / 2, 0])} />
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
            <group position={[0, 0, trussWidth / 2]}>
                {/* Top chord nodes */}
                {Array.from({ length: numPanels + 1 }, (_, i) => {
                    const x = -bridgeLength / 2 + (i * trussSpacing);
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
                    const x = -bridgeLength / 2 + (i * trussSpacing);
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
                    const x1 = -bridgeLength / 2 + (i * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                    const yTop = deckHeight + bridgeHeight + getDamageOffset([(x1 + x2) / 2, deckHeight + bridgeHeight, 0]);
                    const yBottom = deckHeight + getDamageOffset([(x1 + x2) / 2, deckHeight, 0]);
                    const length = Math.sqrt(Math.pow(x2 - x1, 2));

                    return (
                        <React.Fragment key={`beams-right-${i}`}>
                            {/* Top beam */}
                            <group position={[(x1 + x2) / 2, yTop, 0]}>
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
                            <group position={[(x1 + x2) / 2, yBottom, 0]}>
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

                    const x1 = -bridgeLength / 2 + (panelIndex * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((panelIndex + 1) * trussSpacing);
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
                            position={[(startX + endX) / 2, (startY + endY) / 2, 0]}
                            rotation={[0, 0, angle]}>
                            <mesh>
                                <boxGeometry args={[length, 0.15, 0.15]} />
                                <meshStandardMaterial {...getSteelMaterial([(startX + endX) / 2, (startY + endY) / 2, 0])} />
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
                const x = -bridgeLength / 2 + (i * trussSpacing);
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
                const x = -bridgeLength / 2 + 2 + (i * 1.8);
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

export default TrussBridge;
