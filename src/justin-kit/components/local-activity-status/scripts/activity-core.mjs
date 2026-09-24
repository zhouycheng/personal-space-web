import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const delays = [10, 30, 60, 90].map(n => n * 60_000);

// A single durable incident spans changing causes and process restarts.
export function advanceIncident(previous, error, now) {
  if (error) return previous
    ? { ...previous, reason: error, healthySince: null }
    : { since: now, reason: error, stage: 0, nextAt: now + delays[0], healthySince: null };
  if (!previous) return null;
  const healthySince = previous.healthySince ?? now;
  return now - healthySince >= 60_000 ? null : { ...previous, healthySince };
}

export function reminded(incident, now) {
  const stage = Math.min(incident.stage + 1, delays.length - 1);
  return { ...incident, stage, nextAt: now + delays[stage] };
}

export async function readActivity(execute = exec) {
  try {
    const { stdout } = await execute('/usr/bin/osascript', ['-e', 'tell application "System Events" to get name of first application process whose frontmost is true'], { timeout: 3000 });
    const appName = stdout.trim();
    return { appName: appName || null, state: appName ? 'active' : 'inactive', observedAt: Date.now() };
  } catch (error) {
    throw new Error(/authorized|permitted|-1743|-25211|assistive/i.test(error.stderr ?? '') ? 'macOS 权限不足' : '前台应用采集失败');
  }
}

async function systemRequest(url, token, payload, timeout) {
  // macOS curl uses the system trust chain. Secrets travel on stdin, never argv.
  const config = [`url = ${JSON.stringify(url)}`, 'request = "POST"', `header = ${JSON.stringify(`Authorization: Bearer ${token}`)}`, 'header = "Content-Type: application/json"', `data = ${JSON.stringify(JSON.stringify(payload))}`].join('\n');
  return await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/curl', ['--disable', '--silent', '--show-error', '--max-time', String(timeout / 1000), '--write-out', '\n%{http_code}', '--config', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('系统 HTTPS 客户端不可用')));
    child.on('close', code => {
      if (code !== 0) { reject(new Error(code === 28 ? '上报超时' : code === 60 ? 'HTTPS 证书校验失败' : '网络连接失败')); return; }
      const split = output.lastIndexOf('\n'); const status = Number(output.slice(split + 1));
      resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(output.slice(0, split)) });
    });
    child.stdin.end(config);
  });
}

export async function publish(base, token, payload, timeout = 4000) {
  let response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/api/activity/update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout), redirect: 'error',
    });
  } catch (error) {
    if (process.platform === 'darwin' && /CERT|ISSUER/.test(error.cause?.code ?? '')) response = await systemRequest(`${base.replace(/\/$/, '')}/api/activity/update`, token, payload, timeout);
    else throw new Error(error.name === 'TimeoutError' ? '上报超时' : '网络连接失败');
  }
  if (!response.ok) throw new Error([401, 403].includes(response.status) ? `鉴权失败 HTTP ${response.status}` : `服务端错误 HTTP ${response.status}`);
  const body = await response.json().catch(() => null);
  if (body?.ok !== true) throw new Error('服务端响应无效');
  return body;
}

export async function notify(reason) {
  // Arguments never enter AppleScript source, and contain no application names or credentials.
  await exec('/usr/bin/osascript', ['-e', 'on run argv\ndisplay notification (item 1 of argv) with title "Justin Activity"\nend run', `${reason}。请运行 justin-activity status 或 logs 查看。`], { timeout: 5000 });
}

export async function deliverReminder(state, now, { save, send = notify, log }) {
  state.incident = reminded(state.incident, now);
  save(state); // Persist before delivery so a crash cannot repeat the same reminder.
  try { await send(state.incident.reason); }
  catch { log('系统通知投递失败，请检查通知设置'); }
}
