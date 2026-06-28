import {
  canvasSessionCookie,
  createCanvasSession,
  getCanvasAuthSecret,
  isCanvasSessionAuthorized,
  verifyCanvasLoginSecret,
} from "../../../server/canvas/canvas-auth.ts";

export const prerender = false;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

export async function GET({ request }: { request: Request }) {
  return json({ authenticated: isCanvasSessionAuthorized(request) });
}

export async function POST({ request }: { request: Request }) {
  const secret = getCanvasAuthSecret();
  if (!secret) return json({ error: "Server not configured" }, 503);
  const body = await request.json().catch(() => null);
  const loginSecret =
    body && typeof body === "object" && "passphrase" in body && typeof body.passphrase === "string"
      ? body.passphrase
      : body && typeof body === "object" && "token" in body && typeof body.token === "string"
        ? body.token
        : "";
  if (!verifyCanvasLoginSecret(loginSecret, secret)) return json({ error: "Unauthorized" }, 401);
  return json(
    { authenticated: true },
    200,
    { "Set-Cookie": canvasSessionCookie(createCanvasSession(secret)) },
  );
}

export async function DELETE() {
  return json(
    { authenticated: false },
    200,
    { "Set-Cookie": canvasSessionCookie("", { clear: true }) },
  );
}
