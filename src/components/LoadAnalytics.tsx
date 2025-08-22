import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface LoadPoint {
  id: string;
  position: [number, number, number];
  weight: number;
}

interface LoadAnalyticsProps {
  bridgeType: 'truss' | 'arch' | 'beam';
  loadPoints: LoadPoint[];
}

const LoadAnalytics: React.FC<LoadAnalyticsProps> = ({ bridgeType, loadPoints }) => {
  // Bridge capacity limits (simplified)
  const bridgeCapacities = {
    truss: { max: 2000, safe: 1600 },
    arch: { max: 3000, safe: 2400 },
    beam: { max: 1500, safe: 1200 }
  };

  const totalWeight = loadPoints.reduce((sum, load) => sum + load.weight, 0);
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

  // Calculate maximum stress point
  const getMaxStressLocation = () => {
    if (loadPoints.length === 0) return null;
    
    // For beam bridges, find the location with highest moment
    if (bridgeType === 'beam') {
      let maxMoment = 0;
      let maxLocation = 0;
      
      for (let x = -4; x <= 4; x += 0.1) {
        let moment = 0;
        loadPoints.forEach(load => {
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
    const centerLoad = loadPoints.filter(load => Math.abs(load.position[0]) < 1);
    const totalCenterWeight = centerLoad.reduce((sum, load) => sum + load.weight, 0);
    return { x: '0.0', stress: totalCenterWeight };
  };

  const maxStress = getMaxStressLocation();

  return (
    <div className="space-y-4">
      <Card className="bg-card/90 backdrop-blur-sm shadow-panel border-border">
        <CardHeader>
          <CardTitle className="text-lg engineering-title">Structural Analysis</CardTitle>
          <CardDescription>Real-time load distribution and stress analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Load */}
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