import { createHmac, timingSafeEqual } from "node:crypto";

export const CANVAS_SESSION_COOKIE = "justin_canvas_session";
export const CANVAS_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createCanvasSession(
  secret: string,
  now = Date.now(),
  ttlMs = CANVAS_SESSION_TTL_MS,
) {
  const payload = String(now + ttlMs);
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyCanvasSession(value: string, secret: string, now = Date.now()) {
  const separator = value.indexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  return constantTimeEqual(providedSignature, signature(payload, secret));
}

export function getCanvasAuthSecret() {
  return process.env.CANVAS_AUTH_TOKEN?.trim() || "";
}

export function verifyCanvasLoginSecret(value: string, secret = getCanvasAuthSecret()) {
  if (!secret || !value) return false;
  return constantTimeEqual(value, secret);
}

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const item of cookieHeader.split(";")) {
    const [key, ...valueParts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

export function isCanvasSessionAuthorized(request: Request, secret = getCanvasAuthSecret()) {
  if (!secret) return false;
  return verifyCanvasSession(readCookie(request, CANVAS_SESSION_COOKIE), secret);
}

export function canvasSessionCookie(value: string, options: { clear?: boolean } = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = options.clear ? 0 : Math.floor(CANVAS_SESSION_TTL_MS / 1000);
  return `${CANVAS_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/api/canvas; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
