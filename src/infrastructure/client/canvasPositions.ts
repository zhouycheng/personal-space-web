export const POSITION_KEY = 'justin-canvas-positions-v1';
export type Positions = Record<string, { x: number; y: number }>;
export function parsePositions(value: string | null): Positions {
  try {
    const input = JSON.parse(value ?? '{}');
    const result: Positions = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [id, point] of Object.entries(input)) {
      if (id === '__proto__' || id === 'constructor' || !point || typeof point !== 'object') continue;
      const { x, y } = point as { x: number; y: number };
      if (Number.isFinite(x) && Number.isFinite(y)) result[id] = { x, y };
    }
    return result;
  } catch { return {}; }
}
export function applyPositions<T extends { id: string; position: { x: number; y: number } }>(nodes: T[], positions: Positions): T[] {
  return nodes.map(node => ({ ...node, position: Object.hasOwn(positions, node.id) ? positions[node.id] : node.position }));
}
