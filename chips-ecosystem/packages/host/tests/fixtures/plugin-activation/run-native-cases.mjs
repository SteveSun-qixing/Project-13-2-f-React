// 波 2 宿主激活端口原生机制实测子进程夹具（任务 #109，`tests/plugin-activation.test.ts` 专用）。
//
// 背景（与波 1 `tests/fixtures/module-loader/run-native-cases.mjs` 同源）：vitest 的模块管线
// （vite-node）会代管被测代码内的 `import()`，Node ESM 自定义钩子在该管线内不触发，真通道
// 求值（装载 → 角色形状 → service start 执行 → 门面副作用登记）必须在**原生 Node 子进程**
// 里对生产 API 真实执行。本夹具是唯一测试侧启动器，做且仅做两件事：
// 1. 注册「`.js`→`.ts`」resolve 替身层——生产源码是带 `.js` 扩展相对导入的 TS，Node 原生
//    type-stripping 不重写该扩展，该层只识别 `.ts` 父链路下的 `.js` 后缀，不触碰插件作用域流量。
// 2. 顺序执行 ops（channel / apply / stop / globals / writeFile / dispose），把每个 op 的
//    结果（成功投影或 `wireOf` 失败序列化）落 JSON 文件，交由 vitest 断言。
//    夹具本身零判定语义——全部激活/门禁逻辑在 `src/main/plugin-activation.ts` 与
//    `src/loader/**` 生产实现内。
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const SHIM_SOURCE = `
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, nextResolve) {
  // JSON 导入内嵌替身：生产源码按 bundler 口径写 "import doc from ...json"（无 with 属性），
  // 原生 ESM 需 import attribute——测试启动器把 JSON 文档转成等价 export default 模块，
  // 内容语义不变（信任根内嵌面）。
  if (specifier.endsWith('.json') && context.parentURL) {
    try {
      const target = new URL(specifier, context.parentURL);
      const text = readFileSync(fileURLToPath(target), 'utf8');
      return {
        url: 'data:text/javascript,' + encodeURIComponent('export default ' + text),
        shortCircuit: true,
      };
    } catch {
      // 非文件形态：交默认链接器。
    }
  }
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

const activationModule = await import(pathToFileURL(args.sources.activation).href);
const loaderModule = await import(pathToFileURL(args.sources.loaderIndex).href);

let channel = null;
let registry = null;
/** 每次 apply/stop 独立的上下文记录面（能力注册与事件发布留痕，随结果序列化）。 */
const contextLedger = new Map();

const wireOf = (e) => ({
  name: e && typeof e.name === 'string' ? e.name : null,
  code: e && typeof e.code === 'string' ? e.code : null,
  message: String((e && e.message) || e),
  retryable: e && typeof e.retryable === 'boolean' ? e.retryable : null,
  details: (e && e.details) ?? null,
});

const snapshotActivated = (pluginId) => {
  const activated = channel.activatedEntry(pluginId);
  if (activated === undefined) {
    return null;
  }
  return {
    pluginId: activated.pluginId,
    version: activated.version,
    role: activated.role,
    nonce: activated.nonce,
    entryUrl: activated.entryUrl,
    entryKeys: Object.keys(activated.entry).sort(),
  };
};

const buildContext = (pluginId) => {
  const entry = registry.get(pluginId);
  if (entry === undefined) {
    throw new Error('registry entry missing for ' + pluginId);
  }
  const capabilities = [];
  const events = [];
  const hostCapabilityRegistryStub = {
    register: (descriptor) => {
      capabilities.push({ id: descriptor.id, owner: descriptor.owner });
    },
    unregister: (capabilityId) => {
      const index = capabilities.findIndex((item) => item.id === capabilityId);
      if (index >= 0) {
        capabilities.splice(index, 1);
      }
    },
    getRegistered: (capabilityId) => capabilities.find((item) => item.id === capabilityId),
  };
  const context = loaderModule.createPluginActivationContext({
    pluginId,
    version: entry.version,
    role: entry.role,
    hostCapabilityRegistry: hostCapabilityRegistryStub,
    publishEvent: (eventId, payload) => {
      events.push({ eventId, payload });
    },
    config: { greeting: 'hi' },
    signal: new AbortController().signal,
  });
  const ledger = { context, capabilities, events, entry };
  contextLedger.set(pluginId, ledger);
  return ledger;
};

const runOp = async (op) => {
  switch (op.op) {
    case 'channel': {
      registry = await loaderModule.openPluginRegistry({ filePath: args.registryFile });
      const trustRoots = loaderModule.createTrustRootRegistry(args.trustRootKeys ?? []);
      channel = activationModule.createHostPluginActivationChannel({
        pluginRegistry: registry,
        trustRoots,
        sessionRoot: op.sessionRoot,
      });
      results[op.as] = { ok: true, api: typeof channel.activationPortFor };
      return;
    }
    case 'apply': {
      const ledger = buildContext(op.pluginId);
      const port = channel.activationPortFor({
        id: op.pluginId,
        version: ledger.entry.version,
        role: ledger.entry.role,
        path: ledger.entry.path,
      });
      try {
        await port.apply(ledger.context);
        results[op.as] = {
          ok: true,
          activatedEntry: snapshotActivated(op.pluginId),
          capabilities: ledger.capabilities,
          events: ledger.events,
        };
      } catch (e) {
        results[op.as] = { ok: false, wire: wireOf(e), activatedEntry: snapshotActivated(op.pluginId) };
      }
      return;
    }
    case 'stop': {
      const ledger =
        contextLedger.get(op.pluginId) ?? buildContext(op.pluginId);
      const port = channel.activationPortFor({
        id: op.pluginId,
        version: ledger.entry.version,
        role: ledger.entry.role,
        path: ledger.entry.path,
      });
      try {
        await port.stop(ledger.context);
        results[op.as] = {
          ok: true,
          activatedEntry: snapshotActivated(op.pluginId),
          events: ledger.events,
        };
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
    case 'globals': {
      const snap = {};
      for (const name of op.names) {
        snap[name] = globalThis[name] === undefined ? null : globalThis[name];
      }
      results[op.as] = snap;
      return;
    }
    case 'dispose': {
      channel.dispose();
      results[op.as] = { ok: true, activated: snapshotActivated(op.pluginId) };
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
