import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Environment Components (Memoized to prevent unnecessary re-renders)
const Environment: React.FC = React.memo(() => {
    const waterRef = useRef<THREE.Mesh>(null);

    // Generate fixed positions for environmental elements to prevent re-location on re-renders
    const treePositionsLeft = useMemo(() =>
        Array.from({ length: 20 }, (_, i) => ({
            x: -35 + Math.random() * 15,
            z: -20 + Math.random() * 40,
            height: 2.5 + Math.random() * 2,
            foliageSize: 1 + Math.random() * 0.5
        })), []
    );

    const treePositionsRight = useMemo(() =>
        Array.from({ length: 25 }, (_, i) => ({
            x: 20 + Math.random() * 20,
            z: -25 + Math.random() * 50,
            height: 2.5 + Math.random() * 2,
            foliageSize: 1 + Math.random() * 0.5
        })), []
    );

    const rockPositions = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => {
            const x = -15 + Math.random() * 30;
            const z = -10 + Math.random() * 20;
            const size = 0.3 + Math.random() * 0.5;
            return { x, z, size };
        }), []
    );

    const buildingPositionsLeft = useMemo(() =>
        Array.from({ length: 3 }, (_, i) => ({
            x: -40 + i * 5,
            z: -15 + Math.random() * 10,
            height: 3 + Math.random() * 2
        })), []
    );

    const buildingPositionsRight = useMemo(() =>
        Array.from({ length: 4 }, (_, i) => ({
            x: 35 + i * 4,
            z: -10 + Math.random() * 15,
            height: 3 + Math.random() * 2
        })), []
    );

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
                <mesh position={[-20, bridgeHeight - 0.05, deckWidth / 2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[14, 0.6]} />
                    <meshStandardMaterial color="#4a4a4a" />
                </mesh>
                <mesh position={[-20, bridgeHeight - 0.05, -deckWidth / 2 - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
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
                <mesh position={[20, bridgeHeight - 0.05, deckWidth / 2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[14, 0.6]} />
                    <meshStandardMaterial color="#4a4a4a" />
                </mesh>
                <mesh position={[20, bridgeHeight - 0.05, -deckWidth / 2 - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
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
            <mesh position={[-20, bridgeHeight + 0.02, deckWidth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[12, 0.05]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[-20, bridgeHeight + 0.02, -deckWidth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[12, 0.05]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[20, bridgeHeight + 0.02, deckWidth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[12, 0.05]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[20, bridgeHeight + 0.02, -deckWidth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[12, 0.05]} />
                <meshStandardMaterial color="#FFFFFF" />
            </mesh>

            {/* Trees on left side land mass - distributed across the terrain */}
            {treePositionsLeft.map((tree, i) => (
                <group key={`tree-left-${i}`} position={[tree.x, 1.5, tree.z]}>
                    {/* Tree trunk */}
                    <mesh position={[0, tree.height / 2, 0]} castShadow>
                        <cylinderGeometry args={[0.15, 0.25, tree.height]} />
                        <meshStandardMaterial color="#654321" />
                    </mesh>
                    {/* Tree foliage */}
                    <mesh position={[0, tree.height + 1, 0]} castShadow>
                        <sphereGeometry args={[tree.foliageSize]} />
                        <meshStandardMaterial color="#228B22" />
                    </mesh>
                </group>
            ))}

            {/* Trees on right side land mass - distributed across the terrain */}
            {treePositionsRight.map((tree, i) => (
                <group key={`tree-right-${i}`} position={[tree.x, 1.5, tree.z]}>
                    {/* Tree trunk */}
                    <mesh position={[0, tree.height / 2, 0]} castShadow>
                        <cylinderGeometry args={[0.15, 0.25, tree.height]} />
                        <meshStandardMaterial color="#654321" />
                    </mesh>
                    {/* Tree foliage */}
                    <mesh position={[0, tree.height + 1, 0]} castShadow>
                        <sphereGeometry args={[tree.foliageSize]} />
                        <meshStandardMaterial color="#228B22" />
                    </mesh>
                </group>
            ))}

            {/* Bridge abutments/foundations - positioned UNDER the bridge, not blocking the road */}
            {/* Left abutment - under bridge only */}
            <mesh position={[bridgeLeftEnd, bridgeHeight - 1.5, deckWidth / 2 + 1.5]} castShadow receiveShadow>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>
            <mesh position={[bridgeLeftEnd, bridgeHeight - 1.5, -deckWidth / 2 - 1.5]} castShadow receiveShadow>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>

            {/* Right abutment - under bridge only */}
            <mesh position={[bridgeRightEnd, bridgeHeight - 1.5, deckWidth / 2 + 1.5]} castShadow receiveShadow>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>
            <mesh position={[bridgeRightEnd, bridgeHeight - 1.5, -deckWidth / 2 - 1.5]} castShadow receiveShadow>
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
            <mesh position={[-22, bridgeHeight - 0.5, deckWidth / 2 + 0.8]} castShadow receiveShadow>
                <boxGeometry args={[16, 1.5, 0.3]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>
            <mesh position={[-22, bridgeHeight - 0.5, -deckWidth / 2 - 0.8]} castShadow receiveShadow>
                <boxGeometry args={[16, 1.5, 0.3]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>
            <mesh position={[22, bridgeHeight - 0.5, deckWidth / 2 + 0.8]} castShadow receiveShadow>
                <boxGeometry args={[16, 1.5, 0.3]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>
            <mesh position={[22, bridgeHeight - 0.5, -deckWidth / 2 - 0.8]} castShadow receiveShadow>
                <boxGeometry args={[16, 1.5, 0.3]} />
                <meshStandardMaterial color="#A0A0A0" />
            </mesh>

            {/* Some rocks/boulders scattered around for realism */}
            {rockPositions.map((rock, i) => {
                // Don't place rocks on the road
                if (Math.abs(rock.z) > deckWidth / 2 + 1) {
                    return (
                        <mesh key={`rock-${i}`} position={[rock.x, rock.size / 2, rock.z]} castShadow receiveShadow>
                            <sphereGeometry args={[rock.size]} />
                            <meshStandardMaterial color="#696969" />
                        </mesh>
                    );
                }
                return null;
            })}

            {/* Small buildings/structures on distant land for context */}
            {buildingPositionsLeft.map((building, i) => (
                <mesh key={`building-left-${i}`} position={[building.x, 1.5 + building.height / 2, building.z]} castShadow>
                    <boxGeometry args={[2, building.height, 2]} />
                    <meshStandardMaterial color="#8B4513" />
                </mesh>
            ))}

            {buildingPositionsRight.map((building, i) => (
                <mesh key={`building-right-${i}`} position={[building.x, 1.5 + building.height / 2, building.z]} castShadow>
                    <boxGeometry args={[2, building.height, 2]} />
                    <meshStandardMaterial color="#8B4513" />
                </mesh>
            ))}
        </>
    );
});

export default Environment;
