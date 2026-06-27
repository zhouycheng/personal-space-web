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

function ensureTable(): Promise<void> {
  return getClient().execute(`
    CREATE TABLE IF NOT EXISTS canvas (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).then(() => undefined);
}

export async function readCanvasDocument(): Promise<object | null> {
  await ensureTable();
  const result = await getClient().execute("SELECT data FROM canvas WHERE id = 1");
  if (result.rows.length === 0) return null;
  try {
    const raw = result.rows[0].data;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function writeCanvasDocument(document: object): Promise<void> {
  await ensureTable();
  const json = JSON.stringify(document);
  await getClient().execute({
    sql: `INSERT INTO canvas (id, version, data, updated_at) VALUES (1, 3, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET version = 3, data = excluded.data, updated_at = datetime('now')`,
    args: [json],
  });
}
