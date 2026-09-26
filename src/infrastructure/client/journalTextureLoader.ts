import { journalRuntime } from "../../config/journalRuntime.ts";

type DecodeTask = { run: () => Promise<void>; cancel: () => void };

async function download(url: string, signal: AbortSignal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(journalRuntime.requestTimeoutMs)]);
    let response: Response | undefined;
    try {
      response = await fetch(url, { signal: requestSignal });
      if (!response.ok) {
        // An unread error body must not keep a network slot alive while retrying.
        await response.body?.cancel().catch(() => {});
        if (response.status < 500 || attempt === 1) throw new Error(`书页资源不可用 (${response.status})，请重新加载最新日记。`);
        continue;
      }
      return await response.blob();
    } catch (cause) {
      signal.throwIfAborted();
      if (response && !response.ok) throw cause;
      const timeout = requestSignal.reason?.name === 'TimeoutError' || (cause instanceof Error && cause.name === 'TimeoutError');
      if (attempt === 1) throw new Error(timeout ? '书页请求超时，请检查网络后重试。' : '书页下载失败，请检查网络连接后重试。', { cause });
    }
  }
  throw new Error('书页下载失败，请检查网络连接后重试。');
}

/** One decoder queue per book. Fetch concurrency is owned by the page scheduler. */
export function createJournalImageLoader() {
  const queue: DecodeTask[] = [];
  let decoding = 0;
  const pump = () => {
    while (decoding < journalRuntime.decodeConcurrency && queue.length) {
      const task = queue.shift()!;
      decoding++;
      void task.run().finally(() => { decoding--; pump(); });
    }
  };
  return async function load(url: string, signal: AbortSignal): Promise<ImageBitmap> {
    const blob = await download(url, signal);
    signal.throwIfAborted();
    return new Promise<ImageBitmap>((resolve, reject) => {
      let started = false;
      const abort = () => {
        const index = queue.indexOf(task);
        if (index !== -1) queue.splice(index, 1);
        // Keep the reservation until an in-progress decode closes its bitmap.
        if (!started) { signal.removeEventListener("abort", abort); reject(signal.reason); }
      };
      const task: DecodeTask = {
        cancel: abort,
        async run() {
          started = true;
          try {
            signal.throwIfAborted();
            // ImageBitmap ignores Texture.flipY, so orient the decoded pixels here.
            const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none" });
            if (signal.aborted) { bitmap.close(); reject(signal.reason); }
            else resolve(bitmap);
          } catch (cause) { reject(signal.aborted ? signal.reason : new Error('书页图片无法解码，请重新加载最新日记。', { cause })); }
          finally { signal.removeEventListener("abort", abort); }
        },
      };
      signal.addEventListener("abort", abort, { once: true });
      queue.push(task);
      pump();
    });
  };
}
