import { Contact, Plus, X } from "lucide-react";
import { useContext, useRef, useState, type RefObject } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { MineCanvasRuntimeContext } from "../mineCanvasRuntime";
import { CardInlineField } from "../MineCanvasCardShared";
import { uploadCanvasAsset } from "../../../features/canvas/client/canvas-assets";

type BusinessCardData = Extract<MineCanvasNodeData, { kind: "businesscard" }>;

function BusinessCard({ contentRef, data, nodeId, update }: {
  contentRef: RefObject<HTMLDivElement | null>;
  data: BusinessCardData;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const isAuthor = runtime?.isAuthor;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [tagText, setTagText] = useState("");

  const triggerUpload = () => { if (isAuthor) fileRef.current?.click(); };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const asset = await uploadCanvasAsset(blob, `${file.name}.jpg`);
            update((current) => current.kind === "businesscard" ? {
              ...current,
              avatarAssetId: asset.id,
              avatarSrc: asset.url,
              avatarFileName: file.name,
            } : current);
          } catch {
            console.error("头像上传失败");
          }
        }, "image/jpeg", 0.85);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const startTagEdit = () => {
    setTagText(data.tags.join("、"));
    setEditingTags(true);
  };

  const commitTags = () => {
    const newTags = tagText.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    update((current) => current.kind === "businesscard" ? { ...current, tags: newTags } : current);
    setEditingTags(false);
  };

  const removeTag = (index: number) => {
    update((current) => current.kind === "businesscard" ? { ...current, tags: data.tags.filter((_, i) => i !== index) } : current);
  };

  return (
    <div className="mine-card mine-card--businesscard">
      <div className="mine-card-measure" ref={contentRef}>
        <input ref={fileRef} className="mine-hidden-file" type="file" accept="image/*" onChange={handleFile} />

        {data.avatarSrc ? (
        isAuthor ? (
          <button type="button" className="mine-bc-avatar nodrag nopan" onClick={triggerUpload} aria-label="更换头像">
            <img src={data.avatarSrc} alt={data.name || "头像"} draggable={false} />
          </button>
        ) : (
          <span className="mine-bc-avatar">
            <img src={data.avatarSrc} alt={data.name || "头像"} draggable={false} />
          </span>
        )
      ) : (
        isAuthor ? (
          <button type="button" className="mine-bc-avatar mine-bc-avatar--empty nodrag nopan" onClick={triggerUpload} aria-label="上传头像">
            <Contact size={22} strokeWidth={1.6} />
          </button>
        ) : (
          <span className="mine-bc-avatar mine-bc-avatar--empty">
            <Contact size={22} strokeWidth={1.6} />
          </span>
        )
      )}

      <CardInlineField as="strong" className="mine-bc-name" fieldKey="name" nodeId={nodeId} value={data.name} placeholder="姓名" onChange={(name) => update((current) => current.kind === "businesscard" ? { ...current, name } : current)} />

      <CardInlineField as="p" className="mine-bc-intro" multiline fieldKey="intro" nodeId={nodeId} value={data.intro} placeholder="简介" onChange={(intro) => update((current) => current.kind === "businesscard" ? { ...current, intro } : current)} />

      <div className="mine-bc-tags">
        {data.tags.map((tag, i) => (
          <span className="mine-bc-tag" key={`${tag}-${i}`}>
            {tag}
            {isAuthor ? <button type="button" className="nodrag nopan" aria-label={`删除标签 ${tag}`} onClick={() => removeTag(i)}><X size={10} strokeWidth={2.5} /></button> : null}
          </span>
        ))}
        {isAuthor ? (editingTags ? (
          <input
            className="mine-bc-tag-input nodrag nopan"
            autoFocus
            value={tagText}
            placeholder="标签，用逗号分隔"
            onChange={(event) => setTagText(event.target.value)}
            onBlur={commitTags}
            onKeyDown={(event) => { if (event.key === "Enter") commitTags(); if (event.key === "Escape") setEditingTags(false); }}
          />
        ) : (
          <button type="button" className="mine-bc-tag mine-bc-tag--add nodrag nopan" onClick={startTagEdit} aria-label="添加标签">
            <Plus size={12} strokeWidth={2.5} />
          </button>
        )) : null}
      </div>
      </div>
    </div>
  );
}

registerCard({
  kind: "businesscard",
  label: "名片卡",
  accent: "#002FA7",
  defaultSize: { width: 280, height: 188 },
  icon: Contact,
  createDefaultData: () => ({
    kind: "businesscard",
    title: "名片卡",
    accent: "#002FA7",
    width: 280,
    height: 188,
    name: "张三",
    intro: "产品设计师 / 前端开发者",
    tags: ["设计", "前端"],
  }),
  Component: BusinessCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
