import { createClient, type Client } from "@libsql/client";

const TURSO_URL = import.meta.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = import.meta.env.TURSO_AUTH_TOKEN;

let client: Client;

function getClient(): Client {
  if (!client) {
    client = createClient(
      TURSO_URL
        ? { url: TURSO_URL, authToken: TURSO_AUTH_TOKEN! }
        : { url: "file:data/canvas.db" },
    );
  }
  return client;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ------------------------------------------------------------------ schema

async function ensureTables(): Promise<void> {
  const c = getClient();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS canvas_nodes (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      accent TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      pos_x REAL NOT NULL,
      pos_y REAL NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS canvas_edges (
      id TEXT PRIMARY KEY,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      source_handle TEXT,
      target_handle TEXT,
      type TEXT NOT NULL DEFAULT 'mineCurve',
      style TEXT,
      data TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS canvas_viewport (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      x REAL NOT NULL,
      y REAL NOT NULL,
      zoom REAL NOT NULL,
      center_node_id TEXT,
      updated_at TEXT NOT NULL
    )
  `);
}

// ------------------------------------------------------- migrate old -> new

async function migrateFromOldTable(): Promise<boolean> {
  const c = getClient();

  // Check if old canvas table exists
  const tables = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='canvas'",
  );
  if (tables.rows.length === 0) return false;

  // Check if new tables already have data
  const newNodeCount = await c.execute("SELECT COUNT(*) as cnt FROM canvas_nodes");
  if ((newNodeCount.rows[0] as { cnt: number }).cnt > 0) return false;

  const old = await c.execute("SELECT data FROM canvas WHERE id = 1");
  if (old.rows.length === 0) return false;

  try {
    const doc = JSON.parse(old.rows[0].data as string);
    if (!doc || !Array.isArray(doc.nodes)) return false;

    const n = nowISO();
    await ensureTables();

    // Insert nodes
    for (let i = 0; i < doc.nodes.length; i++) {
      const node = doc.nodes[i];
      const common = node.data || {};
      const { kind, title, accent, width, height, ...rest } = common;
      const data = JSON.stringify(rest);
      await c.execute({
        sql: `INSERT OR REPLACE INTO canvas_nodes (id, kind, title, accent, width, height, pos_x, pos_y, data, sort_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          node.id, kind, title, accent, width, height,
          node.position.x, node.position.y, data, i, n,
        ],
      });
    }

    // Insert edges
    if (Array.isArray(doc.edges)) {
      for (const edge of doc.edges) {
        await c.execute({
          sql: `INSERT OR REPLACE INTO canvas_edges (id, source_node_id, target_node_id, source_handle, target_handle, type, style, data, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            edge.id, edge.source, edge.target,
            edge.sourceHandle || null, edge.targetHandle || null,
            edge.type || "mineCurve",
            edge.style ? JSON.stringify(edge.style) : null,
            edge.data ? JSON.stringify(edge.data) : null,
            n,
          ],
        });
      }
    }

    // Insert viewport
    if (doc.viewport) {
      await c.execute({
        sql: `INSERT OR REPLACE INTO canvas_viewport (id, x, y, zoom, center_node_id, updated_at)
              VALUES (1, ?, ?, ?, ?, ?)`,
        args: [
          doc.viewport.x, doc.viewport.y, doc.viewport.zoom,
          doc.centerNodeId || null, n,
        ],
      });
    }

    // Drop old table
    await c.execute("DROP TABLE canvas");
    console.log("[canvas-store] Migrated old canvas table to normalized schema");
    return true;
  } catch (err) {
    console.error("[canvas-store] Migration failed:", err);
    return false;
  }
}

// --------------------------------------------------------- public read API

export type CanvasDocument = {
  version: 3;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  viewport: { x: number; y: number; zoom: number };
  centerNodeId?: string;
};

export async function readCanvasDocument(): Promise<CanvasDocument | null> {
  await ensureTables();
  await migrateFromOldTable();

  const c = getClient();
  const nodesResult = await c.execute(
    "SELECT * FROM canvas_nodes ORDER BY sort_order ASC",
  );

  if (nodesResult.rows.length === 0) return null;

  const nodes = nodesResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const data = JSON.parse((r.data as string) || "{}");
    const width = r.width as number;
    const height = r.height as number;
    const pos_x = r.pos_x as number;
    const pos_y = r.pos_y as number;

    return {
      id: r.id,
      type: "mine",
      position: { x: pos_x, y: pos_y },
      data: {
        kind: r.kind,
        title: r.title,
        accent: r.accent,
        width,
        height,
        ...data,
      },
      selected: false,
      draggable: false,
      width,
      height,
      measured: { width, height },
      style: { width, height },
      dragging: false,
    };
  });

  const edgesResult = await c.execute("SELECT * FROM canvas_edges");
  const edges = edgesResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id,
      source: r.source_node_id,
      target: r.target_node_id,
      sourceHandle: r.source_handle || undefined,
      targetHandle: r.target_handle || undefined,
      type: r.type || "mineCurve",
      style: r.style ? JSON.parse(r.style as string) : undefined,
      data: r.data ? JSON.parse(r.data as string) : {},
      selected: false,
    };
  });

  const vpResult = await c.execute("SELECT * FROM canvas_viewport WHERE id = 1");
  let viewport = { x: 0, y: 0, zoom: 0.8 };
  let centerNodeId: string | undefined;

  if (vpResult.rows.length > 0) {
    const vp = vpResult.rows[0] as Record<string, unknown>;
    viewport = {
      x: vp.x as number,
      y: vp.y as number,
      zoom: vp.zoom as number,
    };
    centerNodeId = (vp.center_node_id as string) || undefined;
  }

  return {
    version: 3,
    nodes,
    edges,
    viewport,
    ...(centerNodeId ? { centerNodeId } : {}),
  };
}

// -------------------------------------------------------- public write API

export async function writeCanvasDocument(document: {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  viewport: { x: number; y: number; zoom: number };
  centerNodeId?: string;
}): Promise<void> {
  await ensureTables();
  await migrateFromOldTable();

  const c = getClient();
  const n = nowISO();

  // Replace all nodes
  const existingNodes = await c.execute("SELECT id FROM canvas_nodes");
  const existingNodeIds = new Set(
    existingNodes.rows.map((r) => (r as Record<string, unknown>).id as string),
  );

  for (let i = 0; i < document.nodes.length; i++) {
    const node = document.nodes[i];
    const nd = (node.data || {}) as Record<string, unknown>;
    const { kind, title, accent, width, height, ...extra } = nd;
    const pos = (node.position || { x: 0, y: 0 }) as Record<string, number>;

    await c.execute({
      sql: `INSERT OR REPLACE INTO canvas_nodes (id, kind, title, accent, width, height, pos_x, pos_y, data, sort_order, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        node.id as string,
        kind as string,
        title as string,
        accent as string,
        width as number,
        height as number,
        pos.x, pos.y,
        JSON.stringify(extra),
        i, n,
      ],
    });
    existingNodeIds.delete(node.id as string);
  }

  // Remove deleted nodes
  for (const id of existingNodeIds) {
    await c.execute({ sql: "DELETE FROM canvas_nodes WHERE id = ?", args: [id] });
    await c.execute({ sql: "DELETE FROM canvas_edges WHERE source_node_id = ? OR target_node_id = ?", args: [id, id] });
  }

  // Replace all edges
  const existingEdges = await c.execute("SELECT id FROM canvas_edges");
  const existingEdgeIds = new Set(
    existingEdges.rows.map((r) => (r as Record<string, unknown>).id as string),
  );

  for (const edge of document.edges) {
    const ed = (edge.data || {}) as Record<string, unknown>;
    // Filter out non-edge fields from extra data
    const { sourceControl, targetControl, ...rest } = ed;
    const edgeData = { ...(sourceControl ? { sourceControl } : {}), ...(targetControl ? { targetControl } : {}), ...rest };

    await c.execute({
      sql: `INSERT OR REPLACE INTO canvas_edges (id, source_node_id, target_node_id, source_handle, target_handle, type, style, data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        edge.id as string,
        edge.source as string,
        edge.target as string,
        (edge.sourceHandle as string) || null,
        (edge.targetHandle as string) || null,
        (edge.type as string) || "mineCurve",
        edge.style ? JSON.stringify(edge.style) : null,
        Object.keys(edgeData).length > 0 ? JSON.stringify(edgeData) : null,
        n,
      ],
    });
    existingEdgeIds.delete(edge.id as string);
  }

  // Remove deleted edges
  for (const id of existingEdgeIds) {
    await c.execute({ sql: "DELETE FROM canvas_edges WHERE id = ?", args: [id] });
  }

  // Upsert viewport
  await c.execute({
    sql: `INSERT OR REPLACE INTO canvas_viewport (id, x, y, zoom, center_node_id, updated_at)
          VALUES (1, ?, ?, ?, ?, ?)`,
    args: [
      document.viewport.x,
      document.viewport.y,
      document.viewport.zoom,
      document.centerNodeId || null,
      n,
    ],
  });
}

// ---------------------------------------------------- seed helper

import { mineCanvasSeed } from "../components/mine-canvas/mineCanvasData";

export async function seedIfEmpty(): Promise<void> {
  await ensureTables();
  const result = await getClient().execute("SELECT COUNT(*) as cnt FROM canvas_nodes");
  if ((result.rows[0] as { cnt: number }).cnt > 0) return;

  console.log("[canvas-store] Seeding with mineCanvasSeed");
  await writeCanvasDocument(mineCanvasSeed as unknown as {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    viewport: { x: number; y: number; zoom: number };
    centerNodeId?: string;
  });
}
