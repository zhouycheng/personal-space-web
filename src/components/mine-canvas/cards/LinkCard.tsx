import { ExternalLink, Link as LinkIcon } from "lucide-react";
import { useContext } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { MineCanvasRuntimeContext } from "../mineCanvasRuntime";
import { CardInlineField, NodeHeader } from "../MineCanvasCardShared";

function LinkCard({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "link" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const isOpen = runtime?.activeLinkNodeId === nodeId;
  const toggle = () => runtime?.setActiveLinkNodeId(isOpen ? "" : nodeId);
  const jump = () => data.url.trim() && window.open(data.url, "_blank", "noopener,noreferrer");
  return (
    <div className={`mine-card mine-card--link${isOpen ? " is-open" : ""}`}>
      <NodeHeader label="链接卡" nodeId={nodeId} title={data.title} onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
      <CardInlineField as="p" multiline fieldKey="summary" nodeId={nodeId} value={data.summary} onChange={(summary) => update((current) => current.kind === "link" ? { ...current, summary } : current)} />
      <CardInlineField as="small" className="mine-link-url" fieldKey="url" nodeId={nodeId} value={data.url} onChange={(url) => update((current) => current.kind === "link" ? { ...current, url } : current)} />
      <button className="mine-link-launch nodrag nopan" type="button" onClick={toggle} aria-label="打开链接确认"><ExternalLink size={18} /></button>
      <div className="mine-link-actions nodrag nopan" aria-hidden={!isOpen}>
        <button type="button" onClick={toggle}>取消</button>
        <button type="button" onClick={jump}>跳转</button>
      </div>
    </div>
  );
}

registerCard({
  kind: "link",
  label: "链接卡",
  accent: "#002FA7",
  defaultSize: { width: 278, height: 156 },
  icon: LinkIcon,
  createDefaultData: () => ({
    kind: "link",
    title: "新链接卡",
    summary: "双击这里修改链接简介。",
    url: "https://",
    accent: "#002FA7",
    width: 278,
    height: 156,
  }),
  Component: LinkCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
