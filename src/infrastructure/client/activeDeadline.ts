import type { OperationResult } from "../../contracts/operation";

/** A hidden document and a BFCache suspension do not consume an interaction deadline. */
export function activeTimeout(callback: () => void, milliseconds: number) {
  const events = new AbortController();
  let remaining = milliseconds, started = 0, timer = 0, suspended = false, disposed = false;
  function pause() {
    if (!timer) return;
    clearTimeout(timer); timer = 0;
    remaining -= Math.max(0, performance.now() - started);
  }
  function resume() {
    if (disposed || timer || suspended || document.hidden) return;
    started = performance.now();
    timer = window.setTimeout(() => { timer = 0; dispose(); callback(); }, Math.max(0, remaining));
  }
  function dispose() { if (disposed) return; disposed = true; pause(); events.abort(); }
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : resume(), { signal: events.signal });
  window.addEventListener("pagehide", () => { suspended = true; pause(); }, { signal: events.signal });
  window.addEventListener("pageshow", () => { suspended = false; resume(); }, { signal: events.signal });
  resume();
  return dispose;
}

export function withActiveDeadline(task: Promise<OperationResult>, milliseconds: number, cancel: () => void): Promise<OperationResult> {
  return new Promise(resolve => {
    let settled = false;
    const stop = activeTimeout(() => {
      if (settled) return;
      settled = true; cancel();
      resolve({ status: "failed", code: "日记操作超时，请重试或返回首页。", retryable: true });
    }, milliseconds);
    task.then(result => {
      if (!settled) { settled = true; stop(); resolve(result); }
    }, () => {
      if (!settled) { settled = true; stop(); cancel(); resolve({ status: "failed", code: "日记操作失败，请重试。", retryable: true }); }
    });
  });
}
