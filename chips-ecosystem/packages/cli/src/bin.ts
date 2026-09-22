#!/usr/bin/env node
/**
 * `chips` 可执行入口（用户侧与开发侧共用同一可执行文件，[CLI 完整参考] §1.1）。
 *
 * 波 3 生产装配（《17-CLI承载链路契约》§2.2/§5.2，工单039）：客户端经
 * `createProductionClient` 组装——`userData` 根按发行布局解析 → 承载
 * `ICliInvoker`（含 §5.2 按需启动缺省链）→ 复用 `createLocalClient` 状态机；
 * 解析不出根时回退无承载定性。`main()` 缺省组装面（嵌入/测试）不受影响。
 */

import { main } from './main.js';
import { createProductionClient } from './runtime/production-client.js';

main(process.argv.slice(2), {
  clientFactory: (): Promise<ReturnType<typeof createProductionClient>> =>
    Promise.resolve(createProductionClient()),
})
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
