import { CalendarDays } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData, MineCanvasTimelineItem } from "../mineCanvasTypes";
import { CardInlineField } from "../MineCanvasCardShared";

function TimelineCard({ contentRef, data, nodeId, update }: {
  contentRef: RefObject<HTMLDivElement | null>;
  data: Extract<MineCanvasNodeData, { kind: "timeline" }>;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const updateItem = (itemId: string, patch: Partial<MineCanvasTimelineItem>) => update((current) => current.kind === "timeline" ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : current);
  return (
    <div className="mine-card mine-card--timeline">
      <div className="mine-card-measure" ref={contentRef}>
        <header className="mine-timeline-title">
          <span aria-hidden="true" />
          <CardInlineField as="h3" fieldKey="title" nodeId={nodeId} value={data.title} onChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
        </header>
        <ol className="mine-timeline-list">
          {data.items.map((item) => (
            <li key={item.id}>
              <span className={`mine-timeline-dot${item.hollow ? " is-hollow" : ""}`} style={{ "--timeline-color": item.color } as CSSProperties} aria-hidden="true" />
              <div>
                <CardInlineField as="time" fieldKey={`timeline-${item.id}-time`} timelineItemId={item.id} nodeId={nodeId} value={item.time} onChange={(time) => updateItem(item.id, { time })} />
                <CardInlineField as="strong" fieldKey={`timeline-${item.id}-title`} timelineItemId={item.id} nodeId={nodeId} value={item.title} onChange={(title) => updateItem(item.id, { title })} />
                <CardInlineField as="p" multiline fieldKey={`timeline-${item.id}-subtitle`} timelineItemId={item.id} nodeId={nodeId} value={item.subtitle} onChange={(subtitle) => updateItem(item.id, { subtitle })} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

registerCard({
  kind: "timeline",
  label: "时间节点卡",
  accent: "#3f79d8",
  defaultSize: { width: 330, height: 220 },
  icon: CalendarDays,
  createDefaultData: () => ({
    kind: "timeline",
    title: "新时间节点卡",
    accent: "#3f79d8",
    width: 330,
    height: 220,
    items: [{ id: `time-${Date.now()}`, time: "2026", title: "新的时间节点", subtitle: "补充这段经历的副标题", color: "#3f79d8", hollow: true }],
  }),
  Component: TimelineCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
