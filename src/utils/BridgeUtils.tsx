import React, { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere, Cylinder, Text } from '@react-three/drei';
import * as THREE from 'three';
// Type definitions moved from BridgeSimulator for shared use
export interface LoadPoint {
    id: string;
    position: [number, number, number];
    weight: number;
    type?: 'manual' | 'vehicle'; // Optional for backward compatibility
}

export type FailureMode = 'none' | 'collapse' | 'buckling' | 'shear' | 'bending';
export type WarningLevel = 'safe' | 'caution' | 'danger' | 'critical' | 'failure';
export interface CrackData {
    id: string;
    severity: number;
    points: [number, number, number][];
    type: 'surface' | 'structural' | 'critical';
}
export interface DamageState {
    cracks: CrackData[];
    overallIntegrity: number;
    failureMode: FailureMode;
    warningLevel: WarningLevel;
}

// Vehicle Component with improved real-time collision detection (Memoized)
const VehicleComponent: React.FC<{
    initialVehicle: any;
    bridgeType: string;
    damageState: DamageState;
    allVehicles: React.MutableRefObject<any[]>;
    isVisible?: boolean; // New prop to control visibility
}> = React.memo(({ initialVehicle, bridgeType, damageState, allVehicles, isVisible = true }) => {
    const meshRef = useRef<THREE.Group>(null);
    const vehicleData = useRef(initialVehicle);

    // Get bridge height at given x position
    const getBridgeHeight = (x: number): number => {
        const bridgeBaseY = 2.2;
        const totalBridgeLength = 28;
        const deckCurveHeight = 1.5;

        // Add vehicle height offset based on vehicle type (only for bridge)
        let vehicleHeightOffset = 0.09; // Default for cars
        if (initialVehicle.type === 'truck') {
            vehicleHeightOffset = 0.10; // Trucks sit a bit higher
        } else if (initialVehicle.type === 'bus') {
            vehicleHeightOffset = 0.11; // Buses sit highest
        }

        if (x >= -14 && x <= 14) {
            // On bridge - use full height + offset
            if (bridgeType === 'arch') {
                return bridgeBaseY + deckCurveHeight * (1 - Math.pow(x / (totalBridgeLength / 2), 2)) + 0.18 + vehicleHeightOffset;
            } else {
                return bridgeBaseY + 0.18 + vehicleHeightOffset;
            }
        }
        // On land/road - use ground level with minimal offset for wheel contact
        const groundLevel = 2.2; // Lower ground level for roads
        let groundOffset = 0.05; // Minimal offset for cars
        if (initialVehicle.type === 'truck') {
            groundOffset = 0.08; // Slightly higher for trucks
        } else if (initialVehicle.type === 'bus') {
            groundOffset = 0.10; // Highest for buses
        }
        return groundLevel + groundOffset;
    };

    // Check for vehicles ahead in the same lane (using real-time positions)
    const getVehicleAhead = (currentVehicle: any): any | null => {
        const vehicles = allVehicles.current;
        const sameDirection = vehicles.filter(v =>
            v.id !== currentVehicle.id &&
            v.direction === currentVehicle.direction &&
            Math.abs(v.position[2] - currentVehicle.position[2]) < 0.8 // Wider lane detection
        );
        let closestVehicle: any | null = null;
        let minDistance = Infinity;
        for (const vehicle of sameDirection) {
            let distance: number;
            if (currentVehicle.direction === 1) {
                distance = vehicle.position[0] - currentVehicle.position[0];
            } else {
                distance = currentVehicle.position[0] - vehicle.position[0];
            }
            // Extended detection range for better traffic flow
            if (distance > 0 && distance < minDistance && distance < 12) {
                minDistance = distance;
                closestVehicle = vehicle;
            }
        }
        return closestVehicle;
    };

    // Get realistic speed based on traffic conditions
    const getRealisticSpeed = (vehicle: any, vehicleAhead: any | null, baseSpeed: number): number => {
        if (!vehicleAhead) {
            // No traffic ahead - drive at optimal speed with small random variation
            const speedVariation = 0.8 + Math.random() * 0.4; // 80-120% of base speed
            return baseSpeed * speedVariation;
        }

        let distance: number;
        if (vehicle.direction === 1) {
            distance = vehicleAhead.position[0] - vehicle.position[0];
        } else {
            distance = vehicle.position[0] - vehicleAhead.position[0];
        }

        // Vehicle-specific safe distances
        const safeDistance = vehicle.type === 'truck' ? 5.0 :
            vehicle.type === 'bus' ? 4.5 : 3.5;

        // Emergency braking distance
        const emergencyDistance = safeDistance * 0.3;

        // Progressive speed reduction based on distance
        if (distance < emergencyDistance) {
            // Emergency stop
            return 0.1;
        } else if (distance < safeDistance * 0.6) {
            // Heavy braking
            return baseSpeed * 0.2;
        } else if (distance < safeDistance) {
            // Moderate braking
            const ratio = (distance - emergencyDistance) / (safeDistance - emergencyDistance);
            return baseSpeed * (0.2 + 0.4 * ratio);
        } else if (distance < safeDistance * 1.5) {
            // Cautious following
            const ratio = (distance - safeDistance) / (safeDistance * 0.5);
            return baseSpeed * (0.6 + 0.3 * ratio);
        } else if (distance < safeDistance * 2.5) {
            // Normal following with slight reduction
            return baseSpeed * 0.9;
        } else {
            // Free driving
            return baseSpeed;
        }
    };

    useFrame((state, delta) => {
        if (meshRef.current) {
            const vehicle = vehicleData.current;

            // Realistic base speeds with variation
            let baseSpeed: number;
            switch (vehicle.type) {
                case 'car':
                    baseSpeed = 3.2 + Math.sin(state.clock.elapsedTime * 0.1) * 0.3; // 2.9-3.5
                    break;
                case 'bus':
                    baseSpeed = 2.1 + Math.sin(state.clock.elapsedTime * 0.08) * 0.2; // 1.9-2.3
                    break;
                case 'truck':
                    baseSpeed = 1.9 + Math.sin(state.clock.elapsedTime * 0.06) * 0.2; // 1.7-2.1
                    break;
                default:
                    baseSpeed = 2.8;
                    break;
            }

            // Check for traffic ahead
            const vehicleAhead = getVehicleAhead(vehicle);

            // Get realistic speed based on traffic conditions
            let currentSpeed = getRealisticSpeed(vehicle, vehicleAhead, baseSpeed);

            // Speed adjustments for bridge conditions
            const isOnBridge = vehicle.position[0] >= -14 && vehicle.position[0] <= 14;
            if (isOnBridge) {
                // Slightly slower on bridge (realistic caution)
                currentSpeed *= 0.9;
            }

            // Weather/random factor simulation
            const weatherFactor = 0.95 + Math.sin(state.clock.elapsedTime * 0.02) * 0.05;
            currentSpeed *= weatherFactor;

            const newX = vehicle.position[0] + vehicle.direction * currentSpeed * delta;
            const targetY = getBridgeHeight(newX);
            const laneCenter = vehicle.direction === 1 ? 0.6 : -0.6;

            // Smooth lane changes and positioning
            const laneChangeSpeed = vehicleAhead &&
                (vehicle.direction === 1 ? vehicleAhead.position[0] - vehicle.position[0] : vehicle.position[0] - vehicleAhead.position[0]) < 2.0
                ? 4 * delta : 2 * delta;

            const newZ = THREE.MathUtils.lerp(vehicle.position[2], laneCenter, laneChangeSpeed);
            const newY = THREE.MathUtils.lerp(vehicle.position[1], targetY, 5 * delta);

            vehicle.position = [newX, newY, newZ];
            vehicle.isOnBridge = newX >= -16 && newX <= 16;

            const vehicleIndex = allVehicles.current.findIndex(v => v.id === vehicle.id);
            if (vehicleIndex !== -1) {
                allVehicles.current[vehicleIndex] = { ...vehicle };
            }

            if (newX > 35 || newX < -35) {
                const resetX = vehicle.direction === 1 ? -35 : 35;
                const resetY = getBridgeHeight(resetX);
                vehicle.position = [resetX, resetY, laneCenter];
                vehicle.isOnBridge = false;
            }
            meshRef.current.position.set(vehicle.position[0], vehicle.position[1], vehicle.position[2]);
            meshRef.current.rotation.y = vehicle.direction === 1 ? 0 : Math.PI;
        }
    });

    const getVehicleSize = () => {
        // More realistic vehicle sizes relative to bridge (28 units long, 2 units wide)
        // Real vehicles: Car ~4-5m, Truck ~8-12m, Bus ~12-15m
        // Bridge scale: ~28 units = ~50-60m real bridge
        // Scale factor: ~0.5 units per meter

        switch (initialVehicle.type) {
            case 'truck':
                return {
                    width: 0.45,    // ~2.2m wide (realistic truck width)
                    height: 2.8,    // ~7.0m tall (much higher truck height) 
                    length: 2.0     // ~10m long (realistic truck length)
                };
            case 'bus':
                return {
                    width: 0.5,     // ~2.5m wide (realistic bus width)
                    height: 1.8,    // ~9.0m tall (much higher bus height)
                    length: 2.6     // ~13m long (realistic bus length)
                };
            default: // car
                return {
                    width: 0.36,    // ~1.8m wide (realistic car width)
                    height: 1.2,    // ~6.0m tall (much higher car height)
                    length: 1.0     // ~5m long (realistic car length)
                };
        }
    };

    // Don't render if not visible (when static loads are active)
    if (!isVisible) {
        return null;
    }

    const size = getVehicleSize();

    // REALISTIC CAR MODEL
    if (initialVehicle.type === 'car') {
        return (
            <group ref={meshRef} position={initialVehicle.position}>
                {/* Main car body - lower section */}
                <mesh position={[0, size.height * 0.18, 0]}>
                    <boxGeometry args={[size.length, size.height * 0.3, size.width]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.8} roughness={0.2} />
                </mesh>

                {/* Car cabin/roof - upper section */}
                <mesh position={[0.05, size.height * 0.41, 0]}>
                    <boxGeometry args={[size.length * 0.6, size.height * 0.18, size.width * 0.85]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.8} roughness={0.2} />
                </mesh>

                {/* Front windshield */}
                <mesh position={[0.25, 0.35, 0]} rotation={[0, 0, -0.2]}>
                    <boxGeometry args={[0.02, 0.12, size.width * 0.8]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Rear windshield */}
                <mesh position={[-0.18, 0.35, 0]} rotation={[0, 0, 0.15]}>
                    <boxGeometry args={[0.02, 0.12, size.width * 0.8]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Side windows */}
                <mesh position={[0.05, 0.35, size.width * 0.42]}>
                    <boxGeometry args={[size.length * 0.5, 0.12, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>
                <mesh position={[0.05, 0.35, -size.width * 0.42]}>
                    <boxGeometry args={[size.length * 0.5, 0.12, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Front grille */}
                <mesh position={[size.length * 0.48, 0.15, 0]}>
                    <boxGeometry args={[0.03, 0.12, size.width * 0.7]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* Headlights */}
                <mesh position={[size.length * 0.49, 0.18, size.width * 0.25]}>
                    <sphereGeometry args={[0.04]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} />
                </mesh>
                <mesh position={[size.length * 0.49, 0.18, -size.width * 0.25]}>
                    <sphereGeometry args={[0.04]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} />
                </mesh>

                {/* Taillights */}
                <mesh position={[-size.length * 0.49, 0.18, size.width * 0.25]}>
                    <sphereGeometry args={[0.03]} />
                    <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.2} />
                </mesh>
                <mesh position={[-size.length * 0.49, 0.18, -size.width * 0.25]}>
                    <sphereGeometry args={[0.03]} />
                    <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.2} />
                </mesh>

                {/* Wheels with rims */}
                <group position={[size.length * 0.25, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.02]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>

                <group position={[size.length * 0.25, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.02]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.25, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.02]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.25, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.02]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>

                {/* Side mirrors */}
                <mesh position={[0.15, 0.32, size.width * 0.48]}>
                    <boxGeometry args={[0.05, 0.03, 0.02]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[0.15, 0.32, -size.width * 0.48]}>
                    <boxGeometry args={[0.05, 0.03, 0.02]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* Door handles */}
                <mesh position={[0.1, 0.2, size.width * 0.48]}>
                    <boxGeometry args={[0.06, 0.02, 0.01]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[0.1, 0.2, -size.width * 0.48]}>
                    <boxGeometry args={[0.06, 0.02, 0.01]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* License plate */}
                <mesh position={[-size.length * 0.47, 0.08, 0]}>
                    <boxGeometry args={[0.01, 0.06, 0.12]} />
                    <meshStandardMaterial color="#fff" />
                </mesh>
            </group>
        );
    }

    // REALISTIC TRUCK MODEL
    if (initialVehicle.type === 'truck') {
        return (
            <group ref={meshRef} position={initialVehicle.position}>
                {/* Truck cab */}
                <mesh position={[size.length * 0.3, size.height * 0.12, 0]}>
                    <boxGeometry args={[size.length * 0.4, size.height * 0.19, size.width]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.6} roughness={0.3} />
                </mesh>

                {/* Truck bed/cargo */}
                <mesh position={[-size.length * 0.15, size.height * 0.095, 0]}>
                    <boxGeometry args={[size.length * 0.6, size.height * 0.14, size.width]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.6} roughness={0.3} />
                </mesh>

                {/* Truck windshield */}
                <mesh position={[size.length * 0.45, 0.3, 0]} rotation={[0, 0, -0.1]}>
                    <boxGeometry args={[0.03, 0.25, size.width * 0.9]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Side windows */}
                <mesh position={[size.length * 0.3, 0.3, size.width * 0.48]}>
                    <boxGeometry args={[size.length * 0.3, 0.2, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>
                <mesh position={[size.length * 0.3, 0.3, -size.width * 0.48]}>
                    <boxGeometry args={[size.length * 0.3, 0.2, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Front grille */}
                <mesh position={[size.length * 0.58, 0.25, 0]}>
                    <boxGeometry args={[0.04, 0.2, size.width * 0.8]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* Headlights */}
                <mesh position={[size.length * 0.59, 0.28, size.width * 0.3]}>
                    <sphereGeometry args={[0.05]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>
                <mesh position={[size.length * 0.59, 0.28, -size.width * 0.3]}>
                    <sphereGeometry args={[0.05]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>

                {/* Larger truck wheels */}
                <group position={[size.length * 0.35, 0.05, size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.1, 0.1, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.03]} />
                        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[size.length * 0.35, 0.05, -size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.1, 0.1, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.03]} />
                        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.25, 0.05, size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.1, 0.1, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.03]} />
                        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.25, 0.05, -size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.1, 0.1, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.03]} />
                        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                {/* Mirrors */}
                <mesh position={[size.length * 0.4, 0.38, size.width * 0.52]}>
                    <boxGeometry args={[0.06, 0.04, 0.03]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[size.length * 0.4, 0.38, -size.width * 0.52]}>
                    <boxGeometry args={[0.06, 0.04, 0.03]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
            </group>
        );
    }

    // REALISTIC BUS MODEL
    if (initialVehicle.type === 'bus') {
        return (
            <group ref={meshRef} position={initialVehicle.position}>
                {/* Main bus body */}
                <mesh position={[0, size.height * 0.27, 0]}>
                    <boxGeometry args={[size.length, size.height * 0.46, size.width]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.7} roughness={0.3} />
                </mesh>

                {/* Bus roof */}
                <mesh position={[0, size.height * 0.52, 0]}>
                    <boxGeometry args={[size.length * 0.95, size.height * 0.06, size.width * 0.95]} />
                    <meshStandardMaterial color={initialVehicle.color} metalness={0.7} roughness={0.3} />
                </mesh>

                {/* Front windshield */}
                <mesh position={[size.length * 0.48, 0.45, 0]} rotation={[0, 0, -0.15]}>
                    <boxGeometry args={[0.03, 0.35, size.width * 0.8]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Rear windshield */}
                <mesh position={[-size.length * 0.48, 0.45, 0]} rotation={[0, 0, 0.15]}>
                    <boxGeometry args={[0.03, 0.35, size.width * 0.8]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Side windows - multiple */}
                <mesh position={[size.length * 0.2, 0.5, size.width * 0.47]}>
                    <boxGeometry args={[size.length * 0.6, 0.25, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>
                <mesh position={[size.length * 0.2, 0.5, -size.width * 0.47]}>
                    <boxGeometry args={[size.length * 0.6, 0.25, 0.02]} />
                    <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
                </mesh>

                {/* Bus door */}
                <mesh position={[size.length * 0.35, 0.3, size.width * 0.47]}>
                    <boxGeometry args={[0.15, 0.4, 0.03]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* Front grille */}
                <mesh position={[size.length * 0.495, 0.25, 0]}>
                    <boxGeometry args={[0.03, 0.15, size.width * 0.6]} />
                    <meshStandardMaterial color="#333" />
                </mesh>

                {/* Headlights */}
                <mesh position={[size.length * 0.499, 0.3, size.width * 0.25]}>
                    <sphereGeometry args={[0.05]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>
                <mesh position={[size.length * 0.499, 0.3, -size.width * 0.25]}>
                    <sphereGeometry args={[0.05]} />
                    <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.4} />
                </mesh>

                {/* Bus wheels - larger and positioned for length */}
                <group position={[size.length * 0.35, 0.05, size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.12, 0.12, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.03]} />
                        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[size.length * 0.35, 0.05, -size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.12, 0.12, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.03]} />
                        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.3, 0.05, size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.12, 0.12, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.03]} />
                        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                <group position={[-size.length * 0.3, 0.05, -size.width * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <cylinderGeometry args={[0.12, 0.12, 0.08]} />
                        <meshStandardMaterial color="#222" />
                    </mesh>
                    <mesh position={[0, 0, 0.03]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.03]} />
                        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>

                {/* Mirrors */}
                <mesh position={[size.length * 0.45, 0.55, size.width * 0.52]}>
                    <boxGeometry args={[0.08, 0.05, 0.03]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
                <mesh position={[size.length * 0.45, 0.55, -size.width * 0.52]}>
                    <boxGeometry args={[0.08, 0.05, 0.03]} />
                    <meshStandardMaterial color="#333" />
                </mesh>
            </group>
        );
    }

    // Fallback (should not reach here)
    return null;
});

// Static Car Load Component - Renders a stationary car as a load
const StaticCarLoad: React.FC<{ load: LoadPoint }> = React.memo(({ load }) => {
    // Create a static vehicle for the load
    const staticVehicle = {
        id: load.id,
        position: load.position,
        type: 'car', // Always render as car for loads
        color: '#ff4444', // Red color to indicate it's a load
        weight: load.weight
    };

    const getStaticVehicleSize = () => {
        return {
            width: 0.36,
            height: 1.2,
            length: 1.0
        };
    };

    const size = getStaticVehicleSize();

    return (
        <group position={load.position}>
            {/* Main car body - lower section */}
            <mesh position={[0, size.height * 0.18, 0]}>
                <boxGeometry args={[size.length, size.height * 0.3, size.width]} />
                <meshStandardMaterial color={staticVehicle.color} metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Car cabin/roof - upper section */}
            <mesh position={[0.05, size.height * 0.41, 0]}>
                <boxGeometry args={[size.length * 0.6, size.height * 0.18, size.width * 0.85]} />
                <meshStandardMaterial color={staticVehicle.color} metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Front windshield */}
            <mesh position={[0.25, size.height * 0.41, 0]} rotation={[0, 0, -0.2]}>
                <boxGeometry args={[0.02, 0.12, size.width * 0.8]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
            </mesh>

            {/* Rear windshield */}
            <mesh position={[-0.18, size.height * 0.41, 0]} rotation={[0, 0, 0.15]}>
                <boxGeometry args={[0.02, 0.12, size.width * 0.8]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
            </mesh>

            {/* Side windows */}
            <mesh position={[0.05, size.height * 0.41, size.width * 0.42]}>
                <boxGeometry args={[size.length * 0.5, 0.12, 0.02]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0.05, size.height * 0.41, -size.width * 0.42]}>
                <boxGeometry args={[size.length * 0.5, 0.12, 0.02]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
            </mesh>

            {/* Front grille */}
            <mesh position={[size.length * 0.48, size.height * 0.18, 0]}>
                <boxGeometry args={[0.03, 0.12, size.width * 0.7]} />
                <meshStandardMaterial color="#333" />
            </mesh>

            {/* Headlights */}
            <mesh position={[size.length * 0.49, size.height * 0.21, size.width * 0.25]}>
                <sphereGeometry args={[0.04]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[size.length * 0.49, size.height * 0.21, -size.width * 0.25]}>
                <sphereGeometry args={[0.04]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} />
            </mesh>

            {/* Taillights */}
            <mesh position={[-size.length * 0.49, size.height * 0.21, size.width * 0.25]}>
                <sphereGeometry args={[0.03]} />
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[-size.length * 0.49, size.height * 0.21, -size.width * 0.25]}>
                <sphereGeometry args={[0.03]} />
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.2} />
            </mesh>

            {/* Wheels with rims */}
            <group position={[size.length * 0.25, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                    <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                </mesh>
            </group>

            <group position={[size.length * 0.25, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                    <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                </mesh>
            </group>

            <group position={[-size.length * 0.25, 0.05, size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                    <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                </mesh>
            </group>

            <group position={[-size.length * 0.25, 0.05, -size.width * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh>
                    <cylinderGeometry args={[0.08, 0.08, 0.06]} />
                    <meshStandardMaterial color="#222" />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.02]} />
                    <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
                </mesh>
            </group>

            {/* Side mirrors */}
            <mesh position={[0.15, size.height * 0.38, size.width * 0.48]}>
                <boxGeometry args={[0.05, 0.03, 0.02]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0.15, size.height * 0.38, -size.width * 0.48]}>
                <boxGeometry args={[0.05, 0.03, 0.02]} />
                <meshStandardMaterial color="#333" />
            </mesh>

            {/* Weight indicator above the car */}
            <Text
                position={[0, size.height * 0.7, 0]}
                fontSize={0.25}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                {load.weight}kg
            </Text>

            {/* Load indicator - small glowing sphere */}
            <mesh position={[0, size.height * 0.6, 0]}>
                <sphereGeometry args={[0.1]} />
                <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.5} />
            </mesh>
        </group>
    );
});

// Load Point Visualization - Now renders as Static Car
const LoadPoint: React.FC<{ load: LoadPoint }> = React.memo(({ load }) => {
    return <StaticCarLoad load={load} />;
});

// Click Handler for Adding Loads
const ClickHandler: React.FC<{
    onAddLoad: (position: [number, number, number]) => void;
    bridgeType: string;
}> = ({ onAddLoad, bridgeType }) => {
    const { camera, raycaster } = useThree();

    // Function to get the correct bridge surface height at any x position
    const getBridgeSurfaceHeight = (x: number, bridgeType: string): number => {
        const bridgeBaseY = 2.2;
        const totalBridgeLength = 28;
        const deckCurveHeight = 1.5;

        if (x >= -14 && x <= 14) {
            // On bridge
            if (bridgeType === 'arch') {
                // Arch bridge has curved surface
                return bridgeBaseY + deckCurveHeight * (1 - Math.pow(x / (totalBridgeLength / 2), 2)) + 0.18;
            } else {
                // Truss bridge is flat
                return bridgeBaseY + 0.18;
            }
        }
        // Off bridge (ground level)
        return 2.0;
    };

    const handleClick = useCallback((event: any) => {
        // Allow clicking anywhere on the bridge (bridge spans from -14 to 14)
        const x = Math.max(-14, Math.min(14, event.point.x));

        // For arch bridges, make it much easier to place loads
        if (bridgeType === 'arch') {
            // Always place loads in the center of the road surface (z = 0)
            // This makes it much easier since you don't need precise clicking
            const z = 0; // Always center

            // IMPORTANT: Always place load on the arch surface, not on the collision box
            // Calculate the correct arch surface height regardless of where the click occurred
            const surfaceY = getBridgeSurfaceHeight(x, bridgeType);
            onAddLoad([x, surfaceY, z]);
        } else {
            // Truss bridge - also make it easier by placing loads in center
            // Always place loads in the center of the road surface (z = 0) for consistency
            const z = 0; // Always center for easier clicking
            const surfaceY = getBridgeSurfaceHeight(x, bridgeType);
            onAddLoad([x, surfaceY, z]);
        }
    }, [onAddLoad, bridgeType]);

    // For arch bridges, we use simple collision boxes instead of complex geometry
    // This makes clicking much easier from any angle

    return (
        <>
            {bridgeType === 'arch' ? (
                <>
                    {/* Large invisible collision box covering the entire arch bridge */}
                    {/* This makes it very easy to click anywhere near the arch bridge */}
                    <mesh onClick={handleClick} visible={false} position={[0, 5, 0]}>
                        <boxGeometry args={[32, 12, 6]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    {/* Additional side collision boxes for even easier clicking */}
                    <mesh onClick={handleClick} visible={false} position={[-16, 5, 0]}>
                        <boxGeometry args={[4, 12, 6]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    <mesh onClick={handleClick} visible={false} position={[16, 5, 0]}>
                        <boxGeometry args={[4, 12, 6]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>
                </>
            ) : (
                // Multiple collision surfaces for truss bridges (clickable from any angle)
                <>
                    {/* Main collision box covering the entire truss bridge */}
                    <mesh onClick={handleClick} visible={false} position={[0, 4, 0]}>
                        <boxGeometry args={[32, 8, 4]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    {/* Additional side collision boxes for easier clicking from sides */}
                    <mesh onClick={handleClick} visible={false} position={[-16, 4, 0]}>
                        <boxGeometry args={[4, 8, 4]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    <mesh onClick={handleClick} visible={false} position={[16, 4, 0]}>
                        <boxGeometry args={[4, 8, 4]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    {/* Top and bottom collision planes for overhead/underneath views */}
                    <mesh onClick={handleClick} visible={false} position={[0, 7, 0]}>
                        <planeGeometry args={[30, 4]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>

                    <mesh onClick={handleClick} visible={false} position={[0, 1, 0]}>
                        <planeGeometry args={[30, 4]} />
                        <meshBasicMaterial transparent opacity={0} />
                    </mesh>
                </>
            )}
        </>
    );
};

export { VehicleComponent, LoadPoint, ClickHandler, StaticCarLoad };
