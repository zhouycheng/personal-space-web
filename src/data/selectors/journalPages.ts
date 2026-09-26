/** Physical faces only. Reading identity, history and bookmarks belong to the application. */
export function spreadFor(page: number, count: number, single: boolean): number[] {
  if (!count) return [];
  const index = Math.max(0, Math.min(count - 1, Math.trunc(page) || 0));
  return single ? [index] : [index - index % 2, index - index % 2 + 1].filter(i => i < count);
}

export function turnFaces(page: number, count: number, single: boolean, direction: 1 | -1) {
  const spread = spreadFor(page, count, single);
  if (!spread.length) return null;
  const next = single ? page + direction : spread[0] + direction * 2;
  if (next < 0 || next >= count) return null;
  return { from: page, to: next, front: single ? page : direction === 1 ? spread[0] + 1 : spread[0] - 1,
    back: single ? next : direction === 1 ? spread[0] + 2 : spread[0], direction };
}
