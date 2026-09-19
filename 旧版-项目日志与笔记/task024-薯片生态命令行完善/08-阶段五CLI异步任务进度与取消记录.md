# 阶段五 CLI 异步任务进度与取消记录

## 1. 本阶段目标

本阶段补齐插件 CLI 执行模块 job 时的状态、进度和取消语义，保证传统 CLI 与 TUI 都继续复用 Host 模块服务，不形成第二套任务治理模型。

交付边界：

- 模块插件 CLI 命令返回 job 时，默认等待到 `completed / failed / cancelled` 终态。
- 等待期间可展示 `job.progress`，但不得污染 stdout 的结构化最终结果。
- 声明 `job.cancelOnInterrupt: true` 的命令在收到 `Ctrl+C` / `SIGINT` 时调用 `module.job.cancel`。
- TUI 执行仍委托传统 CLI 执行器，因此自动继承相同 job 等待、进度和取消语义。

## 2. 代码改动

### 2.1 Host CLI job 等待器

改动文件：

- `Chips-Host/src/main/cli/index.ts`

新增行为：

- `waitForCliModuleJob` 支持 `onProgress` 回调。
- `job.progress` 变化时去重通知。
- TTY 下或设置 `CHIPS_CLI_JOB_PROGRESS=1` 时，进度写入 stderr。
- 最终 stdout 仍只输出结构化 JSON，避免破坏脚本解析。
- 命令声明 `job.cancelOnInterrupt: true` 时，等待期间临时监听 `SIGINT`。
- 收到中断后调用 `module.job.cancel({ jobId })`，随后继续等待 Host 返回 `cancelled` 终态。
- `cancelled` 终态继续归一为 `CLI_JOB_CANCELLED`，退出码沿用既有取消码。

### 2.2 回归测试

改动文件：

- `Chips-Host/tests/e2e/cli.test.ts`

新增覆盖：

- 构造返回 job 的模块插件 CLI 命令。
- 模块方法通过 `ctx.job.reportProgress` 汇报 `started` 与 `completed` 进度。
- CLI 等待 job 到完成。
- `CHIPS_CLI_JOB_PROGRESS=1` 时进度输出到 stderr。
- stdout 仍可解析为最终 JSON。
- 最终 JSON 保留 `job.progress` 与 `output`。

## 3. 公共文档同步

已更新：

- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/协议与契约/06-模块能力契约.md`

文档同步重点：

- CLI 对 module job 的默认等待规则。
- `job.progress` 是正式进度载荷。
- 进度展示写入 stderr，stdout 保持结构化最终结果。
- `job.cancelOnInterrupt` 与 `module.job.cancel` 的中断取消链路。
- TUI 不另建任务治理模型，执行时继续委托传统 CLI 执行器。

## 4. 已通过验证

```text
cd Chips-Host && npx vitest run tests/e2e/cli.test.ts --testNamePattern "module job|module plugin CLI"
cd Chips-Host && npm run build
```

覆盖点：

- 传统模块 CLI 命令仍可执行并保持参数映射。
- 返回 job 的模块 CLI 命令会等待到完成。
- 进度输出不污染 stdout。
- 最终结构化结果包含 job 终态、progress 和 output。

## 5. 后续阶段

后续建议继续推进：

1. 输出目录规则与覆盖策略。
2. 批量输入格式与 schema 错误定位。
3. shell completion 与 CLI / TUI 操作日志。
4. human 输出模板与 artifact 展示。
