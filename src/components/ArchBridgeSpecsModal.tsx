import React, { useState } from 'react';
import { Button } from './ui/button';

interface ArchBridgeSpecsModalProps {
    isOpen: boolean;
    onClose: () => void;
    specs: {
        material: 'steel' | 'wood' | 'concrete';
        maxLoad: number;
        safetyFactor: number;
        spanLength: number;
    };
    onSave: (specs: { material: 'steel' | 'wood' | 'concrete'; maxLoad: number; safetyFactor: number; spanLength: number }) => void;
}

const ArchBridgeSpecsModal: React.FC<ArchBridgeSpecsModalProps> = ({ isOpen, onClose, specs, onSave }) => {
    const [material, setMaterial] = useState<'steel' | 'wood' | 'concrete'>(specs.material);
    const [maxLoad, setMaxLoad] = useState<number>(specs.maxLoad);
    const [safetyFactor, setSafetyFactor] = useState<number>(specs.safetyFactor);
    const [spanLength, setSpanLength] = useState<number>(specs.spanLength);

    const handleSave = () => {
        onSave({ material, maxLoad, safetyFactor, spanLength });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-card rounded-xl shadow-2xl p-7 w-[370px] border border-border/60 backdrop-blur-md">
                <h2 className="text-xl font-bold mb-5 text-white">Edit Arch Bridge Specs</h2>
                <div className="mb-4">
                    <label className="block font-medium mb-2 text-slate-200">Material</label>
                    <div className="flex gap-2">
                        <Button variant={material === 'steel' ? 'engineering' : 'outline'} size="sm" onClick={() => setMaterial('steel')}>Steel</Button>
                        <Button variant={material === 'wood' ? 'engineering' : 'outline'} size="sm" onClick={() => setMaterial('wood')}>Wood</Button>
                        <Button variant={material === 'concrete' ? 'engineering' : 'outline'} size="sm" onClick={() => setMaterial('concrete')}>Concrete</Button>
                    </div>
                </div>
                <div className="mb-4">
                    <label className="block font-medium mb-2 text-slate-200">Max Load (t)</label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition"
                        value={maxLoad}
                        min={1}
                        max={1000}
                        onChange={e => setMaxLoad(Number(e.target.value))}
                        placeholder="Max Load (t)"
                    />
                </div>
                <div className="mb-4">
                    <label className="block font-medium mb-2 text-slate-200">Safety Factor</label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition"
                        value={safetyFactor}
                        min={1}
                        max={5}
                        step={0.1}
                        onChange={e => setSafetyFactor(Number(e.target.value))}
                        placeholder="Safety Factor"
                    />
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                    <Button variant="engineering" size="sm" onClick={handleSave}>Save</Button>
                </div>
            </div>
        </div>
    );
};

export default ArchBridgeSpecsModal;
