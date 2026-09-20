// 波0 M2-C3 主进程 harness：同路径不同 nonce 查询串穿透 ESM 缓存复加载，且每次重新过 resolve/load 门禁
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
const ENTRY_PATH = path.join(PLUGIN_ROOT, 'entry-count.mjs');

function sha(text) {
  return 'sha256-' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const PRISTINE = "// C3 复加载探针入口：模块体每被求值一次，计数 +1（区分“缓存遮蔽”与“真实复执行”）\nglobalThis.__W0_C3_EXEC_COUNT__ = (globalThis.__W0_C3_EXEC_COUNT__ ?? 0) + 1;\nconsole.log('[w0][c3] entry-count.mjs EVALUATED, execCount=' + globalThis.__W0_C3_EXEC_COUNT__);\nexport default 'exec-' + globalThis.__W0_C3_EXEC_COUNT__;\n";
fs.writeFileSync(ENTRY_PATH, PRISTINE); // 复位磁盘，保证可重复运行
const expectedHashes = { [ENTRY_PATH]: sha(PRISTINE) };

register(pathToFileURL(path.join(ROOT, 'hooks.mjs')).href, {
  parentURL: pathToFileURL(ROOT + path.sep).href,
  data: { pluginRootUrl: PLUGIN_ROOT_URL, logFile: LOG_FILE, expectedHashes },
});

const ENTRY_URL = pathToFileURL(ENTRY_PATH).href;
async function tryImport(url) {
  try {
    const m = await import(url);
    return { ok: true, d: m.default };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
}
function hookCount(ev, kind) {
  return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter((e) => e.ev === ev && e.kind === kind).length;
}

app.whenReady().then(async () => {
  console.log(`[w0][c3] main type=${process.type} node=${process.versions.node} electron=${process.versions.electron}`);
  const timeline = [];
  const t1 = await tryImport(ENTRY_URL);
  timeline.push({ step: 'first-import-no-query', t1, exec: globalThis.__W0_C3_EXEC_COUNT__ });
  const t2 = await tryImport(ENTRY_URL);
  timeline.push({ step: 'same-url-twice(cache)', t2, exec: globalThis.__W0_C3_EXEC_COUNT__ });
  const t3 = await tryImport(ENTRY_URL + '?nonce=w0-run-A');
  timeline.push({ step: 'nonce-A', t3, exec: globalThis.__W0_C3_EXEC_COUNT__ });
  const t4 = await tryImport(ENTRY_URL + '?nonce=w0-run-B');
  timeline.push({ step: 'nonce-B', t4, exec: globalThis.__W0_C3_EXEC_COUNT__ });
  // 强化口径：篡改后换 nonce —— 复加载必须重新撞上哈希门禁（门禁非一次性）
  fs.writeFileSync(ENTRY_PATH, PRISTINE + '\nexport const injected = 1;\n');
  const t5 = await tryImport(ENTRY_URL + '?nonce=w0-run-C-tampered');
  timeline.push({ step: 'nonce-C-after-tamper', t5, exec: globalThis.__W0_C3_EXEC_COUNT__ });
  fs.writeFileSync(ENTRY_PATH, PRISTINE);

  const evResolveEntry = hookCount('resolve', 'entry-allow');
  const evLoadAllow = hookCount('load', 'allow');
  const evLoadReject = hookCount('load', 'reject');
  const hookEvents = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

  const assertions = [];
  const assert = (name, cond, note) => assertions.push({ name, pass: !!cond, note: note ?? null });
  assert('first-import-exec-1', t1.ok && globalThis.__W0_C3_EXEC_COUNT__ >= 1);
  assert('cache-shadows-same-url', t2.ok && timeline[1].exec === timeline[0].exec, 'exec stays ' + timeline[1].exec);
  assert('nonce-penetrates-cache', timeline[2].exec === timeline[1].exec + 1 && timeline[3].exec === timeline[2].exec + 1 && t3.d === 'exec-2' && t4.d === 'exec-3', JSON.stringify({ t3d: t3.d, t4d: t4.d }));
  assert('each-import-reran-resolve-gate', evResolveEntry === 5, 'entry resolve events=' + evResolveEntry + '（实测：同 URL 二次 import 仍过 resolve 钩，但不再触发 load/求值 → 缓存遮蔽发生在实例化层）');
  assert('each-reload-reran-load-gate', evLoadAllow === 3 && evLoadReject === 1, 'load allow=' + evLoadAllow + ' reject=' + evLoadReject);
  assert('tampered-reload-rejected-no-extra-exec', !t5.ok && /W0_HASH_REJECT/.test(t5.err) && timeline[4].exec === timeline[3].exec, t5.err ?? '');
  assert('hooks-worker-evidence', hookEvents.some((e) => e.ev === 'init' && e.wtIsMainThread === false && e.threadId > 0));

  const pass = assertions.every((a) => a.pass);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ harness: 'M2-C3-nonce-reload', pass, assertions, timeline, evResolveEntry, evLoadAllow, evLoadReject }, null, 2));
  for (const a of assertions) console.log(`[w0][c3] ASSERT ${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.note ? ' | ' + a.note : ''}`);
  console.log(`[w0][c3] W0_SUMMARY pass=${pass}`);
  app.exit(pass ? 0 : 1);
});

setTimeout(() => {
  console.error('[w0][c3] WATCHDOG: forced exit after 30s');
  app.exit(2);
}, 30000);
