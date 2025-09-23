import React, { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere, Cylinder, Text } from '@react-three/drei';
import * as THREE from 'three';
// Type definitions moved from BridgeSimulator for shared use
export interface LoadPoint {
    id: string;
    position: [number, number, number];
    weight: number;
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
}> = React.memo(({ initialVehicle, bridgeType, damageState, allVehicles }) => {
    const meshRef = useRef<THREE.Group>(null);
    const vehicleData = useRef(initialVehicle);

    // Get bridge height at given x position
    const getBridgeHeight = (x: number): number => {
        const bridgeBaseY = 2.2;
        const totalBridgeLength = 28;
        const deckCurveHeight = 1.5;
        if (x >= -14 && x <= 14) {
            if (bridgeType === 'arch') {
                return bridgeBaseY + deckCurveHeight * (1 - Math.pow(x / (totalBridgeLength / 2), 2)) + 0.18;
            } else {
                return bridgeBaseY + 0.18;
            }
        }
        return bridgeBaseY + 0.01;
    };

    // Check for vehicles ahead in the same lane (using real-time positions)
    const getVehicleAhead = (currentVehicle: any): any | null => {
        const vehicles = allVehicles.current;
        const sameDirection = vehicles.filter(v =>
            v.id !== currentVehicle.id &&
            v.direction === currentVehicle.direction &&
            Math.abs(v.position[2] - currentVehicle.position[2]) < 0.5
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
            if (distance > 0 && distance < minDistance && distance < 8) {
                minDistance = distance;
                closestVehicle = vehicle;
            }
        }
        return closestVehicle;
    };

    useFrame((state, delta) => {
        if (meshRef.current) {
            const vehicle = vehicleData.current;
            let baseSpeed: number;
            switch (vehicle.type) {
                case 'car': baseSpeed = 3.0; break;
                case 'bus': baseSpeed = 2.0; break;
                case 'truck': baseSpeed = 1.8; break;
                default: baseSpeed = 2.5; break;
            }
            const vehicleAhead = getVehicleAhead(vehicle);
            let currentSpeed = baseSpeed;
            if (vehicleAhead) {
                const safeDistance = vehicle.type === 'truck' ? 4.0 : vehicle.type === 'bus' ? 3.5 : 3.0;
                let distance: number;
                if (vehicle.direction === 1) {
                    distance = vehicleAhead.position[0] - vehicle.position[0];
                } else {
                    distance = vehicle.position[0] - vehicleAhead.position[0];
                }
                if (distance < safeDistance * 1.5) {
                    const speedRatio = Math.max(0.4, Math.min(1.0, distance / safeDistance));
                    currentSpeed = baseSpeed * speedRatio;
                    if (distance > 1.5) {
                        currentSpeed = Math.max(currentSpeed, baseSpeed * 0.6);
                    }
                }
            }
            const newX = vehicle.position[0] + vehicle.direction * currentSpeed * delta;
            const targetY = getBridgeHeight(newX);
            const laneCenter = vehicle.direction === 1 ? 0.6 : -0.6;
            const newZ = THREE.MathUtils.lerp(vehicle.position[2], laneCenter, 2 * delta);
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
        switch (initialVehicle.type) {
            case 'truck': return { width: 0.4, height: 0.6, length: 1.2 };
            case 'bus': return { width: 0.35, height: 0.7, length: 2.0 };
            default: return { width: 0.3, height: 0.4, length: 0.8 };
        }
    };

    const size = getVehicleSize();

    return (
        <group ref={meshRef} position={initialVehicle.position}>
            <mesh position={[0, size.height / 2, 0]}>
                <boxGeometry args={[size.length, size.height, size.width]} />
                <meshStandardMaterial color={initialVehicle.color} />
            </mesh>
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

export { VehicleComponent, LoadPoint, ClickHandler };
