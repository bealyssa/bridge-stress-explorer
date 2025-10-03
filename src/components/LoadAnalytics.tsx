import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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

interface DamageState {
  cracks: any[];
  overallIntegrity: number;
  failureMode: string;
  warningLevel: string;
}

interface LoadAnalyticsProps {
  bridgeType: 'truss' | 'arch';
  loadPoints: LoadPoint[];
  damageState?: DamageState;
  vehiclesOnBridge?: Vehicle[];
  dynamicLoad?: number;
  foundationLoads?: number[];
  foundationSupports?: any[];
}

const LoadAnalytics: React.FC<LoadAnalyticsProps> = ({
  bridgeType,
  loadPoints,
  damageState,
  vehiclesOnBridge = [],
  dynamicLoad = 0,
  foundationLoads,
  foundationSupports
}) => {
  // Bridge capacity limits (realistic per-support values, in kg)
  // Each support: safe = 120000 kg (120t), max = 180000 kg (180t)
  const bridgeCapacities = {
    truss: { max: 180000, safe: 120000 },
    arch: { max: 180000, safe: 120000 }
  };

  const staticWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
  const totalLoad = staticWeight + dynamicLoad;
  const capacity = bridgeCapacities[bridgeType];
  const loadPercentage = (totalLoad / capacity.max) * 100;

  // Foundation analytics
  let overloadedSupportIdx: number | null = null;
  let overloadedSupportLoad: number | null = null;
  let overloadedSupportCapacity: number | null = null;
  if (foundationLoads && foundationSupports) {
    foundationLoads.forEach((load, idx) => {
      if (load > foundationSupports[idx].capacity) {
        overloadedSupportIdx = idx;
        overloadedSupportLoad = load;
        overloadedSupportCapacity = foundationSupports[idx].capacity;
      }
    });
  }

  let safetyMargin: string | null = null;
  if (overloadedSupportIdx !== null) {
    safetyMargin = `Support ${overloadedSupportIdx + 1} overloaded by ${(overloadedSupportLoad! - overloadedSupportCapacity!).toFixed(1)}t`;
  } else if (foundationLoads && foundationSupports) {
    let minMargin = Infinity;
    foundationLoads.forEach((load, idx) => {
      const margin = foundationSupports[idx].capacity - load;
      if (margin < minMargin) minMargin = margin;
    });
    safetyMargin = `Closest support margin: ${minMargin.toFixed(1)}t`;
  }

  const getStressLevel = () => {
    if (totalLoad <= capacity.safe * 0.6) return 'safe';
    if (totalLoad <= capacity.safe) return 'warning';
    if (totalLoad <= capacity.max) return 'danger';
    return 'critical';
  };

  // Only show collapse/failure if total bridge load exceeds maximum capacity
  const isCollapse = getStressLevel() === 'critical';

  const stressColors = {
    safe: 'text-stress-safe',
    warning: 'text-stress-warning',
    danger: 'text-stress-danger',
    critical: 'text-stress-critical'
  };

  // Calculate maximum stress point including vehicles
  const getMaxStressLocation = () => {
    const allLoads = [...loadPoints];

    // Add vehicle loads as temporary load points
    vehiclesOnBridge.forEach(vehicle => {
      allLoads.push({
        id: `vehicle-${vehicle.id}`,
        position: vehicle.position,
        weight: vehicle.weight
      });
    });

    if (allLoads.length === 0) return null;

    // For truss and arch, find the most loaded point
    const centerLoads = allLoads.filter(load => Math.abs(load.position[0]) < 1);
    const totalCenterWeight = centerLoads.reduce((sum, load) => sum + load.weight, 0);
    return { x: '0.0', stress: totalCenterWeight };
  };

  const maxStress = getMaxStressLocation();

  // Modern analytics/status panel UI
  return (
    <div className="space-y-6">
      <Card className="bg-card/90 shadow-panel border-border">
        <CardHeader>
          <CardTitle className="text-lg">Bridge Status & Analytics</CardTitle>
          <CardDescription>Live engineering analysis based on real foundation physics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Foundation Integrity */}
          {foundationLoads && foundationSupports && (
            <div className="space-y-2">
              <div className="font-semibold text-base mb-1">Foundation Supports</div>
              <div className="grid grid-cols-2 gap-2">
                {foundationLoads.map((load, idx) => (
                  <div key={idx} className={`p-2 rounded border ${load > foundationSupports[idx].capacity ? 'border-destructive bg-destructive/10 text-destructive font-bold' : 'border-border bg-background'}`}>
                    <div>Support {idx + 1}</div>
                    <div className="text-xs">Load: {load.toFixed(1)}t / {foundationSupports[idx].capacity}t</div>
                    {load > foundationSupports[idx].capacity && <div className="text-xs mt-1">⚠️ Overloaded!</div>}
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <span className="font-medium">Integrity: </span>
                <span className={isCollapse ? 'text-destructive font-bold' : 'text-stress-safe font-bold'}>
                  {isCollapse ? 'FAILED' : 'OK'}
                </span>
              </div>
              {isCollapse && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-xs mt-2">
                  Foundation collapse at Support {overloadedSupportIdx! + 1}! Bridge failure imminent.
                </div>
              )}
            </div>
          )}

          {/* Overall Loads */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Bridge Load</span>
              <span className="font-mono text-blue-500">{(totalLoad / 1000).toFixed(1)} t</span>
            </div>
            <Progress value={Math.min(loadPercentage, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Safe: {(capacity.safe / 1000).toFixed(0)} t</span>
              <span>Max: {(capacity.max / 1000).toFixed(0)} t</span>
            </div>
          </div>

          {/* Safety Margin */}
          <div className="flex justify-between items-center">
            <span className="font-medium">Safety Margin</span>
            <span className={`font-mono ${safetyMargin && safetyMargin.includes('overloaded') ? 'text-destructive' : 'text-stress-safe'}`}>{safetyMargin}</span>
          </div>

          {/* Vehicles and Loads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-medium mb-1">Active Vehicles</div>
              <div className="space-y-1">
                {vehiclesOnBridge.length === 0 && <div className="text-muted-foreground text-xs">None</div>}
                {vehiclesOnBridge.map(v => (
                  <div key={v.id} className="flex justify-between text-xs">
                    <span>{v.type === 'car' ? '🚗' : v.type === 'truck' ? '🚛' : '🚌'} {v.type}</span>
                    <span className="font-mono text-orange-500">{v.weight}kg</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">Manual Loads</div>
              <div className="space-y-1">
                {loadPoints.length === 0 && <div className="text-muted-foreground text-xs">None</div>}
                {loadPoints.map(l => (
                  <div key={l.id} className="flex justify-between text-xs">
                    <span>📦 Load</span>
                    <span className="font-mono">{l.weight}kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
                
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadAnalytics;