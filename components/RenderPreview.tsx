
import { useParams, useSearchParams } from 'react-router-dom';
import { projectData } from '../data/project';
import { LayerRenderer } from './LayerRenderer';
import { RENDER_WIDTH, RENDER_HEIGHT } from '../constants';

const RenderPreview = () => {
  const { compositionId } = useParams();
  const [searchParams] = useSearchParams();
  const frame = Number(searchParams.get('frame') || '0');
  
  const activeComp = projectData.find(c => c.id === compositionId);

  if (!activeComp) return <div className="flex items-center justify-center h-screen w-screen bg-red-900 text-white text-2xl">Composition not found</div>;

  return (
    <div id="render-root" className="relative overflow-hidden bg-white" style={{ width: RENDER_WIDTH, height: RENDER_HEIGHT }}>
      {activeComp.layers.map(layer => <LayerRenderer key={layer.id} layer={layer} frame={frame} />)}
    </div>
  );
};

export default RenderPreview;
