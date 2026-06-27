import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import {
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { getCard } from "../../lib/canvas/card-registry";
import { MineCanvasRuntimeContext } from "./mineCanvasRuntime";
import type { MineCanvasNode, MineCanvasNodeData } from "./mineCanvasTypes";
import { useMeasuredNodeHeight } from "./useMeasuredNodeHeight";
import { CardToolbar, TEXT_MIN_HEIGHT, TIMELINE_MIN_HEIGHT } from "./MineCanvasCardShared";

// Import card modules so they self-register
import "./cards/TextCard";
import "./cards/ImageCard";
import "./cards/QuoteCard";
import "./cards/LinkCard";
import "./cards/TimelineCard";
import "./cards/MonitorCard";

export function MineCanvasNodeCard({ data, id, isConnectable, selected }: NodeProps<MineCanvasNode>) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const [reference, setReference] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const editing = runtime?.editingNodeId === id;
  const style = { "--mine-node-accent": data.accent } as CSSProperties;

  const update = useCallback((updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => runtime?.updateNodeData(id, updater), [id, runtime]);

  useMeasuredNodeHeight(contentRef, data.kind === "text" || data.kind === "timeline", (height) => {
    runtime?.reportNodeHeight(id, height + (data.kind === "timeline" ? 36 : 28), data.kind === "text" ? TEXT_MIN_HEIGHT : TIMELINE_MIN_HEIGHT);
  });

  const cardDef = getCard(data.kind);
  const CardComponent = cardDef?.Component;

  return (
    <article ref={setReference} className={`mine-node mine-node--${data.kind}${selected ? " is-selected" : ""}${editing ? " is-editing nodrag" : ""}`} style={style}>
      <CardToolbar contentRef={contentRef} data={data} nodeId={id} reference={reference} update={update} />
      {data.kind === "image" ? (
        <NodeResizer
          isVisible={selected && !editing}
          minWidth={180}
          minHeight={112}
          maxWidth={620}
          maxHeight={390}
          keepAspectRatio
          handleClassName="mine-image-resizer-handle"
          lineClassName="mine-image-resizer-line"
          onResize={(_, params) => runtime?.updateNodeSize(id, params.width, params.height)}
          onResizeEnd={(_, params) => runtime?.updateNodeSize(id, params.width, params.height)}
        />
      ) : null}
      {data.kind === "text" ? (
        <NodeResizer
          isVisible={selected && !editing}
          minWidth={190}
          minHeight={TEXT_MIN_HEIGHT}
          maxWidth={720}
          maxHeight={760}
          keepAspectRatio={false}
          handleClassName="mine-text-resizer-handle"
          lineClassName="mine-text-resizer-line"
          onResizeStart={() => update((current) => current.kind === "text" ? { ...current, heightMode: "manual" } : current)}
          onResize={(_, params) => runtime?.updateNodeSize(id, params.width, params.height)}
          onResizeEnd={(_, params) => runtime?.updateNodeSize(id, params.width, params.height)}
        />
      ) : null}

      {([Position.Top, Position.Right, Position.Bottom, Position.Left] as const).map((position) => {
        const handleId = position.toLowerCase();
        return <Handle key={handleId} id={handleId} className={`mine-node-handle mine-node-handle--${handleId}`} type="source" position={position} isConnectable={Boolean(isConnectable && !editing)} />;
      })}

      <div className="mine-card-content">
        {CardComponent ? <CardComponent contentRef={contentRef} data={data} nodeId={id} update={update} /> : null}
      </div>
    </article>
  );
}
