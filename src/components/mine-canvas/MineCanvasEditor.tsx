import { Background, ReactFlow, Handle, Position, ConnectionMode, useNodesState, type NodeProps, type ReactFlowInstance } from '@xyflow/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '@xyflow/react/dist/style.css';
import './mine-canvas.css';
import { mineCanvasSeed } from '../../content/canvas/published';
import type { MineCanvasNode, MineCanvasEdge } from './mineCanvasTypes';
import { CanvasCardContent } from './CanvasCardContent';
import { MineCanvasEdgeComponent } from './MineCanvasEdge';
import { inferHandlePair } from './mineCanvasGeometry';
import { applyPositions, parsePositions, POSITION_KEY, type Positions } from './canvasPositions';

function Card({ data }: NodeProps<MineCanvasNode>) {
  return <article className={`canvas-card canvas-card--${data.kind}`} style={{ '--card-accent': data.accent } as CSSProperties}>
    <div className="canvas-card-body">{data.kind === 'monitor' && <small className="canvas-monitor-label">笔记本窗口监听器</small>}{!['businesscard', 'quote'].includes(data.kind) && <h2>{data.title}</h2>}<CanvasCardContent data={data} /></div>
    {[Position.Top, Position.Right, Position.Bottom, Position.Left].map(position => <Handle key={position} id={position} type="source" position={position} isConnectable={false} />)}
  </article>;
}
const nodeTypes = { mine: Card }, edgeTypes = { mineCurve: MineCanvasEdgeComponent };
const defaults = mineCanvasSeed.nodes;
function readPositions() { try { return parsePositions(localStorage.getItem(POSITION_KEY)); } catch { return {}; } }
const duration = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240;

export default function MineCanvasEditor() {
  const overrides = useRef<Positions>(readPositions());
  const [nodes, setNodes, onNodesChange] = useNodesState<MineCanvasNode>(applyPositions(defaults, overrides.current));
  const [instance, setInstance] = useState<ReactFlowInstance<MineCanvasNode, MineCanvasEdge> | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [zoom, setZoom] = useState(100), [storageMessage, setStorageMessage] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const contentButton = useRef<HTMLButtonElement>(null), sidebar = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const edges: MineCanvasEdge[] = mineCanvasSeed.edges.map(edge => {
    const source = nodes.find(n => n.id === edge.source), target = nodes.find(n => n.id === edge.target);
    const pair = source && target ? inferHandlePair(
      { x: source.position.x + source.data.width / 2, y: source.position.y + source.data.height / 2 },
      { x: target.position.x + target.data.width / 2, y: target.position.y + target.data.height / 2 },
    ) : { sourceHandle: 'right', targetHandle: 'left' };
    return { ...edge, ...pair, selectable: false, reconnectable: false };
  });
  const fit = () => { void instance?.fitView({ padding: .18, duration: duration(), minZoom: .08, maxZoom: 1 }); };
  useEffect(() => {
    if (!instance || !wrap.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { void instance.fitView({ padding: .18, duration: 0, minZoom: .08, maxZoom: 1 }); });
    });
    observer.observe(wrap.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [instance]);
  useEffect(() => {
    const page = document.getElementById('page-canvas');
    if (!page) return;
    const observer = new MutationObserver(() => {
      if (!page.classList.contains('is-active')) setDrawer(false);
    });
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (drawer) sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, [drawer]);
  const closeDrawer = () => { setDrawer(false); contentButton.current?.focus(); };
  const focus = (node: MineCanvasNode) => {
    setDrawer(false);
    void instance?.fitView({ nodes: [{ id: node.id }], padding: .3, minZoom: .1, maxZoom: 1, duration: duration() });
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(node.id)}"]`)?.focus());
  };
  const savePosition = (node: MineCanvasNode) => {
    overrides.current[node.id] = { ...node.position };
    const ids = new Set(defaults.map(n => n.id));
    overrides.current = Object.fromEntries(Object.entries(overrides.current).filter(([id]) => ids.has(id)));
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(overrides.current)); setStorageMessage(''); }
    catch { setStorageMessage('浏览器无法保存位置，本次仍可浏览。'); }
  };
  const reset = () => {
    overrides.current = {};
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
        onNodeDragStart={() => { dragging.current = true; }}
        onNodeDragStop={(_, node) => { savePosition(node); setTimeout(() => { dragging.current = false; }, 0); }}
        onNodeDoubleClick={(event, node) => { event.stopPropagation(); if (!dragging.current) focus(node); }}
        nodeDragThreshold={5}
        onKeyDown={event => {
          const element = (event.target as HTMLElement).closest<HTMLElement>('.react-flow__node');
          if (element?.dataset.id && (event.key === 'Enter' || event.key === ' ')) {
            const node = nodes.find(n => n.id === element.dataset.id);
            if (node) { event.preventDefault(); focus(node); }
          }
        }}
        onMove={(_, viewport) => setZoom(Math.round(viewport.zoom * 100))}
        nodesConnectable={false} edgesReconnectable={false} connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null} nodesFocusable nodesDraggable panOnDrag zoomOnPinch zoomOnScroll zoomOnDoubleClick={false}
        minZoom={.08} maxZoom={2} fitView fitViewOptions={{ padding: .18, minZoom: .08, maxZoom: 1 }} proOptions={{ hideAttribution: true }}>
        <Background gap={28} size={1} color="#c8cbd3" />
      </ReactFlow>
    </div>
    <div className="canvas-view-controls" aria-label="画布视角">
      <button onClick={fit}>查看全图</button><button aria-label="缩小" onClick={() => void instance?.zoomOut()}>−</button><output>{zoom}%</output><button aria-label="放大" onClick={() => void instance?.zoomIn()}>＋</button>
    </div>
    {storageMessage && <p className="canvas-storage-message" role="status">{storageMessage}</p>}
  </div>;
}
