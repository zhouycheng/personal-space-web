import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

export type StoredCanvasDocument = {
  version: number;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  viewport: { x: number; y: number; zoom: number };
  centerNodeId?: string;
};

export type CanvasSnapshot = {
  document: StoredCanvasDocument;
  revision: number;
  updatedAt: string;
  checksum: string;
};

export type CanvasWriteResult =
  | { status: "saved"; snapshot: CanvasSnapshot }
  | { status: "conflict"; snapshot: CanvasSnapshot };

type RevisionRow = {
  nodes: string;
  edges: string;
  viewport: string;
  center_node_id: string | null;
  document_version: number;
  revision: number;
  created_at: string;
  checksum: string;
};

type LegacyCanvasRow = {
  nodes: string;
  edges: string;
  viewport: string;
  center_node_id: string | null;
  updated_at: string;
  document_version?: number;
};

export function resolveCanvasDatabasePath(
  configuredPath = process.env.CANVAS_DB_PATH || "data/canvas.db",
  cwd = process.cwd(),
): string {
  return path.resolve(cwd, configuredPath);
}

function serializeDocument(document: StoredCanvasDocument) {
  const nodes = JSON.stringify(document.nodes);
  const edges = JSON.stringify(document.edges);
  const viewport = JSON.stringify(document.viewport);
  const centerNodeId = document.centerNodeId || null;
  const checksum = createHash("sha256")
    .update(JSON.stringify({
      version: document.version,
      nodes: document.nodes,
      edges: document.edges,
      viewport: document.viewport,
      centerNodeId,
    }))
    .digest("hex");
  return { nodes, edges, viewport, centerNodeId, checksum };
}

export function createCanvasStore(databasePath = resolveCanvasDatabasePath()) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  database.pragma("synchronous = NORMAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS canvas (
      id TEXT PRIMARY KEY,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      viewport TEXT NOT NULL,
      center_node_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS canvas_documents (
      id TEXT PRIMARY KEY,
      current_revision INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS canvas_revisions (
      canvas_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      document_version INTEGER NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      viewport TEXT NOT NULL,
      center_node_id TEXT,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (canvas_id, revision),
      FOREIGN KEY (canvas_id) REFERENCES canvas_documents(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_revisions_created_at
      ON canvas_revisions(canvas_id, created_at DESC);
  `);

  database.prepare(
    "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  ).run(2, new Date().toISOString());

  const readCurrentRow = database.prepare(`
    SELECT revisions.*
    FROM canvas_documents documents
    JOIN canvas_revisions revisions
      ON revisions.canvas_id = documents.id
     AND revisions.revision = documents.current_revision
    WHERE documents.id = ?
  `);
  const readRevisionRow = database.prepare(`
    SELECT * FROM canvas_revisions WHERE canvas_id = ? AND revision = ?
  `);
  const readDocumentHead = database.prepare(`
    SELECT current_revision FROM canvas_documents WHERE id = ?
  `);
  const insertDocument = database.prepare(`
    INSERT INTO canvas_documents (id, current_revision, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertRevision = database.prepare(`
    INSERT INTO canvas_revisions (
      canvas_id, revision, document_version, nodes, edges, viewport,
      center_node_id, checksum, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const advanceHead = database.prepare(`
    UPDATE canvas_documents
    SET current_revision = ?, updated_at = ?
    WHERE id = ? AND current_revision = ?
  `);
  const readLegacy = database.prepare("SELECT * FROM canvas WHERE id = ?");

  function rowToSnapshot(row: RevisionRow): CanvasSnapshot {
    return {
      document: {
        version: row.document_version,
        nodes: JSON.parse(row.nodes),
        edges: JSON.parse(row.edges),
        viewport: JSON.parse(row.viewport),
        ...(row.center_node_id ? { centerNodeId: row.center_node_id } : {}),
      },
      revision: row.revision,
      updatedAt: row.created_at,
      checksum: row.checksum,
    };
  }

  function read(): CanvasSnapshot | null {
    const row = readCurrentRow.get("current") as RevisionRow | undefined;
    return row ? rowToSnapshot(row) : null;
  }

  function insertImmutableRevision(document: StoredCanvasDocument, revision: number, createdAt: string) {
    const serialized = serializeDocument(document);
    insertRevision.run(
      "current",
      revision,
      document.version,
      serialized.nodes,
      serialized.edges,
      serialized.viewport,
      serialized.centerNodeId,
      serialized.checksum,
      createdAt,
    );
  }

  const seedTransaction = database.transaction((fallback: StoredCanvasDocument): CanvasSnapshot => {
    const current = read();
    if (current) return current;

    const legacy = readLegacy.get("current") as LegacyCanvasRow | undefined;
    const document = legacy
      ? {
          version: legacy.document_version || 3,
          nodes: JSON.parse(legacy.nodes),
          edges: JSON.parse(legacy.edges),
          viewport: JSON.parse(legacy.viewport),
          ...(legacy.center_node_id ? { centerNodeId: legacy.center_node_id } : {}),
        }
      : fallback;
    const createdAt = legacy?.updated_at || new Date().toISOString();
    insertDocument.run("current", 0, createdAt, createdAt);
    insertImmutableRevision(document, 0, createdAt);
    const seeded = read();
    if (!seeded) throw new Error("Canvas seed failed");
    return seeded;
  });

  const writeTransaction = database.transaction(
    (document: StoredCanvasDocument, expectedRevision: number): CanvasWriteResult => {
      const current = read();
      if (!current) throw new Error("Canvas document has not been seeded");
      if (current.revision !== expectedRevision) {
        return { status: "conflict", snapshot: current };
      }

      const nextRevision = expectedRevision + 1;
      const createdAt = new Date().toISOString();
      insertImmutableRevision(document, nextRevision, createdAt);
      const advanced = advanceHead.run(nextRevision, createdAt, "current", expectedRevision);
      if (advanced.changes !== 1) {
        throw new Error("Canvas head changed while committing an immutable revision");
      }
      const snapshot = read();
      if (!snapshot) throw new Error("Canvas save could not be read back");
      return { status: "saved", snapshot };
    },
  );

  function readRevision(revision: number): CanvasSnapshot | null {
    const row = readRevisionRow.get("current", revision) as RevisionRow | undefined;
    return row ? rowToSnapshot(row) : null;
  }

  function listRevisions(limit = 100) {
    return (database.prepare(`
      SELECT revision, document_version AS documentVersion, checksum, created_at AS createdAt
      FROM canvas_revisions
      WHERE canvas_id = ?
      ORDER BY revision DESC
      LIMIT ?
    `).all("current", limit)) as Array<{
      revision: number;
      documentVersion: number;
      checksum: string;
      createdAt: string;
    }>;
  }

  function restoreRevision(revision: number, expectedRevision: number): CanvasWriteResult {
    const snapshot = readRevision(revision);
    if (!snapshot) throw new Error(`Canvas revision ${revision} does not exist`);
    return writeTransaction(snapshot.document, expectedRevision);
  }

  return {
    read,
    readRevision,
    listRevisions,
    restoreRevision,
    seedIfEmpty: (document: StoredCanvasDocument) => seedTransaction(document),
    write: (document: StoredCanvasDocument, expectedRevision: number) =>
      writeTransaction(document, expectedRevision),
    check: () => {
      const row = database.prepare("SELECT 1 AS value").get() as { value: number };
      return { ok: row.value === 1, path: databasePath };
    },
    close: () => database.close(),
    database,
  };
}

export type CanvasStore = ReturnType<typeof createCanvasStore>;

let singleton: CanvasStore | null = null;

export function getCanvasStore(): CanvasStore {
  singleton ??= createCanvasStore();
  return singleton;
}
