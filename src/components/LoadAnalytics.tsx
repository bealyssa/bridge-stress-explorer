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
  bridgeType: 'truss' | 'arch' | 'beam';
  loadPoints: LoadPoint[];
  damageState?: DamageState;
  vehiclesOnBridge?: Vehicle[];
  dynamicLoad?: number;
}

const LoadAnalytics: React.FC<LoadAnalyticsProps> = ({ 
  bridgeType, 
  loadPoints, 
  damageState, 
  vehiclesOnBridge = [], 
  dynamicLoad = 0 
}) => {
  // Bridge capacity limits (simplified) - Updated to match simulator
  const bridgeCapacities = {
    truss: { max: 1800, safe: 1200 }, // Reduced for more sensitivity
    arch: { max: 2500, safe: 1800 },  // Reduced for more sensitivity
    beam: { max: 1200, safe: 800 }    // Reduced for more sensitivity
  };

  const staticWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
  const totalWeight = staticWeight + dynamicLoad;
  const capacity = bridgeCapacities[bridgeType];
  const loadPercentage = (totalWeight / capacity.max) * 100;
  const safetyMargin = capacity.safe - totalWeight;
  
  const getStressLevel = () => {
    if (totalWeight <= capacity.safe * 0.6) return 'safe';
    if (totalWeight <= capacity.safe) return 'warning';
    if (totalWeight <= capacity.max) return 'danger';
    return 'critical';
  };

  const stressLevel = getStressLevel();
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
    
    // For beam bridges, find the location with highest moment
    if (bridgeType === 'beam') {
      let maxMoment = 0;
      let maxLocation = 0;
      
      for (let x = -4; x <= 4; x += 0.1) {
        let moment = 0;
        allLoads.forEach(load => {
          const distance = Math.abs(x - load.position[0]);
          moment += load.weight * Math.max(0, 4 - distance);
        });
        if (moment > maxMoment) {
          maxMoment = moment;
          maxLocation = x;
        }
      }
      return { x: maxLocation.toFixed(1), stress: maxMoment };
    }
    
    // For truss and arch, find the most loaded point
    const centerLoads = allLoads.filter(load => Math.abs(load.position[0]) < 1);
    const totalCenterWeight = centerLoads.reduce((sum, load) => sum + load.weight, 0);
    return { x: '0.0', stress: totalCenterWeight };
  };

  const maxStress = getMaxStressLocation();

  return (
    <div className="space-y-4">
      <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg engineering-title">Structural Analysis</CardTitle>
              <CardDescription>Real-time load distribution and stress analysis</CardDescription>
            </div>
            {(vehiclesOnBridge.length > 0 || dynamicLoad > 0) && (
              <div className="flex items-center gap-1 text-xs text-orange-500">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                LIVE
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Load with breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Load</span>
              <span className={`text-sm font-mono ${stressColors[stressLevel]}`}>
                {totalWeight} kg
              </span>
            </div>
            <Progress 
              value={Math.min(loadPercentage, 100)} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 kg</span>
              <span>Safe: {capacity.safe} kg</span>
              <span>Max: {capacity.max} kg</span>
            </div>
            
            {/* Load breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Static:</span>
                <span className="font-mono">{staticWeight} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehicles:</span>
                <span className={`font-mono ${dynamicLoad > 0 ? 'text-orange-500' : ''}`}>
                  {dynamicLoad} kg
                </span>
              </div>
            </div>
          </div>

          {/* Safety Margin */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Safety Margin</span>
            <span className={`text-sm font-mono ${safetyMargin > 0 ? 'text-stress-safe' : 'text-stress-critical'}`}>
              {safetyMargin > 0 ? '+' : ''}{safetyMargin} kg
            </span>
          </div>

          {/* Bridge Status */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Bridge Status</span>
            <span className={`text-sm font-semibold uppercase tracking-wider ${stressColors[stressLevel]}`}>
              {stressLevel}
            </span>
          </div>

          {/* Load Points Count */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Active Load Points</span>
            <span className="text-sm font-mono">{loadPoints.length}</span>
          </div>

          {/* Vehicles on Bridge */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Vehicles on Bridge</span>
            <span className={`text-sm font-mono ${vehiclesOnBridge.length > 0 ? 'text-orange-500' : ''}`}>
              {vehiclesOnBridge.length}
            </span>
          </div>

          {/* Real-time vehicle details */}
          {vehiclesOnBridge.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Active Vehicles:</h4>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {vehiclesOnBridge.map((vehicle) => (
                  <div key={vehicle.id} className="flex justify-between items-center text-xs">
                    <span className="capitalize flex items-center gap-1">
                      {vehicle.type === 'car' && '🚗'}
                      {vehicle.type === 'truck' && '🚛'}
                      {vehicle.type === 'bus' && '🚌'}
                      {vehicle.type}
                    </span>
                    <span className="font-mono text-orange-500">{vehicle.weight}kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {maxStress && (
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Max Stress Point</span>
                <span className="text-sm font-mono">x: {maxStress.x}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Stress Value</span>
                <span className="text-xs font-mono">{Math.round(maxStress.stress)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Damage Assessment */}
      {damageState && (
        <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
          <CardHeader>
            <CardTitle className="text-lg engineering-title">Damage Assessment</CardTitle>
            <CardDescription>Structural integrity and failure analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Structural Integrity</span>
                <span className={`text-sm font-mono ${
                  damageState.overallIntegrity > 0.7 ? 'text-stress-safe' :
                  damageState.overallIntegrity > 0.4 ? 'text-stress-warning' :
                  'text-stress-critical'
                }`}>
                  {Math.round(damageState.overallIntegrity * 100)}%
                </span>
              </div>
              <Progress 
                value={damageState.overallIntegrity * 100} 
                className="h-2"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Cracks</span>
              <span className="text-sm font-mono">{damageState.cracks.length}</span>
            </div>

            {damageState.failureMode !== 'none' && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                <div className="font-semibold text-destructive text-sm">Failure Mode Detected</div>
                <div className="text-xs text-destructive/80 mt-1">
                  {damageState.failureMode === 'bending' && 'Excessive deflection causing structural failure'}
                  {damageState.failureMode === 'shear' && 'Shear force exceeding material capacity'}
                  {damageState.failureMode === 'buckling' && 'Compression members buckling under load'}
                  {damageState.failureMode === 'collapse' && 'Complete structural collapse imminent'}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <h4 className="font-semibold text-sm mb-2">Real-World Implications</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                {damageState.overallIntegrity > 0.8 && (
                  <p>✅ Bridge is operating within safe parameters. Regular inspections recommended.</p>
                )}
                {damageState.overallIntegrity <= 0.8 && damageState.overallIntegrity > 0.5 && (
                  <p>⚠️ Increased monitoring required. Load restrictions should be considered.</p>
                )}
                {damageState.overallIntegrity <= 0.5 && damageState.overallIntegrity > 0.2 && (
                  <p>🚫 Bridge should be closed to traffic. Immediate structural repairs needed.</p>
                )}
                {damageState.overallIntegrity <= 0.2 && (
                  <p>💥 Critical failure! Bridge collapse is imminent. Emergency evacuation required.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traffic Flow Analysis */}
      <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
        <CardHeader>
          <CardTitle className="text-lg engineering-title">Traffic Flow</CardTitle>
          <CardDescription>Real-time vehicle monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="text-2xl font-mono text-blue-500">
                {vehiclesOnBridge.filter(v => v.type === 'car').length}
              </div>
              <div className="text-xs text-muted-foreground">🚗 Cars</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-mono text-orange-500">
                {vehiclesOnBridge.filter(v => v.type === 'truck').length}
              </div>
              <div className="text-xs text-muted-foreground">🚛 Trucks</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-mono text-purple-500">
                {vehiclesOnBridge.filter(v => v.type === 'bus').length}
              </div>
              <div className="text-xs text-muted-foreground">🚌 Buses</div>
            </div>
          </div>

          {dynamicLoad > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Traffic Load Impact</span>
                <span className="text-sm font-mono text-orange-500">
                  +{((dynamicLoad / (staticWeight + dynamicLoad)) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Vehicles contributing {dynamicLoad}kg to total bridge load
              </div>
            </div>
          )}

          {vehiclesOnBridge.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-2xl mb-2">🌉</div>
              <div className="text-sm">No vehicles on bridge</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bridge Specifications */}
      <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
        <CardHeader>
          <CardTitle className="text-lg engineering-title">{bridgeType.charAt(0).toUpperCase() + bridgeType.slice(1)} Bridge Specs</CardTitle>
          <CardDescription>Technical specifications and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">Length</div>
              <div className="text-muted-foreground font-mono">8.0 m</div>
            </div>
            <div>
              <div className="font-medium">Material</div>
              <div className="text-muted-foreground">Steel</div>
            </div>
            <div>
              <div className="font-medium">Max Load</div>
              <div className="text-muted-foreground font-mono">{capacity.max} kg</div>
            </div>
            <div>
              <div className="font-medium">Safety Factor</div>
              <div className="text-muted-foreground font-mono">
                {(capacity.max / capacity.safe).toFixed(1)}x
              </div>
            </div>
          </div>
          
          {bridgeType === 'truss' && (
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              <p>Truss bridges distribute loads through triangular units, providing excellent strength-to-weight ratio.</p>
            </div>
          )}
          
          {bridgeType === 'arch' && (
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              <p>Arch bridges transfer loads through compression, making them ideal for heavy loads.</p>
            </div>
          )}
          
          {bridgeType === 'beam' && (
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              <p>Beam bridges rely on flexural strength, showing visible deflection under load.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadAnalytics;