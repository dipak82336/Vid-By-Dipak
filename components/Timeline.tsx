import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Composition, Keyframe, Layer } from '../types';

// --- Icons ---
const VisibleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.48 0-4.5-2.02-4.5-4.5S9.52 7.5 12 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/></svg>;
const HiddenIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.38 1.12 2.5 2.5 2.5.22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.48 0-4.5-2.02-4.5-4.5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.38-1.12-2.5-2.5-2.5l-.16.02z"/></svg>;

// --- Constants ---
const LAYER_TRACK_HEIGHT = 40;
const SNAP_THRESHOLD_PX = 8;
const HEADER_WIDTH = 220;

// --- Types ---
type InteractionType = 'move' | 'trim-start' | 'trim-end';
type Interaction = { type: InteractionType; layerId: string; initialPointerX: number; initialFrom: number; initialDuration: number; };
interface TimelineProps { composition: Composition; frame: number; onFrameChange: (frame: number) => void; selectedLayerIds: string[]; onLayerSelect: (layerId: string, e: React.MouseEvent) => void; onClearSelection: () => void; onCompositionChange: (composition: Composition) => void; collapsedGroups: Record<string, boolean>; onToggleGroupCollapse: (groupId: string) => void; }
type ContextMenuState = { x: number; y: number; layerId: string; propKey: string; frame: number; };

// --- Helper Functions ---
const findSnapPoint = (frameValue: number, targets: number[], framesToPixels: (f: number) => number): number | null => {
    let bestSnap: number | null = null;
    let minDistance = SNAP_THRESHOLD_PX;
    for (const target of targets) {
        const distance = Math.abs(framesToPixels(frameValue - target));
        if (distance < minDistance) { minDistance = distance; bestSnap = target; }
    }
    return bestSnap;
};

const updateLayerRecursively = (layers: Layer[], layerId: string, updates: Partial<Layer>): Layer[] => {
    return layers.map(layer => {
        if (layer.id === layerId) return { ...layer, ...updates };
        if (layer.children) return { ...layer, children: updateLayerRecursively(layer.children, layerId, updates) };
        return layer;
    });
};

// --- Component ---
export const Timeline: React.FC<TimelineProps> = ({ composition, frame, onFrameChange, selectedLayerIds, onLayerSelect, onClearSelection, onCompositionChange, collapsedGroups, onToggleGroupCollapse }) => {
    const [zoom, setZoom] = useState(5);
    const [interaction, setInteraction] = useState<Interaction | null>(null);
    const [snapLineFrame, setSnapLineFrame] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const headerContainerRef = useRef<HTMLDivElement>(null);
    const timelineContainerRef = useRef<HTMLDivElement>(null);
    const rulerDragInfo = useRef<{ isDragging: boolean; lastClientX: number }>({ isDragging: false, lastClientX: 0 });
    const autoScrollRef = useRef<number>(0);

    const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
    const prevPinchDist = useRef<number | null>(null);
    const zoomOriginFrame = useRef<number>(0);

    const pixelsToFrames = useCallback((pixels: number) => pixels / zoom, [zoom]);
    const framesToPixels = useCallback((frames: number) => frames * zoom, [zoom]);
    
    const flattenedLayers = useMemo(() => {
        const list: { layer: Layer; depth: number }[] = [];
        const recurse = (layers: Layer[], depth: number) => {
            layers.forEach(layer => {
                list.push({ layer, depth });
                if (layer.type === 'group' && layer.children && !collapsedGroups[layer.id]) {
                    recurse(layer.children, depth + 1);
                }
            });
        };
        recurse(composition.layers, 0);
        return list;
    }, [composition.layers, collapsedGroups]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(z => Math.min(50, z * 1.25)); } 
            else if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(0.5, z / 1.25)); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => { // Sync vertical scroll between headers and timeline grid
        const grid = timelineContainerRef.current, headers = headerContainerRef.current;
        if (!grid || !headers) return;
        const syncScroll = () => { headers.scrollTop = grid.scrollTop; };
        grid.addEventListener('scroll', syncScroll);
        return () => grid.removeEventListener('scroll', syncScroll);
    }, []);

    useEffect(() => { // Auto-scroll when dragging playhead near edges
        let animationFrameId: number;
        const scrollLoop = () => {
            if (autoScrollRef.current !== 0 && timelineContainerRef.current) {
                timelineContainerRef.current.scrollLeft += 15 * autoScrollRef.current;
                const rect = timelineContainerRef.current.getBoundingClientRect();
                const mouseX = rulerDragInfo.current.lastClientX - rect.left;
                onFrameChange(Math.round(pixelsToFrames(mouseX + timelineContainerRef.current.scrollLeft)));
            }
            animationFrameId = requestAnimationFrame(scrollLoop);
        };
        animationFrameId = requestAnimationFrame(scrollLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [pixelsToFrames, onFrameChange]);

    useEffect(() => { // Close context menu on outside click
        const handleClickOutside = () => setContextMenu(null);
        if (contextMenu) window.addEventListener('pointerdown', handleClickOutside);
        return () => window.removeEventListener('pointerdown', handleClickOutside);
    }, [contextMenu]);
    
    const handleRulerPointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        rulerDragInfo.current = { isDragging: true, lastClientX: e.clientX };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        document.body.style.cursor = 'ew-resize';
        const container = timelineContainerRef.current;
        if (!container) return;
        const updateFrame = (clientX: number) => onFrameChange(Math.round(pixelsToFrames(clientX - container.getBoundingClientRect().left + container.scrollLeft)));
        updateFrame(e.clientX);
        
        const handlePointerMove = (moveEvent: PointerEvent) => {
            rulerDragInfo.current.lastClientX = moveEvent.clientX;
            updateFrame(moveEvent.clientX);
            const rect = container.getBoundingClientRect();
            if (moveEvent.clientX < rect.left + 60) autoScrollRef.current = -1;
            else if (moveEvent.clientX > rect.right - 60) autoScrollRef.current = 1;
            else autoScrollRef.current = 0;
        };
        const handlePointerUp = (upEvent: PointerEvent) => {
            (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
            rulerDragInfo.current = { isDragging: false, lastClientX: 0 };
            autoScrollRef.current = 0;
            document.body.style.cursor = 'default';
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    };

    const handleLayerPointerDown = (e: React.PointerEvent, layerId: string, type: InteractionType) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        const layer = flattenedLayers.find(l => l.layer.id === layerId)?.layer;
        if (!layer || layer.isLocked) return;
        if(!selectedLayerIds.includes(layerId)) { onLayerSelect(layerId, e as any); }
        setInteraction({ type, layerId, initialPointerX: e.clientX, initialFrom: layer.from, initialDuration: layer.duration });
    };

    const handleWheelZoom = useCallback((e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return; // Only zoom with Ctrl/Cmd + Wheel
        e.preventDefault();
        const container = timelineContainerRef.current;
        if(!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const frameAtMouse = pixelsToFrames(container.scrollLeft + mouseX);
        const newZoom = Math.max(0.5, Math.min(50, zoom - e.deltaY * 0.01 * zoom));
        setZoom(newZoom);
        container.scrollLeft = framesToPixels(frameAtMouse) - mouseX;
    }, [zoom, pixelsToFrames, framesToPixels]);

    useEffect(() => { // Layer drag/trim interaction
        if (!interaction) { document.body.style.cursor = 'default'; return; }
        document.body.style.cursor = interaction.type === 'move' ? 'grabbing' : 'ew-resize';
        const handlePointerMove = (e: PointerEvent) => {
            let start = interaction.initialFrom, end = interaction.initialFrom + interaction.initialDuration;
            const deltaFrames = pixelsToFrames(e.clientX - interaction.initialPointerX);
            if (interaction.type === 'move') { start += deltaFrames; end += deltaFrames; } 
            else if (interaction.type === 'trim-start') { start += deltaFrames; } 
            else { end += deltaFrames; }
            const snapTargets = [frame, 0, composition.durationInFrames, ...composition.layers.flatMap(l => !selectedLayerIds.includes(l.id) ? [l.from, l.from + l.duration] : [])];
            let snapLine: number | null = null;
            if (interaction.type === 'move') {
                const duration = end - start;
                const snappedStart = findSnapPoint(start, snapTargets, framesToPixels);
                if (snappedStart !== null) { start = snappedStart; snapLine = snappedStart; } 
                else { const snappedEnd = findSnapPoint(end, snapTargets, framesToPixels); if (snappedEnd !== null) { start = snappedEnd - duration; snapLine = snappedEnd; } }
                end = start + duration;
            } else if (interaction.type === 'trim-start') { const snappedStart = findSnapPoint(start, snapTargets, framesToPixels); if (snappedStart !== null) { start = snappedStart; snapLine = snappedStart; }
            } else { const snappedEnd = findSnapPoint(end, snapTargets, framesToPixels); if (snappedEnd !== null) { end = snappedEnd; snapLine = snappedEnd; } }
            setSnapLineFrame(snapLine);
            if (end < start + 1) { if (interaction.type === 'trim-start') start = end - 1; else end = start + 1; }
            if (start < 0) { if (interaction.type === 'move') { end -= start; start = 0; } else { start = 0; } }
            if (end > composition.durationInFrames) { if (interaction.type === 'move') { start -= (end - composition.durationInFrames); end = composition.durationInFrames; if(start < 0) start = 0; } else { end = composition.durationInFrames; } }
            const newFrom = Math.round(start), newDuration = Math.round(end - start);
            const updatedLayers = updateLayerRecursively(composition.layers, interaction.layerId, { from: newFrom, duration: newDuration });
            onCompositionChange({ ...composition, layers: updatedLayers });
        };
        const handlePointerUp = () => { setInteraction(null); setSnapLineFrame(null); };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
        return () => { window.removeEventListener('pointermove', handlePointerMove); window.removeEventListener('pointerup', handlePointerUp); };
    }, [interaction, composition, frame, pixelsToFrames, framesToPixels, onCompositionChange, selectedLayerIds]);

    const handleKeyframeContextMenu = (e: React.MouseEvent, layerId: string, propKey: string, frame: number) => {
        e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, layerId, propKey, frame });
    };

    const handleInterpolationChange = (interpolation: Keyframe['interpolation']) => {
        if (!contextMenu) return;
        const { layerId, propKey, frame } = contextMenu;
        const updateKeyframeRecursively = (layers: Layer[]): Layer[] => layers.map(l => {
            if (l.id === layerId) {
                const prop = l.properties[propKey as keyof Layer['properties']];
                if (!prop || !prop.keyframes) return l;
                const newKeyframes = prop.keyframes.map(kf => kf.frame === frame ? { ...kf, interpolation } : kf);
                return { ...l, properties: { ...l.properties, [propKey]: { ...prop, keyframes: newKeyframes } } };
            }
            if (l.children) return { ...l, children: updateKeyframeRecursively(l.children) };
            return l;
        });
        onCompositionChange({ ...composition, layers: updateKeyframeRecursively(composition.layers) });
        setContextMenu(null);
    };
    
    // Pan and Zoom pointer handlers
    const timelinePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType !== 'touch') return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const timelinePointerMove = (e: React.PointerEvent) => {
        if (!activePointers.current.has(e.pointerId)) return;
        const container = timelineContainerRef.current;
        if (!container) return;
        const oldPointer = activePointers.current.get(e.pointerId)!;
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (activePointers.current.size === 1) { // Pan
            container.scrollLeft -= e.clientX - oldPointer.x;
            container.scrollTop -= e.clientY - oldPointer.y;
        } else if (activePointers.current.size === 2) { // Zoom
            // Fix: Add an explicit type annotation to 'pointers' to resolve type inference issues.
            const pointers: { x: number; y: number }[] = Array.from(activePointers.current.values());
            const dist = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
            if (prevPinchDist.current !== null) {
                const rect = container.getBoundingClientRect();
                const midX = (pointers[0].x + pointers[1].x) / 2 - rect.left;
                zoomOriginFrame.current = pixelsToFrames(container.scrollLeft + midX);
                const zoomFactor = dist / prevPinchDist.current;
                setZoom(z => Math.max(0.5, Math.min(50, z * zoomFactor)));
            }
            prevPinchDist.current = dist;
        }
    };
    const timelinePointerUp = (e: React.PointerEvent) => {
        if (e.target === e.currentTarget && !e.ctrlKey && !e.metaKey && !e.shiftKey) onClearSelection();
        if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        activePointers.current.delete(e.pointerId);
        if (activePointers.current.size < 2) prevPinchDist.current = null;
    };
    
    useEffect(() => { // Adjust scroll after programmatic zoom (pinch or wheel) to keep origin point stable
        const container = timelineContainerRef.current;
        if (!container) return;
        container.scrollLeft = framesToPixels(zoomOriginFrame.current) - (container.clientWidth / 2);
    }, [zoom, framesToPixels]);

    useEffect(() => {
        const container = timelineContainerRef.current; if (!container) return;
        container.addEventListener('wheel', handleWheelZoom, { passive: false });
        return () => container.removeEventListener('wheel', handleWheelZoom);
    }, [handleWheelZoom]);

    const totalWidth = framesToPixels(composition.durationInFrames);
    const totalHeight = flattenedLayers.length * LAYER_TRACK_HEIGHT;

    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex flex-col gap-2 min-h-[200px] h-[30%]">
            <div className="flex items-center gap-4">
                <label className="text-sm">Zoom:</label>
                <input type="range" min="0.5" max="50" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="w-32 accent-blue-500" />
            </div>
            <div className="flex-1 flex min-h-0">
                <div ref={headerContainerRef} style={{ width: HEADER_WIDTH }} className="flex-shrink-0 flex flex-col overflow-hidden">
                    <div className="h-6 flex-shrink-0 border-b border-gray-700 bg-gray-800 z-30 sticky top-0 flex items-center"><span className="text-xs text-gray-400 pl-2">Layer Name</span></div>
                    <div className="relative" style={{ height: totalHeight }}>
                        {flattenedLayers.map(({ layer, depth }) => (
                            <div key={layer.id} className={`h-10 flex items-center gap-2 text-sm border-b border-gray-700/50 cursor-pointer ${selectedLayerIds.includes(layer.id) ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'}`} style={{ paddingLeft: `${depth * 16}px` }} onClick={(e) => onLayerSelect(layer.id, e)}>
                                {layer.type === 'group' ? <button className="text-gray-400 z-10" onClick={(e) => { e.stopPropagation(); onToggleGroupCollapse(layer.id); }}>{collapsedGroups[layer.id] ? '▶' : '▼'}</button> : <div className="w-4"/>}
                                <span className="flex-1 truncate" title={layer.name}>{layer.name}</span>
                                <button className="p-1 rounded hover:bg-gray-700 z-10" onClick={(e) => { e.stopPropagation(); onCompositionChange({ ...composition, layers: updateLayerRecursively(composition.layers, layer.id, { isVisible: !(layer.isVisible ?? true)})})}}>{layer.isVisible ?? true ? <VisibleIcon /> : <HiddenIcon />}</button>
                                <button className={`p-1 rounded hover:bg-gray-700 z-10 ${layer.isLocked ? 'text-yellow-400' : 'text-gray-500'}`} onClick={(e) => { e.stopPropagation(); onCompositionChange({ ...composition, layers: updateLayerRecursively(composition.layers, layer.id, { isLocked: !layer.isLocked })})}}>{layer.isLocked ? '🔒' : '🔓'}</button>
                            </div>
                        ))}
                    </div>
                </div>
                <div ref={timelineContainerRef} className="flex-1 overflow-auto timeline-scrollbar touch-none" onPointerDown={timelinePointerDown} onPointerMove={timelinePointerMove} onPointerUp={timelinePointerUp} onPointerCancel={timelinePointerUp}>
                    <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
                        <div className="sticky top-0 h-6 bg-gray-700/80 backdrop-blur-sm z-20 cursor-ew-resize" onPointerDown={handleRulerPointerDown}>
                            {Array.from({ length: Math.floor(composition.durationInFrames / 5) + 1 }).map((_, i) => {
                                const frameNum = i * 5; const pxPer5F = framesToPixels(5); if (pxPer5F < 15 && i % 2 !== 0) return null;
                                const isMajor = frameNum % 10 === 0; const showNumber = (isMajor && pxPer5F > 20) || (frameNum % 50 === 0 && pxPer5F <= 20);
                                return <div key={i} className="absolute text-xs text-gray-400 -top-0.5 select-none" style={{ left: framesToPixels(frameNum) }}><div className={`w-px ${isMajor ? 'h-2 bg-gray-400' : 'h-1 bg-gray-500'}`} />{showNumber && frameNum}</div>;
                            })}
                        </div>
                        <div className="absolute top-0 h-full z-10" style={{ left: framesToPixels(frame) }}><div className="w-0.5 h-full bg-red-500 pointer-events-none" /><div className="absolute -top-0.5 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[8px] border-t-red-500 cursor-ew-resize" onPointerDown={handleRulerPointerDown}/></div>
                        {snapLineFrame !== null && <div className="absolute top-0 h-full w-0.5 bg-yellow-400 z-20 pointer-events-none" style={{ left: framesToPixels(snapLineFrame) }} />}
                        <div className="relative pt-6">
                            {flattenedLayers.map(({ layer }, index) => layer.type !== 'group' && (
                                <div key={layer.id} className={`absolute h-8 my-1 flex items-center rounded-sm text-white text-xs box-border group transition-opacity ${layer.isVisible ?? true ? 'opacity-100' : 'opacity-50'} ${selectedLayerIds.includes(layer.id) ? 'bg-orange-500 border-2 border-orange-300 z-10' : 'bg-blue-600/70 border border-blue-800'} ${interaction?.layerId === layer.id ? 'cursor-grabbing' : layer.isLocked ? 'cursor-not-allowed' : 'cursor-grab'}`} style={{ top: `${index * LAYER_TRACK_HEIGHT}px`, left: framesToPixels(layer.from), width: framesToPixels(layer.duration) }} onPointerDown={(e) => handleLayerPointerDown(e, layer.id, 'move')}>
                                    <div className={`absolute left-0 top-0 h-full w-2 z-20 ${layer.isLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'}`} onPointerDown={(e) => handleLayerPointerDown(e, layer.id, 'trim-start')} />
                                    <span className="pl-3 pr-3 pointer-events-none whitespace-nowrap overflow-hidden">{layer.name}</span>
                                    {layer.isLocked && <div className="absolute inset-0 locked-layer-bg pointer-events-none" />}
                                    <div className="absolute inset-0 w-full h-full pointer-events-none">
                                        {Object.keys(layer.properties).flatMap(propName => {
                                            const prop = layer.properties[propName as keyof Layer['properties']];
                                            return prop?.keyframes?.map(kf => (<div key={`${propName}-${kf.frame}`} title={`Keyframe at frame ${layer.from + kf.frame} (${propName}: ${kf.value})`} className="absolute w-2.5 h-2.5 bg-yellow-400 transform -translate-x-1/2 rotate-45 z-30 pointer-events-auto cursor-pointer hover:bg-yellow-300" style={{ left: `${framesToPixels(kf.frame)}px`, top: `calc(50% - 5px)` }} onClick={(e) => { e.stopPropagation(); onFrameChange(layer.from + kf.frame); }} onContextMenu={(e) => handleKeyframeContextMenu(e, layer.id, propName, kf.frame)} />)) ?? [];
                                        })}
                                    </div>
                                    <div className={`absolute right-0 top-0 h-full w-2 z-20 ${layer.isLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'}`} onPointerDown={(e) => handleLayerPointerDown(e, layer.id, 'trim-end')} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            {contextMenu && (
                <div className="absolute z-50 bg-gray-900 border border-gray-600 rounded-md shadow-lg text-white text-sm" style={{ top: contextMenu.y, left: contextMenu.x }} onPointerDown={e => e.stopPropagation()}>
                    <div className="p-2 font-semibold border-b border-gray-700">Interpolation</div>
                    <ul className="py-1">
                        <li className="px-4 py-1.5 hover:bg-gray-700 cursor-pointer" onClick={() => handleInterpolationChange('linear')}>Linear</li>
                        <li className="px-4 py-1.5 hover:bg-gray-700 cursor-pointer" onClick={() => handleInterpolationChange('ease-in')}>Ease In</li>
                        <li className="px-4 py-1.5 hover:bg-gray-700 cursor-pointer" onClick={() => handleInterpolationChange('ease-out')}>Ease Out</li>
                        <li className="px-4 py-1.5 hover:bg-gray-700 cursor-pointer" onClick={() => handleInterpolationChange('ease-in-out')}>Ease In-Out</li>
                    </ul>
                </div>
            )}
        </div>
    );
};