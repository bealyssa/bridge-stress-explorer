import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StressAnalysisPanelProps {
    loadPoints: Array<{
        id: string;
        position: [number, number, number];
        weight: number;
    }>;
    isVisible: boolean;
}

const StressAnalysisPanel: React.FC<StressAnalysisPanelProps> = ({ loadPoints, isVisible }) => {
    if (!isVisible || loadPoints.length === 0) {
        return null;
    }

    // Calculate stress statistics
    const totalLoad = loadPoints.reduce((sum, load) => sum + load.weight, 0);
    const maxLoad = Math.max(...loadPoints.map(load => load.weight));
    const minLoad = Math.min(...loadPoints.map(load => load.weight));
    const avgLoad = totalLoad / loadPoints.length;

    // Stress ranges with colors matching the heat map
    const stressRanges = [
        { range: '> 3.412E+04', color: '#D32F2F', description: 'Critical' },
        { range: '3.102E+04', color: '#F44336', description: 'Very High' },
        { range: '2.792E+04', color: '#FF7043', description: 'High' },
        { range: '2.481E+04', color: '#FFA726', description: 'Elevated' },
        { range: '2.171E+04', color: '#FFEB3B', description: 'Moderate' },
        { range: '1.861E+04', color: '#66BB6A', description: 'Safe' },
        { range: '1.550E+04', color: '#81C784', description: 'Low' },
        { range: '1.240E+04', color: '#42A5F5', description: 'Very Low' },
        { range: '9.299E+03', color: '#1976D2', description: 'Minimal' },
        { range: '6.196E+03', color: '#0D47A1', description: 'Negligible' },
        { range: '0.000E+00', color: '#0D47A1', description: 'No Stress' }
    ];

    return (
        <div className="fixed top-4 right-4 z-50 w-64 animate-in fade-in duration-300">
            <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border-gray-200">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded"></div>
                        STRESS ANALYSIS
                    </CardTitle>
                    <div className="text-xs text-gray-600">
                        POST-PROCESSOR<br />
                        DISPLACEMENT<br />
                        RESULTANT
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {/* Load Statistics */}
                    <div className="bg-gray-50 p-3 rounded-md">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">LOAD ANALYSIS</h4>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span>Total Load:</span>
                                <span className="font-mono">{totalLoad.toFixed(1)} kN</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Max Load:</span>
                                <span className="font-mono">{maxLoad.toFixed(1)} kN</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Avg Load:</span>
                                <span className="font-mono">{avgLoad.toFixed(1)} kN</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Load Points:</span>
                                <span className="font-mono">{loadPoints.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stress Color Scale */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700">STRESS LEVELS (Pa)</h4>
                        <div className="space-y-1">
                            {stressRanges.map((stress, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                    <div
                                        className="w-4 h-3 border border-gray-300 rounded-sm"
                                        style={{ backgroundColor: stress.color }}
                                    ></div>
                                    <span className="font-mono text-xs w-16">{stress.range}</span>
                                    <span className="text-gray-600 flex-1">{stress.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scale Factor */}
                    <div className="bg-blue-50 p-2 rounded-md">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-blue-800">SCALE FACTOR:</span>
                            <span className="font-mono text-blue-900">7.354E+01</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StressAnalysisPanel;