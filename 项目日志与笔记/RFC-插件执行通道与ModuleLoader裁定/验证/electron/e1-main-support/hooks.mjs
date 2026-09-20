// 波0 E1：Electron 主进程支持度专测的迷你钩子（验证 module.register 在非 utility process 的主进程侧真实生效）
import { appendFileSync } from 'node:fs';
import { threadId, isMainThread as wtIsMainThread } from 'node:worker_threads';

let cfg = null;
export function initialize(data) {
  cfg = data;
  appendFileSync(cfg.logFile, JSON.stringify({ ev: 'init', wtIsMainThread, threadId, execArgv: process.execArgv, mainArgvNull: process.argv === undefined || process.argv === null }) + '\n');
}
export async function resolve(specifier, context, nextResolve) {
  appendFileSync(cfg.logFile, JSON.stringify({ ev: 'resolve', specifier: specifier.slice(0, 120), parentTail: (context.parentURL ?? '').slice(-40) }) + '\n');
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  appendFileSync(cfg.logFile, JSON.stringify({ ev: 'load', url: url.slice(0, 120) }) + '\n');
  return nextLoad(url, context);
}
