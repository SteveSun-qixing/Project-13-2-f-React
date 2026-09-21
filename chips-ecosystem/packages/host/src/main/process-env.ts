/**
 * 真实进程环境读取（Vite define 垫片规避）。
 *
 * @remarks 主进程构建的 define 注入会把裸 `process.env` 标识符链替换为 `{}` 空对象
 * 垫片（浏览器目标缺省）；需要触达 Node 真实环境的判据一律经 `globalThis.process`
 * 成员链取环境——与 `e2e-app.ts` 的 `readMainProcessEnv` 同一实测口径，此处收拢为
 * 单一来源供启动编排与追踪门控消费。
 */

/** 读取主进程真实环境变量表。 */
export function readMainProcessEnv(): NodeJS.ProcessEnv {
  return (globalThis as { process?: { env?: NodeJS.ProcessEnv } }).process?.env ?? {};
}
