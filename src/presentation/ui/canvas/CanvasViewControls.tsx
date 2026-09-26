import { useReactFlow, useStore } from '@xyflow/react';
import { memo } from 'react';

/** Zoom updates only the controls; card content and edge derivation remain unchanged. */
export const CanvasViewControls = memo(function CanvasViewControls({ onFit }: { onFit: () => void }) {
  const zoom = useStore(state => Math.round(state.transform[2] * 100));
  const { zoomIn, zoomOut } = useReactFlow();
  return <div className="canvas-view-controls nodrag nopan" aria-label="画布视角">
    <button onClick={onFit}>查看全图</button>
    <button aria-label="缩小" onClick={() => void zoomOut()}>−</button>
    <output>{zoom}%</output>
    <button aria-label="放大" onClick={() => void zoomIn()}>＋</button>
  </div>;
});
