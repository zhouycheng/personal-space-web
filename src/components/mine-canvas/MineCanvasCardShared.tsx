import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Crosshair,
  ExternalLink,
  Image as ImageIcon,
  Italic,
  Maximize2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useContext,
  useEffect,
  useMemo,
  type CSSProperties,
  type ElementType,
  type RefObject,
} from "react";
import { MineCanvasFloatingToolbar } from "./MineCanvasFloatingToolbar";
import { MineCanvasInlineField } from "./MineCanvasInlineField";
import { MineCanvasRuntimeContext } from "./mineCanvasRuntime";
import type { MineCanvasNodeData, MineCanvasTimelineItem } from "./mineCanvasTypes";

export const TEXT_MIN_HEIGHT = 118;
export const TIMELINE_MIN_HEIGHT = 176;

export function CardInlineField({
  as,
  className,
  fieldKey,
  multiline,
  nodeId,
  onChange,
  placeholder,
  timelineItemId,
  value,
}: {
  as?: ElementType;
  className?: string;
  fieldKey: string;
  multiline?: boolean;
  nodeId: string;
  onChange: (value: string) => void;
  placeholder?: string;
  timelineItemId?: string;
  value: string;
}) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const active = runtime?.editingNodeId === nodeId && runtime.editingFieldKey === fieldKey;

  return (
    <MineCanvasInlineField
      active={Boolean(active)}
      as={as}
      className={className}
      multiline={multiline}
      placeholder={placeholder}
      value={value}
      onBeginEdit={() => runtime?.beginEditing(nodeId, { fieldKey, timelineItemId })}
      onChange={onChange}
      onExitEdit={() => runtime?.finishEditing()}
    />
  );
}

export function MineRichText({
  className,
  fieldKey,
  nodeId,
  onChange,
  value,
}: {
  className?: string;
  fieldKey: string;
  nodeId: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const active = runtime?.editingNodeId === nodeId && runtime.editingFieldKey === fieldKey;
  const extensions = useMemo(
    () => [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    [],
  );
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: value,
    editable: Boolean(active),
    onUpdate: ({ editor: activeEditor }) => onChange(activeEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(Boolean(active));
    if (active) {
      runtime?.registerActiveEditor(nodeId, editor);
      window.setTimeout(() => editor.commands.focus("end"), 0);
    }
    return () => {
      if (active) runtime?.registerActiveEditor(nodeId, null);
    };
  }, [active, editor, nodeId, runtime]);

  useEffect(() => {
    if (!editor || active || editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [active, editor, value]);

  return (
    <div
      className={`mine-rich-text ${className || ""}${active ? " is-editing nodrag nopan nowheel" : ""}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        runtime?.beginEditing(nodeId, { fieldKey });
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export function NodeHeader({
  label,
  nodeId,
  onTitleChange,
  title,
}: {
  label: string;
  nodeId: string;
  onTitleChange: (title: string) => void;
  title: string;
}) {
  return (
    <header className="mine-node-header">
      <span>{label}</span>
      <CardInlineField as="strong" fieldKey="title" nodeId={nodeId} value={title} onChange={onTitleChange} />
    </header>
  );
}

export function RichTextTools() {
  const runtime = useContext(MineCanvasRuntimeContext);
  const editor = runtime?.activeEditor;
  if (!editor) return null;

  const preserveSelection = (event: React.MouseEvent) => event.preventDefault();

  return (
    <>
      <button type="button" aria-label="粗体" className={editor.isActive("bold") ? "is-active" : ""} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </button>
      <button type="button" aria-label="斜体" className={editor.isActive("italic") ? "is-active" : ""} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </button>
      <select aria-label="字号" defaultValue="" onChange={(event) => event.target.value && editor.chain().focus().setFontSize(event.target.value).run()}>
        <option value="">字号</option>
        {[12, 14, 16, 18, 24, 32].map((size) => <option value={`${size}px`} key={size}>{size}</option>)}
      </select>
      <input type="color" aria-label="文字颜色" defaultValue="#002fa7" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
      <button type="button" aria-label="左对齐" className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={15} />
      </button>
      <button type="button" aria-label="居中" className={editor.isActive({ textAlign: "center" }) ? "is-active" : ""} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={15} />
      </button>
      <button type="button" aria-label="右对齐" className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""} onMouseDown={preserveSelection} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={15} />
      </button>
      <select
        aria-label="自定义字体"
        disabled={!runtime || runtime.fonts.length === 0}
        defaultValue=""
        onChange={(event) => event.target.value && editor.chain().focus().setFontFamily(event.target.value).run()}
      >
        <option value="">{runtime && runtime.fonts.length > 0 ? "字体" : "无字体文件"}</option>
        {runtime?.fonts.map((font) => <option value={font.family} key={font.family}>{font.family}</option>)}
      </select>
      <span className="mine-toolbar-divider" aria-hidden="true" />
    </>
  );
}

export function TimelineTools({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "timeline" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const activeItem = data.items.find((item) => item.id === runtime?.activeTimelineItemId);
  const updateItem = (patch: Partial<MineCanvasTimelineItem>) => {
    if (!activeItem) return;
    update((current) => current.kind === "timeline" ? { ...current, items: current.items.map((item) => item.id === activeItem.id ? { ...item, ...patch } : item) } : current);
  };

  const addItem = () => {
    const item: MineCanvasTimelineItem = {
      id: `time-${Date.now()}`,
      time: "2026",
      title: "新的时间节点",
      subtitle: "补充副标题",
      color: "#3f79d8",
      hollow: true,
    };
    update((current) => current.kind === "timeline" ? { ...current, items: current.items.concat(item) } : current);
    runtime?.beginEditing(nodeId, { fieldKey: `timeline-${item.id}-title`, timelineItemId: item.id });
  };

  return (
    <>
      <button type="button" aria-label="新增时间节点" onClick={addItem}><Plus size={15} /></button>
      {activeItem ? (
        <>
          <input type="color" aria-label="时间节点颜色" value={activeItem.color} onChange={(event) => updateItem({ color: event.target.value })} />
          <button type="button" className={activeItem.hollow ? "is-active" : ""} onClick={() => updateItem({ hollow: !activeItem.hollow })}>空心</button>
          <button
            type="button"
            aria-label="删除时间节点"
            disabled={data.items.length <= 1}
            onClick={() => update((current) => current.kind === "timeline" && current.items.length > 1 ? { ...current, items: current.items.filter((item) => item.id !== activeItem.id) } : current)}
          >
            <Trash2 size={15} />
          </button>
        </>
      ) : null}
      <span className="mine-toolbar-divider" aria-hidden="true" />
    </>
  );
}

export function CardToolbar({
  contentRef,
  data,
  nodeId,
  reference,
  update,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  data: MineCanvasNodeData;
  nodeId: string;
  reference: HTMLElement | null;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const open = runtime?.editingNodeId === nodeId;

  const fitText = () => {
    if (data.kind !== "text") return;
    const height = Math.max(TEXT_MIN_HEIGHT, Math.ceil((contentRef.current?.scrollHeight || TEXT_MIN_HEIGHT) + 28));
    update((current) => current.kind === "text" ? { ...current, heightMode: "auto", height } : current);
  };

  return (
    <MineCanvasFloatingToolbar reference={reference} open={Boolean(open)}>
      {(data.kind === "text" || data.kind === "quote") ? <RichTextTools /> : null}
      {data.kind === "text" ? <button type="button" aria-label="适应内容" onClick={fitText}><Maximize2 size={15} /></button> : null}
      {data.kind === "image" ? <button type="button" aria-label="更换图片" onClick={() => runtime?.requestImageFile(nodeId)}><ImageIcon size={15} /></button> : null}
      {data.kind === "timeline" ? <TimelineTools data={data} nodeId={nodeId} update={update} /> : null}
      {runtime?.isAuthor && (
        <button
          type="button"
          className={runtime.centerNodeId === nodeId ? "is-active" : ""}
          aria-label={runtime.centerNodeId === nodeId ? "取消中心点" : "设为画布中心点"}
          title={runtime.centerNodeId === nodeId ? "取消中心点" : "设为画布中心点"}
          onClick={() => runtime.setCenterNodeId(nodeId)}
        >
          <Crosshair size={15} />
        </button>
      )}
      <button type="button" className="is-danger" aria-label={`删除 ${data.title}`} onClick={() => runtime?.deleteNode(nodeId)}><Trash2 size={15} /></button>
    </MineCanvasFloatingToolbar>
  );
}
