import { isCanvasSessionAuthorized } from "../../../server/canvas/canvas-auth.ts";
import { getCanvasStore } from "../../../server/canvas/canvas-store.ts";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET({ request }: { request: Request }) {
  if (!isCanvasSessionAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  return json({ revisions: getCanvasStore().listRevisions() });
}

export async function POST({ request }: { request: Request }) {
  if (!isCanvasSessionAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  try {
    const body = await request.json() as { revision?: unknown; expectedRevision?: unknown };
    if (!Number.isInteger(body.revision) || !Number.isInteger(body.expectedRevision)) {
      return json({ error: "Invalid revision" }, 400);
    }
    const result = getCanvasStore().restoreRevision(
      body.revision as number,
      body.expectedRevision as number,
    );
    if (result.status === "conflict") return json({ error: "Revision conflict", latest: result.snapshot }, 409);
    return json(result.snapshot);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Restore failed" }, 400);
  }
}
