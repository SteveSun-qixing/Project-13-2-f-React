// 波0 M2 自定义 ESM Hook（resolve/load 双钩）——C1 白名单口径版
// 由 module.register() 装载，运行于独立钩子线程（worker）；门禁素材经 initialize(data) 投递。
import { fileURLToPath } from 'node:url';
import { readFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { threadId, isMainThread as wtIsMainThread } from 'node:worker_threads';

let cfg = null;

function log(obj) {
  if (!cfg || !cfg.logFile) return;
  appendFileSync(cfg.logFile, JSON.stringify(obj) + '\n');
}

export function initialize(data) {
  cfg = data;
  log({
    ev: 'init',
    wtIsMainThread,
    threadId,
    processIsMainThread: process.isMainThread ?? null,
    versions: { node: process.versions.node, electron: process.versions.electron },
  });
  try {
    if (typeof port2 !== 'undefined' && port2 && port2.postMessage) {
      port2.postMessage({ ev: 'init', wtIsMainThread, threadId });
    }
  } catch {
    /* port 面为加分证据，fs 日志为权威 */
  }
}

function withinPluginScope(urlStr) {
  return typeof urlStr === 'string' && urlStr.startsWith(cfg.pluginRootUrl);
}

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL;
  const parentIsPlugin = withinPluginScope(parent);
  if (!parentIsPlugin) {
    // 非插件流量（宿主自身 ESM）透传；插件入口由宿主以 file URL 显式递交，仍过日志留痕
    if (withinPluginScope(specifier)) {
      log({ ev: 'resolve', kind: 'entry-allow', specifier, parent: parent ?? null });
    }
    return nextResolve(specifier, context);
  }
  // —— 插件作用域出边：白名单判定（§5.2：禁 node:*、electron、裸路径、作用域外路径）——
  if (!specifier.startsWith('.')) {
    log({ ev: 'resolve', kind: 'reject', reason: 'not-in-whitelist', specifier, parent });
    throw new Error(`W0_WHITELIST_REJECT ${specifier} (reason=not-in-whitelist)`);
  }
  const resolved = await nextResolve(specifier, context);
  if (!withinPluginScope(resolved.url)) {
    log({ ev: 'resolve', kind: 'reject', reason: 'scope-escape', specifier, url: resolved.url, parent });
    throw new Error(`W0_WHITELIST_REJECT ${specifier} (reason=scope-escape)`);
  }
  log({ ev: 'resolve', kind: 'allow', specifier, url: resolved.url });
  return resolved;
}

export async function load(url, context, nextLoad) {
  if (!withinPluginScope(url)) return nextLoad(url, context);
  const filePath = fileURLToPath(url.split('?')[0]);
  const source = readFileSync(filePath, 'utf8');
  const actual = 'sha256-' + createHash('sha256').update(source).digest('hex');
  const expected = cfg.expectedHashes[filePath];
  if (!expected || expected !== actual) {
    log({ ev: 'load', kind: 'reject', reason: 'hash-mismatch', url, expected: expected ?? null, actual });
    throw new Error(`W0_HASH_REJECT ${url} (expected=${expected} actual=${actual})`);
  }
  log({ ev: 'load', kind: 'allow', url });
  return { format: 'module', source, shortCircuit: true };
}
