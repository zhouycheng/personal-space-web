import { timingSafeEqual } from "node:crypto";
import { readCanvasDocument, writeCanvasDocument } from "../../lib/canvas-store";
import { mineCanvasSeed } from "../../components/mine-canvas/mineCanvasData";

function bufferEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function validateDocument(body: unknown): body is object {
  if (!body || typeof body !== "object") return false;
  const doc = body as Record<string, unknown>;
  return typeof doc.version === "number" && Array.isArray(doc.nodes) && Array.isArray(doc.edges) && doc.viewport != null;
}

export async function GET() {
  const data = await readCanvasDocument();
  if (data) {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
  }
  return new Response(JSON.stringify(mineCanvasSeed), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}

export async function POST({ request }: { request: Request }) {
  const authToken = import.meta.env.CANVAS_AUTH_TOKEN;
  if (!authToken) {
    return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const token = authHeader.slice(7);
  const expected = Buffer.from(authToken, "utf-8");
  const actual = Buffer.from(token, "utf-8");

  if (!bufferEqual(expected, actual)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const body = await request.json();
    if (!validateDocument(body)) {
      return new Response(JSON.stringify({ error: "Invalid document" }), { status: 400 });
    }
    await writeCanvasDocument(body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
}
