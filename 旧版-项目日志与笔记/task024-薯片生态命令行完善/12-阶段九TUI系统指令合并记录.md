# 阶段九：TUI 系统指令合并记录

## 背景

人工检查 `chips` 进入 TUI 后，命令构造区显示 `chips` 时状态为“没有匹配的插件命令”，且界面只展示插件命令候选。用户补充要求：系统指令也要有。

该要求与当前生态命令行契约一致：TUI 是 `chips` 的交互式命令构建器，不应只面向插件命令；系统内置命令与插件命令应共享同一个键盘优先浏览、补全和执行入口。

## 本阶段实现

- 新增 Host CLI 内置命令定义模块：
  - 固定命令根；
  - shell completion 树；
  - TUI 可浏览的系统命令叶子；
  - 系统命令参数元数据。
- TUI 模型合并系统命令与已启用插件命令：
  - 空输入可浏览 `help / status / plugin / theme / logs / doctor / completion` 等系统根；
  - 系统命令二级指令可继续浏览，例如 `plugin install`、`theme apply`；
  - 系统命令需要参数时使用与插件命令一致的参数控件提示；
  - 无匹配状态统一为“没有匹配的命令”。
- TUI 执行系统命令时回流到传统 Host CLI 分支，继续复用现有系统命令实现和结构化日志。
- 保留插件命令执行链路不变，仍通过 Host 动态命令索引、最长前缀匹配、参数解析、路径治理、任务进度和应用/模块正式路由执行。

## 影响文件

- `Chips-Host/src/main/cli/builtin-commands.ts`
- `Chips-Host/src/main/cli/interactive.ts`
- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/tests/unit/cli-interactive.test.ts`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`

## 验证计划

- `cd Chips-Host && npx vitest run tests/unit/cli-interactive.test.ts`
- `cd Chips-Host && npm run build`
- `git diff --check`

## 说明

本阶段没有引入新的第三方依赖，也没有增加历史命令搜索。TUI 仍不读取插件源码，插件命令仍由 `cli.command.list` 动态发现；系统指令来自 Host CLI 固定命令定义。
