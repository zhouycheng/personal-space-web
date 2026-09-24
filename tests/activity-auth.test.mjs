import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('activity endpoint reads the runtime token and validates authentication and payloads', async () => {
  const source = readFileSync(new URL('../src/pages/api/activity/update.ts', import.meta.url), 'utf8')
    .replace(/import \{ getActivityStore, DEFAULT_ACTIVITY_TTL_MS \}[^;]+;/, 'const getActivityStore = () => ({ update: () => ({}) }); const DEFAULT_ACTIVITY_TTL_MS = 25000;')
    .replaceAll('import.meta.env', '({ DEV: false })');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const { POST } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const previous = process.env.ACTIVITY_MONITOR_TOKEN;
  const request = (token, body = '{"state":"active","appName":"Fixture"}') => ({ request: new Request('http://localhost/api/activity/update', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body }) });
  try {
    delete process.env.ACTIVITY_MONITOR_TOKEN;
    assert.equal((await POST(request('old'))).status, 503);
    process.env.ACTIVITY_MONITOR_TOKEN = 'fixture-one';
    assert.equal((await POST(request('old'))).status, 401);
    assert.equal((await POST(request('fixture-one'))).status, 200);
    process.env.ACTIVITY_MONITOR_TOKEN = 'fixture-two';
    assert.equal((await POST(request('fixture-one'))).status, 401);
    assert.equal((await POST(request('fixture-two', 'invalid'))).status, 400);
    assert.equal((await POST(request('fixture-two', '{}'))).status, 400);
    assert.equal((await POST(request('fixture-two'))).status, 200);
  } finally {
    if (previous === undefined) delete process.env.ACTIVITY_MONITOR_TOKEN;
    else process.env.ACTIVITY_MONITOR_TOKEN = previous;
  }
});
