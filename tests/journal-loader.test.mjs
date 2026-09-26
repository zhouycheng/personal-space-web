import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournalImageLoader } from '../src/infrastructure/client/journalTextureLoader.ts';

async function withFetch(fetcher, check) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'), original = globalThis.fetch;
  globalThis.fetch = fetcher;
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, value: async () => ({ width: 1, height: 1, close() {} }) });
  try { await check(createJournalImageLoader()); }
  finally {
    globalThis.fetch = original;
    if (descriptor) Object.defineProperty(globalThis, 'createImageBitmap', descriptor); else delete globalThis.createImageBitmap;
  }
}

test('network failures have an actionable localized reason after exactly one retry', async () => {
  let attempts = 0;
  const cause = new TypeError('Failed to fetch');
  await withFetch(async () => { attempts++; throw cause; }, async load => {
    await assert.rejects(load('/page.webp', new AbortController().signal), error => {
      assert.match(error.message, /书页下载失败.*检查网络/); assert.equal(error.cause, cause); return true;
    });
  });
  assert.equal(attempts, 2);
});

test('request timeout is distinguished from generic network failure', async () => {
  let attempts = 0;
  await withFetch(async () => { attempts++; throw new DOMException('timeout', 'TimeoutError'); }, async load => {
    await assert.rejects(load('/page.webp', new AbortController().signal), /书页请求超时/);
  });
  assert.equal(attempts, 2);
});

test('caller cancellation preserves its reason and does not retry or become a network error', async () => {
  const controller = new AbortController(), reason = new Error('navigation cancelled');
  let attempts = 0;
  await withFetch(async () => { attempts++; controller.abort(reason); throw new TypeError('fetch aborted'); }, async load => {
    await assert.rejects(load('/page.webp', controller.signal), error => error === reason);
  });
  assert.equal(attempts, 1);
});

test('HTTP errors preserve their status and release their unread response bodies', async () => {
  let attempts = 0, released = 0;
  await withFetch(async () => {
    attempts++;
    return new Response(new ReadableStream({ cancel() { released++; } }), { status: 404 });
  }, async load => { await assert.rejects(load('/page.webp', new AbortController().signal), /\(404\)/); });
  assert.equal(attempts, 1); assert.equal(released, 1);
});

test('a transient server error is closed before retry and decoding the successful page', async () => {
  let attempts = 0, released = 0;
  await withFetch(async () => {
    attempts++;
    if (attempts === 1) return new Response(new ReadableStream({ cancel() { released++; } }), { status: 503 });
    assert.equal(released, 1);
    return new Response(new Uint8Array([1]));
  }, async load => { assert.equal((await load('/page.webp', new AbortController().signal)).width, 1); });
  assert.equal(attempts, 2);
});
