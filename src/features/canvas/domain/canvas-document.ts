export type CanvasDocumentV4 = {
  version: 4;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  viewport: { x: number; y: number; zoom: number };
  centerNodeId?: string;
};

export type CanvasReadResponse = {
  document: CanvasDocumentV4;
  revision: number;
  updatedAt: string;
  checksum: string;
};

export type CanvasWriteRequest = {
  document: CanvasDocumentV4;
  expectedRevision: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeCanvasDocument(value: unknown): CanvasDocumentV4 {
  if (!isRecord(value)) throw new TypeError("Invalid canvas document");
  if (value.version !== 3 && value.version !== 4) throw new TypeError("Invalid canvas document version");
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new TypeError("Invalid canvas document graph");
  if (!isRecord(value.viewport)) throw new TypeError("Invalid canvas document viewport");
  if (
    !isFiniteNumber(value.viewport.x) ||
    !isFiniteNumber(value.viewport.y) ||
    !isFiniteNumber(value.viewport.zoom)
  ) {
    throw new TypeError("Invalid canvas document viewport");
  }
  if (value.centerNodeId != null && typeof value.centerNodeId !== "string") {
    throw new TypeError("Invalid canvas document center node");
  }

  return {
    version: 4,
    nodes: value.nodes as Array<Record<string, unknown>>,
    edges: value.edges as Array<Record<string, unknown>>,
    viewport: {
      x: value.viewport.x,
      y: value.viewport.y,
      zoom: value.viewport.zoom,
    },
    ...(typeof value.centerNodeId === "string" && value.centerNodeId
      ? { centerNodeId: value.centerNodeId }
      : {}),
  };
}

export function parseCanvasWriteRequest(value: unknown): CanvasWriteRequest {
  if (!isRecord(value)) throw new TypeError("Invalid canvas write request");
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) {
    throw new TypeError("Invalid expected revision");
  }
  return {
    document: normalizeCanvasDocument(value.document),
    expectedRevision: value.expectedRevision as number,
  };
}

export function parseCanvasReadResponse(value: unknown): CanvasReadResponse {
  if (!isRecord(value)) throw new TypeError("Invalid canvas response");
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) {
    throw new TypeError("Invalid canvas response revision");
  }
  if (typeof value.updatedAt !== "string" || typeof value.checksum !== "string") {
    throw new TypeError("Invalid canvas response metadata");
  }
  return {
    document: normalizeCanvasDocument(value.document),
    revision: value.revision as number,
    updatedAt: value.updatedAt,
    checksum: value.checksum,
  };
}
