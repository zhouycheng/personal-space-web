import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ExternalLink,
  Image as ImageIcon,
  Italic,
  Maximize2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type RefObject,
} from "react";
import { MineCanvasFloatingToolbar } from "./MineCanvasFloatingToolbar";
import { MineCanvasInlineField } from "./MineCanvasInlineField";
import { MineCanvasRuntimeContext } from "./mineCanvasRuntime";
import type { MineCanvasNode, MineCanvasNodeData, MineCanvasTimelineItem } from "./mineCanvasTypes";
import { useMeasuredNodeHeight } from "./useMeasuredNodeHeight";

const TEXT_MIN_HEIGHT = 118;
const TIMELINE_MIN_HEIGHT = 176;

const KIND_LABELS = {
  text: "文字卡",
  image: "图片卡",
  quote: "引用卡",
  link: "链接卡",
  timeline: "时间节点卡",
} as const;

function CardInlineField({
  as,
  className,
  fieldKey,
  multiline,
  nodeId,
  onChange,
  timelineItemId,
  value,
}: {
  as?: ElementType;
  className?: string;
  fieldKey: string;
  multiline?: boolean;
  nodeId: string;
  onChange: (value: string) => void;
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
      value={value}
      onBeginEdit={() => runtime?.beginEditing(nodeId, { fieldKey, timelineItemId })}
      onChange={onChange}
      onExitEdit={() => runtime?.finishEditing()}
    />
  );
}

function MineRichText({
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

function NodeHeader({
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

function RichTextTools() {
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

function TimelineTools({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "timeline" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
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

function CardToolbar({
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
      <button type="button" className="is-danger" aria-label={`删除 ${data.title}`} onClick={() => runtime?.deleteNode(nodeId)}><Trash2 size={15} /></button>
    </MineCanvasFloatingToolbar>
  );
}

function TextCard({ contentRef, data, nodeId, update }: { contentRef: RefObject<HTMLDivElement | null>; data: Extract<MineCanvasNodeData, { kind: "text" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  return (
    <div className="mine-card mine-card--text">
      <div className="mine-card-measure" ref={contentRef}>
        <NodeHeader label={KIND_LABELS.text} nodeId={nodeId} title={data.title} onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
        <MineRichText className="mine-text-body" fieldKey="body" nodeId={nodeId} value={data.bodyHtml} onChange={(bodyHtml) => update((current) => current.kind === "text" ? { ...current, bodyHtml } : current)} />
      </div>
    </div>
  );
}

function QuoteCard({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "quote" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  return (
    <div className="mine-card mine-card--quote">
      <MineRichText className="mine-quote-body" fieldKey="quote" nodeId={nodeId} value={data.contentHtml} onChange={(contentHtml) => update((current) => current.kind === "quote" ? { ...current, contentHtml } : current)} />
      <CardInlineField as="small" className="mine-quote-author" fieldKey="author" nodeId={nodeId} value={`- ${data.author}`} onChange={(author) => update((current) => current.kind === "quote" ? { ...current, author: author.replace(/^-\s*/, "") } : current)} />
    </div>
  );
}

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

function LinkCard({ data, nodeId, update }: { data: Extract<MineCanvasNodeData, { kind: "link" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
  const runtime = useContext(MineCanvasRuntimeContext);
  const isOpen = runtime?.activeLinkNodeId === nodeId;
  const toggle = () => runtime?.setActiveLinkNodeId(isOpen ? "" : nodeId);
  const jump = () => data.url.trim() && window.open(data.url, "_blank", "noopener,noreferrer");
  return (
    <div className={`mine-card mine-card--link${isOpen ? " is-open" : ""}`}>
      <NodeHeader label={KIND_LABELS.link} nodeId={nodeId} title={data.title} onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))} />
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

function TimelineCard({ contentRef, data, nodeId, update }: { contentRef: RefObject<HTMLDivElement | null>; data: Extract<MineCanvasNodeData, { kind: "timeline" }>; nodeId: string; update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void }) {
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
        {data.kind === "text" ? <TextCard contentRef={contentRef} data={data} nodeId={id} update={update} /> : null}
        {data.kind === "image" ? <ImageCard data={data} nodeId={id} /> : null}
        {data.kind === "quote" ? <QuoteCard data={data} nodeId={id} update={update} /> : null}
        {data.kind === "link" ? <LinkCard data={data} nodeId={id} update={update} /> : null}
        {data.kind === "timeline" ? <TimelineCard contentRef={contentRef} data={data} nodeId={id} update={update} /> : null}
      </div>
    </article>
  );
}
