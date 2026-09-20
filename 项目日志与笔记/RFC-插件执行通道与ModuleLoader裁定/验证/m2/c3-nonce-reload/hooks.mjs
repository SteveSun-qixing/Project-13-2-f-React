// 波0 M2 自定义 ESM Hook（resolve/load 双钩）——C3 nonce 复加载口径版（与 C1/C2 同源机制）
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
  log({ ev: 'init', wtIsMainThread, threadId, versions: { node: process.versions.node, electron: process.versions.electron } });
}

function withinPluginScope(urlStr) {
  return typeof urlStr === 'string' && urlStr.startsWith(cfg.pluginRootUrl);
}

// —— resolve 钩：保留查询串（nonce 穿透 ESM 缓存的关键：URL 含 query 即不同缓存键）——
export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL;
  if (!withinPluginScope(parent)) {
    if (withinPluginScope(specifier)) log({ ev: 'resolve', kind: 'entry-allow', specifier });
    return nextResolve(specifier, context);
  }
  if (!specifier.startsWith('.')) {
    log({ ev: 'resolve', kind: 'reject', reason: 'not-in-whitelist', specifier, parent });
    throw new Error(`W0_WHITELIST_REJECT ${specifier}`);
  }
  const resolved = await nextResolve(specifier, context);
  if (!withinPluginScope(resolved.url)) {
    log({ ev: 'resolve', kind: 'reject', reason: 'scope-escape', specifier, url: resolved.url, parent });
    throw new Error(`W0_WHITELIST_REJECT ${specifier} (scope-escape)`);
  }
  log({ ev: 'resolve', kind: 'allow', specifier, url: resolved.url });
  return resolved;
}

// —— load 钩：每次复加载都重新读字节 + 复算哈希（门禁在每次装载时重新生效）——
export async function load(url, context, nextLoad) {
  if (!withinPluginScope(url)) return nextLoad(url, context);
  const filePath = fileURLToPath(url.split('?')[0]);
  const source = readFileSync(filePath, 'utf8');
  const actual = 'sha256-' + createHash('sha256').update(source, 'utf8').digest('hex');
  const expected = cfg.expectedHashes[filePath];
  if (!expected || expected !== actual) {
    log({ ev: 'load', kind: 'reject', reason: 'hash-mismatch', url, expected: expected ?? null, actual });
    throw new Error(`W0_HASH_REJECT ${url}`);
  }
  log({ ev: 'load', kind: 'allow', url, hash: actual });
  return { format: 'module', source, shortCircuit: true };
}
