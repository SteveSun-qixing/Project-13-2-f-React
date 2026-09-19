# 阶段十：TUI 交互可读性优化记录

## 背景

人工测试发现当前 TUI 虽然已经可以浏览系统指令和插件命令，但界面只展示命令、状态和候选列表，缺少明确的步骤、当前高亮项说明和输入态引导。用户在选择命令片段、填写参数、确认执行之间容易混淆。

同时，`Chip-iconMaker` 的 `--output` 表示输出目录。用户选择已有目录时，CLI 因输出路径默认 `fail` 策略返回 `CLI_OUTPUT_EXISTS`，不符合“把生成图标写入这个目录”的真实使用方式。

## 本阶段实现

- TUI 渲染改为步骤化布局：
  - `选择命令`
  - `填写参数`
  - `准备执行`
  - `执行结果`
- 顶部保留完整命令预览，并新增提示区说明当前 Enter 的行为。
- 候选区下方新增“当前选择 / 说明”，展示高亮项来源、参数类型、是否必填、默认值或执行目标。
- 参数输入态明确提示：
  - path 输入为“输入或粘贴路径，Enter 确认”；
  - select / multiSelect / toggle / slider 分别提示对应键盘操作。
- 已经填过值的选项不再重复显示为可追加项，减少用户误以为需要再次填写。
- `Chip-iconMaker` 的 `--output` 路径声明增加 `overwrite: overwrite`，允许输出目录已存在。

## 影响文件

- `Chips-Host/src/main/cli/interactive.ts`
- `Chips-Host/tests/unit/cli-interactive.test.ts`
- `Chip-iconMaker/manifest.yaml`
- `Chip-iconMaker/tests/e2e/basic-flow.test.ts`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`

## 验证

- `cd Chips-Host && npx vitest run tests/unit/cli-interactive.test.ts`
- `cd Chips-Host && npm run build`
- `cd Chip-iconMaker && npm run validate`
- `cd Chip-iconMaker && npm test -- --run tests/unit/cli-runner.test.ts tests/e2e/basic-flow.test.ts`

## 说明

本阶段没有引入第三方 TUI 库，也没有改变传统 CLI 执行链路。TUI 仍只是命令构建器，最终执行继续回到 Host CLI 正式解析、权限、路径、任务和日志链路。
