#!/usr/bin/env node
import { mkdirSync, existsSync, copyFileSync, chmodSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readJson, writeJson, runService } from './activity-service.mjs';
import { readActivity, notify } from './activity-core.mjs';

export const label = 'cn.zhoust.justin-activity';
export function paths(home = homedir()) {
  const root = join(home, 'Library/Application Support/JustinActivity');
  return { root, cli: join(home, '.local/bin/justin-activity'), agent: join(home, 'Library/LaunchAgents', `${label}.plist`), manual: join(root, `${label}.plist`), config: join(root, 'config.json'), state: join(root, 'state.json') };
}
const xml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const quote = text => `'${text.replace(/'/g, "'\\''")}'`;
export function plist(p, node) {
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(join(p.root, 'activity-cli.mjs'))}</string><string>daemon</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>ExitTimeOut</key><integer>15</integer><key>WorkingDirectory</key><string>${xml(p.root)}</string><key>ProcessType</key><string>Background</string>
</dict></plist>`;
}
function launch(...args) { return execFileSync('/bin/launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
const domain = () => `gui/${process.getuid()}`;
function loaded() { try { return launch('print', `${domain()}/${label}`); } catch { return null; } }
function start(p) {
  if (!loaded()) launch('bootstrap', domain(), existsSync(p.agent) ? p.agent : p.manual);
}
async function stop(p) {
  if (loaded()) launch('bootout', `${domain()}/${label}`);
  // bootout may return before graceful shutdown finishes. Do not overlap restarts.
  for (let i = 0; i < 160; i++) {
    const pid = readJson(p.state, {})?.pid;
    let alive = false;
    if (pid) { try { process.kill(pid, 0); alive = true; } catch {} }
    if (!alive && !loaded()) break;
    if (i === 159) throw new Error('旧进程尚未退出，请查看 status 后重试');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  writeJson(p.state, { ...readJson(p.state, {}), running: false, pid: null, incident: null });
}
function autostart(p, on) {
  if (on) { mkdirSync(dirname(p.agent), { recursive: true }); copyFileSync(p.manual, p.agent); chmodSync(p.agent, 0o600); }
  else rmSync(p.agent, { force: true });
}
export function installFiles(home, node, source) {
  const p = paths(home);
  const first = !existsSync(p.manual);
  mkdirSync(p.root, { recursive: true, mode: 0o700 }); chmodSync(p.root, 0o700);
  mkdirSync(dirname(p.cli), { recursive: true });
  for (const file of ['activity-cli.mjs', 'activity-core.mjs', 'activity-service.mjs']) copyFileSync(join(source, file), join(p.root, file));
  if (!existsSync(p.config)) writeJson(p.config, { url: '', token: '' });
  chmodSync(p.config, 0o600);
  writeFileSync(p.manual, plist(p, node), { mode: 0o600 });
  writeFileSync(p.cli, `#!/bin/sh\nif [ ! -x ${quote(node)} ]; then\n  echo 'Node 不可用，请重新运行仓库安装脚本' >&2\n  exit 1\nfi\nexec ${quote(node)} ${quote(join(p.root, 'activity-cli.mjs'))} "$@"\n`, { mode: 0o755 });
  chmodSync(p.cli, 0o755);
  if (first || existsSync(p.agent)) autostart(p, true);
  return p;
}
export function removeInstalledFiles(p, purge = false) {
  autostart(p, false); rmSync(p.cli, { force: true });
  for (const file of ['activity-cli.mjs', 'activity-core.mjs', 'activity-service.mjs', `${label}.plist`]) rmSync(join(p.root, file), { force: true });
  if (purge) rmSync(p.root, { recursive: true, force: true });
}
async function configure(p) {
  if (!process.stdin.isTTY) throw new Error('请在交互终端运行 justin-activity config，密钥使用隐藏输入');
  const config = readJson(p.config, {});
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  output.isTTY = true; output.columns = process.stdout.columns;
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const prompt = config.url ? `上报地址 [${config.url}]: ` : '上报地址（必填）: ';
    const url = (await rl.question(prompt)).trim() || config.url || '';
    if (!url) throw new Error('上报地址不能为空');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('请输入无凭据、查询参数的 HTTP(S) 地址');
    process.stdout.write('Token（隐藏输入，留空保留）: '); muted = true;
    const token = (await rl.question('')).trim() || config.token || '';
    muted = false; process.stdout.write('\n');
    writeJson(p.config, { url: url.replace(/\/$/, ''), token });
    console.log('配置已保存；运行 restart 应用配置。');
  } finally { muted = false; rl.close(); }
}
export async function main(args = process.argv.slice(2)) {
  if (process.platform !== 'darwin') throw new Error('仅支持 macOS');
  const p = paths(); const [command = 'help', option] = args;
  if (command === 'install') {
    const wasRunning = Boolean(loaded());
    const first = !existsSync(p.manual);
    // A normal update preserves the incident even though a graceful stop clears it.
    const previous = readJson(p.state, {});
    if (wasRunning) await stop(p);
    installFiles(homedir(), process.execPath, dirname(fileURLToPath(import.meta.url)));
    if (previous.incident) writeJson(p.state, { ...readJson(p.state, {}), incident: previous.incident });
    if (first || wasRunning) start(p);
    console.log(`已安装 ${p.cli}`);
    if (!(process.env.PATH ?? '').split(':').includes(dirname(p.cli))) console.log('请将 ~/.local/bin 加入 PATH：export PATH="$HOME/.local/bin:$PATH"');
    const config = readJson(p.config, {});
    if (!config.url || !config.token) console.log('上报配置未完成。请运行 justin-activity config，然后 restart。');
    return;
  }
  if (command === 'daemon') { await runService(p.root); return; }
  if (command === 'start') { start(p); console.log('已启动'); }
  else if (command === 'stop') { await stop(p); console.log('已停止，自启设置不变'); }
  else if (command === 'restart') { await stop(p); start(p); console.log('已重启'); }
  else if (command === 'autostart') {
    if (!['on', 'off'].includes(option)) throw new Error('用法：autostart on|off');
    autostart(p, option === 'on'); console.log(`登录自启 ${option}，当前运行状态不变`);
  } else if (command === 'status') {
    const service = loaded(), state = readJson(p.state, {});
    const pid = service?.match(/\n\s*pid = (\d+)/)?.[1];
    console.log(JSON.stringify({ running: Boolean(pid), registered: Boolean(service), pid: pid ?? null, autostart: existsSync(p.agent), capture: state.capture ?? '等待采集', upload: state.upload ?? '等待上报', lastSuccess: state.lastSuccess ? new Date(state.lastSuccess).toISOString() : null, stale: !state.checkedAt || Date.now() - state.checkedAt > 25000, nextNotification: state.incident ? new Date(state.incident.nextAt).toISOString() : null, incident: state.incident ?? null }, null, 2));
  } else if (command === 'config') {
    if (option === '--show') { const c = readJson(p.config, {}); console.log(JSON.stringify({ url: c.url, token: c.token ? '已配置（隐藏）' : '未配置' }, null, 2)); }
    else if (option === '--import-env') {
      if (!args[2]) throw new Error('用法：config --import-env /path/to/.env');
      const match = readFileSync(args[2], 'utf8').match(/^\s*ACTIVITY_MONITOR_TOKEN\s*=\s*(.*?)\s*$/m);
      if (!match) throw new Error('文件中没有 ACTIVITY_MONITOR_TOKEN');
      const token = match[1].replace(/^(['"])(.*)\1$/, '$2');
      if (!token) throw new Error('token 为空');
      const config = readJson(p.config, { url: '' });
      if (!config.url) throw new Error('请先运行 justin-activity config 设置上报地址');
      writeJson(p.config, { ...config, token });
      console.log('token 已导入；运行 restart 应用配置。');
    }
    else await configure(p);
  } else if (command === 'logs') {
    const file = join(p.root, 'activity.log');
    if (!existsSync(file)) { console.log('暂无日志'); return; }
    await new Promise(resolve => spawn('/usr/bin/tail', [...(option === '--follow' ? ['-f'] : []), '-n', '80', file], { stdio: 'inherit' }).once('exit', resolve));
  } else if (command === 'doctor') {
    console.log(`Node: ${process.version} ${process.execPath}\nLaunchAgent: ${loaded() ? '已注册' : '未注册'}\nToken: ${readJson(p.config, {}).token ? '已配置' : '未配置'}`);
    try { await readActivity(); console.log('当前终端采集权限：正常（后台权限请结合 status 核对）'); } catch (e) { console.log(e.message); }
    console.log('通知：使用 macOS osascript；运行 notify-test 检查可见通知，系统免打扰可能抑制显示。');
  } else if (command === 'notify-test') { await notify('通知测试'); console.log('已提交通知请求，请检查系统通知'); }
  else if (command === 'uninstall') {
    await stop(p); removeInstalledFiles(p, option === '--purge');
    console.log('已卸载');
  } else if (command === 'help') console.log('justin-activity start|stop|restart|status|autostart on/off|config [--show]|logs [--follow]|doctor|notify-test|uninstall [--purge]');
  else throw new Error(`未知命令：${command}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
