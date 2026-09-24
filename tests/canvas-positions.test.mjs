import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePositions, applyPositions } from '../src/components/mine-canvas/canvasPositions.ts';
import { mineCanvasSeed } from '../src/components/mine-canvas/mineCanvasData.ts';
test('invalid storage falls back to defaults', () => {
  for (const input of [null, 'broken', 'null', '[]', '{"a":{"x":"1","y":2}}']) assert.deepEqual(parsePositions(input), {});
});
test('positions preserve current content and ignore removed IDs', () => {
  const positions = parsePositions('{"intro":{"x":4,"y":5,"content":"stale"},"removed":{"x":1,"y":2}}');
  const nodes = applyPositions(mineCanvasSeed.nodes, positions);
  assert.deepEqual(nodes[0].position, {x:4,y:5});
  assert.equal(nodes[0].data, mineCanvasSeed.nodes[0].data);
  assert.deepEqual(nodes[1].position, mineCanvasSeed.nodes[1].position);
  assert.equal(nodes.length, mineCanvasSeed.nodes.length);
});
test('published cards have unique IDs, valid edges and no database assets', () => {
  const ids = new Set(mineCanvasSeed.nodes.map(n=>n.id));
  assert.equal(ids.size, mineCanvasSeed.nodes.length);
  for(const edge of mineCanvasSeed.edges) assert.ok(ids.has(edge.source)&&ids.has(edge.target));
  assert.ok(!JSON.stringify(mineCanvasSeed).includes('/api/canvas/'));
});
