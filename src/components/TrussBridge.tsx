import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import DamageVisualization from './DamageVisualization';
import type { LoadPoint, DamageState } from '../utils/BridgeUtils';

type TrussMaterial = 'steel' | 'wood' | 'concrete';

const TrussBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState; material?: TrussMaterial }> = ({ loadPoints, damageState, material = 'steel' }) => {
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



    // Material selector that adapts appearance by selected material
    const getMemberMaterialProps = (position: [number, number, number]) => {
        // compute a numeric stress value similar to getStressColor so we can map to wood tones
        let localStress = 0;
        loadPoints.forEach(load => {
            const dist = Math.sqrt(
                Math.pow(position[0] - load.position[0], 2) +
                Math.pow(position[2] - load.position[2], 2)
            );
            localStress += load.weight / (1 + dist * 2);
        });
        const damageMultiplier = 1 + (1 - damageState.overallIntegrity) * 2.5;
        localStress *= damageMultiplier;

        if (material === 'wood') {
            // Map stress to warm wood tones (no metallic or blue hues)
            if (localStress < 100) return { color: '#8B5A2B', metalness: 0.0, roughness: 0.95, map: woodTexture };
            if (localStress < 200) return { color: '#A9754B', metalness: 0.0, roughness: 0.92, map: woodTexture };
            if (localStress < 300) return { color: '#8B3A20', metalness: 0.0, roughness: 0.9, map: woodTexture };
            return { color: '#6b1f16', metalness: 0.0, roughness: 0.88, map: woodTexture };
        }

        if (material === 'concrete') {
            return { color: '#9e9e9e', metalness: 0.0, roughness: 1.0 };
        }

        // default steel: use stress-to-color mapping from getStressColor for visuals
        const stressColor = getStressColor(position);
        return { color: stressColor, metalness: 0.8, roughness: 0.2 };
    };

    const getPlateMaterialProps = () => {
        if (material === 'wood') return { color: '#8B5A2B', metalness: 0.0, roughness: 0.9, map: woodTexture };
        if (material === 'concrete') return { color: '#7d7d7d', metalness: 0.0, roughness: 1.0 };
        return { color: '#455a64', metalness: 0.9, roughness: 0.1 };
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

    // Procedural canvas wood texture used for roof and deck in wood mode
    const woodTexture = useMemo(() => {
        const width = 1024;
        const height = 128;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // base
        ctx.fillStyle = '#C69C6D'; // light wood base
        ctx.fillRect(0, 0, width, height);

        // draw subtle grain lines
        ctx.strokeStyle = 'rgba(120,70,40,0.15)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 60; i++) {
            const y = (i / 60) * height + (Math.random() - 0.5) * 6;
            ctx.beginPath();
            ctx.moveTo(0, y);
            // wavy line
            for (let x = 0; x <= width; x += 40) {
                const yy = y + Math.sin((x / width) * Math.PI * 6 + Math.random() * 0.5) * 6;
                ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }

        // knots
        for (let k = 0; k < 12; k++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            ctx.fillStyle = 'rgba(90,50,30,0.12)';
            ctx.beginPath();
            ctx.ellipse(x, y, 8 + Math.random() * 10, 4 + Math.random() * 6, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        // scale repeat so grain runs along length and across width modestly
        tex.repeat.set(bridgeLength / 6, trussWidth * 1.5);
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        return tex;
    }, [bridgeLength, trussWidth]);

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
                            {material === 'wood' ? (
                                <mesh>
                                    <boxGeometry args={[0.25, 0.25, 0.08]} />
                                    <meshStandardMaterial {...(getPlateMaterialProps())} />
                                </mesh>
                            ) : (
                                <mesh>
                                    <sphereGeometry args={[0.15, 16, 16]} />
                                    <meshStandardMaterial {...getMemberMaterialProps([x, y, 0])} />
                                </mesh>
                            )}
                            {/* Connection plates */}
                            <mesh>
                                <boxGeometry args={[0.3, 0.3, 0.05]} />
                                <meshStandardMaterial {...getPlateMaterialProps()} />
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
                            {material === 'wood' ? (
                                <mesh>
                                    <boxGeometry args={[0.3, 0.18, 0.12]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                            ) : (
                                <mesh>
                                    <sphereGeometry args={[0.15, 16, 16]} />
                                    <meshStandardMaterial {...getMemberMaterialProps([x, y, 0])} />
                                </mesh>
                            )}
                            {/* Connection plates */}
                            <mesh>
                                <boxGeometry args={[0.3, 0.3, 0.05]} />
                                <meshStandardMaterial {...getPlateMaterialProps()} />
                            </mesh>
                        </group>
                    );
                })}

                {/* Top chord beams - I-beam profile or wooden planks */}
                {Array.from({ length: numPanels }, (_, i) => {
                    const x1 = -bridgeLength / 2 + (i * trussSpacing);
                    const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                    const y = deckHeight + bridgeHeight + getDamageOffset([(x1 + x2) / 2, deckHeight + bridgeHeight, 0]);
                    const length = Math.sqrt(Math.pow(x2 - x1, 2));
                    return (
                        <group key={`top-beam-left-${i}`} position={[(x1 + x2) / 2, y, 0]}>
                            {material === 'wood' ? (
                                <>
                                    {/* Wooden longitudinal plank */}
                                    <mesh>
                                        <boxGeometry args={[length, 0.18, 0.5]} />
                                        <meshStandardMaterial map={woodTexture} color="#A9754B" roughness={0.95} metalness={0} />
                                    </mesh>
                                </>
                            ) : (
                                <>
                                    {/* Main I-beam web */}
                                    <mesh>
                                        <boxGeometry args={[length, 0.25, 0.08]} />
                                        <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight + bridgeHeight, 0])} />
                                    </mesh>
                                    {/* Top flange */}
                                    <mesh position={[0, 0.1, 0]}>
                                        <boxGeometry args={[length, 0.05, 0.18]} />
                                        <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight + bridgeHeight, 0])} />
                                    </mesh>
                                    {/* Bottom flange */}
                                    <mesh position={[0, -0.1, 0]}>
                                        <boxGeometry args={[length, 0.05, 0.18]} />
                                        <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight, 0])} />
                                    </mesh>
                                </>
                            )}
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
                                <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight, 0])} />
                            </mesh>
                            {/* Top flange */}
                            <mesh position={[0, 0.1, 0]}>
                                <boxGeometry args={[length, 0.05, 0.18]} />
                                <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight + bridgeHeight, 0])} />
                            </mesh>
                            {/* Bottom flange */}
                            <mesh position={[0, -0.1, 0]}>
                                <boxGeometry args={[length, 0.05, 0.18]} />
                                <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, deckHeight, 0])} />
                            </mesh>
                        </group>
                    );
                })}

                {/* Warren truss diagonal members (zigzag or wooden X-braces) */}
                {material === 'wood' ? (
                    // For wood, create crossing X-braces in each panel for a model-like appearance
                    Array.from({ length: numPanels }, (_, i) => {
                        const x1 = -bridgeLength / 2 + (i * trussSpacing);
                        const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                        const bottomY1 = deckHeight + getDamageOffset([x1, deckHeight, 0]);
                        const bottomY2 = deckHeight + getDamageOffset([x2, deckHeight, 0]);
                        const topY1 = deckHeight + bridgeHeight + getDamageOffset([x1, deckHeight + bridgeHeight, 0]);
                        const topY2 = deckHeight + bridgeHeight + getDamageOffset([x2, deckHeight + bridgeHeight, 0]);

                        // Member A: bottom-left -> top-right
                        const dxA = x2 - x1;
                        const dyA = topY2 - bottomY1;
                        const lenA = Math.sqrt(dxA * dxA + dyA * dyA);
                        const angleA = Math.atan2(dyA, dxA);

                        // Member B: top-left -> bottom-right
                        const dxB = x2 - x1;
                        const dyB = bottomY2 - topY1;
                        const lenB = Math.sqrt(dxB * dxB + dyB * dyB);
                        const angleB = Math.atan2(dyB, dxB);

                        return (
                            <React.Fragment key={`xbraces-left-${i}`}>
                                <group position={[(x1 + x2) / 2, (bottomY1 + topY2) / 2, 0]} rotation={[0, 0, angleA]}>
                                    <mesh>
                                        <boxGeometry args={[lenA, 0.12, 0.08]} />
                                        <meshStandardMaterial {...getPlateMaterialProps()} />
                                    </mesh>
                                </group>
                                <group position={[(x1 + x2) / 2, (topY1 + bottomY2) / 2, 0]} rotation={[0, 0, angleB]}>
                                    <mesh>
                                        <boxGeometry args={[lenB, 0.12, 0.08]} />
                                        <meshStandardMaterial {...getPlateMaterialProps()} />
                                    </mesh>
                                </group>
                            </React.Fragment>
                        );
                    })
                ) : (
                    // default non-wood zigzag diagonals
                    Array.from({ length: numPanels * 2 }, (_, i) => {
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
                            <group key={`diagonal-left-${i}`} position={[(startX + endX) / 2, (startY + endY) / 2, 0]} rotation={[0, 0, angle]}>
                                {/* Main angle member */}
                                <mesh>
                                    <boxGeometry args={[length, 0.15, 0.15]} />
                                    <meshStandardMaterial {...getMemberMaterialProps([(startX + endX) / 2, (startY + endY) / 2, 0])} />
                                </mesh>
                                {/* Angle iron flanges */}
                                <mesh position={[0, 0.05, 0.05]}>
                                    <boxGeometry args={[length, 0.08, 0.08]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                            </group>
                        );
                    })
                )}
            </group>

            {/* Warren Truss - Right Side (mirror of left side) */}
            <group position={[0, 0, trussWidth / 2]}>
                {/* Top chord nodes */}
                {Array.from({ length: numPanels + 1 }, (_, i) => {
                    const x = -bridgeLength / 2 + (i * trussSpacing);
                    const y = deckHeight + bridgeHeight + getDamageOffset([x, deckHeight + bridgeHeight, 0]);
                    return (
                        <group key={`top-right-${i}`} position={[x, y, 0]}>
                            {material === 'wood' ? (
                                <mesh>
                                    <boxGeometry args={[0.25, 0.25, 0.08]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                            ) : (
                                <mesh>
                                    <sphereGeometry args={[0.15, 16, 16]} />
                                    <meshStandardMaterial {...getMemberMaterialProps([x, y, 0])} />
                                </mesh>
                            )}
                            {/* Connection plates */}
                            <mesh>
                                <boxGeometry args={[0.3, 0.3, 0.05]} />
                                <meshStandardMaterial {...getPlateMaterialProps()} />
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
                                <meshStandardMaterial {...getPlateMaterialProps()} />
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
                                {material === 'wood' ? (
                                    <>
                                        {/* Wooden longitudinal plank */}
                                        <mesh>
                                            <boxGeometry args={[length, 0.18, 0.5]} />
                                            <meshStandardMaterial color="#A9754B" roughness={0.95} metalness={0} />
                                        </mesh>
                                    </>
                                ) : (
                                    <>
                                        <mesh>
                                            <boxGeometry args={[length, 0.25, 0.08]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yTop, 0])} />
                                        </mesh>
                                        <mesh position={[0, 0.1, 0]}>
                                            <boxGeometry args={[length, 0.05, 0.18]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yTop, 0])} />
                                        </mesh>
                                        <mesh position={[0, -0.1, 0]}>
                                            <boxGeometry args={[length, 0.05, 0.18]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yBottom, 0])} />
                                        </mesh>
                                    </>
                                )}
                            </group>
                            {/* Bottom beam */}
                            <group position={[(x1 + x2) / 2, yBottom, 0]}>
                                {material === 'wood' ? (
                                    <mesh>
                                        <boxGeometry args={[length, 0.18, 0.5]} />
                                        <meshStandardMaterial map={woodTexture} color="#A9754B" roughness={0.95} metalness={0} />
                                    </mesh>
                                ) : (
                                    <>
                                        <mesh>
                                            <boxGeometry args={[length, 0.25, 0.08]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yBottom, 0])} />
                                        </mesh>
                                        <mesh position={[0, 0.1, 0]}>
                                            <boxGeometry args={[length, 0.05, 0.18]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yBottom, 0])} />
                                        </mesh>
                                        <mesh position={[0, -0.1, 0]}>
                                            <boxGeometry args={[length, 0.05, 0.18]} />
                                            <meshStandardMaterial {...getMemberMaterialProps([(x1 + x2) / 2, yBottom, 0])} />
                                        </mesh>
                                    </>
                                )}
                            </group>
                        </React.Fragment>
                    );
                })}

                {/* Warren truss diagonal members - same as left side (mirror) */}
                {material === 'wood' ? (
                    Array.from({ length: numPanels }, (_, i) => {
                        const x1 = -bridgeLength / 2 + (i * trussSpacing);
                        const x2 = -bridgeLength / 2 + ((i + 1) * trussSpacing);
                        const bottomY1 = deckHeight + getDamageOffset([x1, deckHeight, 0]);
                        const bottomY2 = deckHeight + getDamageOffset([x2, deckHeight, 0]);
                        const topY1 = deckHeight + bridgeHeight + getDamageOffset([x1, deckHeight + bridgeHeight, 0]);
                        const topY2 = deckHeight + bridgeHeight + getDamageOffset([x2, deckHeight + bridgeHeight, 0]);

                        // Member A: bottom-left -> top-right
                        const dxA = x2 - x1;
                        const dyA = topY2 - bottomY1;
                        const lenA = Math.sqrt(dxA * dxA + dyA * dyA);
                        const angleA = Math.atan2(dyA, dxA);

                        // Member B: top-left -> bottom-right
                        const dxB = x2 - x1;
                        const dyB = bottomY2 - topY1;
                        const lenB = Math.sqrt(dxB * dxB + dyB * dyB);
                        const angleB = Math.atan2(dyB, dxB);

                        return (
                            <React.Fragment key={`xbraces-right-${i}`}>
                                <group position={[(x1 + x2) / 2, (bottomY1 + topY2) / 2, 0]} rotation={[0, 0, angleA]}>
                                    <mesh>
                                        <boxGeometry args={[lenA, 0.12, 0.08]} />
                                        <meshStandardMaterial {...getPlateMaterialProps()} />
                                    </mesh>
                                </group>
                                <group position={[(x1 + x2) / 2, (topY1 + bottomY2) / 2, 0]} rotation={[0, 0, angleB]}>
                                    <mesh>
                                        <boxGeometry args={[lenB, 0.12, 0.08]} />
                                        <meshStandardMaterial {...getPlateMaterialProps()} />
                                    </mesh>
                                </group>
                            </React.Fragment>
                        );
                    })
                ) : (
                    Array.from({ length: numPanels * 2 }, (_, i) => {
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
                            <group key={`diagonal-right-${i}`} position={[(startX + endX) / 2, (startY + endY) / 2, 0]} rotation={[0, 0, angle]}>
                                <mesh>
                                    <boxGeometry args={[length, 0.15, 0.15]} />
                                    <meshStandardMaterial {...getMemberMaterialProps([(startX + endX) / 2, (startY + endY) / 2, 0])} />
                                </mesh>
                                <mesh position={[0, 0.05, 0.05]}>
                                    <boxGeometry args={[length, 0.08, 0.08]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                            </group>
                        );
                    })
                )}
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
                            <meshStandardMaterial {...getMemberMaterialProps([x, yTop, 0])} />
                        </mesh>
                        {/* Bottom cross brace */}
                        <mesh position={[x, yBottom, 0]}>
                            <boxGeometry args={[0.15, 0.15, trussWidth]} />
                            <meshStandardMaterial {...getMemberMaterialProps([x, yBottom, 0])} />
                        </mesh>
                        {/* Vertical posts at panel boundaries (wood mode) - simulate straight foundation supports */}
                        {material === 'wood' && (
                            <>
                                {/* Left-side vertical post */}
                                <mesh position={[x, (yTop + yBottom) / 2, -trussWidth / 2 + 0.05]}>
                                    <boxGeometry args={[0.08, Math.abs(yTop - yBottom) + 0.02, 0.08]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                                {/* Right-side vertical post */}
                                <mesh position={[x, (yTop + yBottom) / 2, trussWidth / 2 - 0.05]}>
                                    <boxGeometry args={[0.08, Math.abs(yTop - yBottom) + 0.02, 0.08]} />
                                    <meshStandardMaterial {...getPlateMaterialProps()} />
                                </mesh>
                            </>
                        )}

                    </React.Fragment>
                );
            })}

            {/* If material is wood, add a wooden roof and connector members */}
            {material === 'wood' && (
                <group>
                    {/* Continuous roof running the full span (no gaps) */}
                    {(() => {
                        // Align roof so it sits flush on top of the top chord
                        const midX = 0;
                        const topBeamThickness = 0.18; // matches top beam geometry used above for wood
                        const roofThickness = 0.12; // main roof plank thickness
                        const topBeamHalf = topBeamThickness / 2;
                        const roofHalf = roofThickness / 2;
                        // gap between top beam center and roof center so roof bottom rests on top beam top surface
                        const roofGap = topBeamHalf + roofHalf; // 0.09 + 0.06 = 0.15
                        const roofY = deckHeight + bridgeHeight + getDamageOffset([midX, deckHeight + bridgeHeight, 0]) + roofGap;
                        // Slight overhang to cover edges and remove visible seams
                        const overhang = 0.12;
                        return (
                            <group key={`roof-continuous`} position={[0, roofY, 0]}>
                                {/* Main continuous roof plank */}
                                <mesh>
                                    <boxGeometry args={[bridgeLength + overhang * 2, roofThickness, trussWidth + 0.6]} />
                                    <meshStandardMaterial color="#8B5A2B" roughness={0.9} metalness={0} />
                                </mesh>
                                {/* Top skin to hide seams and look like a solid roof */}
                                <mesh position={[0, -roofHalf, 0]}>
                                    <boxGeometry args={[bridgeLength + overhang * 2, 0.02, trussWidth + 0.5]} />
                                    <meshStandardMaterial color="#A9754B" roughness={0.95} metalness={0} />
                                </mesh>
                            </group>
                        );
                    })()}

                    {/* Connectors removed for solid roof look */}

                    {/* Side wooden rails/trails to visually connect roof and deck */}
                    <mesh position={[0, deckHeight + 0.05, trussWidth / 2 + 0.2]}>
                        <boxGeometry args={[bridgeLength, 0.08, 0.1]} />
                        <meshStandardMaterial color="#8B5A2B" roughness={0.95} metalness={0} />
                    </mesh>
                    <mesh position={[0, deckHeight + 0.05, -trussWidth / 2 - 0.2]}>
                        <boxGeometry args={[bridgeLength, 0.08, 0.1]} />
                        <meshStandardMaterial color="#8B5A2B" roughness={0.95} metalness={0} />
                    </mesh>
                </group>
            )}

            {/* Enhanced bridge deck with concrete surface */}
            <group>
                {/* Structural base of deck (kept for both materials) */}
                <mesh position={[0, deckHeight, 0]}>
                    <boxGeometry args={[bridgeLength, 0.38, 2.8]} />
                    <meshStandardMaterial color={material === 'wood' ? '#8b5a2b' : '#9e9e9e'} roughness={material === 'wood' ? 0.98 : 0.8} />
                </mesh>

                {/* Wooden planked surface when in wood mode: many short planks across the length (seams between planks) */}
                {material === 'wood' ? (
                    (() => {
                        const plankCount = Math.round(bridgeLength * 2); // ~2 planks per unit length, tuneable
                        const seam = 0.02; // small gap between planks
                        const plankFull = bridgeLength / plankCount;
                        const plankLength = plankFull - seam;
                        const y = deckHeight + 0.21;
                        return (
                            <group>
                                {Array.from({ length: plankCount }, (_, i) => {
                                    const x = -bridgeLength / 2 + i * plankFull + plankFull / 2;
                                    // slight color jitter for realism
                                    const tint = (i % 3) * 0.02;
                                    return (
                                        <mesh key={`plank-${i}`} position={[x, y, 0]}>
                                            <boxGeometry args={[plankLength, 0.02, 2.6]} />
                                            <meshStandardMaterial map={woodTexture} color={`#${(0xA9754B + Math.floor(tint * 255)).toString(16).slice(0, 6)}`} roughness={0.95} metalness={0} />
                                        </mesh>
                                    );
                                })}
                                {/* optional thin filler between planks to emphasize seams */}
                                {Array.from({ length: plankCount - 1 }, (_, i) => {
                                    const x = -bridgeLength / 2 + (i + 1) * plankFull;
                                    return (
                                        <mesh key={`seam-${i}`} position={[x, y, 0]}>
                                            <boxGeometry args={[seam, 0.021, 2.6]} />
                                            <meshStandardMaterial color="#52331f" roughness={0.98} metalness={0} />
                                        </mesh>
                                    );
                                })}
                            </group>
                        );
                    })()
                ) : (
                    // Non-wood default thin surface layer
                    <mesh position={[0, deckHeight + 0.21, 0]}>
                        <boxGeometry args={[bridgeLength, 0.02, 2.6]} />
                        <meshStandardMaterial color="#424242" roughness={0.9} />
                    </mesh>
                )}

                {/* Lane markings (hide center yellow line when wooden truss) */}
                {material !== 'wood' && (
                    <mesh position={[0, deckHeight + 0.22, 0]}>
                        <boxGeometry args={[bridgeLength, 0.005, 0.1]} />
                        <meshStandardMaterial color="#ffeb3b" />
                    </mesh>
                )}

                {/* Edge lines removed as requested */}
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

            {/* Continuous guardrails (material-aware) - remove entirely when wood */}
            {material !== 'wood' && (
                <>
                    <mesh position={[0, deckHeight + 1.0, 1.5]}>
                        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
                        <meshStandardMaterial {...getMemberMaterialProps([0, deckHeight + 1.0, 1.5])} />
                    </mesh>
                    <mesh position={[0, deckHeight + 1.0, -1.5]}>
                        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
                        <meshStandardMaterial {...getMemberMaterialProps([0, deckHeight + 1.0, -1.5])} />
                    </mesh>

                    {/* Mid-level guardrails */}
                    <mesh position={[0, deckHeight + 0.7, 1.5]}>
                        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
                        <meshStandardMaterial {...getMemberMaterialProps([0, deckHeight + 0.7, 1.5])} />
                    </mesh>
                    <mesh position={[0, deckHeight + 0.7, -1.5]}>
                        <boxGeometry args={[bridgeLength, 0.06, 0.06]} />
                        <meshStandardMaterial {...getMemberMaterialProps([0, deckHeight + 0.7, -1.5])} />
                    </mesh>
                </>
            )}

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
