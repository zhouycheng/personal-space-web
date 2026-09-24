import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mineCanvasSeed } from '../src/components/mine-canvas/mineCanvasData.ts';
import { activityCopy } from '../src/components/mine-canvas/canvasActivity.ts';

test('published canvas contains the four real cards and two connections', () => {
  assert.equal(mineCanvasSeed.nodes.length,4);
  assert.equal(mineCanvasSeed.edges.length,2);
  const byKind = Object.fromEntries(mineCanvasSeed.nodes.map(n=>[n.data.kind,n]));
  assert.equal(byKind.businesscard.id,'node-businesscard-1782568979177');
  assert.equal(byKind.businesscard.data.name,'开发者');
  assert.deepEqual(byKind.businesscard.data.tags,['INTJ','Flutter','客户端']);
  assert.equal(byKind.timeline.data.items.length,5);
  assert.equal(byKind.timeline.data.items[0].time,'2026.4');
  assert.equal(byKind.quote.data.contentHtml,'<p>发生的一切都是必然的</p>');
  for(const edge of mineCanvasSeed.edges) assert.equal(edge.source,byKind.businesscard.id);
  const avatar = readFileSync(new URL('../public/canvas/justin-avatar.jpg',import.meta.url));
  assert.equal(avatar.readUInt16BE(0),0xffd8);
});
test('activity distinguishes loading, error, offline, active and expired snapshots', () => {
  assert.equal(activityCopy({status:'loading'}).title,'正在获取状态…');
  assert.equal(activityCopy({status:'error'}).title,'暂时无法获取状态');
  assert.equal(activityCopy({status:'ready',snapshot:null}).title,'好像关机了');
  const snapshot={appName:'Codex',text:'正在编程',observedAt:0,receivedAt:0,expiresAt:100};
  assert.deepEqual(activityCopy({status:'ready',snapshot},99),{title:'Codex',detail:'正在编程'});
  assert.equal(activityCopy({status:'ready',snapshot},100).title,'好像关机了');
});
