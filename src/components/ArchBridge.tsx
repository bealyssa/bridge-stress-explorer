import React, { useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import DamageVisualization from './DamageVisualization';
import { LoadPoint, DamageState } from './BridgeSimulator';

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
                                    <mesh key={`post-left-${i}`} position={[pos[0], pos[1] + railHeight / 2, -deckWidth / 2 - 0.09]}>
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
                                    <mesh key={`post-right-${i}`} position={[pos[0], pos[1] + railHeight / 2, deckWidth / 2 + 0.09]}>
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
                                    pos[0], pos[1] + height, -deckWidth / 2 + 0.05
                                );
                                railVertsRight.push(
                                    pos[0], pos[1] + height, deckWidth / 2 - 0.05
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
                                                            position={[midX, midY + 0.25 + level * 0.2, -deckWidth / 2 + 0.05]}
                                                            rotation={[0, 0, angle]}
                                                        >
                                                            <boxGeometry args={[length, level === 0 ? 0.08 : 0.04, level === 0 ? 0.08 : 0.04]} />
                                                            <meshStandardMaterial color={level === 0 ? "#8B4513" : "#a0522d"} />
                                                        </mesh>
                                                        <mesh
                                                            key={`rail-right-${level}-${i}`}
                                                            position={[midX, midY + (level === 0 ? 0.15 : (level === 3 ? 0.7 : 0.25 + level * 0.2)), deckWidth / 2 - 0.05]}
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

export default ArchBridge;
