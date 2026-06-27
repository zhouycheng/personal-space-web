# Mine Canvas Persistence & Author Identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side persistence and PBKDF2+AES-GCM author identity to the mine-canvas editor, so the author's edits survive deploys and are visible to all visitors, while visitors never see edit UI.

**Architecture:** Astro API route (`/api/canvas`) serves canvas data from a JSON file on disk. Author identity is established by decrypting an env-injected encrypted token using a passphrase stored only in the author's browser localStorage. The encrypted token + salt are public in client JS; the passphrase is never in the codebase.

**Tech Stack:** Astro API routes (Node.js adapter), React + @xyflow/react (existing), Web Crypto API (PBKDF2 + AES-256-GCM), Node.js `crypto` module

## Global Constraints

- Node >= 22.12.0 (project requirement)
- Astro server mode with `@astrojs/node` adapter (existing)
- All canvas data lives in `MineCanvasDocument` type (existing, `version: 3`)
- Seed file `mineCanvasSeed` is the fallback when no persisted data exists
- Passphrase never exists in any committed file or env variable
- `.env.local` contains the real `CANVAS_AUTH_TOKEN`, `CANVAS_SALT`, `CANVAS_ENCRYPTED_TOKEN`
- `data/canvas.json` is git-ignored (server-side persistence file)

---

### Task 1: Create auth generation script

**Files:**
- Create: `scripts/generate-canvas-auth.mjs`

**Interfaces:**
- Produces: script outputs three env vars to stdout for manual addition to `.env.local`

- [ ] **Step 1: Create `scripts/generate-canvas-auth.mjs`**

```javascript
import crypto from "node:crypto";

function generate(passphrase) {
  const authToken = crypto.randomBytes(32).toString("hex");
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const key = crypto.pbkdf2Sync(passphrase, salt, 600000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(authToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encryptedToken = Buffer.concat([iv, encrypted, authTag]);

  return {
    CANVAS_AUTH_TOKEN: authToken,
    CANVAS_SALT: salt.toString("base64"),
    CANVAS_ENCRYPTED_TOKEN: encryptedToken.toString("base64"),
  };
}

const passphrase = process.argv[2];
if (!passphrase) {
  console.error("Usage: node scripts/generate-canvas-auth.mjs <passphrase>");
  process.exit(1);
}

const vars = generate(passphrase);
console.log("\nAdd these to your .env.local:\n");
for (const [key, value] of Object.entries(vars)) {
  console.log(`${key}=${value}`);
}
```

- [ ] **Step 2: Test script**

Run: `node scripts/generate-canvas-auth.mjs "test-passphrase"`
Expected: Outputs three env vars with non-empty values, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-canvas-auth.mjs
git commit -m "feat(canvas): add auth token generation script"
```

---

### Task 2: Create auth helper library

**Files:**
- Create: `src/lib/canvas-auth.ts`

**Interfaces:**
- Produces: `tryDeriveAuthToken(passphrase, salt, encryptedToken)` → `Promise<string | null>` for browser use

- [ ] **Step 1: Create `src/lib/canvas-auth.ts`**

```typescript
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function tryDeriveAuthToken(
  passphrase: string,
  saltBase64: string,
  encryptedTokenBase64: string,
): Promise<string | null> {
  try {
    const salt = base64ToBytes(saltBase64);
    const encryptedData = base64ToBytes(encryptedTokenBase64);

    const iv = encryptedData.slice(0, 12);
    const ciphertext = encryptedData.slice(12);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 600000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/canvas-auth.ts
git commit -m "feat(canvas): add client-side PBKDF2+AES-GCM auth helper"
```

---

### Task 3: Create canvas API route

**Files:**
- Create: `src/pages/api/canvas.ts`
- Create: `data/.gitkeep`

**Interfaces:**
- Produces: `GET /api/canvas` returns `MineCanvasDocument`, `POST /api/canvas` writes document (auth required)
- Consumes: `mineCanvasSeed` from `src/components/mine-canvas/mineCanvasData.ts`, `CANVAS_AUTH_TOKEN` from `import.meta.env`

- [ ] **Step 1: Create `data/.gitkeep`**

```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 2: Create `src/pages/api/canvas.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add data/.gitkeep src/pages/api/canvas.ts
git commit -m "feat(canvas): add GET/POST API route for canvas persistence"
```

---

### Task 4: Update configuration files

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Update `.env.example`**

Append to `.env.example`:

```
# Canvas persistence
CANVAS_AUTH_TOKEN=change-me-to-64-char-hex
CANVAS_SALT=will-be-generated
CANVAS_ENCRYPTED_TOKEN=will-be-generated
```

- [ ] **Step 2: Update `.gitignore`**

Append to `.gitignore`:

```
# canvas persistence data
/data/canvas.json
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore(canvas): add canvas auth env placeholders and gitignore data file"
```

---

### Task 5: Update MineCanvasEditor with auth + persistence

**Files:**
- Modify: `src/components/mine-canvas/MineCanvasEditor.tsx`

**Interfaces:**
- Consumes: `tryDeriveAuthToken` from `src/lib/canvas-auth.ts`
- Produces: Updated `MineCanvasEditor` component that loads from API, detects author mode, auto-saves

- [ ] **Step 1: Add import for auth helper**

At the top of `MineCanvasEditor.tsx`, after existing imports, add:

```typescript
import { tryDeriveAuthToken } from "../../lib/canvas-auth";
```

- [ ] **Step 2: Update `MineCanvasEditorProps` to accept auth props**

Replace existing props type (around line 106) with:

```typescript
type MineCanvasEditorProps = {
  seedDocument: MineCanvasDocument;
  authSalt?: string;
  authEncryptedToken?: string;
};
```

- [ ] **Step 3: Add author detection hook, API data loading, and auto-save**

Replace the default export function signature and initial state block (lines 325-343). The old code:

```typescript
export default function MineCanvasEditor({ seedDocument }: MineCanvasEditorProps) {
  const initialDocument = useMemo(() => prepareDocument(seedDocument), [seedDocument]);
  const [nodes, setNodes] = useState<MineCanvasNode[]>(initialDocument.nodes);
  const [edges, setEdges] = useState<MineCanvasEdge[]>(initialDocument.edges);
  const [viewport, setViewport] = useState(initialDocument.viewport);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  // ... rest of state
```

Becomes:

```typescript
export default function MineCanvasEditor({ seedDocument, authSalt, authEncryptedToken }: MineCanvasEditorProps) {
  const preparedSeed = useMemo(() => prepareDocument(seedDocument), [seedDocument]);
  const [remoteDocument, setRemoteDocument] = useState<MineCanvasDocument | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const [saveError, setSaveError] = useState(false);

  const initialDocument = useMemo(() => {
    if (remoteDocument) return prepareDocument(remoteDocument);
    return preparedSeed;
  }, [remoteDocument, preparedSeed]);

  const [nodes, setNodes] = useState<MineCanvasNode[]>(initialDocument.nodes);
  const [edges, setEdges] = useState<MineCanvasEdge[]>(initialDocument.edges);
  const [viewport, setViewport] = useState(initialDocument.viewport);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  // ... (rest of existing state declarations unchanged)
```

- [ ] **Step 4: Add useEffects for API loading, author detection, auto-save**

Add these three effects after the existing `useEffect` that loads fonts (after line 352, before the `releaseObjectUrl` callback):

```typescript
  // Load canvas data from API on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/canvas")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.nodes)) {
          setRemoteDocument(data);
        }
      })
      .catch(() => { /* use seed fallback */ });
    return () => { cancelled = true; };
  }, []);

  // Detect author via passphrase decryption
  useEffect(() => {
    if (!authSalt || !authEncryptedToken) return;
    const existing = sessionStorage.getItem("author_token");
    if (existing) {
      setAuthToken(existing);
      setIsAuthor(true);
      return;
    }
    const passphrase = localStorage.getItem("author_password");
    if (!passphrase) return;
    tryDeriveAuthToken(passphrase, authSalt, authEncryptedToken).then((token) => {
      if (token) {
        sessionStorage.setItem("author_token", token);
        sessionStorage.setItem("author_active", "1");
        setAuthToken(token);
        setIsAuthor(true);
      }
    });
  }, [authSalt, authEncryptedToken]);

  // Apply remote data to state once loaded
  useEffect(() => {
    if (!remoteDocument) return;
    const doc = prepareDocument(remoteDocument);
    setNodes(doc.nodes);
    setEdges(doc.edges);
    setViewport(doc.viewport);
  }, [remoteDocument]);

  // Auto-save when author makes changes (2s debounce)
  useEffect(() => {
    if (!isAuthor || !authToken) return;
    setSaveError(false);
    const timer = setTimeout(() => {
      fetch("/api/canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({ version: 3, nodes, edges, viewport }),
      }).then((res) => {
        if (!res.ok) setSaveError(true);
      }).catch(() => {
        setSaveError(true);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [nodes, edges, viewport, isAuthor, authToken]);
```

- [ ] **Step 5: Gate editor UI on isAuthor**

Five precise edits in the JSX return block (lines 602-682):

**Edit 1**: Gate the sidebar delete button (line 616). Wrap with `isAuthor`:

```tsx
// Before:
<button className="mine-canvas-layer-delete" type="button" onClick={() => deleteNode(node.id)} aria-label={`删除 ${node.data.title}`}><Trash2 size={14} /></button>

// After:
{isAuthor && <button className="mine-canvas-layer-delete" type="button" onClick={() => deleteNode(node.id)} aria-label={`删除 ${node.data.title}`}><Trash2 size={14} /></button>}
```

**Edit 2**: Gate the entire create control block (lines 622-627). Wrap with `isAuthor`:

```tsx
// Before:
<div className="mine-create-control">
  <button type="button" className="mine-create-toggle" ...>

// After:
{isAuthor && <div className="mine-create-control">
  <button type="button" className="mine-create-toggle" ...>
  {createPanelOpen ? <CreatePanel addNode={addNode} /> : null}
</div>}
```

**Edit 3**: Gate edge double-click deletion (line 649). Change to conditional:

```tsx
// Before:
onEdgeDoubleClick={(_, edge) => setEdges((current) => current.filter((item) => item.id !== edge.id))}

// After:
onEdgeDoubleClick={isAuthor ? (_, edge) => setEdges((current) => current.filter((item) => item.id !== edge.id)) : undefined}
```

**Edit 4**: Gate `nodesDraggable` (line 654). Pass `isAuthor`:

```tsx
// Before:
nodesDraggable

// After:
nodesDraggable={isAuthor}
```

**Edit 5**: Gate `nodesConnectable` (line 655). Pass `isAuthor`:

```tsx
// Before:
nodesConnectable

// After:
nodesConnectable={isAuthor}
```

The `MineCanvasRuntimeContext.Provider` still passes all mutation callbacks (deleteNode, updateNodeData, etc.) — they remain functional but are only reachable through UI elements now gated by `isAuthor`. Author detection happens via `useEffect`, so the runtime context does not need conditional logic.

- [ ] **Step 6: Verify the build compiles**

Run: `npx astro check 2>&1 | head -20`
Expected: No new TypeScript errors related to the canvas changes.

- [ ] **Step 7: Commit**

```bash
git add src/components/mine-canvas/MineCanvasEditor.tsx
git commit -m "feat(canvas): add API loading, author detection, and auto-save to editor"
```

---

### Task 6: Update MineCanvas.astro with auth props

**Files:**
- Modify: `src/components/mine-canvas/MineCanvas.astro`

- [ ] **Step 1: Pass auth env vars as props**

Replace the content of `MineCanvas.astro`:

```astro
---
import MineCanvasEditor from "./MineCanvasEditor";
import { mineCanvasSeed } from "./mineCanvasData";

const authSalt = import.meta.env.CANVAS_SALT || "";
const authEncryptedToken = import.meta.env.CANVAS_ENCRYPTED_TOKEN || "";
---

<div class="mine-canvas-mount" data-mine-canvas-mount>
  <MineCanvasEditor
    seedDocument={mineCanvasSeed}
    authSalt={authSalt}
    authEncryptedToken={authEncryptedToken}
    client:only="react"
  />
</div>
```

- [ ] **Step 2: Verify build**

Run: `npx astro build 2>&1 | tail -5`
Expected: Build succeeds (may take a moment).

- [ ] **Step 3: Commit**

```bash
git add src/components/mine-canvas/MineCanvas.astro
git commit -m "feat(canvas): pass auth env vars to MineCanvasEditor"
```

---

### Task 7: Manual verification flow

**Files:**
- None (verification only)

- [ ] **Step 1: Generate auth credentials**

Run: `node scripts/generate-canvas-auth.mjs "your-chosen-passphrase"`
Add the three output lines to `.env.local`.
Example passphrase: `my-secret-canvas-key-2026`

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Verify visitor mode**

Open the canvas page in a fresh incognito window.
Expected:
- Canvas loads with seed data (or saved data from API)
- No edit UI visible (no "+" button, no delete buttons)
- No errors in console

- [ ] **Step 4: Set up author mode**

In the browser console of a regular (non-incognito) window:
```
localStorage.setItem('author_password', 'your-chosen-passphrase')
```
Refresh the page.

Expected:
- Edit UI now visible ("+" button to create nodes, delete buttons on selected nodes)
- sessionStorage contains `author_token` and `author_active`

- [ ] **Step 5: Verify persistence**

As author, make a change (e.g., move a node, edit text).
Wait 3+ seconds for auto-save debounce.
Check `data/canvas.json` exists and contains the modified data.
Open another incognito window → should see the updated data.

- [ ] **Step 6: Verify session expiry**

Close ALL tabs of the site. Open a new tab.
Expected: No edit UI (sessionStorage cleared). The saved data is still visible (loaded from API).
Open console: `localStorage.getItem('author_password')` should still return the passphrase.

- [ ] **Step 7: Verify re-activation**

Refresh the page (with passphrase still in localStorage).
Expected: Edit UI visible again (sessionStorage re-populated from passphrase decryption).

- [ ] **Step 8: Verify data survives code changes**

Add a hypothetical new field to `mineCanvasSeed` (e.g., a new node). Reload.
Expected: Old saved data loads fine, new seed-only fields get default values via `prepareDocument`.

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Auth generation script | `scripts/generate-canvas-auth.mjs` (new) |
| 2 | Browser auth helper | `src/lib/canvas-auth.ts` (new) |
| 3 | Canvas API route | `src/pages/api/canvas.ts` (new), `data/.gitkeep` (new) |
| 4 | Config files | `.env.example`, `.gitignore` (modify) |
| 5 | Editor integration | `MineCanvasEditor.tsx` (modify) |
| 6 | Astro page integration | `MineCanvas.astro` (modify) |
| 7 | Manual verification | None |
