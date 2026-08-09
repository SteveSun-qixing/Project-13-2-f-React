# chips-scaffold-module

官方模块插件脚手架，用于生成 Host 托管的无界面能力模块工程。

## 定位

模块插件不是应用窗口，也不是页面插槽。生成工程必须通过 `manifest.module.provides` 暴露 capability/method，并由 Host 模块服务完成 provider 发现、默认解析、schema 校验、方法级超时、job 生命周期、取消和审计。

本脚手架只负责开发期模板、渲染和生成工程基线，不承载 Host 模块运行时主实现。

## 模板矩阵

| 模板 ID | 默认方法 | 模式 | 场景 |
|---|---|---|---|
| `module-standard` | `run` / `runAsync` | sync / job | 通用模块基线 |
| `module-pure-function` | `run` | sync | 文本、配置、元数据归一 |
| `module-file-conversion` | `convert` | job | 输入文件到输出工件 |
| `module-html-rendering` | `convert` | job | 目录态 HTML 到 PDF / 图片 |
| `module-image-processing` | `process` | sync | 图像读取与轻量分析 |
| `module-color-extraction` | `pick` | sync | 背景色与强调色提取 |
| `module-orchestration` | `execute` | job | 下游模块能力编排 |

## 创建工程

```bash
chipsdev-r create module Chips-ModulePlugin/my-module

chipsdev-r create module Chips-ModulePlugin/html-render \
  --template module-html-rendering \
  --capability converter.html.render

chipsdev-r create module Chips-ModulePlugin/file-orchestrator \
  --template module-orchestration \
  --capability converter.file.convert \
  --consumes converter.card.to-html@^1.0.0 \
  --consumes converter.html.to-pdf@^1.0.0
```

`--consumes` 只写入生成工程的 `manifest.module.consumes`，不会自动安装、启用或调用下游 provider。模块运行期通过 `ctx.module.invoke(...)` 调用外部 capability 时，Host 会校验该声明。

## 生成工程验证

生成工程默认提供以下脚本：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

`npm run verify` 会串联 lint、typecheck、test、build、validate 和 package。`npm run package` 输出 `.cpk`，该包必须能被 Host 安装、启用，并通过 `module.listProviders / module.resolve / module.invoke / module.job.*` 完成真实调用。

## 插件 CLI 命令

所有模块模板都会在 `manifest.yaml` 生成 `cli.commands` 示例。命令路径使用项目名派生的安全根段，避开 `help / host / start / stop / status / config / logs / theme / plugin / update / doctor / open / completion` 等 Host 固定命令根；参数声明按模板 schema 映射到 `module.invoke.input`，路径、JSON、枚举、布尔值和 slider/textarea 等 TUI 提示均写在 manifest 中。

插件命令被安装并启用后由 Host 动态发现，执行仍必须走 `module.invoke / module.job.*`，不得让生成工程提供独立 OS CLI 程序或直接导入模块源码。

## Host 联调

生成工程的真实联调入口是：

```bash
chipsdev-r module invoke \
  --capability <capability> \
  --method <method> \
  --input '<json>' \
  --timeout-ms 60000
```

该命令会执行正式构建、安装并启用当前模块插件，然后通过 Host `module.invoke` 发起调用。sync 方法超时返回 `MODULE_TIMEOUT`；job 方法超时后进入 `failed`；取消运行中 job 后进入 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`。

## 维护门禁

修改模板后至少运行：

```bash
npm run build
npm test
npm run test:templates
npm run test:e2e
```

模板不得生成 React 运行时、`runtime.tsx`、页面挂载入口、主题注入逻辑、i18n UI 词典、过程性文档目录或旧 `module.mount(...)` 口径。
