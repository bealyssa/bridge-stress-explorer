import React, { useState } from 'react';
import BridgeSimulator from '@/components/BridgeSimulator';
import LoadAnalytics from '@/components/LoadAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoadPoint {
  id: string;
  position: [number, number, number];
  weight: number;
}

const Index = () => {
  const [bridgeType, setBridgeType] = useState<'truss' | 'arch' | 'beam'>('truss');
  const [loadPoints, setLoadPoints] = useState<LoadPoint[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(true);

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
            <BridgeSimulator 
              bridgeType={bridgeType}
              loadPoints={loadPoints}
              onBridgeTypeChange={setBridgeType}
              onLoadPointsChange={setLoadPoints}
            />
          </div>

          {/* Analytics Panel */}
          {showAnalytics && (
            <div className="lg:col-span-1 space-y-4 overflow-y-auto">
              <LoadAnalytics bridgeType={bridgeType} loadPoints={loadPoints} />
              
              {/* Educational Info */}
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

export default Index;
