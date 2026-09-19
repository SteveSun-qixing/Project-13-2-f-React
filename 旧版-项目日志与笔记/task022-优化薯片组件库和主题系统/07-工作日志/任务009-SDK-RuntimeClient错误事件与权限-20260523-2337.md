# 任务009：SDK RuntimeClient 错误、事件与权限

## 本次完成范围

- 补齐 SDK `StandardError` envelope：新增 `messageKey / requestId / traceId / permission`，并提供统一 `normalizeStandardError()`。
- SDK Runtime Client 调用链新增 SDK 侧 `requestId`、真实 `timeoutMs`、成功/失败日志 requestId、失败耗时、重试 attempt 与 trace/permission 记录。
- SDK retry 仍只对 `retryable=true` 生效，但明确禁止 `PERMISSION_DENIED / SERVICE_PERMISSION_DENIED` 自动重试。
- SDK Bridge adapter 统一 Host IPC encoded error 解码，保留 `messageKey / requestId / traceId`。
- SDK `events.once()` 改为返回取消函数；自定义 transport 与 plugin bridge 均具备可取消 once 语义。
- Host Bridge API 类型同步：`on/once` 均返回 disposer，`emit/emitScoped` 为 Promise 语义，不再吞掉传输层 Promise。
- Host preload Electron `once` 改为 `on + removeListener` 包装，支持触发前取消。
- Host shared `StandardError` 类型同步新增字段；Kernel Router、command 权限前置检查、PluginRuntime 权限检查输出顶层 `permission` 诊断。
- 公共文档同步：
  - `生态共用技术文档/协议与契约/02-服务协议标准.md`
  - `生态共用技术文档/协议与契约/04-数据交换协议.md`
  - `生态共用技术文档/协议与接口标准/01-薯片协议规范.md`
  - `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
  - `生态共用技术文档/插件开发/07-Bridge-API使用指南.md`
  - `生态共用技术文档/插件开发/08-SDK使用指南.md`
  - `生态共用技术文档/架构设计/01-薯片内核设计.md`
  - `生态共用技术文档/架构设计/薯片生态-架构设计手册.md`
  - `生态共用技术文档/主题系统/02-主题接口规范.md`

## 边界说明

- 本任务只处理 Runtime Client 错误、事件、权限诊断和公共契约同步。
- 未提前展开任务020/021/022/027 的主题包完整升级、视觉 token、图标字体、motion 或主题脚手架工作。
- 未把 Host 内置 RuntimeClient 主实现迁入 SDK；SDK 仍只做正式 Bridge/Host 能力的类型化封装、诊断和调用辅助。
- 任务010 的 Domain API 缺口勘察报告已保留在 `08-草稿笔记`，不混入任务009实现范围。

## 验证记录

```bash
cd Chips-SDK
npm test
```

通过：chipsdev CLI smoke、Host managed、create app/card/layout/module workspace、module invoke、package compatibility 全部通过。

```bash
cd Chips-Host
npm run build
npm test
npm run test:contract
```

通过：Host TypeScript build、35 个 Host 测试文件 208 个测试、route manifest contract 3 个测试。

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts
```

通过：29 个 SDK Runtime Client 测试。

```bash
cd Chips-Host
npx vitest run ../Chips-SDK/tests/client.test.ts tests/unit/bridge-transport.test.ts tests/unit/runtime-client.test.ts tests/unit/chips-ipc.test.ts tests/unit/kernel-router.test.ts tests/unit/plugin-runtime.test.ts tests/unit/host-services-pal-routing.test.ts
```

通过：受影响 SDK/Host 单元链路 41 个测试。

## 后续关注

- 任务010 需要基于已生成的 `任务010-SDK-DomainAPI补齐与类型同步前置勘察报告.md` 继续处理 Domain API 缺口和类型同步。
- `Chips-Scaffold/chips-scaffold-basecard/node_modules/@types/node/*` 仍为既有无关脏文件，本任务未修改、未纳入提交。
