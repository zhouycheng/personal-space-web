import { Quote } from "lucide-react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { CardInlineField, MineRichText } from "../MineCanvasCardShared";

function QuoteCard({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "quote" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  return (
    <div className="mine-card mine-card--quote">
      <MineRichText className="mine-quote-body" fieldKey="quote" nodeId={nodeId} value={data.contentHtml} onChange={(contentHtml) => update((current) => current.kind === "quote" ? { ...current, contentHtml } : current)} />
      <CardInlineField as="small" className="mine-quote-author" fieldKey="author" nodeId={nodeId} value={`- ${data.author}`} onChange={(author) => update((current) => current.kind === "quote" ? { ...current, author: author.replace(/^-\s*/, "") } : current)} />
    </div>
  );
}

registerCard({
  kind: "quote",
  label: "引用卡",
  accent: "#3f79d8",
  defaultSize: { width: 270, height: 132 },
  icon: Quote,
  createDefaultData: () => ({
    kind: "quote",
    title: "新引用卡",
    contentHtml: "<p>写下一句你想反复看到的话。</p>",
    author: "Unknown",
    accent: "#3f79d8",
    width: 270,
    height: 132,
  }),
  Component: QuoteCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
