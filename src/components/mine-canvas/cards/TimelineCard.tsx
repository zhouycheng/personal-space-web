import { CalendarDays } from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import { MineCanvasRuntimeContext } from "../mineCanvasRuntime";
import type { MineCanvasNodeData, MineCanvasTimelineItem } from "../mineCanvasTypes";
import { CardInlineField } from "../MineCanvasCardShared";

function TimelineCard({ contentRef, data, nodeId, update }: {
  contentRef: RefObject<HTMLDivElement | null>;
  data: Extract<MineCanvasNodeData, { kind: "timeline" }>;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const itemsRef = useRef(data.items);

  useEffect(() => { itemsRef.current = data.items; }, [data.items]);

  const updateItem = (itemId: string, patch: Partial<MineCanvasTimelineItem>) => update((current) => current.kind === "timeline" ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : current);

  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    update((current) => {
      if (current.kind !== "timeline") return current;
      const items = [...current.items];
      const [removed] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, removed);
      return { ...current, items };
    });
  }, [update]);

  const handlePointerDown = useCallback((index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0 || !runtime?.isAuthor) return;
    e.preventDefault();
    dragIndexRef.current = index;
    overIndexRef.current = index;
    setDragIndex(index);
    setOverIndex(index);
  }, [runtime?.isAuthor]);

  useEffect(() => {
    if (dragIndex === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const list = listRef.current;
      if (!list) return;
      const children = Array.from(list.children) as HTMLElement[];
      let target = children.length;
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          target = i;
          break;
        }
      }
      // Adjust: if dragging down past our own row, target stays same as index
      overIndexRef.current = target;
      setOverIndex(target);
    };

    const handlePointerUp = () => {
      const from = dragIndexRef.current;
      const to = overIndexRef.current;
      if (from !== null && to !== null && from !== to) {
        moveItem(from, to);
      }
      dragIndexRef.current = null;
      overIndexRef.current = null;
      setDragIndex(null);
      setOverIndex(null);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragIndex, moveItem]);

  return (
    <div className="mine-card mine-card--timeline">
      <div className="mine-card-measure" ref={contentRef}>
        <header className="mine-timeline-title">
          <CardInlineField as="h3" fieldKey="title" nodeId={nodeId} value={data.title} onChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
        </header>
        <ol className={`mine-timeline-list${runtime?.isAuthor ? " is-draggable" : ""}`} ref={listRef}>
          {data.items.map((item, index) => (
            <li
              key={item.id}
              className={`${dragIndex === index ? "is-dragging" : ""}${dragIndex !== null && dragIndex !== index && overIndex === index ? " is-drop-target" : ""}`}
            >
              <span
                className={`mine-timeline-dot${item.hollow ? " is-hollow" : ""}`}
                style={{ "--timeline-color": item.color } as CSSProperties}
                aria-hidden="true"
                onPointerDown={handlePointerDown(index)}
              />
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
