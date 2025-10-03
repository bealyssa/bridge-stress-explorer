import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import DamageVisualization from '@/components/DamageVisualization';
import TrussBridge from '@/components/TrussBridge';
import ArchBridge from '@/components/ArchBridge';
import StressAnalysisPanel from '@/components/StressAnalysisPanel';
import { VehicleComponent, LoadPoint as LoadPointVis, ClickHandler } from '@/utils/BridgeUtils';
import Environment from '@/components/Environment';
import LoadAnalytics from '@/components/LoadAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoadPoint {
    id: string;
    position: [number, number, number];
    weight: number;
    type?: 'manual' | 'vehicle';
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
    const [trussMaterial, setTrussMaterial] = useState<'steel' | 'wood'>('steel');
    const [archMaterial, setArchMaterial] = useState<'wood' | 'steel' | 'concrete'>('wood');
    const [loadPoints, setLoadPoints] = useState<LoadPoint[]>([]);
    const [showAnalytics, setShowAnalytics] = useState(true);
    const [currentWeight, setCurrentWeight] = useState(100);
    const vehiclesRef = useRef<Vehicle[]>([]);
    const [realTimeDamageState, setRealTimeDamageState] = useState<DamageState | null>(null);
    const [currentDynamicLoad, setCurrentDynamicLoad] = useState(0);
    const [vehiclesOnBridgeCount, setVehiclesOnBridgeCount] = useState(0);
    const [vehiclesOnBridge, setVehiclesOnBridge] = useState<Vehicle[]>([]);
    const [dynamicLoad, setDynamicLoad] = useState(0);
    // Editor-style layout state (resizable panels)
    const [leftWidth, setLeftWidth] = useState<number>(320);
    const [terminalHeight, setTerminalHeight] = useState<number>(180);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const isDraggingLeftRef = useRef(false);
    const isDraggingBottomRef = useRef(false);

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
                weight: v.weight,
                type: 'vehicle' as const // Mark as vehicle load
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

    // Resize handlers for left sidebar and bottom terminal
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (isDraggingLeftRef.current) {
                // calculate new left width relative to viewport
                const newWidth = Math.max(200, Math.min(window.innerWidth - 200, e.clientX));
                setLeftWidth(newWidth);
            }
            if (isDraggingBottomRef.current) {
                // calculate new terminal height from bottom edge
                const newHeight = Math.max(80, Math.min(window.innerHeight - 160, window.innerHeight - e.clientY));
                setTerminalHeight(newHeight);
            }
        };

        const onMouseUp = () => {
            isDraggingLeftRef.current = false;
            isDraggingBottomRef.current = false;
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

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

    // Foundation analytics state
    const trussBridgeRef = useRef<any>(null);
    const [foundationIntegrity, setFoundationIntegrity] = useState<number | null>(null);
    const [foundationLoads, setFoundationLoads] = useState<number[] | null>(null);
    const [foundationSupports, setFoundationSupports] = useState<any[] | null>(null);

    // Poll foundation data from TrussBridge
    useEffect(() => {
        if (bridgeType === 'truss' && trussBridgeRef.current) {
            const poll = () => {
                const { foundationIntegrity, foundationLoads, foundationSupports } = trussBridgeRef.current;
                setFoundationIntegrity(foundationIntegrity);
                setFoundationLoads(foundationLoads);
                setFoundationSupports(foundationSupports);
            };
            const interval = setInterval(poll, 200);
            return () => clearInterval(interval);
        }
    }, [bridgeType]);

    // Calculate damage state (now includes vehicles for real-time updates)
    // For truss bridge, use foundation integrity for collapse logic
    const baseDamageState = useMemo(() => {
        return calculateDamageState(bridgeType, loadPoints);
    }, [bridgeType, loadPoints]);

    // Override for truss bridge foundation collapse
    let damageState = baseDamageState;
    // Only show collapse/failure if total bridge load exceeds maximum capacity
    const safetyFactor = 1.5;
    const bridgeCapacities = {
        truss: { max: 180000, safe: 120000 },
        arch: { max: 180000, safe: 120000 }
    };
    const capacity = bridgeCapacities[bridgeType];
    const staticWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
    const totalLoad = staticWeight + dynamicLoad;
    const collapseThreshold = capacity.max * safetyFactor;
    const isCollapse = totalLoad >= collapseThreshold;
    if (
        bridgeType === 'truss' &&
        foundationIntegrity !== null &&
        isCollapse
    ) {
        damageState = {
            ...baseDamageState,
            overallIntegrity: foundationIntegrity,
            failureMode: 'collapse' as FailureMode,
            warningLevel: 'failure' as WarningLevel,
            cracks: baseDamageState.cracks
        };
    }

    const addLoad = useCallback((position: [number, number, number]) => {
        const newLoad: LoadPoint = {
            id: Date.now().toString(),
            position,
            weight: currentWeight,
            type: 'manual'
        };
        const newLoadPoints = [...loadPoints, newLoad];
        setLoadPoints(newLoadPoints);
        // Immediately update analytics and status for manual loads
        // This ensures the UI reflects the new load and physics instantly
        // (If analytics logic is in a useEffect, this will trigger it)
    }, [currentWeight, loadPoints]);

    const clearLoads = useCallback(() => {
        setLoadPoints([]);
    }, []);

    const handleBridgeTypeChange = useCallback((type: 'truss' | 'arch') => {
        setBridgeType(type);
    }, []);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    // Main render
    return (
        <div className="min-h-screen bg-background text-sm">
            {/* Top toolbar (editor-like) */}
            <header className="border-b border-border bg-card/60 backdrop-blur-sm">
                <div className="w-full px-3 py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 rounded bg-gradient-to-br from-slate-700 to-slate-800 text-white font-semibold">Bridge Studio</div>
                        <div className="text-muted-foreground">3D Bridge Load Simulator</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded bg-transparent hover:bg-slate-700">File</button>
                        <button className="px-2 py-1 rounded bg-transparent hover:bg-slate-700">Edit</button>
                        <button className="px-2 py-1 rounded bg-transparent hover:bg-slate-700">View</button>
                        <button className="px-2 py-1 rounded bg-transparent hover:bg-slate-700">Help</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant={showAnalytics ? "engineering" : "outline"} size="sm" onClick={() => setShowAnalytics(!showAnalytics)}>Analytics</Button>
                        <Button variant={isFullscreen ? "engineering" : "outline"} size="sm" onClick={toggleFullscreen}>
                            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        </Button>
                    </div>
                </div>
            </header>

            <div className={`w-full h-[calc(100vh-3.25rem)] ${isFullscreen ? 'px-1 py-1' : 'px-3 py-3'} flex flex-col`}>
                <div className="flex-1 flex overflow-hidden bg-transparent rounded">
                    {/* Left analytics sidebar (resizable) */}
                    {showAnalytics && !isFullscreen && (
                        <aside style={{ width: leftWidth }} className="flex-shrink-0 flex flex-col overflow-hidden">
                            <div className="h-full overflow-auto p-2">
                                <Card className="bg-card/90 backdrop-blur-sm rounded-lg shadow-panel border border-border mb-3">
                                    <LoadAnalytics
                                        bridgeType={bridgeType}
                                        loadPoints={loadPoints}
                                        damageState={realTimeDamageState || damageState}
                                        vehiclesOnBridge={vehiclesOnBridge}
                                        dynamicLoad={dynamicLoad}
                                    />
                                </Card>
                                {bridgeType === 'truss' && (
                                    <Card className="bg-card/95 backdrop-blur-sm shadow-panel border-border mb-3">
                                        <CardHeader className="pb-0">
                                            <CardTitle className="text-lg text-blue-400 font-semibold">Truss Bridge Specs</CardTitle>
                                            <CardDescription>Technical specifications and limits</CardDescription>
                                        </CardHeader>
                                        <CardContent className="pt-2 pb-3">
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-2 text-sm">
                                                <div>
                                                    <span className="font-medium">Length</span>
                                                    <div className="font-mono text-[15px] text-muted-foreground">65.0 m</div>
                                                </div>
                                                <div>
                                                    <span className="font-medium">Material</span>
                                                    <div className="font-mono text-[15px] text-muted-foreground">Steel</div>
                                                </div>
                                                <div>
                                                    <span className="font-medium">Max Load</span>
                                                    <div className="font-mono text-[15px] text-muted-foreground">180 t</div>
                                                </div>
                                                <div>
                                                    <span className="font-medium">Safety Factor</span>
                                                    <div className="font-mono text-[15px] text-muted-foreground">1.5x</div>
                                                </div>
                                            </div>
                                            <hr className="my-2 border-border" />
                                            <div className="text-xs text-muted-foreground">
                                                Truss bridges distribute loads through triangular units, providing excellent strength-to-weight ratio.
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                                <Card className="mt-3 bg-card/90 backdrop-blur-sm shadow-panel border-border">
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
                                                Real bridges include safety margins. Always design for loads well below maximum capacity.                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            {/* Vertical resizer */}
                            <div
                                onMouseDown={() => { isDraggingLeftRef.current = true; document.body.style.userSelect = 'none'; }}
                                className="w-1 cursor-col-resize hover:bg-border bg-transparent"
                                style={{ alignSelf: 'stretch' }}
                                aria-hidden
                            />
                        </aside>
                    )}

                    {/* Main 3D canvas area */}
                    <main className="flex-1 relative bg-transparent flex flex-col overflow-hidden">
                        <div className="w-full h-full relative">
                            <Canvas
                                camera={{ position: [25, 18, 25], fov: 60 }}
                                className="scene-container h-full w-full"
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
                                        isVisible={loadPoints.length === 0} // Hide moving vehicles when loads are present
                                    />
                                ))}
                                {(bridgeType === 'truss' || bridgeType === 'arch') && (
                                    <>
                                        {bridgeType === 'truss' ? (
                                            <TrussBridge
                                                loadPoints={loadPoints}
                                                damageState={damageState}
                                                material={trussMaterial}
                                                foundationIntegrity={foundationIntegrity}
                                                foundationLoads={foundationLoads}
                                                foundationSupports={foundationSupports}
                                                isCollapse={isCollapse}
                                            />
                                        ) : (
                                            <ArchBridge loadPoints={loadPoints} damageState={damageState} material={archMaterial} onAddLoad={addLoad} />
                                        )}
                                        {loadPoints.map((load) => (
                                            <LoadPointVis key={load.id} load={load} />
                                        ))}
                                        <ClickHandler onAddLoad={addLoad} bridgeType={bridgeType} />
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

                            {/* Simulation Controls (kept as overlays in the 3D area) */}
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
                                {bridgeType === 'truss' && (
                                    <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border">
                                        <h3 className="font-semibold mb-3">Truss Material</h3>
                                        <div className="flex gap-2">
                                            <button
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${trussMaterial === 'wood' ? 'bg-amber-600 text-white' : 'bg-secondary'}`}
                                                onClick={() => setTrussMaterial('wood')}
                                            >
                                                Wood
                                            </button>
                                            <button
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${trussMaterial === 'steel' ? 'bg-amber-600 text-white' : 'bg-secondary'}`}
                                                onClick={() => setTrussMaterial('steel')}
                                            >
                                                Steel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {bridgeType === 'arch' && (
                                    <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border">
                                        <h3 className="font-semibold mb-3">Arch Material</h3>
                                        <div className="flex gap-2">
                                            <button
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${archMaterial === 'wood' ? 'bg-amber-600 text-white' : 'bg-secondary'}`}
                                                onClick={() => setArchMaterial('wood')}
                                            >
                                                Wood
                                            </button>
                                            <button
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${archMaterial === 'steel' ? 'bg-amber-600 text-white' : 'bg-secondary'}`}
                                                onClick={() => setArchMaterial('steel')}
                                            >
                                                Steel
                                            </button>
                                            <button
                                                className={`px-3 py-2 rounded text-sm font-medium transition-all ${archMaterial === 'concrete' ? 'bg-amber-600 text-white' : 'bg-secondary'}`}
                                                onClick={() => setArchMaterial('concrete')}
                                            >
                                                Concrete
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-panel border border-border">
                                    <h3 className="font-semibold mb-3">Load Weight</h3>
                                    <input
                                        type="range"
                                        min="1000"
                                        max="50000"
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

                            {/* Bridge Status Panel - bottom right of simulator area, compact card style */}
                            <div style={{ position: 'absolute', right: '1rem', bottom: '1rem', zIndex: 50 }}>
                                <div className="bg-card/90 backdrop-blur-sm rounded-lg shadow-panel bottom-4 right-4 border border-border px-4 py-3 w-[300px]">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-semibold text-base">Bridge Status</h3>
                                        <span className="flex items-center gap-1 text-xs text-orange-500">
                                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                                            LIVE
                                        </span>
                                    </div>
                                    <div className={`text-lg font-bold mb-1 ${isCollapse ? 'text-destructive' : 'text-stress-safe'}`}>{isCollapse ? 'FAILED' : 'SAFE'}</div>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span>Integrity</span>
                                            <span className={`font-mono ${isCollapse ? 'text-destructive' : 'text-stress-safe'}`}>{Math.round((realTimeDamageState || damageState).overallIntegrity * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Load</span>
                                            <span className="font-mono text-blue-500">{(totalLoad / 1000).toFixed(1)} t</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Safe Limit</span>
                                            <span className="font-mono">{(capacity.safe / 1000).toFixed(0)} t</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Max Limit</span>
                                            <span className="font-mono">{(capacity.max / 1000).toFixed(0)} t</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Collapse Limit (Safety Factor)</span>
                                            <span className="font-mono">{(collapseThreshold / 1000).toFixed(0)} t</span>
                                        </div>
                                    </div>
                                    {isCollapse && (
                                        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs font-semibold">
                                            ⚠️ Bridge collapse! Maximum load exceeded.
                                        </div>
                                    )}
                                    {!isCollapse && (totalLoad > capacity.max * 0.85) && (
                                        <div className="mt-2 p-2 bg-warning/10 border border-warning/20 rounded text-warning text-xs font-semibold">
                                            ⚠️ Warning: Structural damage detected. Approaching collapse threshold.
                                        </div>
                                    )}
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
                    </main>
                </div>

                {/* Bottom terminal area (resizable) */}
                {!isFullscreen && (
                    <>
                        {/* Horizontal resizer */}
                        <div
                            onMouseDown={() => { isDraggingBottomRef.current = true; document.body.style.userSelect = 'none'; }}
                            className="h-1 cursor-row-resize bg-border rounded-t"
                            aria-hidden
                        />
                        <div style={{ height: terminalHeight }} className="mt-2 bg-[#0b1220] text-xs text-green-300 font-mono rounded-b-lg border border-border p-3 overflow-auto">
                            <div className="flex items-center justify-between">
                                <div className="font-semibold">Terminal</div>
                                <div className="text-[11px] text-muted-foreground">Logs & Diagnostics</div>
                            </div>
                            <div className="mt-2 text-[12px]">
                                {/* Placeholder logs - in future hook up real logs or console output */}
                                <div>Initializing renderer...</div>
                                <div>Loading assets...</div>
                                <div>Vehicles loaded: {vehiclesRef.current.length}</div>
                                <div>Real-time damage monitoring active</div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Stress Analysis Panel - shows when loads are applied */}
            {/* StressAnalysisPanel removed for clarity. Collapse visualization now fully synchronized with foundation analytics and bridge status. */}

            {/* New Modern Bridge Status Panel Overlay */}

        </div>
    );
};

export default BridgeSimulator;
