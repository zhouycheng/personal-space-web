import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  CANVAS_ADMIN_TAB_HEADER,
  isCanvasAdminTabToken,
} from "../../features/canvas/domain/canvas-admin-session.ts";

export const CANVAS_SESSION_COOKIE = "justin_canvas_session";
export const CANVAS_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type CanvasSessionPayload = {
  expiresAt: number;
  tabHash: string;
};

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
  tabToken: string,
  now = Date.now(),
  ttlMs = CANVAS_SESSION_TTL_MS,
) {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: now + ttlMs,
    tabHash: hashCanvasAdminTabToken(tabToken),
  } satisfies CanvasSessionPayload)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function hashCanvasAdminTabToken(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function parseCanvasSessionPayload(value: string): CanvasSessionPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as CanvasSessionPayload;
    if (!payload || typeof payload.expiresAt !== "number" || typeof payload.tabHash !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyCanvasSession(value: string, secret: string, tabToken: string, now = Date.now()) {
  const separator = value.indexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  if (!isCanvasAdminTabToken(tabToken)) return false;
  if (!constantTimeEqual(providedSignature, signature(payload, secret))) return false;
  const parsedPayload = parseCanvasSessionPayload(payload);
  if (!parsedPayload || !Number.isFinite(parsedPayload.expiresAt) || parsedPayload.expiresAt <= now) return false;
  return constantTimeEqual(parsedPayload.tabHash, hashCanvasAdminTabToken(tabToken));
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

export function readCanvasAdminTabToken(request: Request) {
  return request.headers.get(CANVAS_ADMIN_TAB_HEADER)?.trim() || "";
}

export function isCanvasSessionAuthorized(request: Request, secret = getCanvasAuthSecret()) {
  if (!secret) return false;
  return verifyCanvasSession(
    readCookie(request, CANVAS_SESSION_COOKIE),
    secret,
    readCanvasAdminTabToken(request),
  );
}

export function canvasSessionCookie(value: string, options: { clear?: boolean } = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = options.clear ? 0 : Math.floor(CANVAS_SESSION_TTL_MS / 1000);
  return `${CANVAS_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/api/canvas; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
