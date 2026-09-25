import { useEffect, useState, type CSSProperties } from 'react';
import type { MineCanvasNodeData } from '../../../contracts/canvas';
import type { ActivitySnapshot } from '../../../contracts/activity';
import { activityCopy, type ActivityState } from '../../../application/activity/canvasActivity';

function ActivityContent() {
  const [activity, setActivity] = useState<ActivityState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const read = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch('/api/activity/current', { signal: controller.signal });
        if (!response.ok) throw new Error('Activity unavailable');
        const snapshot: ActivitySnapshot | null = await response.json();
        if (snapshot !== null && (typeof snapshot.appName !== 'string' || !Number.isFinite(snapshot.expiresAt))) throw new Error('Invalid activity');
        if (!controller.signal.aborted) setActivity({ status: 'ready', snapshot });
      } catch {
        if (!controller.signal.aborted) setActivity({ status: 'error' });
      } finally { pending = false; }
    };
    read(); const timer = setInterval(read, 12000);
    document.addEventListener('visibilitychange', read);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', read); };
  }, []);
  useEffect(() => {
    if (activity.status !== 'ready' || !activity.snapshot) return;
    const timer = setTimeout(() => setActivity({ status: 'ready', snapshot: null }), Math.max(0, activity.snapshot.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [activity]);
  const copy = activityCopy(activity);
  return <div className="canvas-activity" role="status"><p>{copy.title}</p>{copy.detail && <p>{copy.detail}</p>}</div>;
}

/** Read-only content displayed directly on canvas nodes. */
export function CanvasCardContent({ data }: { data: MineCanvasNodeData }) {
  switch (data.kind) {
    case 'text': return <div className="canvas-prose" style={data.textStyle ? { fontSize: data.textStyle.fontSize, fontWeight: { regular: 400, medium: 500, bold: 700 }[data.textStyle.fontWeight], textAlign: data.textStyle.align, color: data.textStyle.color } : undefined} dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />;
    case 'quote': return <blockquote><div dangerouslySetInnerHTML={{ __html: data.contentHtml }} /><cite>{data.author}</cite></blockquote>;
    case 'link': return <><p>{data.summary}</p><a className="nodrag" href={data.url} target={data.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer" onDoubleClick={event => event.stopPropagation()}>打开链接 ↗</a></>;
    case 'image': return data.src ? <img src={data.src} alt={data.title} draggable={false} /> : <div className="canvas-image-empty">照片待更新</div>;
    case 'timeline': return <ol className="canvas-timeline">{data.items.map(item => <li key={item.id} style={{ '--item-color': item.color, '--item-fill': item.hollow ? 'white' : item.color } as CSSProperties}><time>{item.time}</time><strong>{item.title}</strong><p>{item.subtitle}</p></li>)}</ol>;
    case 'businesscard': return <div className="canvas-business">{data.avatarSrc && <img src={data.avatarSrc} alt="" />}<strong>{data.name}</strong><p>{data.intro}</p><div>{data.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>;
    case 'monitor': return <ActivityContent />;
  }
}
