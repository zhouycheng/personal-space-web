import { readFile, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { mineCanvasSeed } from "../../components/mine-canvas/mineCanvasData";

const DATA_PATH = "data/canvas.json";

function bufferEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function readCanvasData() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (data && typeof data.version === "number" && Array.isArray(data.nodes) && Array.isArray(data.edges) && data.viewport) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCanvasData(document: unknown): Promise<void> {
  const tmpPath = join(tmpdir(), `canvas-${randomUUID()}.json`);
  await writeFile(tmpPath, JSON.stringify(document, null, 2), "utf-8");
  await rename(tmpPath, DATA_PATH);
}

export async function GET() {
  const data = await readCanvasData();
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
    if (!body || typeof body.version !== "number" || !Array.isArray(body.nodes) || !Array.isArray(body.edges) || !body.viewport) {
      return new Response(JSON.stringify({ error: "Invalid document" }), { status: 400 });
    }
    await writeCanvasData(body);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
}
