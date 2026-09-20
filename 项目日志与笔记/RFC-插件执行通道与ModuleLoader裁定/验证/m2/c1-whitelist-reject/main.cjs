// 波0 M2-C1 主进程 harness（Electron 真进程）：白名单越界 specifier 在 resolve 钩真实抛拒且插件体零执行
// 启动：node <chips-ecosystem/packages/host>/node_modules/electron/cli.js <本目录>/main.cjs
'use strict';
const { app } = require('electron');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const LOG_FILE = path.join(OUT, 'hook-events.jsonl');
if (fs.existsSync(LOG_FILE)) fs.rmSync(LOG_FILE);

const PLUGIN_ROOT = path.join(ROOT, 'fixtures', 'plugin-root');
const PLUGIN_ROOT_URL = pathToFileURL(PLUGIN_ROOT).href + '/';

function hashFile(p) {
  return 'sha256-' + crypto.createHash('sha256').update(fs.readFileSync(p, 'utf8'), 'utf8').digest('hex');
}

const expectedHashes = {};
for (const f of ['probe.mjs', 'plugin-node.mjs', 'plugin-electron.mjs', 'plugin-abs.mjs', 'plugin-bare.mjs', 'plugin-good.mjs']) {
  expectedHashes[path.join(PLUGIN_ROOT, f)] = hashFile(path.join(PLUGIN_ROOT, f));
}

const registerReturn = register(pathToFileURL(path.join(ROOT, 'hooks.mjs')).href, {
  parentURL: pathToFileURL(ROOT + path.sep).href,
  data: { pluginRootUrl: PLUGIN_ROOT_URL, logFile: LOG_FILE, expectedHashes },
});
// Electron 特异性实测：register() 返回值可能为 undefined（MessagePort 通道不可用），以 fs 日志为权威
console.log(`[w0][c1] register() returned: ${registerReturn === undefined ? 'undefined' : typeof registerReturn}`);
const portMessages = [];
if (registerReturn && typeof registerReturn.on === 'function') {
  registerReturn.on('message', (m) => portMessages.push(m));
  registerReturn.unref();
}

async function tryImport(rel) {
  const url = pathToFileURL(path.join(PLUGIN_ROOT, rel)).href;
  try {
    await import(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
}

app.whenReady().then(async () => {
  console.log(`[w0][c1] main process type=${process.type} pid=${process.pid} node=${process.versions.node} electron=${process.versions.electron}`);
  const r = {};
  r.node = await tryImport('plugin-node.mjs');
  r.electron = await tryImport('plugin-electron.mjs');
  r.abs = await tryImport('plugin-abs.mjs');
  r.bare = await tryImport('plugin-bare.mjs');
  // —— 负断言采样点：越界流量全部结束后、阳性对照之前 ——
  const probeEvaluatedAfterBad = globalThis.__W0_PROBE_EVALUATED__;
  const bodyRanAfterBad = {
    node: globalThis.__W0_NODE_BODY_RAN__,
    electron: globalThis.__W0_ELECTRON_BODY_RAN__,
    abs: globalThis.__W0_ABS_BODY_RAN__,
    bare: globalThis.__W0_BARE_BODY_RAN__,
    outside: globalThis.__W0_OUTSIDE_PROBE_EVALUATED__,
  };
  r.good = await tryImport('plugin-good.mjs');

  const hookEvents = fs
    .readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const rejects = hookEvents.filter((e) => e.ev === 'resolve' && e.kind === 'reject');

  const assertions = [];
  const assert = (name, cond, note) => assertions.push({ name, pass: !!cond, note: note ?? null });
  assert('node-specifier-rejected-in-resolve-hook', !r.node.ok && /W0_WHITELIST_REJECT/.test(r.node.err), r.node.err);
  assert('electron-specifier-rejected-in-resolve-hook', !r.electron.ok && /W0_WHITELIST_REJECT/.test(r.electron.err), r.electron.err);
  assert('scope-escape-abs-rejected-in-resolve-hook', !r.abs.ok && /W0_WHITELIST_REJECT/.test(r.abs.err), r.abs.err);
  assert('bare-path-rejected-in-resolve-hook', !r.bare.ok && /W0_WHITELIST_REJECT/.test(r.bare.err), r.bare.err);
  assert('probe-module-never-evaluated', probeEvaluatedAfterBad === undefined);
  assert('plugin-bodies-never-executed', bodyRanAfterBad.node === undefined && bodyRanAfterBad.electron === undefined && bodyRanAfterBad.abs === undefined && bodyRanAfterBad.bare === undefined);
  assert('outside-scope-probe-never-evaluated', bodyRanAfterBad.outside === undefined);
  assert('good-control-imported-and-evaluated', r.good.ok && globalThis.__W0_GOOD_LOADED__ === 'probe');
  assert('resolve-reject-events-count-4', rejects.length === 4, JSON.stringify(rejects.map((e) => e.reason + ':' + e.specifier)));
  assert('hooks-ran-in-worker-thread', hookEvents.some((e) => e.ev === 'init' && e.wtIsMainThread === false && e.threadId > 0), JSON.stringify(hookEvents.find((e) => e.ev === 'init')));
  assert('register-return-value-documented', true, 'register() returned ' + (registerReturn === undefined ? 'undefined (Electron quirk: MessagePort unavailable)' : typeof registerReturn) + '; portMessages=' + portMessages.length);

  const pass = assertions.every((a) => a.pass);
  const summary = { harness: 'M2-C1-whitelist-reject', pass, assertions, importResults: r };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(summary, null, 2));
  for (const a of assertions) console.log(`[w0][c1] ASSERT ${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.note ? ' | ' + a.note : ''}`);
  console.log(`[w0][c1] W0_SUMMARY pass=${pass}`);
  app.exit(pass ? 0 : 1);
});

setTimeout(() => {
  console.error('[w0][c1] WATCHDOG: forced exit after 30s');
  app.exit(2);
}, 30000);
