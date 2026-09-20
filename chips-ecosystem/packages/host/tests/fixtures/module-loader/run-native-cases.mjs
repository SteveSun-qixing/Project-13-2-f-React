// 波 1 ModuleLoader 原生机制实测子进程夹具（任务 #106，`tests/loader-module.test.ts` 专用）。
//
// 背景：vitest 的模块管线（vite-node）会代管被测代码内的 `import()`，Node ESM 自定义钩子
// 在该管线内不触发（波 1 开工实测坐实）；M2 机制（`module.register()` resolve/load 双钩）
// 的正向装载求值、白名单拒装、复加载重门禁等口径必须在**原生 Node 子进程**里对生产 API
// 真实执行。本夹具是唯一测试侧启动器，做且仅做两件事：
// 1. 注册「`.js`→`.ts`」resolve 替身层——生产源码是带 `.js` 扩展相对导入的 TS（TS ESM
//    书写口径），Node 原生 type-stripping 不重写该扩展，故测试启动器补这一层把源图接上；
//    该层只识别 `.ts` 父链路下的 `.js` 后缀，不触碰插件作用域流量，与生产钩子互不串扰。
// 2. 顺序执行 ops（load / rawImport / writeFile / appendFile / deleteFile / snapshotGlobals /
//    dispose），把每个 op 的结果与 globalThis 标记快照落 JSON 文件，交由 vitest 断言。
//    夹具本身零门禁逻辑、零判定语义——全部判定在 `src/loader/module-loader.ts` 生产实现内。
import { readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const SHIM_SOURCE = `
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js') && context.parentURL && context.parentURL.endsWith('.ts')) {
    const candidate = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
    try {
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, format: 'module-typescript', shortCircuit: true };
      }
    } catch {
      // 非法 URL 形态：交默认链接器。
    }
  }
  return nextResolve(specifier, context);
}
`;

const argsPath = process.argv[2];
if (typeof argsPath !== 'string') {
  console.error('usage: run-native-cases.mjs <args.json>');
  process.exit(2);
}
const args = JSON.parse(readFileSync(argsPath, 'utf8'));
const outFile = String(args.outFile);
const results = {};

register('data:text/javascript,' + encodeURIComponent(SHIM_SOURCE), {
  parentURL: import.meta.url,
});

const watchdog = setTimeout(() => {
  try {
    writeFileSync(outFile, JSON.stringify({ fatal: 'watchdog', results }, null, 2));
  } catch {
    // 结果文件不可写时无从补救，退出码兜底。
  }
  process.exit(4);
}, 90000);

let loader = null;
const getLoader = () => {
  if (loader === null) {
    throw new Error('loader used before create op');
  }
  return loader;
};

const wireOf = (e) => ({
  name: e && typeof e.name === 'string' ? e.name : null,
  code: e && typeof e.code === 'string' ? e.code : null,
  message: String((e && e.message) || e),
  retryable: e && typeof e.retryable === 'boolean' ? e.retryable : null,
  details: (e && e.details) ?? null,
});

const runOp = async (op) => {
  switch (op.op) {
    case 'create': {
      const source = args.loaderSource;
      const mod = await import(pathToFileURL(source).href);
      loader = mod.createCpkModuleLoader({ sessionRoot: op.sessionRoot });
      results[op.as] = { ok: true, api: typeof mod.createCpkModuleLoader };
      return;
    }
    case 'load': {
      try {
        const res = await getLoader().loadModule({
          pluginId: op.pluginId,
          rootDir: op.rootDir,
          expectedPackageHash: op.expectedPackageHash,
        });
        let defaultResult = null;
        if (typeof res.exports.default === 'function') {
          defaultResult = JSON.parse(JSON.stringify(res.exports.default()));
        }
        results[op.as] = {
          ok: true,
          nonce: res.nonce,
          entryUrl: res.entryUrl,
          gateStats: res.gateStats,
          exportKeys: Object.keys(res.exports).sort(),
          exportsFrozen: Object.isFrozen(res.exports),
          defaultKind: typeof res.exports.default,
          defaultResult,
        };
      } catch (e) {
        results[op.as] = { ok: false, wire: wireOf(e) };
      }
      return;
    }
    case 'rawImport': {
      try {
        const mod = await import(op.url);
        results[op.as] = { ok: true, keys: Object.keys(mod).sort() };
      } catch (e) {
        results[op.as] = { ok: false, wire: wireOf(e) };
      }
      return;
    }
    case 'writeFile': {
      writeFileSync(op.path, op.text);
      results[op.as] = { ok: true };
      return;
    }
    case 'appendFile': {
      appendFileSync(op.path, op.text);
      results[op.as] = { ok: true };
      return;
    }
    case 'deleteFile': {
      rmSync(op.path, { force: true });
      results[op.as] = { ok: true };
      return;
    }
    case 'snapshotGlobals': {
      const snap = {};
      for (const name of op.names) {
        snap[name] = globalThis[name] === undefined ? null : globalThis[name];
      }
      results[op.as] = snap;
      return;
    }
    case 'dispose': {
      getLoader().dispose();
      results[op.as] = { ok: true, disposed: getLoader().disposed };
      return;
    }
    default:
      throw new Error('unknown op: ' + String(op.op));
  }
};

let fatalError = null;
try {
  for (const op of args.ops) {
    await runOp(op);
  }
} catch (e) {
  fatalError = wireOf(e);
}
clearTimeout(watchdog);
writeFileSync(outFile, JSON.stringify({ fatal: fatalError, results }, null, 2));
process.exit(fatalError === null ? 0 : 1);
