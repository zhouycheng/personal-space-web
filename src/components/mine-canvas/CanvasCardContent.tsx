import { useEffect, useState, type CSSProperties } from 'react';
import type { MineCanvasNodeData } from './mineCanvasTypes';
import type { ActivitySnapshot } from '../../lib/activity/types';

function ActivityContent() {
  const [activity, setActivity] = useState<ActivitySnapshot | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const read = () => { if (!document.hidden) void fetch('/api/activity/current', { signal: controller.signal }).then(r => r.json()).then(setActivity).catch(() => {}); };
    read(); const timer = setInterval(read, 12000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return <p>{activity ? `${activity.appName} · ${activity.text ?? '正在使用'}` : '当前离线'}</p>;
}

/** Shared read-only content for spatial cards and the full reading dialog. */
export function CanvasCardContent({ data, detail = false }: { data: MineCanvasNodeData; detail?: boolean }) {
  switch (data.kind) {
    case 'text': return <div className="canvas-prose" style={data.textStyle ? { fontSize: data.textStyle.fontSize, fontWeight: { regular: 400, medium: 500, bold: 700 }[data.textStyle.fontWeight], textAlign: data.textStyle.align, color: data.textStyle.color } : undefined} dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />;
    case 'quote': return <blockquote><div dangerouslySetInnerHTML={{ __html: data.contentHtml }} /><cite>{data.author}</cite></blockquote>;
    case 'link': return <><p>{data.summary}</p>{detail ? <a href={data.url} target={data.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer">打开链接 ↗</a> : <small>打开阅读 · 查看链接 ↗</small>}</>;
    case 'image': return data.src ? (detail ? <a href={data.src} target="_blank" rel="noreferrer"><img src={data.src} alt={data.title} /></a> : <img src={data.src} alt={data.title} draggable={false} />) : <div className="canvas-image-empty">照片待更新</div>;
    case 'timeline': return <ol className="canvas-timeline">{data.items.map(item => <li key={item.id} style={{ '--item-color': item.color } as CSSProperties}><time>{item.time}</time><strong>{item.title}</strong><p>{item.subtitle}</p></li>)}</ol>;
    case 'businesscard': return <div className="canvas-business">{data.avatarSrc && <img src={data.avatarSrc} alt="" />}<strong>{data.name}</strong><p>{data.intro}</p><div>{data.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>;
    case 'monitor': return <ActivityContent />;
  }
}
