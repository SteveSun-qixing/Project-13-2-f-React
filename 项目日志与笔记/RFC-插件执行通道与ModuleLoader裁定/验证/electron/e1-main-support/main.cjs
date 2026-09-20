// 波0 E1 主进程支持度专测：module.register 在 Electron 主进程（browser，非 utility process）的可用性、
// 钩子 worker 线程形态、与沙箱渲染配置（sandbox/nodeIntegration/contextIsolation）的相互作用。
'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const LOG_FILE = path.join(OUT, 'hook-events.jsonl');
if (fs.existsSync(LOG_FILE)) fs.rmSync(LOG_FILE);

const registerReturn = register(pathToFileURL(path.join(ROOT, 'hooks.mjs')).href, {
  parentURL: pathToFileURL(ROOT + path.sep).href,
  data: { logFile: LOG_FILE },
});

app.whenReady().then(async () => {
  const assertions = [];
  const assert = (name, cond, note) => assertions.push({ name, pass: !!cond, note: note === undefined ? null : String(note) });

  // 1) 主进程身份与 register 可用性
  assert('main-process-is-browser', process.type === 'browser', 'process.type=' + process.type);
  assert('register-callable-in-main', typeof register === 'function', 'register() returned ' + typeof registerReturn + ' (Electron 40.8 实测返回 undefined，MessagePort 面不可用；钩子本身生效)');

  // 2) 主进程侧经钩子链的真实 ESM 求值
  const m = await import(pathToFileURL(path.join(ROOT, 'fixtures', 'gate-mod.mjs')).href);
  assert('esm-eval-through-hooks-in-main', m.default === 'e1-ok' && globalThis.__W0_E1_ESM_EVAL__ === true);

  // 3) 钩子线程形态：Node worker 线程（worker_threads），不是 Electron utility process
  const hookEvents = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  const initEv = hookEvents.find((e) => e.ev === 'init');
  assert('hooks-run-on-node-worker-thread', initEv && initEv.wtIsMainThread === false && initEv.threadId > 0, JSON.stringify(initEv));
  assert('resolve-and-load-hooks-fired', hookEvents.some((e) => e.ev === 'resolve') && hookEvents.some((e) => e.ev === 'load'));

  // 4) 沙箱窗口与钩子机制互不干扰（宿主红线：渲染侧无 Node/无系统能力通路）
  const preloadPromise = new Promise((resolve) => {
    ipcMain.once('w0-preload-evidence', (_ev, data) => resolve(data));
    setTimeout(() => resolve(null), 8000);
  });
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(ROOT, 'preload.cjs'),
    },
  });
  await win.loadFile(path.join(ROOT, 'index.html'));
  const mainWorld = await win.webContents.executeJavaScript(`({
    typeofRequire: typeof require,
    typeofModule: typeof module,
    typeofProcess: typeof process,
    chipsExposed: typeof window.chips,
    e1FlagLeak: typeof globalThis.__W0_E1_ESM_EVAL__,
    title: document.getElementById('x') && document.getElementById('x').textContent,
  })`);
  const preloadEvidence = await preloadPromise;
  assert('renderer-page-loaded', mainWorld.title === 'w0-e1-sandbox-page', JSON.stringify(mainWorld));
  assert('renderer-main-world-no-node-access', mainWorld.typeofRequire === 'undefined' && mainWorld.typeofProcess === 'undefined' && mainWorld.typeofModule === 'undefined');
  assert('renderer-main-world-no-loader-leak', mainWorld.e1FlagLeak === 'undefined' && mainWorld.chipsExposed === 'undefined');
  // 沙箱 preload 契约：受限 require（仅 electron 通道，node builtins 被拒）；主世界（页面 JS）无任何 Node 面
  assert('sandbox-preload-boundary', preloadEvidence && preloadEvidence.hasProcess === true && preloadEvidence.processType === 'renderer' && preloadEvidence.canRequireElectron === true && preloadEvidence.canRequireNodeFs === false, JSON.stringify(preloadEvidence));

  win.destroy();
  const pass = assertions.every((a) => a.pass);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ harness: 'E1-main-support', pass, assertions, hookEvents, mainWorld, preloadEvidence }, null, 2));
  for (const a of assertions) console.log(`[w0][e1] ASSERT ${a.pass ? 'PASS' : 'FAIL'} ${a.name}${a.note ? ' | ' + a.note : ''}`);
  console.log(`[w0][e1] W0_SUMMARY pass=${pass}`);
  app.exit(pass ? 0 : 1);
});

setTimeout(() => {
  console.error('[w0][e1] WATCHDOG: forced exit after 45s');
  app.exit(2);
}, 45000);
