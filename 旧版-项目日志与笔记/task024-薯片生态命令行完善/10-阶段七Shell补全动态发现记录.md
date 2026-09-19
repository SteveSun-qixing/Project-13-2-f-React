# 阶段七：Shell 补全动态发现记录

## 背景

阶段六后，插件 CLI 已具备声明、动态索引、传统执行、TUI、job 进度/取消、输出路径和批量输入能力。本阶段补齐架构方案中“shell completion 读取命令索引版本”的缺口，让命令行补全也消费 Host 动态命令索引，而不是依赖静态生成的插件命令缓存。

## 本阶段实现

- Host CLI 新增 `chips completion <bash|zsh|fish>`，输出当前 shell 的补全脚本。
- Host CLI 新增 shell completion 私有入口 `chips __complete ...`，返回换行分隔候选。
- `__complete` 每次运行都会通过 Host `cli.command.list` 读取当前已启用 app/module 插件命令，并合并 Host 固定命令树。
- 插件安装、启用、禁用或卸载后，下一次补全请求即可反映最新命令，不需要重装补全脚本或重启 Host。
- 补全只提供候选；真实执行仍重新经过传统 CLI 执行器的最长前缀匹配、冲突消解、参数解析、路径校验、payload 映射和 Host 正式路由。
- `completion` 被加入 Host 固定命令根，Host `plugin.install`、SDK `chipsdev validate/package` 和脚手架命令根派生均会阻止插件命令占用该根。
- `chipsdev completion <bash|zsh|fish>` 通过既有 Host 托管命令转发链路落到开发工作区，补全读取开发工作区插件索引。

## 影响文件

- `Chips-Host/src/main/cli/index.ts`
- `Chips-Host/src/runtime/plugin-runtime.ts`
- `Chips-Host/tests/e2e/cli.test.ts`
- `Chips-SDK/cli/index.js`
- `Chips-SDK/tests/run-cli-host-managed-tests.cjs`
- `Chips-Scaffold/chips-scaffold-app/src/core/template-engine.ts`
- `Chips-Scaffold/chips-scaffold-module/src/core/template-engine.ts`
- `Chips-Scaffold/chips-scaffold-module/tests/core/template-engine.test.ts`
- `Chips-Scaffold/chips-scaffold-module/scripts/check-templates.cjs`
- `Chips-Scaffold/chips-scaffold-module/scripts/run-generated-e2e.cjs`
- `Chips-Scaffold/chips-scaffold-module/README.md`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/05-模块插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/命令行工具/01-Chips-Host命令行使用手册.md`
- `生态共用技术文档/命令行工具/02-Chips-Dev开发者命令行手册.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`

## 验证计划

- `cd Chips-Host && npx vitest run tests/e2e/cli.test.ts --testNamePattern "completion|plugin CLI"`
- `cd Chips-Host && npm run build`
- `cd Chips-SDK && node ./tests/run-cli-host-managed-tests.cjs`
- `cd Chips-SDK && node ./tests/run-cli-package-compatibility-tests.cjs`
- `cd Chips-SDK && node --check cli/index.js`
- `git diff --check` 针对本阶段相关文件

## 后续

- 补齐 CLI / TUI 操作日志。
- 沉淀 human 输出模板与非 JSON 展示策略。
- 继续细化批量任务逐项结果标准：`items[]`、部分成功语义和错误定位。
