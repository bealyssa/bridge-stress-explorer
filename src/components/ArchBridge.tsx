import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import DamageVisualization from './DamageVisualization';
import type { LoadPoint, DamageState } from '../utils/BridgeUtils';

const ArchBridge: React.FC<{ loadPoints: LoadPoint[]; damageState: DamageState; material?: 'wood' | 'steel' | 'concrete' }> = ({ loadPoints, damageState, material = 'wood' }) => {
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

    // Prepare steel arch geometries/materials with hooks at top-level so hooks order is stable
    const leftCurve = useMemo(() => new THREE.CatmullRomCurve3(archPointsLeft.map(p => new THREE.Vector3(p[0], p[1], p[2]))), [archPointsLeft]);
    const rightCurve = useMemo(() => new THREE.CatmullRomCurve3(archPointsRight.map(p => new THREE.Vector3(p[0], p[1], p[2]))), [archPointsRight]);

    // For steel we create multiple parallel ribs per side to simulate the multi-ribbed arch from the photo.
    // Concrete uses a single wide rib so it reads as a solid concrete arch instead of multiple metal ribs.
    const ribOffsets = useMemo(() => material === 'concrete' ? [0] : [0, 0.12, 0.24], [material]);
    const ribCurvesLeft = useMemo(() => ribOffsets.map(o => new THREE.CatmullRomCurve3(archPointsLeft.map(p => new THREE.Vector3(p[0], p[1], p[2] - o)))), [archPointsLeft, ribOffsets]);
    const ribCurvesRight = useMemo(() => ribOffsets.map(o => new THREE.CatmullRomCurve3(archPointsRight.map(p => new THREE.Vector3(p[0], p[1], p[2] + o)))), [archPointsRight, ribOffsets]);
    const ribGeomsLeft = useMemo(() => {
        // slightly reduced concrete radius to make the arch a bit thinner
        const radius = material === 'concrete' ? 0.22 : 0.08;
        return ribCurvesLeft.map(c => new THREE.TubeGeometry(c, 96, radius, 10, false));
    }, [ribCurvesLeft, material]);
    const ribGeomsRight = useMemo(() => {
        const radius = material === 'concrete' ? 0.22 : 0.08;
        return ribCurvesRight.map(c => new THREE.TubeGeometry(c, 96, radius, 10, false));
    }, [ribCurvesRight, material]);

    // Additional concrete shell geometries to guarantee a solid white appearance
    // slightly thinner shell so concrete appears less bulky
    const concreteShellLeft = useMemo(() => material === 'concrete' ? new THREE.TubeGeometry(leftCurve, 96, 0.28, 12, false) : null, [material, leftCurve]);
    const concreteShellRight = useMemo(() => material === 'concrete' ? new THREE.TubeGeometry(rightCurve, 96, 0.28, 12, false) : null, [material, rightCurve]);

    const concreteWhite = '#f5f5f5';
    const concreteLight = '#e6e6e6';
    const steelSilver = '#e9ecef';
    const steelBright = '#f3f3f3';
    const steelDark = '#1f2937'; // dark steel / almost black for barricade
    const steelAccent = '#bfc7cc'; // mid silver accent for rails

    const archMeshMaterial = useMemo(() => {
        if (material === 'steel') return new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.92, roughness: 0.18 });
        if (material === 'concrete') return new THREE.MeshStandardMaterial({ color: concreteWhite, metalness: 0.0, roughness: 0.8 });
        return new THREE.MeshStandardMaterial({ color: '#e9ecef', metalness: 0.0, roughness: 0.6 });
    }, [material]);

    const connectorMat = useMemo(() => {
        if (material === 'concrete') return new THREE.MeshStandardMaterial({ color: concreteLight, metalness: 0.0, roughness: 0.78 });
        return new THREE.MeshStandardMaterial({ color: '#b45f06', metalness: 0.95, roughness: 0.22 });
    }, [material]);
    const plateMat = useMemo(() => {
        if (material === 'concrete') return new THREE.MeshStandardMaterial({ color: concreteLight, metalness: 0.0, roughness: 0.78 });
        return new THREE.MeshStandardMaterial({ color: '#c65f2a', metalness: 0.9, roughness: 0.25 });
    }, [material]);

    // Small helper component to render a cylindrical brace between two points
    const Brace: React.FC<{ p1: [number, number, number]; p2: [number, number, number]; radius?: number; color?: string }> = ({ p1, p2, radius = 0.035, color = '#cfcfcf' }) => {
        const ref = useRef<THREE.Mesh>(null);
        useEffect(() => {
            if (!ref.current) return;
            const a = new THREE.Vector3(p1[0], p1[1], p1[2]);
            const b = new THREE.Vector3(p2[0], p2[1], p2[2]);
            const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
            const dir = new THREE.Vector3().subVectors(b, a);
            const len = dir.length();

            // Align cylinder (which is along Y) to the direction vector
            const axis = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(axis, dir.clone().normalize());

            ref.current.position.copy(mid);
            ref.current.quaternion.copy(quat);
            // scale the unit-height cylinder to the actual length
            ref.current.scale.set(1, len, 1);
        }, [p1, p2]);

        return (
            <mesh ref={ref}>
                <cylinderGeometry args={[radius, radius, 1, 8]} />
                <meshStandardMaterial color={material === 'concrete' ? concreteLight : color} metalness={material === 'concrete' ? 0 : 0.9} roughness={material === 'concrete' ? 0.78 : 0.22} />
            </mesh>
        );
    };

    return (
        <group ref={bridgeRef} position={collapsePosition} rotation={collapseRotation}>
            {/* Arches: wooden lines or steel multi-ribbed arches with connectors/bracing */}
            {material === 'wood' ? (
                <>
                    <Line points={archPointsLeft} color="#c97a3d" lineWidth={8} />
                    <Line points={archPointsRight} color="#c97a3d" lineWidth={8} />
                </>
            ) : (
                <>
                    {/* Multiple ribs per side to give the arch depth and weight */}
                    {ribGeomsLeft.map((g, ri) => (
                        <mesh key={`left-rib-${ri}`} geometry={g}>
                            <primitive object={archMeshMaterial} attach="material" />
                        </mesh>
                    ))}
                    {ribGeomsRight.map((g, ri) => (
                        <mesh key={`right-rib-${ri}`} geometry={g}>
                            <primitive object={archMeshMaterial} attach="material" />
                        </mesh>
                    ))}

                    {/* For concrete, draw an additional slightly larger shell so the arch visually reads as solid white concrete */}
                    {material === 'concrete' && concreteShellLeft && (
                        <mesh geometry={concreteShellLeft}>
                            <primitive object={archMeshMaterial} attach="material" />
                        </mesh>
                    )}
                    {material === 'concrete' && concreteShellRight && (
                        <mesh geometry={concreteShellRight}>
                            <primitive object={archMeshMaterial} attach="material" />
                        </mesh>
                    )}

                    {/* Lattice/diagonal bracing between the ribs on each side
                        For concrete arches we avoid adding metal lattice/gussets so concrete reads as a solid element. */}
                    {material !== 'concrete' && ribCurvesLeft[0].getPoints(20).map((pt, i) => {
                        // connect outer rib (index 0) to inner rib (index 1 or 2) with short diagonals
                        if (i % 2 === 1) return null;
                        const outer = ribCurvesLeft[0].getPoints(20)[i];
                        const inner = ribCurvesLeft[1].getPoints(20)[i + 1] || ribCurvesLeft[1].getPoints(20)[i];
                        return (
                            <React.Fragment key={`lbrace-left-${i}`}>
                                <Brace p1={[outer.x, outer.y, outer.z]} p2={[inner.x, inner.y, inner.z]} color="#cfcfcf" />
                                {/* gusset plate at the outer node */}
                                <mesh key={`gusset-left-${i}`} position={[outer.x, outer.y, outer.z - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                                    <boxGeometry args={[0.12, 0.02, 0.06]} />
                                    <primitive object={plateMat} attach="material" />
                                </mesh>
                            </React.Fragment>
                        );
                    })}

                    {material !== 'concrete' && ribCurvesRight[0].getPoints(20).map((pt, i) => {
                        if (i % 2 === 1) return null;
                        const outer = ribCurvesRight[0].getPoints(20)[i];
                        const inner = ribCurvesRight[1].getPoints(20)[i + 1] || ribCurvesRight[1].getPoints(20)[i];
                        return (
                            <React.Fragment key={`lbrace-right-${i}`}>
                                <Brace p1={[outer.x, outer.y, outer.z]} p2={[inner.x, inner.y, inner.z]} color="#cfcfcf" />
                                <mesh key={`gusset-right-${i}`} position={[outer.x, outer.y, outer.z + 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                                    <boxGeometry args={[0.12, 0.02, 0.06]} />
                                    <primitive object={plateMat} attach="material" />
                                </mesh>
                            </React.Fragment>
                        );
                    })}
                </>
            )}
            {/* Connect arches with horizontal beams */}
            {Array.from({ length: 12 }, (_, i) => {
                const idx = i * 4;
                if (idx >= archPointsLeft.length || idx >= archPointsRight.length) return null;
                const left = archPointsLeft[idx];
                const right = archPointsRight[idx];
                return (
                    <mesh key={i} position={[(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, 0]}>
                        <boxGeometry args={[material === 'concrete' ? 0.28 : 0.08, material === 'concrete' ? 0.28 : 0.08, deckWidth]} />
                        <meshStandardMaterial color={material === 'concrete' ? concreteWhite : (material === 'steel' ? '#cfcfcf' : '#a0522d')} metalness={material === 'steel' ? 0.9 : 0} roughness={material === 'concrete' ? 0.78 : (material === 'steel' ? 0.2 : 0.8)} />
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
                                    color={material === 'concrete' ? concreteWhite : (material === 'steel' ? '#9e9e9e' : '#995D27')}
                                    roughness={material === 'concrete' ? 0.8 : (material === 'steel' ? 0.85 : 0.9)}
                                    metalness={material === 'steel' ? 0.0 : 0.0}
                                />
                            </mesh>

                            {/* Bottom surface for thickness */}
                            <mesh key="deck-bottom" geometry={geometry} position={[0, -0.4, 0]}>
                                <meshStandardMaterial
                                    color={material === 'concrete' ? concreteLight : (material === 'steel' ? steelSilver : '#995D27')}
                                    roughness={material === 'concrete' ? 0.78 : (material === 'steel' ? 0.16 : 0.9)}
                                    metalness={material === 'steel' ? 0.95 : 0}
                                />
                            </mesh>

                            {/* Planks overlay for texture */}
                            <mesh key="planks-texture" geometry={geometry} position={[0, 0.01, 0]}>
                                <meshStandardMaterial
                                    color={material === 'concrete' ? concreteWhite : (material === 'steel' ? '#9e9e9e' : '#995D27')}
                                    roughness={material === 'concrete' ? 0.8 : (material === 'steel' ? 0.75 : 0.0)}
                                    metalness={material === 'steel' ? 0.6 : 0}
                                />
                            </mesh>
                        </>
                    );
                })}
                {/* Steel side fascia panels that follow the deck curve (showing concrete on top of steel) */}
                {material === 'steel' && (
                    <group>
                        {deckPoints.map((pt, i) => {
                            const next = deckPoints[i + 1] || pt;
                            const length = Math.sqrt(Math.pow(next[0] - pt[0], 2) + Math.pow(next[1] - pt[1], 2));
                            const midX = (pt[0] + next[0]) / 2;
                            const midY = (pt[1] + next[1]) / 2;
                            const angle = Math.atan2(next[1] - pt[1], next[0] - pt[0]);
                            const thickness = 0.06;
                            const height = 0.38;
                            // left fascia
                            return (
                                <React.Fragment key={`fascia-${i}`}>
                                    <mesh position={[midX, midY - 0.1, -deckWidth / 2 - thickness / 2]} rotation={[0, 0, angle]}>
                                        <boxGeometry args={[length * 0.98, height, thickness]} />
                                        <meshStandardMaterial color={steelSilver} metalness={0.95} roughness={0.14} />
                                    </mesh>
                                    <mesh position={[midX, midY - 0.1, deckWidth / 2 + thickness / 2]} rotation={[0, 0, angle]}>
                                        <boxGeometry args={[length * 0.98, height, thickness]} />
                                        <meshStandardMaterial color={steelSilver} metalness={0.95} roughness={0.14} />
                                    </mesh>
                                </React.Fragment>
                            );
                        })}
                    </group>
                )}
            </group>
            {/* Dashed centerline that follows the curved deck (hidden for wood) */}
            {material !== 'wood' && (
                <group>
                    {deckPoints.map((pt, i) => {
                        // create dashes: render every other segment
                        if (i % 2 === 1) return null;
                        const next = deckPoints[i + 1] || pt;
                        const length = Math.sqrt(Math.pow(next[0] - pt[0], 2) + Math.pow(next[1] - pt[1], 2));
                        const midX = (pt[0] + next[0]) / 2;
                        const midY = (pt[1] + next[1]) / 2 + 0.22;
                        const angle = Math.atan2(next[1] - pt[1], next[0] - pt[0]);
                        return (
                            <mesh key={`dash-${i}`} position={[midX, midY, 0]} rotation={[0, 0, angle]}>
                                <boxGeometry args={[length * 0.9, 0.01, 0.06]} />
                                <meshStandardMaterial color="#ffeb3b" metalness={0} roughness={0.3} />
                            </mesh>
                        );
                    })}
                </group>
            )}
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
                                const isConcreteRail = material === 'concrete';
                                const postSize = material === 'steel' || isConcreteRail ? [0.08, railHeight, 0.06] : [0.04, railHeight, 0.04];
                                const postColor = material === 'steel' ? steelSilver : (isConcreteRail ? steelDark : '#a0522d');
                                const postMetal = material === 'steel' || isConcreteRail ? 0.95 : 0;
                                const postRough = material === 'steel' || isConcreteRail ? 0.18 : 0.8;
                                return (
                                    <mesh key={`post-left-${i}`} position={[pos[0], pos[1] + railHeight / 2, -deckWidth / 2 - 0.09]}>
                                        {/* Heavier square posts for steel and concrete-anchored steel rails */}
                                        <boxGeometry args={postSize as [number, number, number]} />
                                        <meshStandardMaterial color={postColor} metalness={postMetal} roughness={postRough} />
                                    </mesh>
                                );
                            }
                            return null;
                        })}

                        {/* Right side railings */}
                        {vertices.map((pos, i) => {
                            if (i % 2 === 0) {
                                const isConcreteRail = material === 'concrete';
                                const postSize = material === 'steel' || isConcreteRail ? [0.08, railHeight, 0.06] : [0.04, railHeight, 0.04];
                                const postColor = material === 'steel' ? steelSilver : (isConcreteRail ? steelDark : '#a0522d');
                                const postMetal = material === 'steel' || isConcreteRail ? 0.95 : 0;
                                const postRough = material === 'steel' || isConcreteRail ? 0.18 : 0.8;
                                return (
                                    <mesh key={`post-right-${i}`} position={[pos[0], pos[1] + railHeight / 2, deckWidth / 2 + 0.09]}>
                                        <boxGeometry args={postSize as [number, number, number]} />
                                        <meshStandardMaterial color={postColor} metalness={postMetal} roughness={postRough} />
                                    </mesh>
                                );
                            }
                            return null;
                        })}

                        {/* Rivet dots at post positions for steel look */}
                        {(material === 'steel' || material === 'concrete') && vertices.map((pos, i) => {
                            // Show rivet-like accents for metal rails. For concrete we use subtle silver accents instead of bright rivets.
                            if (i % 2 !== 0) return null;
                            const isConcreteRail = material === 'concrete';
                            return (
                                <React.Fragment key={`rivets-${i}`}>
                                    <mesh position={[pos[0], pos[1] + railHeight - 0.18, -deckWidth / 2 - 0.09 - 0.03]}>
                                        <sphereGeometry args={[isConcreteRail ? 0.015 : 0.02, 6, 6]} />
                                        <meshStandardMaterial color={isConcreteRail ? steelAccent : steelBright} metalness={isConcreteRail ? 0.9 : 1} roughness={isConcreteRail ? 0.22 : 0.12} />
                                    </mesh>
                                    <mesh position={[pos[0], pos[1] + railHeight - 0.18, deckWidth / 2 + 0.09 + 0.03]}>
                                        <sphereGeometry args={[isConcreteRail ? 0.015 : 0.02, 6, 6]} />
                                        <meshStandardMaterial color={isConcreteRail ? steelAccent : steelBright} metalness={isConcreteRail ? 0.9 : 1} roughness={isConcreteRail ? 0.22 : 0.12} />
                                    </mesh>
                                </React.Fragment>
                            );
                        })}

                        {/* Horizontal rails - using curved geometry */}
                        {[0, 1, 2, 3].map((level) => {
                            const railGeometryLeft = new THREE.BufferGeometry();
                            const railGeometryRight = new THREE.BufferGeometry();
                            const railVerts = [];
                            const railVertsRight = [];

                            // Adjust height and thickness based on level (make bottom rails thicker for steel)
                            const height = level === 0 ? 0.15 : (level === 3 ? 0.7 : 0.25 + level * 0.2);
                            const isConcreteRail = material === 'concrete';
                            const thickness = level === 0 ? (material === 'steel' || isConcreteRail ? 0.14 : 0.08) : (material === 'steel' || isConcreteRail ? 0.06 : 0.04); // Bottom rail thicker in steel or concrete-steel rails

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
                                                    <React.Fragment key={`rail-pair-${level}-${i}`}>
                                                        <mesh
                                                            key={`rail-left-${level}-${i}`}
                                                            position={[midX, midY + 0.25 + level * 0.2, -deckWidth / 2 + 0.05]}
                                                            rotation={[0, 0, angle]}
                                                        >
                                                            <boxGeometry args={[length, level === 0 ? (material === 'steel' || isConcreteRail ? 0.14 : 0.08) : (material === 'steel' || isConcreteRail ? 0.06 : 0.04), level === 0 ? (material === 'steel' || isConcreteRail ? 0.14 : 0.08) : (material === 'steel' || isConcreteRail ? 0.06 : 0.04)]} />
                                                            <meshStandardMaterial color={material === 'steel' ? (level === 0 ? steelSilver : '#d1d1d1') : (isConcreteRail ? (level === 0 ? steelDark : steelAccent) : (level === 0 ? "#8B4513" : "#a0522d"))} metalness={material === 'steel' || isConcreteRail ? 0.95 : 0} roughness={material === 'steel' || isConcreteRail ? 0.18 : 0.8} />
                                                        </mesh>
                                                        <mesh
                                                            key={`rail-right-${level}-${i}`}
                                                            position={[midX, midY + (level === 0 ? 0.15 : (level === 3 ? 0.7 : 0.25 + level * 0.2)), deckWidth / 2 - 0.05]}
                                                            rotation={[0, 0, angle]}
                                                        >
                                                            <boxGeometry args={[length, level === 0 ? (material === 'steel' || isConcreteRail ? 0.14 : 0.08) : (material === 'steel' || isConcreteRail ? 0.06 : 0.04), level === 0 ? (material === 'steel' || isConcreteRail ? 0.14 : 0.08) : (material === 'steel' || isConcreteRail ? 0.06 : 0.04)]} />
                                                            <meshStandardMaterial color={material === 'steel' ? (level === 0 ? steelSilver : '#d1d1d1') : (isConcreteRail ? (level === 0 ? steelDark : steelAccent) : (level === 0 ? "#8B4513" : "#a0522d"))} metalness={material === 'steel' || isConcreteRail ? 0.95 : 0} roughness={material === 'steel' || isConcreteRail ? 0.18 : 0.8} />
                                                        </mesh>
                                                    </React.Fragment>
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

            {/* steel piers removed per request */}
        </group>
    );
};

export default ArchBridge;
