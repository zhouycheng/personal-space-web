import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { mineCanvasSeed } from "../components/mine-canvas/mineCanvasData";

const DB_PATH = import.meta.env.CANVAS_DB_PATH || "data/canvas.db";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dbPath = join(process.cwd(), DB_PATH);
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas (
      id TEXT PRIMARY KEY,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      viewport TEXT NOT NULL,
      center_node_id TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  return db;
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
  const database = getDb();
  const row = database
    .prepare("SELECT * FROM canvas WHERE id = ?")
    .get("current") as
    | {
        nodes: string;
        edges: string;
        viewport: string;
        center_node_id: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    version: 3,
    nodes: JSON.parse(row.nodes),
    edges: JSON.parse(row.edges),
    viewport: JSON.parse(row.viewport),
    ...(row.center_node_id ? { centerNodeId: row.center_node_id } : {}),
  };
}

// -------------------------------------------------------- public write API

export async function writeCanvasDocument(document: {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  viewport: { x: number; y: number; zoom: number };
  centerNodeId?: string;
}): Promise<void> {
  const database = getDb();

  database
    .prepare(
      `INSERT INTO canvas (id, nodes, edges, viewport, center_node_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         nodes = excluded.nodes,
         edges = excluded.edges,
         viewport = excluded.viewport,
         center_node_id = excluded.center_node_id,
         updated_at = excluded.updated_at`,
    )
    .run(
      "current",
      JSON.stringify(document.nodes),
      JSON.stringify(document.edges),
      JSON.stringify(document.viewport),
      document.centerNodeId || null,
      new Date().toISOString(),
    );
}

// ---------------------------------------------------- seed helper

export async function seedIfEmpty(): Promise<void> {
  const database = getDb();
  const row = database.prepare("SELECT id FROM canvas WHERE id = ?").get("current");
  if (row) return;

  console.log("[canvas-store] Seeding with mineCanvasSeed");
  await writeCanvasDocument(
    mineCanvasSeed as unknown as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
      viewport: { x: number; y: number; zoom: number };
      centerNodeId?: string;
    },
  );
}
