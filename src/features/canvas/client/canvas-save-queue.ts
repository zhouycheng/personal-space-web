export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

type SaveResult =
  | { status: "saved"; revision: number }
  | { status: "conflict"; revision: number };

type SaveQueueOptions<T> = {
  initialRevision: number;
  save: (document: T, expectedRevision: number) => Promise<SaveResult>;
  onStatusChange?: (status: CanvasSaveStatus) => void;
};

export function createCanvasSaveQueue<T>(options: SaveQueueOptions<T>) {
  let revision = options.initialRevision;
  let status: CanvasSaveStatus = "idle";
  let pendingDocument: T | null = null;
  let running: Promise<void> | null = null;

  function setStatus(next: CanvasSaveStatus) {
    status = next;
    options.onStatusChange?.(next);
  }

  async function drain() {
    while (pendingDocument != null) {
      const document = pendingDocument;
      pendingDocument = null;
      setStatus("saving");
      try {
        const result = await options.save(document, revision);
        revision = result.revision;
        if (result.status === "conflict") {
          pendingDocument ??= document;
          setStatus("conflict");
          return;
        }
        setStatus(pendingDocument == null ? "saved" : "saving");
      } catch {
        pendingDocument ??= document;
        setStatus("error");
        return;
      }
    }
  }

  function ensureRunning() {
    if (running || status === "conflict") return;
    running = drain().finally(() => {
      running = null;
      if (pendingDocument != null && status !== "conflict" && status !== "error") ensureRunning();
    });
  }

  return {
    enqueue(document: T) {
      pendingDocument = document;
      ensureRunning();
    },
    async flush() {
      ensureRunning();
      await running;
    },
    retry() {
      if (status === "error") setStatus("idle");
      ensureRunning();
    },
    getRevision: () => revision,
    getStatus: () => status,
    getPendingDocument: () => pendingDocument,
  };
}
