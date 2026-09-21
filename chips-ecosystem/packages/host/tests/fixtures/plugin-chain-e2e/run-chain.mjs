// 插件链 E2E（装载→能力→事件）原生机制实测子进程夹具（任务 #118，`tests/plugin-chain-e2e.test.ts` 臂 A 专用）。
//
// 背景（与波 1 `tests/fixtures/module-loader/run-native-cases.mjs`、波 2
// `tests/fixtures/plugin-activation/run-native-cases.mjs` 同源）：vitest 的模块管线（vite-node）
// 代管被测代码内的 `import()`，Node ESM 自定义钩子在该管线内不触发，ModuleLoader 通道门禁
// fail-closed（`channel/not-live`）；「装载 → 角色形状 → service start 真实求值 → 能力注册 →
// Bridge 路由调用 → 事件总线投递 → 停用/卸载」的完整金链路必须在**原生 Node 子进程**里对生产
// API 真实执行。本夹具是唯一测试侧启动器，做且仅做两件事：
// 1. 注册「`.js`→`.ts`」resolve 替身层——生产源码是带 `.js` 扩展相对导入的 TS，Node 原生
//    type-stripping 不重写该扩展；JSON 导入内嵌替身与波 2 夹具同口径。
// 2. 按生产接线口径顺序驱动一条链（openPluginRegistry → createHostPluginActivationChannel →
//    createHostRuntime(pluginLoaderFactory=createCpkPluginLoader) → 订阅 → install → enable →
//    ipc 能力调用 → disable → 调用复核 → uninstall → 快照），把每一步的结果投影（成功数据或
//    序列化错误）落 JSON 文件，交由 vitest 断言。
//    夹具本身零判定语义——全部装载/激活/门禁/路由逻辑在 `src/loader/**`、
//    `src/main/plugin-activation.ts`、`src/runtime/**` 生产实现内。
//
// 注入面口径：`IPlatformHostChannel` 与 `IEventSink` 是宿主运行时既有测试注入面
// （`tests/host-runtime.test.ts` 同源）；其余端口（注册表、信任根、能力注册表、会话、
// 订阅中心、路由、激活通道、ModuleLoader）全部为生产实现实例。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const SHIM_SOURCE = `
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, nextResolve) {
  // JSON 导入内嵌替身：生产源码按 bundler 口径写 "import doc from ...json"（无 with 属性），
  // 原生 ESM 需 import attribute——测试启动器把 JSON 文档转成等价 export default 模块。
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
  console.error('usage: run-chain.mjs <args.json>');
  process.exit(2);
}
const args = JSON.parse(readFileSync(argsPath, 'utf8'));
const outFile = String(args.outFile);

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
}, 120000);

const loaderModule = await import(pathToFileURL(args.sources.loaderIndex).href);
const activationModule = await import(pathToFileURL(args.sources.activation).href);
const runtimeModule = await import(pathToFileURL(args.sources.hostRuntime).href);

const wireOf = (e) => ({
  code: e && typeof e.code === 'string' ? e.code : null,
  message: String((e && e.message) || e),
  retryable: e && typeof e.retryable === 'boolean' ? e.retryable : null,
  details: (e && e.details) ?? null,
});

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

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

let registry = null;
let channel = null;
let loader = null;
const results = {
  /** 装载器事件台账（经组合根注入位记录发布序）。 */
  events: [],
  /** 事件总线下行信封留痕（forwardEvents sink，即 preload `onEvent` 消费位）。 */
  delivered: [],
  checkpoints: {},
};

try {
  registry = await loaderModule.openPluginRegistry({ filePath: args.registryFile });
  const trustRoots = loaderModule.createTrustRootRegistryFromDocument(
    readJson(args.trustRootsFile),
    'chain-e2e',
  );
  channel = activationModule.createHostPluginActivationChannel({
    pluginRegistry: registry,
    trustRoots,
    sessionRoot: args.sessionRoot,
  });
  // 生产接线口径（`src/main/production-assembly.ts`）：宿主运行时经 `pluginLoaderFactory`
  // 递交 `hostCapabilityRegistry` 与 `emitEvent`；装载器生命周期事件经运行时广播给
  // 已订阅活动会话。测试侧仅在发布链上并联一台台账（不吞投递）。
  const runtime = runtimeModule.createHostRuntime({
    capabilities: [],
    platformRoot: args.platformRoot,
    pluginLoaderFactory: (deps) => {
      loader = loaderModule.createCpkPluginLoader({
        pluginsRoot: args.pluginsRoot,
        registry,
        hostCapabilityRegistry: deps.hostCapabilityRegistry,
        hostVersion: args.hostVersion,
        trustRoots,
        activationPortFor: (plugin) => channel.activationPortFor(plugin),
        emitEvent: (eventId, payload) => {
          results.events.push({ eventId, payload });
          deps.emitEvent(eventId, payload);
        },
      });
      return loader;
    },
  });
  await runtime.start(
    { info: { appVersion: args.hostVersion } },
    { updates: [], pushSessionPermissions(_windowId, update) { this.updates.push(update); } },
  );
  const releaseSink = runtime.forwardEvents({
    deliver: (windowId, envelope) => results.delivered.push({ windowId, envelope }),
  });

  const source = { windowId: 77, frameId: null };
  let controlSeq = 0;
  for (const eventId of args.subscribe) {
    results.checkpoints[`subscribe:${eventId}`] = await runtime.ipc.handleEventControl(
      source,
      { controlId: `sub-${(controlSeq += 1)}`, action: 'subscribe', eventId },
    );
  }

  // 插件求值身份 token：由父侧随机注入、只存活于本子进程；能力调用响应回传该 token
  // 即证明「运行的是被门禁装载的真实插件模块代码」。
  globalThis.__CHAIN_E2E_TOKEN__ = args.runToken;
  const pluginId = args.pluginId;

  const step = async (name, fn) => {
    try {
      results[name] = { ok: true, value: await fn() };
    } catch (error) {
      results[name] = { ok: false, error: wireOf(error) };
    }
  };

  await step('install', async () => {
    const pkg = await loaderModule.loadCpkArchive(args.cpkFile);
    return await loader.install({ pkg, source: 'user' });
  });
  const installRecord = results.install?.value;
  if (installRecord !== undefined) {
    results.checkpoints.registryAfterInstall = readJson(args.registryFile);
    results.checkpoints.diskAfterInstall = existsSync(installRecord.path);
    results.checkpoints.stateAfterInstall = loader.get(pluginId)?.state ?? null;
    // 装后目录包级合并摘要只读复算（诊断投影；主套件与父侧递交摘要逐字节比对，
    // 锁定 `record.hash`（归档口径）与激活期望摘要（合并口径）两口径关系）。
    const installedPkg = await loaderModule.loadCpkDirectory(installRecord.path);
    results.packageHashAfterInstall = loaderModule.computeContentHash(
      loaderModule.membersToZipEntries(installedPkg.members),
    );
  }

  await step('enable', () => loader.enable(pluginId));
  results.checkpoints.registryAfterEnable = readJson(args.registryFile);
  results.checkpoints.stateAfterEnable = loader.get(pluginId)?.state ?? null;
  results.checkpoints.reportAfterEnable = runtime.report();
  results.activatedEntry = snapshotActivated(pluginId);

  await step('invoke', () =>
    runtime.ipc.handleRequest(source, {
      requestId: 'chain-invoke-1',
      capabilityId: args.capabilityId,
      input: args.invokeInput,
    }),
  );

  await step('disable', () => loader.disable(pluginId));
  results.checkpoints.registryAfterDisable = readJson(args.registryFile);
  results.checkpoints.stateAfterDisable = loader.get(pluginId)?.state ?? null;
  results.checkpoints.reportAfterDisable = runtime.report();
  results.activatedEntryAfterDisable = snapshotActivated(pluginId);

  // 停用后复核能力撤销：同 ID 再调用应得真实注册表未命中语义（夹具零判定，响应原样序列化）。
  await step('invokeAfterDisable', () =>
    runtime.ipc.handleRequest(source, {
      requestId: 'chain-invoke-2',
      capabilityId: args.capabilityId,
      input: args.invokeInput,
    }),
  );

  await step('uninstall', () => loader.uninstall(pluginId));
  results.checkpoints.registryAfterUninstall = readJson(args.registryFile);
  results.checkpoints.diskAfterUninstall =
    typeof installRecord?.path === 'string' ? existsSync(installRecord.path) : null;
  results.checkpoints.listAfterUninstall = loader.list();

  results.checkpoints.globals = {
    starts: globalThis.__CHAIN_E2E_STARTS__ ?? null,
    stops: globalThis.__CHAIN_E2E_STOPS__ ?? null,
  };

  releaseSink();
  await runtime.shutdown();
  channel.dispose();
} catch (error) {
  results.fatalError = wireOf(error);
}

clearTimeout(watchdog);
writeFileSync(outFile, JSON.stringify({ fatal: results.fatalError ?? null, results }, null, 2));
process.exit(results.fatalError == null ? 0 : 1);
