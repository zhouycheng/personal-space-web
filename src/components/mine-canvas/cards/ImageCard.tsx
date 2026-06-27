import { Image as ImageIcon } from "lucide-react";
import { useContext } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { MineCanvasRuntimeContext } from "../mineCanvasRuntime";

function ImageCard({ data, nodeId }: { data: Extract<MineCanvasNodeData, { kind: "image" }>; nodeId: string }) {
  const runtime = useContext(MineCanvasRuntimeContext);
  return (
    <div className="mine-card mine-card--image" onDoubleClick={(event) => { event.stopPropagation(); runtime?.beginEditing(nodeId, { fieldKey: "image" }); }}>
      {data.src ? <img className="mine-image-preview" src={data.src} alt={data.title} draggable={false} /> : (
        <button className="mine-image-empty nodrag nopan" type="button" onClick={() => runtime?.requestImageFile(nodeId)}>
          <ImageIcon size={26} strokeWidth={1.8} />
          <span>{data.fileName || "点击选择图片"}</span>
        </button>
      )}
      <span className="mine-image-resize-corner" aria-hidden="true" />
    </div>
  );
}

registerCard({
  kind: "image",
  label: "图片卡",
  accent: "#6b7280",
  defaultSize: { width: 300, height: 190 },
  icon: ImageIcon,
  createDefaultData: () => ({
    kind: "image",
    title: "新图片卡",
    accent: "#6b7280",
    width: 300,
    height: 190,
    fileName: "点击选择图片",
    naturalRatio: 1.58,
  }),
  Component: ImageCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
