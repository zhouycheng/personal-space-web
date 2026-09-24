import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { advanceIncident, reminded, publish, readActivity, deliverReminder } from '../src/justin-kit/components/local-activity-status/scripts/activity-core.mjs';
import { installFiles, plist, removeInstalledFiles } from '../src/justin-kit/components/local-activity-status/scripts/activity-cli.mjs';
import { writeJson, readJson } from '../src/justin-kit/components/local-activity-status/scripts/activity-service.mjs';

test('capture classifies permission errors without exposing raw system output', async () => {
  const result = await readActivity(async () => ({ stdout: 'Fixture\n' }));
  assert.equal(result.appName, 'Fixture'); assert.equal(result.state, 'active');
  await assert.rejects(readActivity(async () => { throw { stderr: 'Not authorized -1743 private data' }; }), /^Error: macOS 权限不足$/);
  await assert.rejects(readActivity(async () => { throw new Error('timeout'); }), /采集失败/);
});

test('notification failure persists the next interval once and never creates a recursive incident', async () => {
  const state = { incident: advanceIncident(null, 'network', 0) };
  const events = [];
  await deliverReminder(state, 600000, { save: value => events.push(['save', value.incident.nextAt]), send: async () => { events.push(['send']); throw new Error('denied'); }, log: message => events.push(['log', message]) });
  assert.deepEqual(events.map(event => event[0]), ['save', 'send', 'log']);
  assert.equal(state.incident.nextAt, 2400000);
  assert.equal(state.incident.reason, 'network');
});

test('incident backoff persists, merges causes, caps at 90 minutes and recovers after 60 seconds', () => {
  let incident = advanceIncident(null, 'network', 0);
  assert.equal(incident.nextAt, 600000);
  for (const minutes of [30, 60, 90, 90]) {
    const now = incident.nextAt;
    incident = reminded(JSON.parse(JSON.stringify(incident)), now);
    assert.equal(incident.nextAt, now + minutes * 60000);
  }
  const next = incident.nextAt;
  incident = advanceIncident(incident, 'permission', next - 1000);
  assert.equal(incident.nextAt, next);
  incident = advanceIncident(incident, null, next);
  assert.ok(advanceIncident(incident, null, next + 59999));
  assert.equal(advanceIncident(incident, null, next + 60000), null);
  incident = advanceIncident(incident, 'network', next + 30000);
  assert.equal(incident.healthySince, null);
  const resumed = reminded(incident, next + 86400000);
  assert.equal(resumed.nextAt, next + 86400000 + 90 * 60000);
});

test('isolated install preserves configuration, incident, disabled autostart and private modes', () => {
  const home = mkdtempSync(join(tmpdir(), 'activity-install-'));
  try {
    const source = resolve('src/justin-kit/components/local-activity-status/scripts');
    const p = installFiles(home, process.execPath, source);
    assert.ok(existsSync(p.cli)); assert.ok(existsSync(p.agent));
    assert.equal(readJson(p.config).url, '');
    writeJson(p.config, { url: 'http://localhost:1234', token: 'test-only' });
    writeJson(p.state, { incident: { nextAt: 123 } });
    rmSync(p.agent);
    installFiles(home, process.execPath, source);
    assert.equal(readJson(p.config).token, 'test-only');
    assert.equal(readJson(p.state).incident.nextAt, 123);
    assert.equal(existsSync(p.agent), false);
    assert.equal(statSync(p.config).mode & 0o777, 0o600);
    assert.ok(!readFileSync(p.cli, 'utf8').includes(source));
    assert.ok(plist(p, '/path/with&char/node').includes('with&amp;char'));
    removeInstalledFiles(p);
    assert.ok(!existsSync(p.cli)); assert.ok(!existsSync(p.agent));
    assert.equal(readJson(p.config).token, 'test-only');
    removeInstalledFiles(p, true); assert.ok(!existsSync(p.root));
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('publish uses authenticated contract and distinguishes server, auth, malformed and timeout failures', async () => {
  let status = 200, malformed = false, hang = false;
  const server = createServer(async (req, res) => {
    assert.equal(req.url, '/api/activity/update');
    assert.equal(req.headers.authorization, 'Bearer test-only');
    for await (const _ of req) { /* drain */ }
    if (hang) return;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(malformed ? '{}' : '{"ok":true,"active":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await publish(url, 'test-only', { state: 'active', appName: 'Fixture' })).ok, true);
    for (const code of [401, 403, 500]) { status = code; await assert.rejects(publish(url, 'test-only', {}), new RegExp(String(code))); }
    status = 200; malformed = true;
    await assert.rejects(publish(url, 'test-only', {}), /响应无效/);
    hang = true; await assert.rejects(publish(url, 'test-only', {}, 30), /超时/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await assert.rejects(publish(url, 'test-only', {}, 30), /网络/);
});
