import { mineCanvasSeed } from "../../components/mine-canvas/mineCanvasData.ts";
import {
  normalizeCanvasDocument,
  parseCanvasWriteRequest,
} from "../../features/canvas/domain/canvas-document.ts";
import { isCanvasSessionAuthorized } from "../../server/canvas/canvas-auth.ts";
import { getCanvasStore, type StoredCanvasDocument } from "../../server/canvas/canvas-store.ts";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function currentSnapshot() {
  const store = getCanvasStore();
  let snapshot = store.seedIfEmpty(mineCanvasSeed as unknown as StoredCanvasDocument);
  if (snapshot.document.version !== 4) {
    const migrated = store.write(normalizeCanvasDocument(snapshot.document), snapshot.revision);
    snapshot = migrated.snapshot;
  }
  return snapshot;
}

export async function GET() {
  return json(currentSnapshot());
}

export async function POST({ request }: { request: Request }) {
  if (!isCanvasSessionAuthorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const input = parseCanvasWriteRequest(await request.json());
    currentSnapshot();
    const result = getCanvasStore().write(input.document, input.expectedRevision);
    if (result.status === "conflict") {
      return json({ error: "Revision conflict", latest: result.snapshot }, 409);
    }
    return json(result.snapshot);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Invalid canvas request",
    }, 400);
  }
}
