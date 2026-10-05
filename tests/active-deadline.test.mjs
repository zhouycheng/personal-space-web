import test from 'node:test';
import assert from 'node:assert/strict';
import { activeTimeout, withActiveDeadline } from '../src/infrastructure/client/activeDeadline.ts';
import { waitForOptionalResource } from '../src/infrastructure/client/optionalResource.ts';

function fakePage() {
  const originals = new Map(['window', 'document', 'performance', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = new EventTarget(), tasks = new Map();
  let time = 0, id = 0;
  window.setTimeout = (run, delay) => { tasks.set(++id, { run, at: time + delay }); return id; };
  const values = { window, document, performance: { now: () => time }, clearTimeout: key => tasks.delete(key) };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return {
    document, window, tasks,
    advance(milliseconds) {
      const end = time + milliseconds;
      while (tasks.size) {
        const [key, task] = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (task.at > end) break;
        time = task.at; tasks.delete(key); task.run();
      }
      time = end;
    },
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

test('hidden and BFCache intervals do not consume a deadline; resumption settles once', () => {
  const page = fakePage(); let fired = 0, stop;
  try {
    stop = activeTimeout(() => { fired++; }, 100);
    page.advance(40);
    page.document.hidden = true; page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(60_000); assert.equal(fired, 0);
    page.document.hidden = false; page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(10); page.window.dispatchEvent(new Event('pagehide'));
    page.advance(60_000);
    page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(50); assert.equal(fired, 0);
    page.window.dispatchEvent(new Event('pageshow'));
    page.advance(49); assert.equal(fired, 0);
    page.advance(1); assert.equal(fired, 1);
    page.window.dispatchEvent(new Event('pageshow'));
    page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(60_000); assert.equal(fired, 1); assert.equal(page.tasks.size, 0);
    stop(); stop();
  } finally { stop?.(); page.restore(); }
});

test('pageshow while still hidden waits for visibility, and a cancelled deadline stays cancelled', () => {
  const page = fakePage(); let fired = 0, stop;
  try {
    page.document.hidden = true;
    stop = activeTimeout(() => { fired++; }, 50);
    page.window.dispatchEvent(new Event('pagehide'));
    page.window.dispatchEvent(new Event('pageshow'));
    page.advance(60_000); assert.equal(fired, 0); assert.equal(page.tasks.size, 0);
    page.document.hidden = false; page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(20); stop();
    page.window.dispatchEvent(new Event('pageshow'));
    page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(60_000); assert.equal(fired, 0); assert.equal(page.tasks.size, 0);
  } finally { stop?.(); page.restore(); }
});

test('an operation timeout cancels once and ignores a late successful result', async () => {
  const page = fakePage(); let complete, cancelled = 0;
  try {
    const pending = new Promise(resolve => { complete = resolve; });
    const result = withActiveDeadline(pending, 20, () => { cancelled++; });
    page.advance(20);
    assert.equal((await result).status, 'failed'); assert.equal(cancelled, 1);
    complete({ status: 'completed', value: undefined });
    await Promise.resolve(); page.advance(100);
    assert.equal((await result).status, 'failed'); assert.equal(cancelled, 1);
    assert.equal(page.tasks.size, 0);
  } finally { page.restore(); }
});

test('optional texture timeout counts foreground time, accepts late completion and clears cancellation timers',async()=>{
  const page=fakePage();
  try {
    let complete;const resource=new Promise(resolve=>complete=resolve),abort=new AbortController();
    const result=waitForOptionalResource(resource,abort.signal,15_000);
    page.advance(5000);page.document.hidden=true;page.document.dispatchEvent(new Event('visibilitychange'));
    page.advance(60_000);assert.equal(page.tasks.size,0);
    page.document.hidden=false;page.document.dispatchEvent(new Event('visibilitychange'));page.advance(10_000);
    assert.equal(await result,'timeout');complete();await Promise.resolve();assert.equal(page.tasks.size,0);
    const cancellation=new AbortController(),cancelled=waitForOptionalResource(new Promise(()=>{}),cancellation.signal);
    cancellation.abort();assert.equal(await cancelled,'cancelled');assert.equal(page.tasks.size,0);
    assert.equal(await waitForOptionalResource(Promise.resolve(),new AbortController().signal),'ready');assert.equal(page.tasks.size,0);
  }finally{page.restore();}
});
