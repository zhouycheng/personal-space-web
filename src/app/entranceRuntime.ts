import { createCloudEntrance } from '../justin-kit/components/cloud-entrance/runtime';
import { completeEntrance, entranceCompleted, isReloadNavigation } from '../infrastructure/client/entranceSession';
import type { OperationResult } from '../contracts/operation';
import { ENTRANCE_DURATION } from '../animation/studio/entranceMotion';
import type { StartupProgress,StartupStage } from '../contracts/startup';
import { paintOpportunity } from '../infrastructure/client/paintOpportunity';

const stageLabels:Record<StartupStage,string>={module:'正在加载场景',geometry:'正在布置小岛',texture:'正在准备海面与材质',shader:'正在预热光影','first-frame':'正在准备首帧',ready:'准备完成'};

export function createEntranceRuntime(root: HTMLElement, options: {
  prepare(progress: (value: StartupProgress) => void): Promise<OperationResult>;
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
  const cloudStart=performance.now();
  const view = covered ? createCloudEntrance(root, enter, () => void start()) : undefined;
  const cloudCpu=performance.now()-cloudStart;
  const lifetime=new AbortController();
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
    const started=performance.now();
    const timings:Record<string,number>={navigationToPrepare:started,cloudCpu};
    let currentStage:StartupStage|undefined;
    view?.setState('loading',stageLabels.module); view?.setProgress(0); options.sync();
    // Two frames give the SSR surface a paint before synchronous scene creation.
    await paintOpportunity(lifetime.signal).catch(()=>{});
    if (token !== version || disposed) return;
    try {
      const result = await options.prepare(value => { if (token === version) {
          view?.setProgress(value.progress);
          if(currentStage!==value.stage){currentStage=value.stage;view?.setState('loading',stageLabels[value.stage]);root.dataset.stage=value.stage;timings[value.stage]=Math.round(performance.now()-started);root.dataset.timings=JSON.stringify(timings);}
        } });
      if (token !== version || disposed) return;
      if (result.status !== 'completed') { failed(); return; }
      timings.ready=Math.round(performance.now()-started);timings.navigationToReady=performance.now();root.dataset.timings=JSON.stringify(timings);
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
    dispose() { disposed = true; version++; lifetime.abort(); options.cancel(); view?.dispose(); },
  };
}
