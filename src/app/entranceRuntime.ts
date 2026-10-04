import { createCloudEntrance } from '../justin-kit/components/cloud-entrance/runtime';
import { completeEntrance, entranceCompleted, isReloadNavigation } from '../infrastructure/client/entranceSession';
import type { OperationResult } from '../contracts/operation';
import { ENTRANCE_DURATION } from '../animation/studio/entranceMotion';

export function createEntranceRuntime(root: HTMLElement, options: {
  prepare(progress: (value: number) => void): Promise<OperationResult>;
  play(duration: number, progress: (value: number) => void): Promise<OperationResult>;
  cancel(): void;
  sync(): void;
  complete(): void;
  reducedMotion: MediaQueryList;
}) {
  const skipped = new URLSearchParams(location.search).get('entrance') === 'skip';
  let blocking = !entranceCompleted() && !skipped;
  let covered = !skipped && (blocking || isReloadNavigation());
  let playing = false, ready = false, disposed = false, version = 0;
  const view = covered ? createCloudEntrance(root, enter, () => void start()) : undefined;
  root.hidden = !covered;
  if (covered && !blocking) root.dataset.state = 'loading';
  function complete() {
    if (blocking) completeEntrance();
    blocking = playing = covered = false;
    view?.dispose(); options.complete();
  }
  function failed(message = '准备暂时中断，请重试或选择内容入口') {
    if (!covered || disposed) return;
    version++; playing = ready = false; options.cancel();
    view?.setState('error', message); options.sync();
  }
  async function start() {
    if (!covered || disposed) return;
    const token = ++version; playing = ready = false; options.cancel();
    const started=performance.now();let measuredStep=0;
    const timings:Record<string,number>={};
    view?.setState('loading', blocking ? undefined : '正在布置工作室…'); view?.setProgress(0); options.sync();
    // Two frames give the SSR surface a paint before synchronous scene creation.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (token !== version || disposed) return;
    try {
      const result = await options.prepare(value => { if (token === version) {
          view?.setProgress(value);
          const step=Math.round(value*5);
          if(step>measuredStep){measuredStep=step;timings[`step-${step}`]=Math.round(performance.now()-started);root.dataset.timings=JSON.stringify(timings);}
        } });
      if (token !== version || disposed) return;
      if (result.status !== 'completed') { failed(); return; }
      timings.ready=Math.round(performance.now()-started);root.dataset.timings=JSON.stringify(timings);
      view?.setProgress(1);
      if (blocking) {
        ready = true; view?.setState('ready'); options.sync();
        return;
      }
      playing = true;
      await view?.dismiss(options.reducedMotion.matches ? 0 : 420);
      if (token !== version || disposed) return;
      complete();
    } catch { if (token === version && !disposed) failed(); }
  }
  async function enter() {
    if (!blocking || playing || !ready || disposed) return;
    const token = ++version; playing = true; ready = false;
    view?.setState('revealing'); options.sync();
    try {
      const result = await options.play(options.reducedMotion.matches ? 240 : ENTRANCE_DURATION, value => {
        if (token === version && !disposed) view?.setRevealProgress(value);
      });
      if (token !== version || disposed) return;
      if (result.status !== 'completed') { failed(); return; }
      complete();
    } catch { if (token === version && !disposed) failed(); }
  }
  return {
    get blocking() { return blocking; },
    get covered() { return covered; },
    get playing() { return playing; },
    start, failed,
    dispose() { disposed = true; version++; options.cancel(); view?.dispose(); },
  };
}
