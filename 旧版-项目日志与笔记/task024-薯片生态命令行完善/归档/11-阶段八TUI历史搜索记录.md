# 阶段八：TUI 历史搜索记录

## 背景

阶段七完成 shell completion 后，TUI 仍缺少架构草案中定义的 `Ctrl+R` 历史命令搜索。该能力用于在键盘交互界面中快速找回已执行命令，并继续复用传统 CLI 执行器，不引入第二套执行语义。

## 本阶段实现

- TUI 状态机新增 `history` 模式。
- `Ctrl+R` 进入历史搜索；输入字符过滤历史命令，`↑ / ↓` 选择，`Enter / Tab` 回填命令构造区，`Esc` 返回浏览模式。
- 历史条目包含 `commandLine / tokens / pluginId / executedAt / code`。
- Host CLI 在工作区根保存 `cli-history.json`，用户工作区和开发工作区天然隔离。
- TUI 执行命令完成后写入历史；相同 `commandLine` 会去重并移动到顶部，最多保留 200 条。
- 历史回填后仍回到普通浏览模式，后续执行继续走传统 CLI 的最长前缀匹配、参数解析、路径校验、模块 job 等待与应用 surface 打开链路。

## 影响文件

- `Chips-Host/src/main/cli/interactive.ts`
- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/tests/unit/cli-interactive.test.ts`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`

## 验证计划

- `cd Chips-Host && npx vitest run tests/unit/cli-interactive.test.ts`
- `cd Chips-Host && npx vitest run tests/e2e/cli.test.ts --testNamePattern "interactive|completion|plugin CLI"`
- `cd Chips-Host && npm run build`
- `git diff --check` 针对本阶段相关文件

## 后续

- 沉淀 human 输出模板与非 JSON 展示策略。
- 补齐批量任务逐项结果标准：`items[]`、部分成功语义和错误定位。
- 做一次目标级完成审计，确认应用/模块插件声明、动态发现、脚手架、TUI、路径/输出/job/错误码/文档的证据链都已覆盖。
