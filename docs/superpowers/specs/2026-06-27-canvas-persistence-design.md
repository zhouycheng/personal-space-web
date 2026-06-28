# Mine Canvas Persistence & Author Identity Design

> Status: superseded. This design describes the original JSON-file and
> browser-local author-token approach. The current implementation uses SQLite
> append-only revisions, HttpOnly author sessions, stable `data/canvas-assets`,
> and `/api/canvas` read/write envelopes with optimistic revision checks.

## Goals

1. **Author edits persist** across page refreshes and tab sessions
2. **All visitors see** the author's latest published canvas data
3. **Visitor mode is invisible** — no edit UI, no hint that editing exists
4. **Author identity via console** — one-time passphrase setup, session-based activation
5. **Passphrase never stored in code** — only encrypted token and salt in the project
6. **Data survives code updates** — new fields default to seed values, old data preserved

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Server (Astro API)                      │
│                                                           │
│  GET  /api/canvas  →  Read data/canvas.json               │
│                     →  Return document or seed fallback    │
│                                                           │
│  POST /api/canvas  →  Validate Authorization header       │
│                     →  Write data/canvas.json              │
│                     →  Return 200 / 401                    │
│                                                           │
│  Storage: data/canvas.json (git-ignored JSON file)         │
└──────────────────────────────────────────────────────────┘
                           ▲
                           │ HTTP
                           ▼
┌──────────────────────────────────────────────────────────┐
│                    Browser (Client)                        │
│                                                           │
│  localStorage:                                            │
│    author_password — raw passphrase (never in git)      │
│                                                           │
│  sessionStorage:                                          │
│    author_token    — decrypted AUTH_TOKEN                 │
│    author_active   — boolean, author mode flag            │
│                                                           │
│  Author flow:                                             │
│    passphrase + SALT → PBKDF2 key → AES-GCM decrypt       │
│    ENCRYPTED_TOKEN → AUTH_TOKEN → sessionStorage          │
│                                                           │
│  Visitor flow:                                            │
│    No passphrase → no sessionStorage → view-only          │
└──────────────────────────────────────────────────────────┘
```

## Identity Verification

### Environment Variables

```
# .env.local (never committed)
CANVAS_AUTH_TOKEN=<64-char hex random>        # Server-side truth
CANVAS_SALT=<base64 random bytes>             # Injected into client JS
CANVAS_ENCRYPTED_TOKEN=<AES-GCM ciphertext>   # Injected into client JS

# .env.example (committed, placeholder values only)
CANVAS_AUTH_TOKEN=change-me-to-64-char-hex
CANVAS_SALT=will-be-generated
CANVAS_ENCRYPTED_TOKEN=will-be-generated
```

### Key Derivation

```
passphrase ─┐
            ├─→ PBKDF2(iterations=600k, hash=SHA-256) → 256-bit key
SALT ───────┘
```

### Encryption (from passphrase to ENCRYPTED_TOKEN)

```
AES-256-GCM(key, iv=random_12_bytes) → encrypt(AUTH_TOKEN)
                                       → ciphertext + auth tag
                                       → base64 encode
                                       → CANVAS_ENCRYPTED_TOKEN
```

IV is prepended to the ciphertext before base64 encoding.

### Client-side Verification (on page load)

```
1. Read passphrase from localStorage('author_password')
2. If missing → visitor mode, stop
3. Derive key: PBKDF2(passphrase, SALT)
4. Decrypt: AES-GCM(key, ENCRYPTED_TOKEN)
5. If decryption fails (bad auth tag) → visitor mode, stop
6. Success → sessionStorage.setItem('author_token', decrypted)
7. sessionStorage.setItem('author_active', '1')
```

### Session Lifecycle

| Action | sessionStorage | localStorage |
|--------|---------------|--------------|
| Page refresh | Preserved | Preserved |
| Close all tabs of this origin | Cleared | Preserved |
| New tab after close | Empty → visitor mode | Preserved → re-derive key |
| User clears browser data | Cleared | Cleared |

### One-time Setup Script

A generation script (`scripts/generate-canvas-auth.ts`) that:

1. Prompts for passphrase (or reads from env)
2. Generates random AUTH_TOKEN, SALT
3. Derives PBKDF2 key from passphrase + SALT
4. Encrypts AUTH_TOKEN → ENCRYPTED_TOKEN
5. Outputs the three env vars to append to `.env.local`

## API Design

### GET /api/canvas

- **Auth**: None (public)
- **Response**: `MineCanvasDocument` JSON
- **Logic**:
  1. Read `data/canvas.json`
  2. If exists and valid → return it
  3. If not → return `mineCanvasSeed` (imported from mineCanvasData.ts)
- **Response Headers**: `Cache-Control: no-cache`

### POST /api/canvas

- **Auth**: `Authorization: Bearer <AUTH_TOKEN>` header
- **Body**: `MineCanvasDocument` JSON (nodes, edges, viewport)
- **Validation**:
  1. Extract Bearer token from Authorization header
  2. Compare with `CANVAS_AUTH_TOKEN` using `crypto.timingSafeEqual`
  3. If mismatch → 401
  4. Validate body is valid MineCanvasDocument (version field exists, nodes/edges are arrays)
  5. If invalid → 400
- **Success**: Write to `data/canvas.json`, return 200 `{ ok: true }`
- **Error Handling**: Write to temp file first, then rename (atomic write)

## Client Integration

### MineCanvas.astro Changes

```
---
// Before:
<MineCanvasEditor seedDocument={mineCanvasSeed} client:only="react" />

// After: Pass env vars for client-side auth
<MineCanvasEditor
  seedDocument={mineCanvasSeed}
  authSalt={CANVAS_SALT}
  authEncryptedToken={CANVAS_ENCRYPTED_TOKEN}
  client:only="react"
/>
---
```

### MineCanvasEditor Changes

New hooks and state:

```
// New: author mode detection
const [isAuthor, setIsAuthor] = useState(false);
const [authToken, setAuthToken] = useState("");

// New: load persisted data on mount
const [initialDocument, setInitialDocument] = useState(null);

useEffect(() => {
  // 1. Try to derive auth from localStorage passphrase
  const token = tryDeriveAuthToken(salt, encryptedToken);
  if (token) {
    sessionStorage.setItem('author_token', token);
    sessionStorage.setItem('author_active', '1');
    setAuthToken(token);
    setIsAuthor(true);
  }

  // 2. Load canvas data from API
  fetch('/api/canvas')
    .then(res => res.json())
    .then(data => setInitialDocument(prepareDocument(data)))
    .catch(() => setInitialDocument(prepareDocument(seedDocument)));
}, []);

// 3. Auto-save when author makes changes (debounced)
useEffect(() => {
  if (!isAuthor) return;
  const timer = setTimeout(() => {
    fetch('/api/canvas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ nodes, edges, viewport })
    });
  }, 2000);
  return () => clearTimeout(timer);
}, [nodes, edges, viewport, isAuthor, authToken]);
```

### Visitor Experience

- No edit buttons, no create panel (no change from current behavior)
- No indication that editing is possible
- Data loaded from API (author's latest version)
- Refresh → re-fetch from API → latest data
- Clean browser → still sees author's published data

### Author Experience

- Console setup (one-time): `localStorage.setItem('author_password', '<passphrase>')`
- Page load → auto-derive → sessionStorage populated → edit UI visible
- Make changes → auto-save to API after 2s debounce
- Refresh → sessionStorage gone, but re-derives from localStorage → author mode restored
- Close all tabs → sessionStorage gone → re-derive on next open

## Data Compatibility

### Version Field

`MineCanvasDocument.version` is already `3`. When code adds new node fields:

```
// When loading from API, merge missing defaults from seed
function prepareDocument(doc: MineCanvasDocument): MineCanvasDocument {
  // Existing prepareDocument logic adds defaults
  // New fields in future code will get seed defaults automatically
  return doc;
}
```

The seed file acts as the schema default source. Any field present in seed but missing in saved data gets the seed value.

### Atomic Writes

```
POST handler:
  1. Write to data/canvas.json.tmp
  2. fs.rename(canvas.json.tmp → canvas.json)
  3. If rename fails, original file is untouched
```

Prevents corruption from concurrent writes or crashes mid-write.

## Security

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Visitor reads JS source, gets SALT + ENCRYPTED_TOKEN | Without passphrase, PBKDF2 + AES-GCM is infeasible to break |
| Visitor forges sessionStorage | Server checks AUTH_TOKEN on every POST |
| Visitor calls POST directly without UI | Authorization header required |
| Passphrase leaked | Change passphrase, re-run generation script → new ENCRYPTED_TOKEN |
| Code repo leaked | Passphrase is never in the repo |
| .env.local leaked | Rotate AUTH_TOKEN and re-generate |
| Timing attack on token comparison | `crypto.timingSafeEqual` used |
| Partial write corrupts data | Atomic write (tmp + rename) |

### What's NOT Protected

- If someone has physical access to the author's unlocked computer, they can read localStorage
- MITM on localhost (not a real concern for a dev/personal site)
- The passphrase is in localStorage in plaintext (acceptable for a personal site)

## Files Changed / Created

### New Files

| File | Purpose |
|------|---------|
| `scripts/generate-canvas-auth.ts` | One-time setup: generate env vars from passphrase |
| `src/pages/api/canvas.ts` | GET + POST API route |
| `src/lib/canvas-auth.ts` | PBKDF2 + AES-GCM encrypt/decrypt helpers |
| `data/canvas.json` | Persisted canvas data (git-ignored) |
| `data/.gitkeep` | Keep data directory in git |

### Modified Files

| File | Change |
|------|--------|
| `.env.example` | Add CANVAS_AUTH_TOKEN, CANVAS_SALT, CANVAS_ENCRYPTED_TOKEN placeholders |
| `.env.local` | Add real values (generated by script) |
| `.gitignore` | Add `data/canvas.json` |
| `src/components/mine-canvas/MineCanvas.astro` | Pass authSalt and authEncryptedToken props |
| `src/components/mine-canvas/MineCanvasEditor.tsx` | Add author detection, API load/save hooks |
| `src/components/mine-canvas/mineCanvasData.ts` | Export seed as constant for API fallback use |

## Implementation Order

1. Create generation script (`scripts/generate-canvas-auth.ts`)
2. Create `src/lib/canvas-auth.ts` helpers
3. Create `src/pages/api/canvas.ts` API route
4. Update `.env.example` and `.gitignore`
5. Update `MineCanvasEditor.tsx` with auth + persistence hooks
6. Update `MineCanvas.astro` with new props
7. Manual verification flow
