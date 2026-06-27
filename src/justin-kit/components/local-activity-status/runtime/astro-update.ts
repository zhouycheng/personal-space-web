import type { APIRoute } from "astro";

import {
  activityStatusStore,
  DEFAULT_ACTIVITY_TTL_MS,
} from "./store";
import type { ActivityUpdatePayload, ActivityWireState } from "./types";

export const prerender = false;

function getMonitorToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-activity-token");
}

function parseState(value: unknown): ActivityWireState | null {
  return value === "active" || value === "inactive" ? value : null;
}

function parseActivityPayload(body: unknown): ActivityUpdatePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const state = parseState(candidate.state);
  if (!state) {
    return null;
  }

  const rawAppName = candidate.appName;
  const appName =
    typeof rawAppName === "string" && rawAppName.trim().length > 0
      ? rawAppName.trim().slice(0, 120)
      : null;

  const rawObservedAt = candidate.observedAt;
  const observedAt =
    typeof rawObservedAt === "number" && Number.isFinite(rawObservedAt)
      ? rawObservedAt
      : undefined;

  const rawSessionId = candidate.sessionId;
  const sessionId =
    typeof rawSessionId === "string" && rawSessionId.trim().length > 0
      ? rawSessionId.trim().slice(0, 120)
      : null;

  return {
    appName,
    state,
    observedAt,
    sessionId,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const expectedToken = import.meta.env.ACTIVITY_MONITOR_TOKEN;
  if (!expectedToken) {
    return Response.json(
      { message: "ACTIVITY_MONITOR_TOKEN is not configured." },
      { status: 503 }
    );
  }

  const token = getMonitorToken(request);
  if (token !== expectedToken) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const payload = parseActivityPayload(body);
  if (!payload) {
    return Response.json({ message: "Invalid activity payload." }, { status: 400 });
  }

  const snapshot = activityStatusStore.update(payload, DEFAULT_ACTIVITY_TTL_MS);

  return Response.json({
    ok: true,
    active: Boolean(snapshot),
    ttlMs: DEFAULT_ACTIVITY_TTL_MS,
  });
};
