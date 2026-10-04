import { Background, ReactFlow, Handle, Position, ConnectionMode, useNodesState, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import '@xyflow/react/dist/style.css';
import './mine-canvas.css';
import { getPublishedCanvas } from '../../../data/repositories/canvas';
import type { FlowNode as MineCanvasNode, FlowEdge as MineCanvasEdge } from './flowTypes';
import { CanvasCardContent } from './CanvasCardContent';
import { MineCanvasEdgeComponent } from './MineCanvasEdge';
import { createEdgeDeriver } from './derivedEdges';
import { applyPositions, parsePositions, POSITION_KEY, type Positions } from '../../../infrastructure/client/canvasPositions';
import type { CanvasSession } from './canvasSession';
import { CanvasViewControls } from './CanvasViewControls';

const Card = memo(function Card({ data }: NodeProps<MineCanvasNode>) {
  return <article className={`canvas-card canvas-card--${data.kind}`} style={{ '--card-accent': data.accent } as CSSProperties}>
    <div className="canvas-card-body">{data.kind === 'monitor' ? <small className="canvas-monitor-label">{data.title}</small> : !['businesscard', 'quote'].includes(data.kind) && <h2>{data.title}</h2>}<CanvasCardContent data={data} /></div>
    {[Position.Top, Position.Right, Position.Bottom, Position.Left].map(position => <Handle key={position} id={position} type="source" position={position} isConnectable={false} />)}
  </article>;
});
const nodeTypes = { mine: Card }, edgeTypes = { mineCurve: MineCanvasEdgeComponent };
const mineCanvasSeed = getPublishedCanvas();
const defaults = mineCanvasSeed.nodes;
const defaultIds = new Set(defaults.map(node => node.id));
function readPositions() { try { return parsePositions(localStorage.getItem(POSITION_KEY)); } catch { return {}; } }
const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;

export default function MineCanvasEditor({ active, session }: { active: boolean; session: CanvasSession }) {
  const [initialPositions] = useState(() => session.positions ??= readPositions());
  const overrides = useRef<Positions>(initialPositions);
  const [initialNodes] = useState(() => applyPositions(defaults, initialPositions));
  const [nodes, setNodes, onNodesChange] = useNodesState<MineCanvasNode>(initialNodes);
  const [instance, setInstance] = useState<ReactFlowInstance<MineCanvasNode, MineCanvasEdge> | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const contentButton = useRef<HTMLButtonElement>(null), sidebar = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const dragTimer = useRef(0);
  const [deriveEdges]=useState(()=>createEdgeDeriver(mineCanvasSeed.edges));
  const {nodeById,edges}=useMemo(()=>deriveEdges(nodes),[nodes,deriveEdges]);
  const fit = useCallback(() => { void instance?.fitView({ padding: .18, duration: duration(), minZoom: .08, maxZoom: 1 }); }, [instance]);
  useEffect(() => {
    if (!active || !instance || !wrap.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!wrap.current?.clientWidth || !wrap.current.clientHeight) return;
        if (session.viewport) void instance.setViewport(session.viewport, { duration: 0 });
        else void instance.fitView({ padding: .18, duration: 0, minZoom: .08, maxZoom: 1 });
      });
    });
    observer.observe(wrap.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [active, instance, session]);
  useEffect(() => {
    if (!active) {
      setDrawer(false);
      clearTimeout(dragTimer.current);
      dragging.current = false;
    }
    return () => clearTimeout(dragTimer.current);
  }, [active]);
  useEffect(() => { if (drawer) sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [drawer]);
  const closeDrawer = () => { setDrawer(false); contentButton.current?.focus(); };
  const focus = useCallback((node: MineCanvasNode) => {
    setDrawer(false);
    void instance?.fitView({ nodes: [{ id: node.id }], padding: .3, minZoom: .1, maxZoom: 1, duration: duration() });
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(node.id)}"]`)?.focus());
  }, [instance]);
  const savePosition = useCallback((node: MineCanvasNode) => {
    overrides.current[node.id] = { ...node.position };
    overrides.current = Object.fromEntries(Object.entries(overrides.current).filter(([id]) => defaultIds.has(id)));
    session.positions = overrides.current;
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(overrides.current)); setStorageMessage(''); }
    catch { setStorageMessage('浏览器无法保存位置，本次仍可浏览。'); }
  }, [session]);
  const startDrag = useCallback(() => { dragging.current = true; }, []);
  const stopDrag = useCallback((_: unknown, node: MineCanvasNode) => {
    savePosition(node);
    dragTimer.current = window.setTimeout(() => { dragging.current = false; }, 0);
  }, [savePosition]);
  const doubleClickNode = useCallback((event: ReactMouseEvent, node: MineCanvasNode) => {
    event.stopPropagation();
    if (!dragging.current) focus(node);
  }, [focus]);
  const rememberViewport = useCallback((_: unknown, viewport: { x: number; y: number; zoom: number }) => {
    session.viewport = viewport;
  }, [session]);
  const reset = () => {
    overrides.current = {};
    session.positions = {};
    session.viewport = undefined;
    try { localStorage.removeItem(POSITION_KEY); } catch {}
    setNodes(defaults.map(n => ({ ...n }))); requestAnimationFrame(fit);
  };
  return <div className="canvas-viewer">
    <div className="canvas-topbar"><strong>我的画布</strong><button ref={contentButton} aria-expanded={drawer} aria-controls="canvas-contents" onClick={() => setDrawer(!drawer)}>内容</button></div>
    {drawer && <button className="canvas-sidebar-backdrop" aria-label="关闭内容列表" onClick={closeDrawer} />}
    <aside id="canvas-contents" ref={sidebar} className={`canvas-sidebar ${drawer ? 'is-open' : ''}`} aria-label="画布内容" onKeyDown={event => {
      if (event.key === 'Escape') closeDrawer();
      if (event.key === 'Tab' && drawer && matchMedia('(max-width: 640px)').matches) {
        const buttons = [...sidebar.current!.querySelectorAll<HTMLButtonElement>('button')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header><h2>内容</h2><button className="canvas-sidebar-close" onClick={closeDrawer} aria-label="关闭内容列表">×</button></header>
      <nav>{nodes.map(node => <button key={node.id} onClick={() => focus(node)}>{node.data.title}<span>↗</span></button>)}</nav>
      <p>直接拖动卡片调整位置，位置仅保存在当前浏览器。双击卡片聚焦，双击空白处查看全图。</p><button onClick={reset}>恢复默认布局</button>
    </aside>
    <div className="canvas-flow" ref={wrap} onDoubleClick={event => {
      if ((event.target as Element).classList.contains('react-flow__pane')) fit();
    }}>
      <ReactFlow<MineCanvasNode, MineCanvasEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onInit={setInstance} onNodesChange={onNodesChange}
        onNodeDragStart={startDrag}
        onNodeDragStop={stopDrag}
        onNodeDoubleClick={doubleClickNode}
        nodeDragThreshold={5}
        onKeyDown={event => {
          const element = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
          if (element?.dataset.id && (event.key === 'Enter' || event.key === ' ')) {
            const node = nodeById.get(element.dataset.id);
            if (node) { event.preventDefault(); focus(node); }
          }
        }}
        onMove={rememberViewport}
        nodesConnectable={false} edgesReconnectable={false} connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null} nodesFocusable nodesDraggable={active} autoPanOnNodeDrag={active} panOnDrag={active} zoomOnPinch={active} zoomOnScroll={active} zoomOnDoubleClick={false}
        defaultViewport={session.viewport} minZoom={.08} maxZoom={2} fitView={!session.viewport} fitViewOptions={{ padding: .18, minZoom: .08, maxZoom: 1 }} proOptions={{ hideAttribution: true }}>
        <Background gap={28} size={1} color="#c8cbd3" />
        <CanvasViewControls onFit={fit} />
      </ReactFlow>
    </div>
    {storageMessage && <p className="canvas-storage-message" role="status">{storageMessage}</p>}
  </div>;
}
