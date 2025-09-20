// Removed duplicate import
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import DamageVisualization from '@/components/DamageVisualization';
import TrussBridge from '@/components/TrussBridge';
import ArchBridge from '@/components/ArchBridge';
import { VehicleComponent, LoadPoint as LoadPointVis, ClickHandler } from '@/utils/BridgeUtils';
import Environment from '@/components/Environment';
import LoadAnalytics from '@/components/LoadAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoadPoint {
    id: string;
    position: [number, number, number];
    weight: number;
}

interface Vehicle {
    id: string;
    position: [number, number, number];
    velocity: [number, number, number];
    type: 'car' | 'truck' | 'bus';
    weight: number;
    color: string;
    direction: 1 | -1;
    isOnBridge: boolean;
}

type FailureMode = 'none' | 'collapse' | 'buckling' | 'shear' | 'bending';
type WarningLevel = 'safe' | 'caution' | 'danger' | 'critical' | 'failure';
interface CrackData {
    id: string;
    severity: number;
    points: [number, number, number][];
    type: 'surface' | 'structural' | 'critical';
}
interface DamageState {
    cracks: CrackData[];
    overallIntegrity: number;
    failureMode: FailureMode;
    warningLevel: WarningLevel;
}

// Simple damage calculation for analytics - Updated to match simulator
const calculateDamageState = (bridgeType: string, loadPoints: LoadPoint[]): DamageState => {
    const bridgeCapacities = {
        truss: { max: 1800, safe: 1200, critical: 1500 },
        arch: { max: 2500, safe: 1800, critical: 2200 }
    };
    const capacity = bridgeCapacities[bridgeType as keyof typeof bridgeCapacities];
    const totalWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
    let integrity = 1;
    let failureMode: FailureMode = 'none';
    let warningLevel: WarningLevel = 'safe';
    if (totalWeight > capacity.max) {
        integrity = Math.max(0, 1 - (totalWeight - capacity.max) / capacity.max);
        failureMode = 'collapse';
        warningLevel = 'failure';
    } else if (totalWeight > capacity.critical) {
        integrity = 0.3 + (0.7 * (capacity.max - totalWeight) / (capacity.max - capacity.critical));
        failureMode = bridgeType === 'truss' ? 'buckling' : 'shear';
        warningLevel = 'critical';
    } else if (totalWeight > capacity.safe) {
        integrity = 0.7 + (0.3 * (capacity.critical - totalWeight) / (capacity.critical - capacity.safe));
        warningLevel = 'danger';
    } else if (totalWeight > capacity.safe * 0.8) {
        warningLevel = 'caution';
    }
    let cracks: CrackData[] = [];
    if (integrity < 0.8) {
        cracks = loadPoints.map((load, i) => ({
            id: `surface-${i}`,
            severity: 1 - integrity,
            points: [load.position, [load.position[0] + 0.5, load.position[1], load.position[2]]],
            type: 'surface'
        }));
    }
    return {
        cracks,
        overallIntegrity: integrity,
        failureMode,
        warningLevel
    };
};


const BridgeSimulator = () => {
    const [bridgeType, setBridgeType] = useState<'truss' | 'arch'>('truss');
    const [loadPoints, setLoadPoints] = useState<LoadPoint[]>([]);
    const [showAnalytics, setShowAnalytics] = useState(true);
    const [currentWeight, setCurrentWeight] = useState(100);
    const vehiclesRef = useRef<Vehicle[]>([]);
    const [realTimeDamageState, setRealTimeDamageState] = useState<DamageState | null>(null);
    const [currentDynamicLoad, setCurrentDynamicLoad] = useState(0);
    const [vehiclesOnBridgeCount, setVehiclesOnBridgeCount] = useState(0);
    const [vehiclesOnBridge, setVehiclesOnBridge] = useState<Vehicle[]>([]);
    const [dynamicLoad, setDynamicLoad] = useState(0);

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
        return calculateDamageState(bridgeType, allLoadPoints);
    }, [bridgeType, loadPoints, calculateDynamicLoad]);

    // Update analytics in real-time
    React.useEffect(() => {
        const updateAnalytics = () => {
            const { dynamicLoad, vehiclesOnBridge } = calculateDynamicLoad();
            const damageState = calculateTotalDamageState();

            setRealTimeDamageState(damageState);
            setCurrentDynamicLoad(dynamicLoad);
            setVehiclesOnBridgeCount(vehiclesOnBridge.length);
            setVehiclesOnBridge(vehiclesOnBridge);
            setDynamicLoad(dynamicLoad);
        };
        const interval = setInterval(updateAnalytics, 100);
        return () => clearInterval(interval);
    }, [calculateDynamicLoad, calculateTotalDamageState]);

    // Initialize vehicles
    React.useEffect(() => {
        const initialVehicles: Vehicle[] = [
            // ...same vehicle array as BridgeSimulator...
            { id: 'car1', position: [-25, 2.21, 0.6], velocity: [0, 0, 0], type: 'car', weight: 150, color: '#ff4444', direction: 1, isOnBridge: false },
            { id: 'truck1', position: [-35, 2.21, 0.6], velocity: [0, 0, 0], type: 'truck', weight: 800, color: '#4444ff', direction: 1, isOnBridge: false },
            { id: 'car3', position: [-15, 2.21, 0.6], velocity: [0, 0, 0], type: 'car', weight: 160, color: '#ff44ff', direction: 1, isOnBridge: false },
            { id: 'car4', position: [-5, 2.21, 0.6], velocity: [0, 0, 0], type: 'car', weight: 145, color: '#44ffff', direction: 1, isOnBridge: false },
            { id: 'bus2', position: [-45, 2.21, 0.6], velocity: [0, 0, 0], type: 'bus', weight: 650, color: '#ff8844', direction: 1, isOnBridge: false },
            { id: 'car5', position: [5, 2.21, 0.6], velocity: [0, 0, 0], type: 'car', weight: 155, color: '#8844ff', direction: 1, isOnBridge: false },
            { id: 'truck2', position: [-55, 2.21, 0.6], velocity: [0, 0, 0], type: 'truck', weight: 850, color: '#448844', direction: 1, isOnBridge: false },
            { id: 'heavyTruck1', position: [-65, 2.21, 0.6], velocity: [0, 0, 0], type: 'truck', weight: 1200, color: '#ff4444', direction: 1, isOnBridge: false },
            { id: 'heavyTruck2', position: [65, 2.21, -0.6], velocity: [0, 0, 0], type: 'truck', weight: 1100, color: '#4444ff', direction: -1, isOnBridge: false },
            { id: 'car2', position: [25, 2.21, -0.6], velocity: [0, 0, 0], type: 'car', weight: 140, color: '#44ff44', direction: -1, isOnBridge: false },
            { id: 'bus1', position: [35, 2.21, -0.6], velocity: [0, 0, 0], type: 'bus', weight: 600, color: '#ffff44', direction: -1, isOnBridge: false },
            { id: 'car6', position: [15, 2.21, -0.6], velocity: [0, 0, 0], type: 'car', weight: 135, color: '#ff4488', direction: -1, isOnBridge: false },
            { id: 'car7', position: [5, 2.21, -0.6], velocity: [0, 0, 0], type: 'car', weight: 165, color: '#88ff44', direction: -1, isOnBridge: false },
            { id: 'truck3', position: [45, 2.21, -0.6], velocity: [0, 0, 0], type: 'truck', weight: 780, color: '#4488ff', direction: -1, isOnBridge: false },
            { id: 'car8', position: [-5, 2.21, -0.6], velocity: [0, 0, 0], type: 'car', weight: 150, color: '#ffaa44', direction: -1, isOnBridge: false },
            { id: 'bus3', position: [55, 2.21, -0.6], velocity: [0, 0, 0], type: 'bus', weight: 620, color: '#aa44ff', direction: -1, isOnBridge: false }
        ];
        vehiclesRef.current = initialVehicles;
    }, []);

    // Calculate damage state (now includes vehicles for real-time updates)
    const damageState = useMemo(() => {
        return calculateDamageState(bridgeType, loadPoints);
    }, [bridgeType, loadPoints]);

    const addLoad = useCallback((position: [number, number, number]) => {
        const newLoad: LoadPoint = {
            id: Date.now().toString(),
            position,
            weight: currentWeight
        };
        const newLoadPoints = [...loadPoints, newLoad];
        setLoadPoints(newLoadPoints);
    }, [currentWeight, loadPoints]);

    const clearLoads = useCallback(() => {
        setLoadPoints([]);
    }, []);

    const handleBridgeTypeChange = useCallback((type: 'truss' | 'arch') => {
        setBridgeType(type);
    }, []);

    // Main render
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/50 backdrop-blur-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold engineering-title">
                                3D Bridge Load Simulator
                            </h1>
                            <p className="text-muted-foreground">
                                Interactive structural analysis and load testing platform
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={showAnalytics ? "engineering" : "outline"}
                                size="sm"
                                onClick={() => setShowAnalytics(!showAnalytics)}
                            >
                                Analytics
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
                    {/* 3D Simulator */}
                    <div className="lg:col-span-3 relative">
                        <div className="w-full h-full">
                            <Canvas
                                camera={{ position: [25, 18, 25], fov: 60 }}
                                className="scene-container"
                                shadows
                            >
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
                                <Environment />
                                {vehiclesRef.current.map((vehicle) => (
                                    <VehicleComponent
                                        key={vehicle.id}
                                        initialVehicle={vehicle}
                                        bridgeType={bridgeType}
                                        damageState={damageState}
                                        allVehicles={vehiclesRef}
                                    />
                                ))}
                                {/* Bridge rendering */}
                                {(bridgeType === 'truss' || bridgeType === 'arch') && (
                                    <>
                                        {bridgeType === 'truss' ? (
                                            <TrussBridge loadPoints={loadPoints} damageState={damageState} />
                                        ) : (
                                            <ArchBridge loadPoints={loadPoints} damageState={damageState} />
                                        )}
                                        {loadPoints.map((load) => (
                                            <LoadPointVis key={load.id} load={load} />
                                        ))}
                                        <ClickHandler onAddLoad={addLoad} />
                                    </>
                                )}
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
                                        {['truss', 'arch'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => handleBridgeTypeChange(type as any)}
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${bridgeType === type
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
                                <div className={`text-lg font-bold mb-2 ${(realTimeDamageState || damageState).warningLevel === 'safe' ? 'text-stress-safe' :
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
                    </div>
                    {/* Analytics Panel */}
                    {showAnalytics && (
                        <div className="lg:col-span-1 space-y-4 overflow-y-auto">
                            <LoadAnalytics
                                bridgeType={bridgeType}
                                loadPoints={loadPoints}
                                damageState={realTimeDamageState || damageState}
                                vehiclesOnBridge={vehiclesOnBridge}
                                dynamicLoad={dynamicLoad}
                            />
                            <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
                                <CardHeader>
                                    <CardTitle className="text-lg engineering-title">Learning Objectives</CardTitle>
                                    <CardDescription>Understand structural engineering concepts</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold">Load Distribution</h4>
                                        <p className="text-muted-foreground">
                                            Observe how different bridge types handle loads through various structural mechanisms.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-semibold">Stress Visualization</h4>
                                        <p className="text-muted-foreground">
                                            Color coding shows stress levels: green (safe) → yellow (warning) → red (critical).
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-semibold">Safety Factors</h4>
                                        <p className="text-muted-foreground">
                                            Real bridges include safety margins. Always design for loads well below maximum capacity.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BridgeSimulator;
