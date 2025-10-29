// Fix: Import React to make the React namespace available for type annotations like React.MouseEvent.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { projectData } from './data/project';
import type { Composition, Layer } from './types';
import { LayerRenderer } from './components/LayerRenderer';
import { RENDER_WIDTH, RENDER_HEIGHT } from './constants';
import { Timeline } from './components/Timeline';
import { PropertyInspector } from './components/PropertyInspector';

const PlayIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5V19L19 12L8 5Z" fill="currentColor"/></svg>;
const PauseIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" fill="currentColor"/></svg>;
const ToStartIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 12L10 5V19L18.5 12ZM5 19H7V5H5V19Z" fill="currentColor"/></svg>;
const ToEndIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 12L14 5V19L5.5 12ZM19 5H17V19H19V5Z" fill="currentColor"/></svg>;
const PrevFrameIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.41 16.59L10.83 12L15.41 7.41L14 6L8 12L14 18L15.41 16.59Z" fill="currentColor"/></svg>;
const NextFrameIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z" fill="currentColor"/></svg>;

const findLayer = (layers: Layer[], layerId: string | null): Layer | null => {
    if (!layerId) return null;
    for (const layer of layers) {
        if (layer.id === layerId) return layer;
        if (layer.children) {
            const found = findLayer(layer.children, layerId);
            if (found) return found;
        }
    }
    return null;
};

export default function App() {
    const [compositions, setCompositions] = useState<Composition[]>(projectData);
    const [selectedCompId, setSelectedCompId] = useState<string>(compositions[0].id);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [frame, setFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [scale, setScale] = useState(0.5);
    const viewportRef = useState<HTMLDivElement | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const [isRendering, setIsRendering] = useState(false);
    const [renderQueue, setRenderQueue] = useState<string[]>(['MainScene']);
    const [lastRenderedUrl, setLastRenderedUrl] = useState<string | null>(null);
    
    const activeComp = useMemo(() => compositions.find(c => c.id === selectedCompId)!, [compositions, selectedCompId]);
    const selectedLayer = useMemo(() => selectedLayerIds.length === 1 ? findLayer(activeComp.layers, selectedLayerIds[0]) : null, [activeComp, selectedLayerIds]);
    
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
        recurse(activeComp.layers, 0);
        return list;
    }, [activeComp.layers, collapsedGroups]);

    const handleCompositionChange = useCallback((newComp: Composition) => {
        setCompositions(prev => prev.map(c => c.id === newComp.id ? newComp : c));
    }, []);
    
    const handleLayerSelect = useCallback((layerId: string, e: React.MouseEvent) => {
        const { ctrlKey, metaKey, shiftKey } = e;

        if (shiftKey && selectedLayerIds.length > 0) {
            const lastSelectedId = selectedLayerIds[selectedLayerIds.length - 1];
            const lastIndex = flattenedLayers.findIndex(l => l.layer.id === lastSelectedId);
            const currentIndex = flattenedLayers.findIndex(l => l.layer.id === layerId);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const layersToSelect = flattenedLayers.slice(start, end + 1).map(l => l.layer.id);
                const newSelection = [...new Set([...selectedLayerIds, ...layersToSelect])];
                setSelectedLayerIds(newSelection);
            } else {
                 setSelectedLayerIds([layerId]);
            }
        } else if (ctrlKey || metaKey) {
            setSelectedLayerIds(prev =>
                prev.includes(layerId)
                    ? prev.filter(id => id !== layerId)
                    : [...prev, layerId]
            );
        } else {
            setSelectedLayerIds([layerId]);
        }
    }, [selectedLayerIds, flattenedLayers]);


    const handleSelectComp = (compId: string) => {
        setSelectedCompId(compId);
        setSelectedLayerIds([]);
        setFrame(0);
        setIsPlaying(false);
    };

    const handleFrameChange = useCallback((newFrame: number) => {
      setFrame(Math.max(0, Math.min(activeComp.durationInFrames -1, newFrame)));
    }, [activeComp.durationInFrames]);
    
    useEffect(() => {
        const calculateScale = () => { 
            if (viewportRef[0]) { 
                const { width, height } = viewportRef[0].getBoundingClientRect();
                const scaleX = (width - 32) / RENDER_WIDTH;
                const scaleY = (height - 32) / RENDER_HEIGHT;
                setScale(Math.min(scaleX, scaleY));
            } 
        };
        calculateScale(); 
        window.addEventListener('resize', calculateScale);
        return () => window.removeEventListener('resize', calculateScale);
    }, [viewportRef]);
    
    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => { 
            setFrame(f => (f + 1) % activeComp.durationInFrames); 
        }, 1000 / activeComp.fps);
        return () => clearInterval(interval);
    }, [isPlaying, activeComp]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsPlaying(p => !p);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    handleFrameChange(frame - 1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    handleFrameChange(frame + 1);
                    break;
                case 'Home':
                    e.preventDefault();
                    handleFrameChange(0);
                    break;
                case 'End':
                    e.preventDefault();
                    handleFrameChange(activeComp.durationInFrames - 1);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [frame, activeComp, handleFrameChange]);

    const handleRenderQueue = async () => {
        if (renderQueue.length === 0) { alert("Please select a composition to render."); return; }
        setIsRendering(true); setLastRenderedUrl(null);
        for (const compId of renderQueue) {
            const compToRender = compositions.find(c => c.id === compId)!;
            try {
                const response = await fetch('http://localhost:4000/render', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        compositionId: compToRender.id,
                        props: {}, 
                        durationInFrames: compToRender.durationInFrames, 
                        fps: compToRender.fps,
                    }),
                });
                const result = await response.json();
                setLastRenderedUrl(result.downloadUrl);
            } catch (error) { console.error(`Failed to render ${compId}:`, error); alert(`Failed to render ${compId}.`); break; }
        }
        setIsRendering(false);
    };
    
    const toggleInQueue = (compId: string) => { setRenderQueue(prev => prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]); };
    
    return (
      <div className="flex h-screen">
        {/* Project Panel */}
        <div className="w-[280px] bg-gray-800 p-4 shrink-0 flex flex-col gap-4 border-r border-gray-700">
          <div>
            <h3 className="text-lg font-semibold mb-2">Compositions</h3>
            <ul className="list-none p-0">{compositions.map(c => <li key={c.id} className={`py-2 px-3 rounded-md cursor-pointer mb-1 transition-colors ${c.id === selectedCompId ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`} onClick={() => handleSelectComp(c.id)}>{c.name}</li>)}</ul>
          </div>
          <div className="border-t border-gray-700 pt-4 mt-auto">
              <h3 className="text-lg font-semibold mb-2">Render Queue</h3>
              <div className="mb-4">{compositions.map(c => (<div key={c.id} className="flex items-center gap-2 mb-2"><input type="checkbox" id={`cb-${c.id}`} checked={renderQueue.includes(c.id)} onChange={() => toggleInQueue(c.id)} className="accent-blue-500"/><label htmlFor={`cb-${c.id}`}>{c.name}</label></div>))}</div>
              <button className="w-full py-3 bg-green-600 text-white font-bold rounded-md text-base cursor-pointer transition-colors hover:enabled:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-70" onClick={handleRenderQueue} disabled={isRendering || renderQueue.length === 0}>{isRendering ? 'Rendering...' : `Render (${renderQueue.length}) Selected`}</button>
              {isRendering && <div className="border-4 border-gray-600 border-t-blue-500 rounded-full w-5 h-5 animate-spin mx-auto mt-4"></div>}
              {lastRenderedUrl && (<div className="mt-4 text-sm bg-gray-700 p-3 rounded-md"><h4>Last Render:</h4><a href={lastRenderedUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Download Video</a></div>)}
          </div>
        </div>

        {/* Center Column: Preview & Timeline */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
            {/* Preview Panel */}
            <div className="flex-1 bg-black flex flex-col rounded-lg overflow-hidden border border-gray-800 min-h-0">
              <div className="flex-1 flex justify-center items-center p-4 overflow-hidden" ref={viewportRef[1]}>
                <div className="relative shadow-2xl shadow-black">
                  <div className="bg-gray-300 relative overflow-hidden" style={{ width: RENDER_WIDTH, height: RENDER_HEIGHT, transform: `scale(${scale})` }}>
                    {activeComp.layers.map(layer => <LayerRenderer key={layer.id} layer={layer} frame={frame} />)}
                  </div>
                </div>
              </div>
              <div className="flex justify-center items-center p-2 bg-gray-800 gap-2 border-t border-gray-700">
                <button onClick={() => handleFrameChange(0)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title="Go to Start"><ToStartIcon /></button>
                <button onClick={() => handleFrameChange(frame - 1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title="Previous Frame"><PrevFrameIcon /></button>
                <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <PauseIcon /> : <PlayIcon />}</button>
                <button onClick={() => handleFrameChange(frame + 1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title="Next Frame"><NextFrameIcon /></button>
                <button onClick={() => handleFrameChange(activeComp.durationInFrames - 1)} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title="Go to End"><ToEndIcon /></button>
                <div className="text-sm text-gray-400 w-32 text-center font-mono">{frame}f / {(frame / activeComp.fps).toFixed(2)}s</div>
              </div>
            </div>
            
            {/* Timeline Panel */}
            <Timeline 
              composition={activeComp}
              frame={frame}
              onFrameChange={handleFrameChange}
              selectedLayerIds={selectedLayerIds}
              onLayerSelect={handleLayerSelect}
              onClearSelection={() => setSelectedLayerIds([])}
              onCompositionChange={handleCompositionChange}
              collapsedGroups={collapsedGroups}
              onToggleGroupCollapse={(groupId) => setCollapsedGroups(p => ({...p, [groupId]: !p[groupId]}))}
            />
        </div>
        
        {/* Property Inspector */}
        <div className="w-[300px] bg-gray-800 p-4 border-l border-gray-700 overflow-y-auto timeline-scrollbar">
          <PropertyInspector 
            key={selectedLayer?.id} // Force re-mount on layer change
            selectedLayer={selectedLayer}
            selectedLayerIds={selectedLayerIds}
            composition={activeComp}
            onCompositionChange={handleCompositionChange}
            frame={frame}
            onFrameChange={setFrame}
          />
        </div>
      </div>
    );
}