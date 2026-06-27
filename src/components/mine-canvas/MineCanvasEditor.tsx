import "@xyflow/react/dist/style.css";
import "./mine-canvas.css";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  reconnectEdge,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnMove,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  CalendarDays,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  Plus,
  Quote,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { MineCanvasEdgeComponent } from "./MineCanvasEdge";
import { MineCanvasNodeCard } from "./MineCanvasNodeCard";
import { inferHandlePair, toControlOffset, type MineCanvasHandleSide } from "./mineCanvasGeometry";
import { mineCanvasFonts } from "./mineCanvasFonts";
import { MineCanvasRuntimeContext, type BeginMineCanvasEditOptions } from "./mineCanvasRuntime";
import { resolveMeasuredHeight } from "./mineCanvasSizing";
import type {
  MineCanvasDocument,
  MineCanvasEdge,
  MineCanvasEdgeData,
  MineCanvasNode,
  MineCanvasNodeData,
  MineCanvasNodeKind,
  MineCanvasTimelineItem,
} from "./mineCanvasTypes";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.6;
const GRID_SIZE = 32;
const OVERLAP_GAP = 34;

const EDGE_STYLE = {
  stroke: "#aebbd2",
  strokeDasharray: "5 8",
  strokeWidth: 1.6,
};

const KIND_LABELS: Record<MineCanvasNodeKind, string> = {
  text: "文字卡",
  image: "图片卡",
  quote: "引用卡",
  link: "链接卡",
  timeline: "时间节点卡",
};

const KIND_ACCENTS: Record<MineCanvasNodeKind, string> = {
  text: "#002FA7",
  image: "#6b7280",
  quote: "#3f79d8",
  link: "#002FA7",
  timeline: "#3f79d8",
};

const KIND_SIZES: Record<MineCanvasNodeKind, { width: number; height: number }> = {
  text: { width: 260, height: 170 },
  image: { width: 300, height: 190 },
  quote: { width: 270, height: 132 },
  link: { width: 278, height: 156 },
  timeline: { width: 330, height: 220 },
};

const CREATE_OPTIONS: Array<{ kind: MineCanvasNodeKind; icon: typeof Type; title: string }> = [
  { kind: "text", icon: Type, title: "文字卡" },
  { kind: "image", icon: ImageIcon, title: "图片卡" },
  { kind: "quote", icon: Quote, title: "引用卡" },
  { kind: "link", icon: LinkIcon, title: "链接卡" },
  { kind: "timeline", icon: CalendarDays, title: "时间节点卡" },
];

const NODE_TYPES = { mine: MineCanvasNodeCard };
const EDGE_TYPES = { mineCurve: MineCanvasEdgeComponent };
const DEFAULT_EDGE_OPTIONS = { type: "mineCurve" as const, style: EDGE_STYLE, data: {} as MineCanvasEdgeData };
const PRO_OPTIONS = { hideAttribution: true };

type MineCanvasEditorProps = {
  seedDocument: MineCanvasDocument;
};

function cloneDocument(document: MineCanvasDocument): MineCanvasDocument {
  return JSON.parse(JSON.stringify(document)) as MineCanvasDocument;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function htmlParagraph(text: string) {
  return `<p>${text}</p>`;
}

function syncNodeSize(node: MineCanvasNode): MineCanvasNode {
  return {
    ...node,
    width: node.data.width,
    height: node.data.height,
    measured: {
      width: node.data.width,
      height: node.data.height,
    },
    style: {
      ...node.style,
      width: node.data.width,
      height: node.data.height,
    },
  };
}

function markInteractiveNodes(nodes: MineCanvasNode[], selectedNodeId: string, editingNodeId: string) {
  return nodes.map((node) =>
    syncNodeSize({
      ...node,
      selected: node.id === selectedNodeId,
      draggable: node.id === selectedNodeId && node.id !== editingNodeId,
    }),
  );
}

function migrateNodeData(data: MineCanvasNodeData): MineCanvasNodeData {
  if (data.kind === "text") {
    const legacyBody = typeof data.body === "string" ? data.body : "";
    return {
      ...data,
      bodyHtml: data.bodyHtml || htmlParagraph(legacyBody),
      heightMode: data.heightMode || "auto",
    };
  }
  if (data.kind === "quote") {
    const legacyContent = typeof data.content === "string" ? data.content : "";
    return {
      ...data,
      contentHtml: data.contentHtml || htmlParagraph(legacyContent),
    };
  }
  return data;
}

function nodeCenter(node: MineCanvasNode) {
  return {
    x: node.position.x + node.data.width / 2,
    y: node.position.y + node.data.height / 2,
  };
}

function nodeHandlePoint(node: MineCanvasNode, side: MineCanvasHandleSide) {
  const center = nodeCenter(node);
  if (side === "top") return { x: center.x, y: node.position.y };
  if (side === "bottom") return { x: center.x, y: node.position.y + node.data.height };
  if (side === "left") return { x: node.position.x, y: center.y };
  return { x: node.position.x + node.data.width, y: center.y };
}

function isHandleSide(value: string | null | undefined): value is MineCanvasHandleSide {
  return value === "top" || value === "right" || value === "bottom" || value === "left";
}

function prepareDocument(document: MineCanvasDocument): MineCanvasDocument {
  const next = cloneDocument(document);
  const nodes = next.nodes.map((node) =>
    syncNodeSize({
      ...node,
      type: "mine",
      selected: false,
      draggable: false,
      data: {
        ...migrateNodeData(node.data),
        accent: node.data.accent || KIND_ACCENTS[node.data.kind],
        width: node.data.width || KIND_SIZES[node.data.kind].width,
        height: node.data.height || KIND_SIZES[node.data.kind].height,
      } as MineCanvasNodeData,
    }),
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges = next.edges.map((edge) => {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);
    const inferred = sourceNode && targetNode
      ? inferHandlePair(nodeCenter(sourceNode), nodeCenter(targetNode))
      : { sourceHandle: "right" as const, targetHandle: "left" as const };
    const sourceHandle = isHandleSide(edge.sourceHandle) ? edge.sourceHandle : inferred.sourceHandle;
    const targetHandle = isHandleSide(edge.targetHandle) ? edge.targetHandle : inferred.targetHandle;
    const data: MineCanvasEdgeData = { ...(edge.data || {}) };

    if (data.control && sourceNode && targetNode) {
      data.sourceControl = toControlOffset(nodeHandlePoint(sourceNode, sourceHandle), data.control);
      data.targetControl = toControlOffset(nodeHandlePoint(targetNode, targetHandle), data.control);
      delete data.control;
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
      type: "mineCurve" as const,
      selected: false,
      style: { ...EDGE_STYLE, ...(edge.style || {}) },
      data,
    };
  });

  return {
    version: 3,
    viewport: {
      x: Number.isFinite(next.viewport?.x) ? next.viewport.x : 0,
      y: Number.isFinite(next.viewport?.y) ? next.viewport.y : 0,
      zoom: clamp(Number.isFinite(next.viewport?.zoom) ? next.viewport.zoom : 0.8, MIN_ZOOM, MAX_ZOOM),
    },
    nodes: markInteractiveNodes(nodes, "", ""),
    edges,
  };
}

function createDefaultNodeData(kind: MineCanvasNodeKind): MineCanvasNodeData {
  const size = KIND_SIZES[kind];
  if (kind === "text") {
    return { kind, title: "新文字卡", bodyHtml: htmlParagraph("双击文字后，直接在卡片里写内容。"), heightMode: "auto", accent: KIND_ACCENTS[kind], ...size };
  }
  if (kind === "image") {
    return { kind, title: "新图片卡", accent: KIND_ACCENTS[kind], ...size, fileName: "点击选择图片", naturalRatio: 1.58 };
  }
  if (kind === "quote") {
    return { kind, title: "新引用卡", contentHtml: htmlParagraph("写下一句你想反复看到的话。"), author: "Unknown", accent: KIND_ACCENTS[kind], ...size };
  }
  if (kind === "link") {
    return { kind, title: "新链接卡", summary: "双击这里修改链接简介。", url: "https://", accent: KIND_ACCENTS[kind], ...size };
  }
  const item: MineCanvasTimelineItem = { id: `time-${Date.now()}`, time: "2026", title: "新的时间节点", subtitle: "补充这段经历的副标题", color: "#3f79d8", hollow: true };
  return { kind, title: "新时间节点卡", accent: KIND_ACCENTS[kind], ...size, items: [item] };
}

function getNodeRect(node: MineCanvasNode) {
  return { x: node.position.x, y: node.position.y, width: node.data.width, height: node.data.height };
}

function overlaps(a: ReturnType<typeof getNodeRect>, b: ReturnType<typeof getNodeRect>) {
  return !(a.x + a.width + OVERLAP_GAP <= b.x || b.x + b.width + OVERLAP_GAP <= a.x || a.y + a.height + OVERLAP_GAP <= b.y || b.y + b.height + OVERLAP_GAP <= a.y);
}

function findOpenPosition(nodes: MineCanvasNode[], base: { x: number; y: number }, size: { width: number; height: number }) {
  const existingRects = nodes.map(getNodeRect);
  const candidates = [base];
  for (let ring = 1; ring <= 11; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      candidates.push({ x: base.x + dx * GRID_SIZE, y: base.y - ring * GRID_SIZE });
      candidates.push({ x: base.x + dx * GRID_SIZE, y: base.y + ring * GRID_SIZE });
    }
    for (let dy = -ring + 1; dy <= ring - 1; dy += 1) {
      candidates.push({ x: base.x - ring * GRID_SIZE, y: base.y + dy * GRID_SIZE });
      candidates.push({ x: base.x + ring * GRID_SIZE, y: base.y + dy * GRID_SIZE });
    }
  }
  return candidates.find((candidate) => existingRects.every((rect) => !overlaps({ ...candidate, ...size }, rect))) || base;
}

function isBlobUrl(src?: string): src is string {
  return typeof src === "string" && src.startsWith("blob:");
}

function MineCanvasMiniMap({ onMapClick }: { onMapClick: (event: unknown, position: { x: number; y: number }) => void }) {
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);
  useEffect(() => setPortalRoot(window.document.querySelector("[data-mine-canvas-minimap-slot]")), []);
  const minimap = (
    <MiniMap<MineCanvasNode>
      className="mine-canvas-minimap"
      position="bottom-left"
      pannable
      zoomable={false}
      offsetScale={9}
      nodeBorderRadius={5}
      nodeStrokeWidth={1.5}
      nodeColor={(node) => node.data.accent}
      nodeStrokeColor={() => "#f9f7ed"}
      bgColor="rgba(252, 250, 241, 0.95)"
      maskColor="rgba(0, 47, 167, 0.08)"
      maskStrokeColor="rgba(0, 47, 167, 0.32)"
      maskStrokeWidth={1.4}
      onClick={onMapClick}
      ariaLabel="我的画布概览图"
    />
  );
  return portalRoot ? createPortal(minimap, portalRoot) : minimap;
}

export default function MineCanvasEditor({ seedDocument }: MineCanvasEditorProps) {
  const initialDocument = useMemo(() => prepareDocument(seedDocument), [seedDocument]);
  const [nodes, setNodes] = useState<MineCanvasNode[]>(initialDocument.nodes);
  const [edges, setEdges] = useState<MineCanvasEdge[]>(initialDocument.edges);
  const [viewport, setViewport] = useState(initialDocument.viewport);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [editingNodeId, setEditingNodeId] = useState("");
  const [editingFieldKey, setEditingFieldKey] = useState("");
  const [activeTimelineItemId, setActiveTimelineItemId] = useState("");
  const [activeEditor, setActiveEditor] = useState<import("@tiptap/react").Editor | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [activeLinkNodeId, setActiveLinkNodeId] = useState("");
  const flowInstance = useRef<ReactFlowInstance<MineCanvasNode, MineCanvasEdge> | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageNodeId = useRef("");
  const objectUrls = useRef<Set<string>>(new Set());
  const activeEditorNodeId = useRef("");
  const zoomPercent = Math.round(viewport.zoom * 100);

  useEffect(() => {
    if (mineCanvasFonts.length === 0) return;
    const style = window.document.createElement("style");
    style.dataset.mineCanvasFonts = "true";
    style.textContent = mineCanvasFonts.map((font) => `@font-face { font-family: "${font.family}"; src: url("${font.url}"); font-display: swap; }`).join("\n");
    window.document.head.append(style);
    return () => style.remove();
  }, []);

  const releaseObjectUrl = useCallback((src?: string) => {
    if (!isBlobUrl(src) || !objectUrls.current.has(src)) return;
    window.URL.revokeObjectURL(src);
    objectUrls.current.delete(src);
  }, []);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => window.URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const finishEditing = useCallback(() => {
    setEditingNodeId("");
    setEditingFieldKey("");
    setActiveTimelineItemId("");
    setActiveEditor(null);
    activeEditorNodeId.current = "";
  }, []);

  const beginEditing = useCallback((nodeId: string, options: BeginMineCanvasEditOptions) => {
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditingFieldKey(options.fieldKey);
    setActiveTimelineItemId(options.timelineItemId || "");
    setActiveEditor(null);
    activeEditorNodeId.current = "";
    setCreatePanelOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editingNodeId) finishEditing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingNodeId, finishEditing]);

  const selectNode = useCallback((nodeId: string) => {
    if (editingNodeId && editingNodeId !== nodeId) {
      setEditingNodeId("");
      setEditingFieldKey("");
      setActiveTimelineItemId("");
      setActiveEditor(null);
    }
    setSelectedNodeId(nodeId);
    setCreatePanelOpen(false);
    setNodes((current) => markInteractiveNodes(current, nodeId, editingNodeId === nodeId ? nodeId : ""));
  }, [editingNodeId]);

  const clearSelection = useCallback(() => {
    setSelectedNodeId("");
    setEditingNodeId("");
    setEditingFieldKey("");
    setActiveTimelineItemId("");
    setActiveEditor(null);
    setNodes((current) => markInteractiveNodes(current, "", ""));
  }, []);

  const updateNodeSize = useCallback((nodeId: string, width: number, height: number) => {
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        if (node.id !== nodeId || (node.data.width === nextWidth && node.data.height === nextHeight)) return node;
        changed = true;
        return syncNodeSize({ ...node, data: { ...node.data, width: nextWidth, height: nextHeight } as MineCanvasNodeData });
      });
      return changed ? markInteractiveNodes(next, selectedNodeId, editingNodeId) : current;
    });
  }, [editingNodeId, selectedNodeId]);

  const updateNodeData = useCallback((nodeId: string, updater: (data: MineCanvasNodeData) => MineCanvasNodeData) => {
    setNodes((current) => markInteractiveNodes(current.map((node) => node.id === nodeId ? syncNodeSize({ ...node, data: updater(node.data) }) : node), selectedNodeId, editingNodeId));
  }, [editingNodeId, selectedNodeId]);

  const reportNodeHeight = useCallback((nodeId: string, measuredHeight: number, minimumHeight: number) => {
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        if (node.id !== nodeId || (node.data.kind !== "text" && node.data.kind !== "timeline")) return node;
        const mode = node.data.kind === "text" ? node.data.heightMode : "auto";
        const height = resolveMeasuredHeight(mode, node.data.height, measuredHeight, minimumHeight);
        if (height === node.data.height) return node;
        changed = true;
        return syncNodeSize({ ...node, data: { ...node.data, height } });
      });
      return changed ? markInteractiveNodes(next, selectedNodeId, editingNodeId) : current;
    });
  }, [editingNodeId, selectedNodeId]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((current) => {
      const target = current.find((node) => node.id === nodeId);
      if (target?.data.kind === "image") releaseObjectUrl(target.data.src);
      return current.filter((node) => node.id !== nodeId);
    });
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId("");
    if (editingNodeId === nodeId) finishEditing();
    if (activeLinkNodeId === nodeId) setActiveLinkNodeId("");
  }, [activeLinkNodeId, editingNodeId, finishEditing, releaseObjectUrl, selectedNodeId]);

  const focusNode = useCallback((node: MineCanvasNode) => {
    const instance = flowInstance.current;
    if (!instance) return;
    selectNode(node.id);
    void instance.setCenter(node.position.x + node.data.width / 2, node.position.y + node.data.height / 2, { zoom: Math.max(viewport.zoom, 0.72), duration: 320 });
    window.setTimeout(() => setViewport(instance.getViewport()), 350);
  }, [selectNode, viewport.zoom]);

  const handleNodesChange = useCallback((changes: NodeChange<MineCanvasNode>[]) => {
    setNodes((current) => markInteractiveNodes(applyNodeChanges(changes, current), selectedNodeId, editingNodeId));
  }, [editingNodeId, selectedNodeId]);

  const handleEdgesChange = useCallback((changes: EdgeChange<MineCanvasEdge>[]) => setEdges((current) => applyEdgeChanges(changes, current)), []);

  const handleConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}`, type: "mineCurve", style: EDGE_STYLE, data: {} }, current));
  }, []);

  const handleReconnect = useCallback((oldEdge: MineCanvasEdge, connection: Connection) => {
    const sourceChanged = oldEdge.source !== connection.source || oldEdge.sourceHandle !== connection.sourceHandle;
    const targetChanged = oldEdge.target !== connection.target || oldEdge.targetHandle !== connection.targetHandle;
    setEdges((current) => reconnectEdge(oldEdge, connection, current, { shouldReplaceId: false }).map((edge) => edge.id === oldEdge.id ? {
      ...edge,
      data: {
        ...(edge.data || {}),
        sourceControl: sourceChanged ? undefined : edge.data?.sourceControl,
        targetControl: targetChanged ? undefined : edge.data?.targetControl,
        control: undefined,
      },
    } : edge));
  }, []);

  const updateEdgeControl = useCallback((edgeId: string, field: "sourceControl" | "targetControl", offset: { dx: number; dy: number }) => {
    setEdges((current) => current.map((edge) => edge.id === edgeId ? {
      ...edge,
      data: { ...(edge.data || {}), [field]: offset, control: undefined },
    } : edge));
  }, []);

  const handleSelectionChange: OnSelectionChangeFunc<MineCanvasNode, MineCanvasEdge> = useCallback(({ nodes: selectedNodes }) => {
    const nodeId = selectedNodes[0]?.id || "";
    setSelectedNodeId(nodeId);
    if (!nodeId && editingNodeId) finishEditing();
  }, [editingNodeId, finishEditing]);

  const handleMove: OnMove = useCallback((_, nextViewport) => setViewport(nextViewport), []);

  const getViewportCenter = useCallback((size: { width: number; height: number }) => {
    const instance = flowInstance.current;
    const bounds = flowWrapRef.current?.getBoundingClientRect();
    if (!instance || !bounds) return { x: Math.round((-viewport.x + 640) / viewport.zoom - size.width / 2), y: Math.round((-viewport.y + 360) / viewport.zoom - size.height / 2) };
    const sidebar = window.document.querySelector(".mine-canvas-sidebar")?.getBoundingClientRect();
    const screenPoint = { x: sidebar ? sidebar.right + (bounds.right - sidebar.right) / 2 : bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const flowPoint = instance.screenToFlowPosition(screenPoint);
    return { x: Math.round(flowPoint.x - size.width / 2), y: Math.round(flowPoint.y - size.height / 2) };
  }, [viewport]);

  const addNode = useCallback((kind: MineCanvasNodeKind) => {
    const data = createDefaultNodeData(kind);
    const size = { width: data.width, height: data.height };
    const id = `node-${kind}-${Date.now()}`;
    const nextNode = syncNodeSize({ id, type: "mine", position: findOpenPosition(nodes, getViewportCenter(size), size), selected: true, draggable: true, data });
    setNodes((current) => markInteractiveNodes(current.concat(nextNode), id, ""));
    setSelectedNodeId(id);
    setCreatePanelOpen(false);
    if (kind === "image") {
      pendingImageNodeId.current = id;
      window.setTimeout(() => fileInputRef.current?.click(), 80);
    }
  }, [getViewportCenter, nodes]);

  const requestImageFile = useCallback((nodeId: string) => {
    pendingImageNodeId.current = nodeId;
    selectNode(nodeId);
    fileInputRef.current?.click();
  }, [selectNode]);

  const handleImageFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const nodeId = pendingImageNodeId.current;
    event.target.value = "";
    if (!file || !nodeId) return;
    const src = window.URL.createObjectURL(file);
    objectUrls.current.add(src);
    const preview = new window.Image();
    preview.onload = () => {
      const naturalRatio = preview.naturalWidth > 0 && preview.naturalHeight > 0 ? preview.naturalWidth / preview.naturalHeight : 1.58;
      updateNodeData(nodeId, (data) => {
        if (data.kind !== "image") return data;
        releaseObjectUrl(data.src);
        const width = data.width || KIND_SIZES.image.width;
        return { ...data, src, fileName: file.name, naturalRatio, width, height: clamp(Math.round(width / naturalRatio), 112, 390) };
      });
    };
    preview.onerror = () => releaseObjectUrl(src);
    preview.src = src;
  }, [releaseObjectUrl, updateNodeData]);

  const zoomTo = useCallback((zoom: number) => {
    const instance = flowInstance.current;
    if (!instance) return;
    void instance.zoomTo(clamp(zoom, MIN_ZOOM, MAX_ZOOM), { duration: 180 });
    window.setTimeout(() => setViewport(instance.getViewport()), 210);
  }, []);

  const handleMiniMapClick = useCallback((_event: unknown, position: { x: number; y: number }) => {
    const instance = flowInstance.current;
    if (!instance) return;
    void instance.setCenter(position.x, position.y, { zoom: viewport.zoom, duration: 280 });
    window.setTimeout(() => setViewport(instance.getViewport()), 310);
  }, [viewport.zoom]);

  const registerActiveEditor = useCallback((nodeId: string, editor: import("@tiptap/react").Editor | null) => {
    if (editor) {
      activeEditorNodeId.current = nodeId;
      setActiveEditor(editor);
    } else if (activeEditorNodeId.current === nodeId) {
      activeEditorNodeId.current = "";
      setActiveEditor(null);
    }
  }, []);

  const runtime = useMemo(() => ({
    activeEditor,
    activeLinkNodeId,
    activeTimelineItemId,
    editingFieldKey,
    editingNodeId,
    fonts: mineCanvasFonts,
    beginEditing,
    deleteNode,
    finishEditing,
    registerActiveEditor,
    reportNodeHeight,
    requestImageFile,
    setActiveLinkNodeId,
    setActiveTimelineItemId,
    updateNodeData,
    updateNodeSize,
    updateEdgeControl,
  }), [activeEditor, activeLinkNodeId, activeTimelineItemId, beginEditing, deleteNode, editingFieldKey, editingNodeId, finishEditing, registerActiveEditor, reportNodeHeight, requestImageFile, updateEdgeControl, updateNodeData, updateNodeSize]);

  return (
    <MineCanvasRuntimeContext.Provider value={runtime}>
      <div className="mine-canvas-editor">
        <aside className="mine-canvas-sidebar" aria-label="我的画布节点列表">
          <div className="mine-canvas-brand"><span aria-hidden="true">J</span><div><strong>Justin Canvas</strong><p>{nodes.length} 个节点</p></div></div>
          <section className="mine-canvas-layers" aria-label="全部节点">
            <div className="mine-canvas-section-title"><span aria-hidden="true">Layers</span><small>全部节点</small></div>
            <div className="mine-canvas-node-list">
              {nodes.map((node) => (
                <div className={`mine-canvas-layer${selectedNodeId === node.id ? " is-active" : ""}`} key={node.id}>
                  <button className="mine-canvas-layer-main" type="button" onClick={() => focusNode(node)}>
                    <span style={{ "--layer-accent": node.data.accent } as CSSProperties} aria-hidden="true" />
                    <strong>{node.data.title}</strong><small>{KIND_LABELS[node.data.kind]}</small>
                  </button>
                  <button className="mine-canvas-layer-delete" type="button" onClick={() => deleteNode(node.id)} aria-label={`删除 ${node.data.title}`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </section>
          <div className="mine-canvas-sidebar-bottom">
            <div className="mine-create-control">
              <button type="button" className="mine-create-toggle" onClick={() => { setCreatePanelOpen((current) => !current); clearSelection(); }} aria-label="新建节点">
                {createPanelOpen ? <X size={16} /> : <Plus size={17} />}<span>新建</span>
              </button>
              {createPanelOpen ? <CreatePanel addNode={addNode} /> : null}
            </div>
            <div className="mine-canvas-minimap-label"><span aria-hidden="true">Minimap</span><small>点击/拖拽定位</small></div>
            <div className="mine-canvas-minimap-slot" data-mine-canvas-minimap-slot />
          </div>
        </aside>

        <input ref={fileInputRef} className="mine-hidden-file" type="file" accept="image/*" onChange={handleImageFileChange} />
        <div className="mine-canvas-flow" ref={flowWrapRef}>
          <ReactFlow<MineCanvasNode, MineCanvasEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            onInit={(instance) => { flowInstance.current = instance; void instance.setViewport(viewport, { duration: 0 }); }}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onMove={handleMove}
            onNodeClick={(_, node) => selectNode(node.id)}
            onPaneClick={() => { clearSelection(); setActiveLinkNodeId(""); }}
            onSelectionChange={handleSelectionChange}
            onEdgeDoubleClick={(_, edge) => setEdges((current) => current.filter((item) => item.id !== edge.id))}
            defaultViewport={initialDocument.viewport}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            edgesReconnectable
            reconnectRadius={18}
            connectionMode={ConnectionMode.Loose}
            connectionLineType={ConnectionLineType.Bezier}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            panOnScroll={false}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            fitView={false}
            proOptions={PRO_OPTIONS}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          >
            <Background id="mine-canvas-dots" variant={BackgroundVariant.Dots} gap={32} size={1.2} color="rgba(36, 38, 46, 0.16)" />
            <MineCanvasMiniMap onMapClick={handleMiniMapClick} />
          </ReactFlow>
        </div>

        <div className="mine-canvas-zoom" aria-label="缩放控制">
          <button type="button" onClick={() => zoomTo(viewport.zoom - 0.12)} aria-label="缩小"><Minus size={16} /></button>
          <output>{zoomPercent}%</output>
          <button type="button" onClick={() => zoomTo(viewport.zoom + 0.12)} aria-label="放大"><Plus size={16} /></button>
        </div>
      </div>
    </MineCanvasRuntimeContext.Provider>
  );
}

function CreatePanel({ addNode }: { addNode: (kind: MineCanvasNodeKind) => void }) {
  return (
    <section className="mine-create-panel" aria-label="新建节点">
      {CREATE_OPTIONS.map((item) => {
        const Icon = item.icon;
        return <button type="button" key={item.kind} onClick={() => addNode(item.kind)} title={item.title}><Icon size={17} /><span>{item.title}</span></button>;
      })}
    </section>
  );
}
