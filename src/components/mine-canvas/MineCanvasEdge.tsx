import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { useCallback, useContext, type PointerEvent as ReactPointerEvent } from "react";
import {
  resolveCubicControls,
  toControlOffset,
  type CanvasPoint,
  type MineCanvasHandleSide,
} from "./mineCanvasGeometry";
import { MineCanvasRuntimeContext } from "./mineCanvasRuntime";
import type { MineCanvasEdge, MineCanvasNode } from "./mineCanvasTypes";

function sideFromPosition(position: Position): MineCanvasHandleSide {
  if (position === Position.Top) return "top";
  if (position === Position.Bottom) return "bottom";
  if (position === Position.Left) return "left";
  return "right";
}

function handleSide(handleId: string | null | undefined, position: Position) {
  return handleId === "top" || handleId === "right" || handleId === "bottom" || handleId === "left"
    ? handleId
    : sideFromPosition(position);
}

function MineEdgeControl({
  control,
  endpoint,
  edgeId,
  field,
}: {
  control: CanvasPoint;
  endpoint: CanvasPoint;
  edgeId: string;
  field: "sourceControl" | "targetControl";
}) {
  const { screenToFlowPosition } = useReactFlow<MineCanvasNode, MineCanvasEdge>();
  const runtime = useContext(MineCanvasRuntimeContext);

  const startDragging = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const moveControl = (pointerEvent: PointerEvent) => {
        pointerEvent.preventDefault();
        const nextPoint = screenToFlowPosition({ x: pointerEvent.clientX, y: pointerEvent.clientY });
        runtime?.updateEdgeControl(edgeId, field, toControlOffset(endpoint, nextPoint));
      };
      const stopDragging = () => {
        window.removeEventListener("pointermove", moveControl);
        window.removeEventListener("pointerup", stopDragging);
        window.removeEventListener("pointercancel", stopDragging);
      };

      window.addEventListener("pointermove", moveControl, { passive: false });
      window.addEventListener("pointerup", stopDragging, { once: true });
      window.addEventListener("pointercancel", stopDragging, { once: true });
    },
    [edgeId, endpoint, field, runtime, screenToFlowPosition],
  );

  const moveWithKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const amount = event.shiftKey ? 10 : 2;
      const delta = event.key === "ArrowLeft" ? { x: -amount, y: 0 }
        : event.key === "ArrowRight" ? { x: amount, y: 0 }
          : event.key === "ArrowUp" ? { x: 0, y: -amount }
            : event.key === "ArrowDown" ? { x: 0, y: amount }
              : null;
      if (!delta) return;
      event.preventDefault();
      const currentOffset = toControlOffset(endpoint, control);
      runtime?.updateEdgeControl(edgeId, field, { dx: currentOffset.dx + delta.x, dy: currentOffset.dy + delta.y });
    },
    [control, edgeId, endpoint, field, runtime],
  );

  return (
    <button
      type="button"
      className="mine-edge-control nodrag nopan"
      style={{ pointerEvents: "all", transform: `translate(-50%, -50%) translate(${control.x}px, ${control.y}px)` }}
      aria-label={field === "sourceControl" ? "调整连线起点角度" : "调整连线终点角度"}
      onPointerDown={startDragging}
      onKeyDown={moveWithKeyboard}
    />
  );
}

export function MineCanvasEdgeComponent({
  data,
  id,
  markerEnd,
  markerStart,
  selected,
  sourceHandleId,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetHandleId,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<MineCanvasEdge>) {
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const controls = resolveCubicControls({
    source,
    target,
    sourceHandle: handleSide(sourceHandleId, sourcePosition),
    targetHandle: handleSide(targetHandleId, targetPosition),
    sourceControl: data?.sourceControl,
    targetControl: data?.targetControl,
  });
  const edgePath = `M ${sourceX} ${sourceY} C ${controls.sourceControl.x} ${controls.sourceControl.y} ${controls.targetControl.x} ${controls.targetControl.y} ${targetX} ${targetY}`;
  const guidePath = `M ${sourceX} ${sourceY} L ${controls.sourceControl.x} ${controls.sourceControl.y} M ${targetX} ${targetY} L ${controls.targetControl.x} ${controls.targetControl.y}`;

  return (
    <>
      {selected ? <path className="mine-edge-guide" d={guidePath} /> : null}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} markerStart={markerStart} interactionWidth={28} style={style} />
      {selected ? (
        <EdgeLabelRenderer>
          <MineEdgeControl control={controls.sourceControl} endpoint={source} edgeId={id} field="sourceControl" />
          <MineEdgeControl control={controls.targetControl} endpoint={target} edgeId={id} field="targetControl" />
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
