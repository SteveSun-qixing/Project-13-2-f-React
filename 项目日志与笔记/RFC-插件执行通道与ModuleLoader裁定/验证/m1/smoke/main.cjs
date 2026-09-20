// 波0 M1 备选面机制可达性冒烟（M2 三口径已全绿，按任务口径 M1 仅证明降级路径真实存在）：
// node:vm SourceTextModule + 自定义 linker，在 Electron 主进程（browser）真进程内跑通
// 白名单拒（linker 抛拒且零求值）、哈希门禁（源字节复算不合即拒）、复加载（每激活新建模块实例，天然无全局缓存）。
// 启动（flag 注入唯一生效面，见 flags/ 实测）：NODE_OPTIONS=--experimental-vm-modules node <host>/node_modules/electron/cli.js main.cjs
'use strict';
const { app } = require('electron');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function sha(text) {
  return 'sha256-' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

// —— 模拟安装包登记摘要表与模块源（安装期字节哈希登记）——
const SOURCES = {
  'plugin:rerun': `globalThis.__W0_M1_EXEC__ = (globalThis.__W0_M1_EXEC__ ?? 0) + 1; export default 'rerun-' + globalThis.__W0_M1_EXEC__;`,
  'plugin:probe': `export default function probe(tag){ globalThis.__W0_M1_PROBE_EVAL__ = (globalThis.__W0_M1_PROBE_EVAL__ ?? []).concat(tag); return tag; }`,
  'plugin:clean': `import probe from 'plugin:probe';\nimport x from 'plugin:rerun';\nglobalThis.__W0_M1_OK__ = probe('clean');\nexport default 'm1-ok-' + x;`,
  'plugin:bad-node': `import probe from 'plugin:probe';\nimport fsx from 'node:fs';\nglobalThis.__W0_M1_HALF_EXEC__ = true;`,
  'plugin:bad-electron': `import probe from 'plugin:probe';\nimport { app } from 'electron';\nglobalThis.__W0_M1_HALF_EXEC__ = true;`,
  'plugin:bad-bare': `import { readFileSync } from 'fs';\nglobalThis.__W0_M1_HALF_EXEC__ = true;`,
};
const REGISTRY_HASHES = Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, sha(v)]));

const ALLOW_PREFIX = 'plugin:';

// M1 linker：白名单判定 + 包级摘要复算 + 交源实例化（每次激活独立日志）
async function activate(context, entryKey) {
  const log = [];
  const childLinker = (specifier) => {
    if (!specifier.startsWith(ALLOW_PREFIX)) {
      log.push({ ev: 'link-reject', reason: 'not-in-whitelist', specifier });
      throw new Error(`W0_M1_WHITELIST_REJECT ${specifier}`);
    }
    const src = SOURCES[specifier];
    const actual = src === undefined ? null : sha(src);
    if (!src || REGISTRY_HASHES[specifier] !== actual) {
      log.push({ ev: 'link-reject', reason: src ? 'hash-mismatch' : 'unknown-module', specifier });
      throw new Error(`W0_M1_${src ? 'HASH' : 'WHITELIST'}_REJECT ${specifier}`);
    }
    log.push({ ev: 'link-allow', specifier, hash: actual });
    return new vm.SourceTextModule(src, { identifier: specifier, context });
  };
  const entrySource = SOURCES[entryKey];
  if (REGISTRY_HASHES[entryKey] !== sha(entrySource)) {
    log.push({ ev: 'link-reject', reason: 'hash-mismatch', specifier: entryKey });
    return { ok: false, stage: 'entry-hash', log };
  }
  const entry = new vm.SourceTextModule(entrySource, { identifier: entryKey, context });
  await entry.link(childLinker);
  await entry.evaluate();
  return { ok: true, ns: entry.namespace, log };
}

app.whenReady().then(async () => {
  const assertions = [];
  const assert = (name, cond, note) => assertions.push({ name, pass: !!cond, note: note === undefined ? null : String(note) });

  assert('svm-available-in-electron-main-via-node-options', typeof vm.SourceTextModule === 'function', 'NODE_OPTIONS 注入实测（flags/ 探针 f4 为唯一生效面）；process.type=' + process.type);
  const ctx = vm.createContext({ console });
  const rd = (expr) => vm.runInContext(expr, ctx);

  // 口径1（linker 白名单拒 + 零执行）：三个越界入口
  const badResults = {};
  for (const key of ['plugin:bad-node', 'plugin:bad-electron', 'plugin:bad-bare']) {
    try {
      const r = await activate(ctx, key);
      badResults[key] = { threw: r.ok === false, errs: r.log.filter((l) => l.ev === 'link-reject').map((l) => l.reason) };
    } catch (e) {
      badResults[key] = { threw: true, msg: String(e.message) };
    }
  }
  assert('m1-linker-whitelist-rejects-all-3', Object.values(badResults).every((v) => v.threw === true), JSON.stringify(badResults));
  assert('m1-zero-exec-on-reject', rd('typeof __W0_M1_HALF_EXEC__') === 'undefined' && rd('typeof __W0_M1_PROBE_EVAL__') === 'undefined');

  // 口径2（哈希门禁）：registry 哈希按原始字节登记后，模拟篡改源字节
  const pristineClean = SOURCES['plugin:clean'];
  SOURCES['plugin:clean'] = pristineClean + '\nexport const injected = 1;';
  let tamper = { threw: false };
  try {
    const r = await activate(ctx, 'plugin:clean');
    tamper = { threw: !r.ok, stage: r.ok ? null : r.stage, errs: r.log.filter((l) => l.ev === 'link-reject').map((l) => l.reason) };
  } catch (e) {
    tamper = { threw: true, msg: String(e.message) };
  }
  assert('m1-hash-gate-rejects-tampered', tamper.threw === true && JSON.stringify(tamper).includes('hash-mismatch'), JSON.stringify(tamper));
  SOURCES['plugin:clean'] = pristineClean; // 复位

  // 阳性对照 + 口径3（复加载：每次激活新建实例、重新过 linker 门禁；无全局缓存可遮蔽）
  const r1 = await activate(ctx, 'plugin:clean');
  const v1 = r1.ns.default;
  const r2 = await activate(ctx, 'plugin:clean');
  const v2 = r2.ns.default;
  assert('m1-clean-control-evaluated', r1.ok && r2.ok && rd('__W0_M1_PROBE_EVAL__.includes("clean")') === true, 'v1=' + v1 + ' v2=' + v2);
  assert('m1-reload-reruns-gate-and-body', v1 === 'm1-ok-rerun-1' && v2 === 'm1-ok-rerun-2' && rd('__W0_M1_EXEC__') === 2 && r1.log.filter((l) => l.ev === 'link-allow').length === r2.log.filter((l) => l.ev === 'link-allow').length, '每次激活独立 linker 门禁日志计数相等');

  const pass = assertions.every((a) => a.pass);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ harness: 'M1-smoke', pass, assertions, badResults, tamper }, null, 2));
  for (const a of assertions) console.log(`[w0][m1] ASSERT ${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.note ? ' | ' + a.note : ''}`);
  console.log(`[w0][m1] W0_SUMMARY pass=${pass}`);
  app.exit(pass ? 0 : 1);
});

setTimeout(() => {
  console.error('[w0][m1] WATCHDOG: forced exit after 30s');
  app.exit(2);
}, 30000);
