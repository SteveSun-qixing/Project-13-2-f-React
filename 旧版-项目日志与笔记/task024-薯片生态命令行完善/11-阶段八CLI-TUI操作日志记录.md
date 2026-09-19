# 阶段八：CLI / TUI 操作日志记录

## 背景

阶段七完成 shell completion 后，原计划曾补充 TUI 历史搜索。但最新任务口径明确：不需要历史命令搜索，需要日志系统，并且可以记录所有操作记录。因此本阶段移除 TUI 历史搜索入口，不再保存 `cli-history.json`，改为记录 CLI / TUI 操作日志。

## 实现范围

- Host 结构化日志增加工作区持久化文件 `host-logs.jsonl`。
- Host 启动时读取 `host-logs.jsonl`，`log.query / log.export` 可查询和导出历史日志。
- Host 停止时把内存结构化日志写回 `host-logs.jsonl`，CLI 操作也会直接 append 到同一文件。
- 内建 CLI 命令、插件 CLI 命令执行成功和失败都会写入 `namespace: "cli"`、`action: "operation.execute"` 日志。
- TUI 执行命令时复用传统 CLI 执行器，因此同样写入 `operation.execute`，并通过 `metadata.source: "tui"` 标识来源。
- shell completion 私有入口 `chips __complete ...` 成功返回候选后写入日志，来源为 `metadata.source: "completion"`。
- 操作日志记录脱敏后的 `commandLine / argv / workspace / exitCode / commandId / commandPath / targetType / error` 等字段。
- 参数名包含 token、secret、password、credential、api key 等敏感语义时，日志中的参数值脱敏为 `<redacted>`。

## 取消的内容

- 移除了 TUI `Ctrl+R` 历史搜索模式。
- 移除了工作区 `cli-history.json` 读写。
- 移除了执行后写入历史、历史回填和历史搜索测试。
- 原 `11-阶段八TUI历史搜索记录.md` 已移入 `归档/`。

## 文档同步

- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
  - 移除 TUI 历史搜索说明；
  - 增加 CLI / TUI 操作日志说明。
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`
  - 将 TUI 能力说明从历史搜索调整为操作日志。
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
  - 明确 CLI / TUI 操作日志字段和 TUI 不维护历史搜索文件。

## 验证关注点

- Host 日志能跨 Host 重启保留。
- 插件 CLI 成功执行后，`chips logs` 能看到 `result: success` 的 `cli.operation.execute`。
- 插件 CLI 参数或路径错误后，`chips logs` 能看到对应错误码和非零退出码。
- TUI 单元测试不再出现 `Ctrl+R` 历史搜索。
