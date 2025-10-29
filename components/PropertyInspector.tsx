import React, { useCallback } from 'react';
import type { Composition, Layer, Property, Keyframe } from '../types';
import { getPropertyValue } from '../utils/interpolation';
import { CurveEditor } from './CurveEditor';

interface PropertyInspectorProps {
    selectedLayer: Layer | null;
    selectedLayerIds: string[];
    composition: Composition;
    onCompositionChange: (composition: Composition) => void;
    frame: number;
    onFrameChange: (frame: number) => void;
}

const animatableProperties: Record<string, { name: string; type: 'number'; min?: number; max?: number; step?: number }> = {
    x: { name: 'Position X', type: 'number', step: 1 },
    y: { name: 'Position Y', type: 'number', step: 1 },
    opacity: { name: 'Opacity', type: 'number', min: 0, max: 1, step: 0.01 },
    scale: { name: 'Scale', type: 'number', min: 0, step: 0.01 },
    fontSize: { name: 'Font Size', type: 'number', min: 1, step: 1 },
    width: { name: 'Width', type: 'number', min: 0, step: 1 },
    height: { name: 'Height', type: 'number', min: 0, step: 1 },
};

const staticProperties: Record<string, { name: string; type: 'text' | 'color' | 'select'; options?: readonly string[] }> = {
    text: { name: 'Text', type: 'text' },
    color: { name: 'Color', type: 'color' },
    shape: { name: 'Shape', type: 'select', options: ['rect', 'circle'] },
};

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({ selectedLayer, selectedLayerIds, composition, onCompositionChange, frame, onFrameChange }) => {
    
    const updateLayerProperty = useCallback((layerId: string, propKey: string, newPropValue: Partial<Property>) => {
        const updateRecursively = (layers: Layer[]): Layer[] => {
            return layers.map(l => {
                if (l.id === layerId) {
                    const newProps = { ...l.properties };
                    (newProps[propKey as keyof Layer['properties']] as Property) = {
                        ...(newProps[propKey as keyof Layer['properties']]),
                        ...newPropValue
                    };
                    return { ...l, properties: newProps };
                }
                if (l.children) {
                    return { ...l, children: updateRecursively(l.children) };
                }
                return l;
            });
        };
        const newLayers = updateRecursively(composition.layers);
        onCompositionChange({ ...composition, layers: newLayers });
    }, [composition, onCompositionChange]);

    if (selectedLayerIds.length > 1) {
        return <div className="text-gray-400 p-4 text-center">{selectedLayerIds.length} layers selected. Bulk editing is not yet supported.</div>;
    }

    if (!selectedLayer) {
        return <div className="text-gray-400">Select a layer to inspect its properties.</div>;
    }

    if (selectedLayer.type === 'group') {
        return (
            <div>
                <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">{selectedLayer.name}</h3>
                <div className="text-gray-400">This is a group layer. Edit child layers to change properties.</div>
                 {selectedLayer.isLocked && <div className="mt-4 text-yellow-400 text-sm p-2 bg-yellow-900/50 rounded-md">This layer is locked.</div>}
            </div>
        )
    }

    const handleToggleKeyframing = (propKey: string) => {
        const prop = selectedLayer.properties[propKey as keyof Layer['properties']];
        if (!prop) return;

        const localFrame = frame - selectedLayer.from;

        if (prop.keyframes && prop.keyframes.length > 0) { // Is animated, make static
            const currentValue = getPropertyValue(prop, localFrame);
            updateLayerProperty(selectedLayer.id, propKey, { value: currentValue, keyframes: undefined });
        } else { // Is static, make animated
            const currentValue = prop.value;
            updateLayerProperty(selectedLayer.id, propKey, { 
                value: undefined, 
                keyframes: [{ frame: Math.max(0, localFrame), value: currentValue, interpolation: 'linear' }] 
            });
        }
    };

    const handleValueChange = (propKey: string, newValue: any) => {
        const prop = selectedLayer.properties[propKey as keyof Layer['properties']];
        if (!prop) return;

        if (prop.keyframes) { // Animated property
            const localFrame = frame - selectedLayer.from;
            const existingKfIndex = prop.keyframes.findIndex(kf => kf.frame === localFrame);
            let newKeyframes: Keyframe[];

            if (existingKfIndex > -1) { // Update existing keyframe
                newKeyframes = [...prop.keyframes];
                newKeyframes[existingKfIndex] = { ...newKeyframes[existingKfIndex], value: newValue };
            } else { // Add new keyframe
                newKeyframes = [...prop.keyframes, { frame: Math.max(0, localFrame), value: newValue, interpolation: 'linear' }];
                newKeyframes.sort((a, b) => a.frame - b.frame);
            }
            updateLayerProperty(selectedLayer.id, propKey, { keyframes: newKeyframes });
        } else { // Static property
            updateLayerProperty(selectedLayer.id, propKey, { value: newValue });
        }
    };
    
    const renderPropertyControl = (propKey: string, config: { name: string, type: string, [key: string]: any }) => {
        const prop = selectedLayer.properties[propKey as keyof Layer['properties']];
        if (!prop) return null;

        const localFrame = frame - selectedLayer.from;
        const currentValue = getPropertyValue(prop, localFrame);
        const isAnimated = !!prop.keyframes?.length;
        
        const handleLabelPointerDown = (e: React.PointerEvent) => {
            if (e.button !== 0 || config.type !== 'number' || selectedLayer?.isLocked) return;
            e.preventDefault();
            document.body.style.cursor = 'ew-resize';
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        
            const initialValue = getPropertyValue(prop, localFrame);
            let value = initialValue;
        
            const handlePointerMove = (moveEvent: PointerEvent) => {
                const sensitivity = moveEvent.shiftKey ? 0.1 : 1.0;
                const step = config.step || 1;
                const delta = moveEvent.movementX * step * sensitivity;
                value += delta;
                
                const precision = String(step).includes('.') ? String(step).split('.')[1].length : 0;
                const roundedValue = parseFloat(value.toFixed(precision));
        
                handleValueChange(propKey, roundedValue);
            };
        
            const handlePointerUp = (upEvent: PointerEvent) => {
                document.body.style.cursor = 'default';
                if((upEvent.target as HTMLElement).hasPointerCapture(upEvent.pointerId)) {
                    (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
                }
                window.removeEventListener('pointermove', handlePointerMove);
                window.removeEventListener('pointerup', handlePointerUp);
            };
        
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp, { once: true });
        };
        
        return (
            <div key={propKey} className="mb-2">
                <div className="grid grid-cols-[20px_1fr_80px] items-center gap-2">
                    <button 
                        onClick={() => handleToggleKeyframing(propKey)}
                        className={`text-lg transition-colors ${isAnimated ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
                        title={isAnimated ? 'Disable keyframes' : 'Enable keyframes for this property'}
                    >
                        ⏱️
                    </button>
                    <label 
                        className={`text-sm text-gray-300 truncate ${config.type === 'number' && !selectedLayer.isLocked ? 'cursor-ew-resize' : ''}`}
                        title={config.name}
                        onPointerDown={handleLabelPointerDown}
                    >
                        {config.name}
                    </label>
                    {config.type === 'number' && (
                        <input type="number" value={Number(currentValue).toFixed(2)} onChange={e => handleValueChange(propKey, parseFloat(e.target.value))}
                               min={config.min} max={config.max} step={config.step}
                               className="w-full bg-gray-900 text-white text-right px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-700"/>
                    )}
                    {config.type === 'text' && (
                         <input type="text" value={currentValue || ''} onChange={e => handleValueChange(propKey, e.target.value)}
                               className="w-full bg-gray-900 text-white col-span-2 px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-700"/>
                    )}
                     {config.type === 'color' && (
                         <input type="color" value={currentValue || '#ffffff'} onChange={e => handleValueChange(propKey, e.target.value)}
                               className="w-full h-8 bg-gray-900 border border-gray-700 rounded-md cursor-pointer disabled:cursor-not-allowed"/>
                    )}
                     {config.type === 'select' && (
                         <select value={currentValue} onChange={e => handleValueChange(propKey, e.target.value)}
                                className="w-full bg-gray-900 text-white col-span-2 px-2 py-1 rounded-md border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-700">
                             {config.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                         </select>
                     )}
                </div>
                {isAnimated && prop.keyframes && config.type === 'number' && (
                    <div className="mt-2 pl-[28px]">
                        <CurveEditor 
                            keyframes={prop.keyframes}
                            width={230}
                            height={80}
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">{selectedLayer.name}</h3>
            {selectedLayer.isLocked && <div className="mb-4 text-yellow-400 text-sm p-2 bg-yellow-900/50 rounded-md">This layer is locked and cannot be edited.</div>}
            <fieldset disabled={selectedLayer.isLocked}>
                <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-gray-400 mt-2 mb-1">Transform</h4>
                    {renderPropertyControl('x', animatableProperties.x)}
                    {renderPropertyControl('y', animatableProperties.y)}
                    {renderPropertyControl('scale', animatableProperties.scale)}
                    {renderPropertyControl('opacity', animatableProperties.opacity)}

                    <h4 className="text-sm font-semibold text-gray-400 mt-3 mb-1 border-t border-gray-700 pt-3">
                        {selectedLayer.type === 'text' ? 'Text Options' : 'Shape Options'}
                    </h4>
                    {selectedLayer.type === 'text' && (
                        <>
                            {renderPropertyControl('text', { name: 'Text Content', type: 'text' })}
                            {renderPropertyControl('color', staticProperties.color)}
                            {renderPropertyControl('fontSize', animatableProperties.fontSize)}
                        </>
                    )}
                    {selectedLayer.type === 'shape' && (
                        <>
                             {renderPropertyControl('shape', staticProperties.shape)}
                             {renderPropertyControl('color', staticProperties.color)}
                             {renderPropertyControl('width', animatableProperties.width)}
                             {renderPropertyControl('height', animatableProperties.height)}
                        </>
                    )}
                </div>
            </fieldset>
        </div>
    );
};