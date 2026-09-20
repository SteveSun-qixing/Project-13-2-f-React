// 波0 M2-C2 主进程 harness：load 钩读字节复算包级哈希，篡改夹具真实拒装且无半执行状态
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

function sha(text) {
  return 'sha256-' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// 安装期登记哈希：以夹具原始字节为准（先复位磁盘，保证可重复运行）
const TAMPERED_PATH = path.join(PLUGIN_ROOT, 'entry-tampered.mjs');
const ORIGINAL_TEXT = fs.readFileSync(TAMPERED_PATH, 'utf8');
if (!ORIGINAL_TEXT.includes('__W0_C2_TAMPERED_BODY_RAN__')) {
  fs.writeFileSync(TAMPERED_PATH, '// C2 被篡改入口（原始态）：main.cjs 会在装载前把磁盘内容改写为篡改版本，\n// 注册表期望哈希仍是原始字节的摘要 → load 钩复算不合 → 拒装。\nimport probe from \'./probe.mjs\';\nglobalThis.__W0_C2_TAMPERED_BODY_RAN__ = true;\nexport default \'tampered-original\';\n');
}
const expectedHashes = {};
for (const f of ['probe.mjs', 'entry-clean.mjs', 'entry-tampered.mjs']) {
  expectedHashes[path.join(PLUGIN_ROOT, f)] = sha(fs.readFileSync(path.join(PLUGIN_ROOT, f), 'utf8'));
}

register(pathToFileURL(path.join(ROOT, 'hooks.mjs')).href, {
  parentURL: pathToFileURL(ROOT + path.sep).href,
  data: { pluginRootUrl: PLUGIN_ROOT_URL, logFile: LOG_FILE, expectedHashes },
});

async function tryImport(name) {
  const url = pathToFileURL(path.join(PLUGIN_ROOT, name)).href + '?nonce=' + Date.now() + '-' + Math.random();
  try {
    await import(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
}

app.whenReady().then(async () => {
  console.log(`[w0][c2] main type=${process.type} node=${process.versions.node} electron=${process.versions.electron}`);
  const r = {};
  // 阳性对照：未篡改包先过门禁成功装载
  r.clean = await tryImport('entry-clean.mjs');
  const cleanProbe = globalThis.__W0_C2_PROBE_EVALUATED__;
  // 篡改磁盘字节（模拟安装后篡改），期望哈希仍是原始摘要
  fs.writeFileSync(TAMPERED_PATH, ORIGINAL_TEXT + '\nglobalThis.__W0_C2_TAMPER_INJECTED__ = true;\nexport const injected = 1;\n');
  const tamperedActual = sha(fs.readFileSync(TAMPERED_PATH, 'utf8'));
  r.tampered = await tryImport('entry-tampered.mjs');
  // 复位磁盘
  fs.writeFileSync(TAMPERED_PATH, ORIGINAL_TEXT);

  const hookEvents = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const loadRejects = hookEvents.filter((e) => e.ev === 'load' && e.kind === 'reject');

  const assertions = [];
  const assert = (name, cond, note) => assertions.push({ name, pass: !!cond, note: note ?? null });
  assert('clean-control-loaded', r.clean.ok && cleanProbe === true && globalThis.__W0_C2_CLEAN_LOADED__ === 'probe', JSON.stringify(r.clean));
  assert('tampered-import-rejected-hash', !r.tampered.ok && /W0_HASH_REJECT/.test(r.tampered.err), r.tampered.err);
  assert('load-hook-hash-reject-event', loadRejects.length === 1 && loadRejects[0].actual === tamperedActual, JSON.stringify(loadRejects));
  assert('no-half-execution-state', globalThis.__W0_C2_TAMPERED_BODY_RAN__ === undefined && globalThis.__W0_C2_TAMPER_INJECTED__ === undefined);
  assert('hooks-worker-evidence', hookEvents.some((e) => e.ev === 'init' && e.wtIsMainThread === false && e.threadId > 0), JSON.stringify(hookEvents.find((e) => e.ev === 'init')));

  const pass = assertions.every((a) => a.pass);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ harness: 'M2-C2-hash-tamper', pass, assertions, importResults: r }, null, 2));
  for (const a of assertions) console.log(`[w0][c2] ASSERT ${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.note ? ' | ' + a.note : ''}`);
  console.log(`[w0][c2] W0_SUMMARY pass=${pass}`);
  app.exit(pass ? 0 : 1);
});

setTimeout(() => {
  console.error('[w0][c2] WATCHDOG: forced exit after 30s');
  app.exit(2);
}, 30000);
