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
  Minus,
  Plus,
  Trash2,
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
import { getCard, getCreateOptions } from "../../lib/canvas/card-registry";
import {
  canvasAdminHeaders,
  clearCanvasAdminTabToken,
  createCanvasAdminTabToken,
  getCanvasAdminTabToken,
  setCanvasAdminTabToken,
} from "../../features/canvas/client/canvas-admin-session";
import { createCanvasSaveQueue, type CanvasSaveStatus } from "../../features/canvas/client/canvas-save-queue";
import { uploadCanvasAsset } from "../../features/canvas/client/canvas-assets";
import { parseCanvasReadResponse } from "../../features/canvas/domain/canvas-document";
// Import card modules so they self-register before editor reads from registry
import "./cards/TextCard";
import "./cards/ImageCard";
import "./cards/QuoteCard";
import "./cards/LinkCard";
import "./cards/TimelineCard";
import "./cards/MonitorCard";
import "./cards/BusinessCard";
import { MineCanvasRuntimeContext, type BeginMineCanvasEditOptions } from "./mineCanvasRuntime";
import { resolveMeasuredHeight } from "./mineCanvasSizing";
import type {
  MineCanvasDocument,
  MineCanvasEdge,
  MineCanvasEdgeData,
  MineCanvasNode,
  MineCanvasNodeData,
  MineCanvasNodeKind,
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


const NODE_TYPES = { mine: MineCanvasNodeCard };
const EDGE_TYPES = { mineCurve: MineCanvasEdgeComponent };
const DEFAULT_EDGE_OPTIONS = { type: "mineCurve" as const, style: EDGE_STYLE, data: {} as MineCanvasEdgeData };
const PRO_OPTIONS = { hideAttribution: true };

const EMPTY_DOCUMENT: MineCanvasDocument = {
  version: 4,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 0.8 },
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
  if (
    node.measured?.width === node.data.width &&
    node.measured?.height === node.data.height &&
    node.width === node.data.width &&
    node.height === node.data.height &&
    node.style?.width === node.data.width &&
    node.style?.height === node.data.height
  ) {
    return node;
  }
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
  return nodes.map((node) => {
    const selected = node.id === selectedNodeId;
    const draggable = node.id === selectedNodeId && node.id !== editingNodeId;
    if (node.selected === selected && node.draggable === draggable) {
      return syncNodeSize(node);
    }
    return syncNodeSize({ ...node, selected, draggable });
  });
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
        accent: node.data.accent || getCard(node.data.kind)?.accent || "#002FA7",
        width: node.data.width || getCard(node.data.kind)?.defaultSize.width || 260,
        height: node.data.height || getCard(node.data.kind)?.defaultSize.height || 170,
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
    version: 4,
    viewport: {
      x: Number.isFinite(next.viewport?.x) ? next.viewport.x : 0,
      y: Number.isFinite(next.viewport?.y) ? next.viewport.y : 0,
      zoom: clamp(Number.isFinite(next.viewport?.zoom) ? next.viewport.zoom : 0.8, MIN_ZOOM, MAX_ZOOM),
    },
    nodes: markInteractiveNodes(nodes, "", ""),
    edges,
    centerNodeId: next.centerNodeId || undefined,
  };
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

export default function MineCanvasEditor() {
  const [remoteDocument, setRemoteDocument] = useState<MineCanvasDocument | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [isAuthor, setIsAuthor] = useState(false);
  const [saveStatus, setSaveStatus] = useState<CanvasSaveStatus>("idle");

  // Refs for state setters — used by global window functions to always have the latest reference
  const setIsAuthorRef = useRef(setIsAuthor);
  setIsAuthorRef.current = setIsAuthor;

  const initialDocument = useMemo(() => {
    if (remoteDocument) return prepareDocument(remoteDocument);
    return prepareDocument(EMPTY_DOCUMENT);
  }, [remoteDocument]);

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
  const [centerNodeId, setCenterNodeIdState] = useState(initialDocument.centerNodeId || "");
  const [isFlowReady, setIsFlowReady] = useState(false);
  const flowInstance = useRef<ReactFlowInstance<MineCanvasNode, MineCanvasEdge> | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageNodeId = useRef("");
  const objectUrls = useRef<Set<string>>(new Set());
  const activeEditorNodeId = useRef("");
  const saveQueueRef = useRef<ReturnType<typeof createCanvasSaveQueue<MineCanvasDocument>> | null>(null);
  const saveTimerRef = useRef<number>(0);
  const zoomPercent = Math.round(viewport.zoom * 100);

  // ---- Refs for immediate save (updated synchronously with every mutation) ----
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef(viewport);
  const centerNodeIdRef = useRef(centerNodeId);

  useEffect(() => {
    if (mineCanvasFonts.length === 0) return;
    const style = window.document.createElement("style");
    style.dataset.mineCanvasFonts = "true";
    style.textContent = mineCanvasFonts.map((font) => `@font-face { font-family: "${font.family}"; src: url("${font.url}"); font-display: swap; }`).join("\n");
    window.document.head.append(style);
    return () => style.remove();
  }, []);

  // Load canvas data from API on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/canvas")
      .then((res) => {
        if (!res.ok) throw new Error("Canvas load failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const snapshot = parseCanvasReadResponse(data);
        const loadedDocument = prepareDocument(snapshot.document as unknown as MineCanvasDocument);
        nodesRef.current = loadedDocument.nodes;
        edgesRef.current = loadedDocument.edges;
        viewportRef.current = loadedDocument.viewport;
        centerNodeIdRef.current = loadedDocument.centerNodeId || "";
        setNodes(loadedDocument.nodes);
        setEdges(loadedDocument.edges);
        setViewport(loadedDocument.viewport);
        setCenterNodeIdState(loadedDocument.centerNodeId || "");
        setRemoteDocument(loadedDocument);
        saveQueueRef.current = createCanvasSaveQueue<MineCanvasDocument>({
          initialRevision: snapshot.revision,
          onStatusChange: setSaveStatus,
          save: async (document, expectedRevision) => {
            const response = await fetch("/api/canvas", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", ...canvasAdminHeaders() },
              body: JSON.stringify({ document, expectedRevision }),
            });
            const body = await response.json();
            if (response.status === 409) {
              return { status: "conflict", revision: body.latest?.revision ?? expectedRevision };
            }
            if (!response.ok) throw new Error(body.error || "Canvas save failed");
            return { status: "saved", revision: body.revision };
          },
        });
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => { cancelled = true; };
  }, []);

  // Restore author state for this tab only. The HttpOnly cookie is shared by
  // the browser, so it must be paired with a sessionStorage tab token.
  useEffect(() => {
    localStorage.removeItem("author_password");
    sessionStorage.removeItem("author_token");
    const tabToken = getCanvasAdminTabToken();
    if (!tabToken) {
      setIsAuthor(false);
      return;
    }
    fetch("/api/canvas/session", { credentials: "same-origin", headers: canvasAdminHeaders() })
      .then((response) => response.json())
      .then((body) => setIsAuthor(Boolean(body.authenticated)))
      .catch(() => {
        clearCanvasAdminTabToken();
        setIsAuthor(false);
      });
  }, []);

  // Expose global admin activation function for console use
  useEffect(() => {
    (window as unknown as Record<string, unknown>).enableAdmin = (passphrase: string) => {
      if (!passphrase) {
        console.warn("用法：enableAdmin('你的密码')");
        return Promise.resolve(false);
      }
      return (async () => {
        const tabToken = createCanvasAdminTabToken();
        const response = await fetch("/api/canvas/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passphrase, tabToken }),
        });
        if (response.ok) {
          setCanvasAdminTabToken(tabToken);
          setIsAuthorRef.current(true);
          console.log("管理员模式已激活");
          return true;
        }
        clearCanvasAdminTabToken();
        console.warn("密码错误");
        return false;
      })();
    };

    (window as unknown as Record<string, unknown>).disposeAdmin = async () => {
      clearCanvasAdminTabToken();
      await fetch("/api/canvas/session", { method: "DELETE", credentials: "same-origin" });
      setIsAuthorRef.current(false);
      console.log("已退出管理员模式");
    };

    return () => {
      delete (window as unknown as Record<string, unknown>).enableAdmin;
      delete (window as unknown as Record<string, unknown>).disposeAdmin;
    };
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

  // -------------------------------------------------------------- save

  const flushSave = useCallback(() => {
    if (!isAuthor || loadState !== "ready") return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = 0;
    }
    saveQueueRef.current?.enqueue({
      version: 4,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewportRef.current,
      centerNodeId: centerNodeIdRef.current || undefined,
    });
  }, [isAuthor, loadState]);

  const scheduleSave = useCallback(() => {
    if (!isAuthor || loadState !== "ready") return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushSave, 400);
  }, [flushSave, isAuthor, loadState]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  // Cmd+S manual save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flushSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flushSave]);

  // --- undo / redo state ---
  const MAX_HISTORY = 50;
  const undoStack = useRef<Array<{ nodes: MineCanvasNode[]; edges: MineCanvasEdge[]; viewport: typeof viewport }>>([]);
  const redoStack = useRef<typeof undoStack.current>([]);

  const pushHistory = useCallback(() => {
    undoStack.current.push({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewportRef.current,
    });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const finishEditing = useCallback(() => {
    setEditingNodeId("");
    setEditingFieldKey("");
    setActiveTimelineItemId("");
    setActiveEditor(null);
    activeEditorNodeId.current = "";
  }, []);

  const applySnapshot = useCallback((snapshot: { nodes: MineCanvasNode[]; edges: MineCanvasEdge[]; viewport: typeof viewport }) => {
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    viewportRef.current = snapshot.viewport;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setViewport(snapshot.viewport);
    finishEditing();
    flushSave();
  }, [finishEditing, flushSave]);

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    redoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current, viewport: viewportRef.current });
    applySnapshot(snapshot);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current, viewport: viewportRef.current });
    applySnapshot(snapshot);
  }, [applySnapshot]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAuthor) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" && e.shiftKey || e.key === "Z")) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthor, undo, redo]);
  // --- end undo / redo ---

  const beginEditing = useCallback((nodeId: string, options: BeginMineCanvasEditOptions) => {
    if (!isAuthor) return;
    pushHistory();
    setSelectedNodeId(nodeId);
    setEditingNodeId(nodeId);
    setEditingFieldKey(options.fieldKey);
    setActiveTimelineItemId(options.timelineItemId || "");
    setActiveEditor(null);
    activeEditorNodeId.current = "";
    setCreatePanelOpen(false);
  }, [isAuthor, pushHistory]);

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
    const next = markInteractiveNodes(nodesRef.current.map((node) => node.id === nodeId ? syncNodeSize({ ...node, data: updater(node.data) }) : node), selectedNodeId, editingNodeId);
    nodesRef.current = next;
    setNodes(next);
    scheduleSave();
  }, [editingNodeId, selectedNodeId, scheduleSave]);

  const reportNodeHeight = useCallback((nodeId: string, measuredHeight: number, minimumHeight: number) => {
    let changed = false;
    const next = nodesRef.current.map((node) => {
      if (node.id !== nodeId || (node.data.kind !== "text" && node.data.kind !== "timeline" && node.data.kind !== "businesscard")) return node;
      const mode = node.data.kind === "text" ? node.data.heightMode : "auto";
      const height = resolveMeasuredHeight(mode, node.data.height, measuredHeight, minimumHeight);
      if (height === node.data.height) return node;
      changed = true;
      return syncNodeSize({ ...node, data: { ...node.data, height } });
    });
    if (!changed) return;
    const marked = markInteractiveNodes(next, selectedNodeId, editingNodeId);
    nodesRef.current = marked;
    setNodes(marked);
    scheduleSave();
  }, [editingNodeId, scheduleSave, selectedNodeId]);

  const setCenterNodeId = useCallback((nodeId: string) => {
    setCenterNodeIdState((current) => {
      const next = current === nodeId ? "" : nodeId;
      centerNodeIdRef.current = next;
      return next;
    });
    flushSave();
  }, [flushSave]);

  const deleteNode = useCallback((nodeId: string) => {
    pushHistory();
    const target = nodesRef.current.find((node) => node.id === nodeId);
    if (target?.data.kind === "image") releaseObjectUrl(target.data.src);
    const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId);
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    const nextEdges = edgesRef.current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    edgesRef.current = nextEdges;
    setEdges(nextEdges);
    if (selectedNodeId === nodeId) setSelectedNodeId("");
    if (editingNodeId === nodeId) finishEditing();
    if (activeLinkNodeId === nodeId) setActiveLinkNodeId("");
    setCenterNodeIdState((current) => {
      const next = current === nodeId ? "" : current;
      centerNodeIdRef.current = next;
      return next;
    });
    flushSave();
  }, [activeLinkNodeId, editingNodeId, finishEditing, flushSave, pushHistory, releaseObjectUrl, selectedNodeId]);

  useEffect(() => {
    if (!isAuthor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!selectedNodeId) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable=true]")) return;
      if (editingNodeId) return;
      event.preventDefault();
      deleteNode(selectedNodeId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthor, selectedNodeId, editingNodeId, deleteNode]);

  const focusNode = useCallback((node: MineCanvasNode) => {
    const instance = flowInstance.current;
    if (!instance) return;
    selectNode(node.id);
    void instance.setCenter(node.position.x + node.data.width / 2, node.position.y + node.data.height / 2, { zoom: Math.max(viewport.zoom, 0.72), duration: 320 });
    window.setTimeout(() => setViewport(instance.getViewport()), 350);
  }, [selectNode, viewport.zoom]);

  const handleNodesChange = useCallback((changes: NodeChange<MineCanvasNode>[]) => {
    const next = markInteractiveNodes(applyNodeChanges(changes, nodesRef.current), selectedNodeId, editingNodeId);
    nodesRef.current = next;
    setNodes(next);
  }, [editingNodeId, selectedNodeId]);

  const handleEdgesChange = useCallback((changes: EdgeChange<MineCanvasEdge>[]) => {
    const next = applyEdgeChanges(changes, edgesRef.current);
    edgesRef.current = next;
    setEdges(next);
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    pushHistory();
    const next = addEdge({ ...connection, id: `edge-${connection.source}-${connection.target}-${Date.now()}`, type: "mineCurve", style: EDGE_STYLE, data: {} }, edgesRef.current);
    edgesRef.current = next;
    setEdges(next);
    flushSave();
  }, [flushSave, pushHistory]);

  const handleReconnect = useCallback((oldEdge: MineCanvasEdge, connection: Connection) => {
    pushHistory();
    const sourceChanged = oldEdge.source !== connection.source || oldEdge.sourceHandle !== connection.sourceHandle;
    const targetChanged = oldEdge.target !== connection.target || oldEdge.targetHandle !== connection.targetHandle;
    const next = reconnectEdge(oldEdge, connection, edgesRef.current, { shouldReplaceId: false }).map((edge) => edge.id === oldEdge.id ? {
      ...edge,
      data: {
        ...(edge.data || {}),
        sourceControl: sourceChanged ? undefined : edge.data?.sourceControl,
        targetControl: targetChanged ? undefined : edge.data?.targetControl,
        control: undefined,
      },
    } : edge);
    edgesRef.current = next;
    setEdges(next);
    flushSave();
  }, [flushSave, pushHistory]);

  const updateEdgeControl = useCallback((edgeId: string, field: "sourceControl" | "targetControl", offset: { dx: number; dy: number }) => {
    const next = edgesRef.current.map((edge) => edge.id === edgeId ? {
      ...edge,
      data: { ...(edge.data || {}), [field]: offset, control: undefined },
    } : edge);
    edgesRef.current = next;
    setEdges(next);
    flushSave();
  }, [flushSave]);

  const editingNodeIdRef = useRef(editingNodeId);
  editingNodeIdRef.current = editingNodeId;

  const handleSelectionChange: OnSelectionChangeFunc<MineCanvasNode, MineCanvasEdge> = useCallback(({ nodes: selectedNodes }) => {
    const nodeId = selectedNodes[0]?.id || "";
    setSelectedNodeId(nodeId);
    if (!nodeId && editingNodeIdRef.current) finishEditing();
  }, [finishEditing]);

  const handleMove: OnMove = useCallback((_, nextViewport) => {
    viewportRef.current = nextViewport;
    setViewport(nextViewport);
  }, []);

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
    pushHistory();
    const data = getCard(kind)?.createDefaultData() || { kind, title: "新卡片", accent: "#002FA7", width: 260, height: 170 } as MineCanvasNodeData;
    const size = { width: data.width, height: data.height };
    const id = `node-${kind}-${Date.now()}`;
    const nextNode = syncNodeSize({ id, type: "mine", position: findOpenPosition(nodesRef.current, getViewportCenter(size), size), selected: true, draggable: true, data });
    const next = markInteractiveNodes(nodesRef.current.concat(nextNode), id, "");
    nodesRef.current = next;
    setNodes(next);
    setSelectedNodeId(id);
    setCreatePanelOpen(false);
    flushSave();
    if (kind === "image") {
      pendingImageNodeId.current = id;
      window.setTimeout(() => fileInputRef.current?.click(), 80);
    }
  }, [getViewportCenter, flushSave, pushHistory]);

  const requestImageFile = useCallback((nodeId: string) => {
    pendingImageNodeId.current = nodeId;
    selectNode(nodeId);
    fileInputRef.current?.click();
  }, [selectNode]);

  const handleImageFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const nodeId = pendingImageNodeId.current;
    event.target.value = "";
    if (!file || !nodeId) return;
    let asset;
    try {
      asset = await uploadCanvasAsset(file, file.name);
    } catch {
      setSaveStatus("error");
      return;
    }
    const preview = new window.Image();
    preview.onload = () => {
      const naturalRatio = preview.naturalWidth > 0 && preview.naturalHeight > 0 ? preview.naturalWidth / preview.naturalHeight : 1.58;
      updateNodeData(nodeId, (data) => {
        if (data.kind !== "image") return data;
        releaseObjectUrl(data.src);
        const width = data.width || getCard("image")?.defaultSize.width || 300;
        return { ...data, assetId: asset.id, src: asset.url, fileName: file.name, naturalRatio, width, height: clamp(Math.round(width / naturalRatio), 112, 390) };
      });
    };
    preview.onerror = () => setSaveStatus("error");
    preview.src = asset.url;
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
    centerNodeId,
    editingFieldKey,
    editingNodeId,
    fonts: mineCanvasFonts,
    isAuthor,
    beginEditing,
    deleteNode,
    finishEditing,
    registerActiveEditor,
    reportNodeHeight,
    requestImageFile,
    setActiveLinkNodeId,
    setActiveTimelineItemId,
    setCenterNodeId,
    updateNodeData,
    updateNodeSize,
    updateEdgeControl,
  }), [activeEditor, activeLinkNodeId, activeTimelineItemId, centerNodeId, beginEditing, deleteNode, editingFieldKey, editingNodeId, finishEditing, isAuthor, registerActiveEditor, reportNodeHeight, requestImageFile, setCenterNodeId, updateEdgeControl, updateNodeData, updateNodeSize]);

  // Auto-center on the center node when loaded or toggled
  useEffect(() => {
    if (!centerNodeId || !isFlowReady) return;
    const instance = flowInstance.current;
    if (!instance) return;
    const target = nodes.find((node) => node.id === centerNodeId);
    if (!target) return;
    void instance.setCenter(
      target.position.x + target.data.width / 2,
      target.position.y + target.data.height / 2,
      { zoom: Math.max(viewport.zoom, 0.72), duration: 0 },
    );
  }, [centerNodeId, isFlowReady]);

  if (loadState === "loading") {
    return (
      <div className="mine-canvas-editor mine-canvas-load-state" role="status" aria-live="polite">
        <span className="mine-canvas-loading-mark" aria-hidden="true">J</span>
        <strong>正在安全加载画布…</strong>
        <p>数据库确认前不会显示占位节点。</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mine-canvas-editor mine-canvas-load-state is-error" role="alert">
        <strong>画布加载失败</strong>
        <p>为保护现有数据，未使用本地占位内容替代数据库。</p>
        <button type="button" onClick={() => window.location.reload()}>重新加载</button>
      </div>
    );
  }

  const saveStatusText = {
    idle: "",
    saving: "保存中",
    saved: "已保存 · 历史版本已保留",
    error: "保存失败 · 本地改动待重试",
    conflict: "检测到新版本 · 已停止覆盖",
  }[saveStatus];

  return (
    <MineCanvasRuntimeContext.Provider value={runtime}>
      <div className={`mine-canvas-editor${!isAuthor ? " is-visitor" : ""}`}>
        <aside className="mine-canvas-sidebar" aria-label="我的画布节点列表">
          <div className="mine-canvas-brand"><span aria-hidden="true">J</span><div><strong>Justin Canvas</strong><p>{nodes.length} 个节点</p></div></div>
          <section className="mine-canvas-layers" aria-label="全部节点">
            <div className="mine-canvas-section-title"><span aria-hidden="true">Layers</span><small>全部节点</small></div>
            <div className="mine-canvas-node-list">
              {nodes.map((node) => (
                <div className={`mine-canvas-layer${selectedNodeId === node.id ? " is-active" : ""}`} key={node.id}>
                  <button className="mine-canvas-layer-main" type="button" onClick={() => focusNode(node)}>
                    <span style={{ "--layer-accent": node.data.accent } as CSSProperties} aria-hidden="true" />
                    <strong>{node.data.title}</strong><small>{getCard(node.data.kind)?.label || node.data.kind}</small>
                  </button>
                  {isAuthor && <button className="mine-canvas-layer-delete" type="button" onClick={() => deleteNode(node.id)} aria-label={`删除 ${node.data.title}`}><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
          </section>
          <div className="mine-canvas-sidebar-bottom">
            {isAuthor && <div className="mine-create-control">
              <button type="button" className="mine-create-toggle" onClick={() => { setCreatePanelOpen((current) => !current); clearSelection(); }} aria-label="新建节点">
                {createPanelOpen ? <X size={16} /> : <Plus size={17} />}<span>新建</span>
              </button>
              {createPanelOpen ? <CreatePanel addNode={addNode} isAuthor={isAuthor} /> : null}
            </div>}
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
            onInit={(instance) => {
              flowInstance.current = instance;
              setIsFlowReady(true);
              void instance.setViewport(viewport, { duration: 0 });
            }}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onReconnect={handleReconnect}
            onNodeDragStart={isAuthor ? () => pushHistory() : undefined}
            onNodeDragStop={isAuthor ? () => flushSave() : undefined}
            onMoveStart={isAuthor ? () => pushHistory() : undefined}
            onMove={handleMove}
            onMoveEnd={isAuthor ? () => flushSave() : undefined}
            onNodeClick={(_, node) => selectNode(node.id)}
            onPaneClick={() => { clearSelection(); setActiveLinkNodeId(""); }}
            onSelectionChange={handleSelectionChange}
            onEdgeDoubleClick={isAuthor ? (_, edge) => {
              pushHistory();
              const nextEdges2 = edgesRef.current.filter((item) => item.id !== edge.id);
              edgesRef.current = nextEdges2;
              setEdges(nextEdges2);
              flushSave();
            } : undefined}
            defaultViewport={initialDocument.viewport}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            nodesDraggable={true}
            nodesConnectable={isAuthor}
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
            onlyRenderVisibleElements
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
        {saveStatusText && (
          <span className={`mine-canvas-save-status is-${saveStatus}`} role="status">
            {saveStatusText}
          </span>
        )}
      </div>
    </MineCanvasRuntimeContext.Provider>
  );
}

function CreatePanel({ addNode, isAuthor }: { addNode: (kind: MineCanvasNodeKind) => void; isAuthor: boolean }) {
  const options = getCreateOptions().filter((opt) => !opt.authorOnly || isAuthor);
  return (
    <section className="mine-create-panel" aria-label="新建节点">
      {options.map((item) => {
        const Icon = item.icon;
        return <button type="button" key={item.kind} onClick={() => addNode(item.kind)} title={item.label}><Icon size={17} /><span>{item.label}</span></button>;
      })}
    </section>
  );
}
