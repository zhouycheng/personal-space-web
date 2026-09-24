import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readActivity, publish, advanceIncident, deliverReminder } from './activity-core.mjs';

export function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
export function writeJson(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(temp, file);
}

export async function runService(root) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = join(root, 'daemon.lock');
  // Exclusive file creation closes concurrent start races. Crashed owners can be reclaimed.
  for (let attempt = 0; ; attempt++) {
    try { writeFileSync(lock, String(process.pid), { flag: 'wx', mode: 0o600 }); break; }
    catch (error) {
      if (error.code !== 'EEXIST' || attempt > 1) throw error;
      const owner = Number(readFileSync(lock, 'utf8'));
      if (!owner) throw new Error('监视器锁无效，请检查安装目录');
      try { process.kill(owner, 0); throw new Error('监视器已经运行'); }
      catch (failure) { if (failure.code !== 'ESRCH') throw failure; }
      rmSync(lock, { force: true });
    }
  }
  process.once('exit', () => { try { if (readFileSync(lock, 'utf8') === String(process.pid)) rmSync(lock); } catch {} });
  const config = readJson(join(root, 'config.json'), {});
  const stateFile = join(root, 'state.json');
  const old = readJson(stateFile, {});
  let state = { ...old, pid: process.pid, startedAt: Date.now(), checkedAt: null, capture: '等待采集', upload: '等待上报', running: true, incident: old.incident ? { ...old.incident, healthySince: null } : null };
  const sessionId = randomUUID();
  let stopping = false, timer, wake;
  const log = message => {
    const file = join(root, 'activity.log');
    if (existsSync(file) && statSync(file).size > 1_000_000) renameSync(file, `${file}.1`);
    appendFileSync(file, `${new Date().toISOString()} ${message}\n`, { mode: 0o600 });
  };
  const stop = () => { stopping = true; clearTimeout(timer); wake?.(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  let fingerprint = '', sentAt = 0, previousError;
  log('监视器启动');
  while (!stopping) {
    let error = null;
    try {
      if (!config.url) throw new Error('尚未配置上报地址：运行 justin-activity config');
      if (!config.token) throw new Error('尚未配置 token：运行 justin-activity config');
      const activity = await readActivity();
      state.capture = '正常';
      const next = `${activity.state}:${activity.appName}`;
      if (next !== fingerprint || Date.now() - sentAt >= 12000) {
        await publish(config.url, config.token, { ...activity, sessionId });
        fingerprint = next; sentAt = Date.now(); state.lastSuccess = sentAt;
        state.upload = '正常';
      }
    } catch (failure) {
      error = failure.message;
      if (/采集|权限/.test(error)) state.capture = error;
      else state.upload = error;
    }
    const now = Date.now();
    // Missing heartbeats after sleep do not count as continuous health.
    if (state.checkedAt && now - state.checkedAt > 25000 && state.incident) state.incident.healthySince = null;
    state.incident = advanceIncident(state.incident, error, now);
    state.checkedAt = now;
    if (error !== previousError) { log(error ?? '采集与上报正常'); previousError = error; }
    if (error && state.incident.nextAt <= now) {
      await deliverReminder(state, now, { save: value => writeJson(stateFile, value), log });
    }
    writeJson(stateFile, state);
    if (!stopping) await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, 2000); });
  }
  if (config.token) {
    try { await publish(config.url, config.token, { appName: null, state: 'inactive', observedAt: Date.now(), sessionId }); }
    catch { log('停止时离线上报失败，服务端将自动过期'); }
  }
  state = { ...state, running: false, pid: null, incident: null };
  writeJson(stateFile, state); log('监视器停止');
}
