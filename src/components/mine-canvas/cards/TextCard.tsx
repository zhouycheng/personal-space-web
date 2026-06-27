import { Type } from "lucide-react";
import type { RefObject } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { MineRichText, NodeHeader, TEXT_MIN_HEIGHT } from "../MineCanvasCardShared";

function TextCard({ contentRef, data, nodeId, update }: {
  contentRef: RefObject<HTMLDivElement | null>;
  data: Extract<MineCanvasNodeData, { kind: "text" }>;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  return (
    <div className="mine-card mine-card--text">
      <div className="mine-card-measure" ref={contentRef}>
        <NodeHeader label="文字卡" nodeId={nodeId} title={data.title} onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
        <MineRichText className="mine-text-body" fieldKey="body" nodeId={nodeId} value={data.bodyHtml} onChange={(bodyHtml) => update((current) => current.kind === "text" ? { ...current, bodyHtml } : current)} />
      </div>
    </div>
  );
}

registerCard({
  kind: "text",
  label: "文字卡",
  accent: "#002FA7",
  defaultSize: { width: 260, height: 170 },
  icon: Type,
  createDefaultData: () => ({
    kind: "text",
    title: "新文字卡",
    bodyHtml: "<p>双击文字后，直接在卡片里写内容。</p>",
    heightMode: "auto",
    accent: "#002FA7",
    width: 260,
    height: 170,
  }),
  Component: TextCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
