import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { resolveCubicControls, type MineCanvasHandleSide } from './mineCanvasGeometry';
import type { MineCanvasEdge } from './mineCanvasTypes';
export function MineCanvasEdgeComponent(p: EdgeProps<MineCanvasEdge>) {
  const controls = resolveCubicControls({
    source: { x: p.sourceX, y: p.sourceY }, target: { x: p.targetX, y: p.targetY },
    sourceHandle: (p.sourceHandleId ?? p.sourcePosition) as MineCanvasHandleSide,
    targetHandle: (p.targetHandleId ?? p.targetPosition) as MineCanvasHandleSide,
    sourceControl: p.data?.sourceControl, targetControl: p.data?.targetControl,
  });
  const path = `M ${p.sourceX} ${p.sourceY} C ${controls.sourceControl.x} ${controls.sourceControl.y} ${controls.targetControl.x} ${controls.targetControl.y} ${p.targetX} ${p.targetY}`;
  return <BaseEdge id={p.id} path={path} style={p.style} markerEnd={p.markerEnd} markerStart={p.markerStart} />;
}
