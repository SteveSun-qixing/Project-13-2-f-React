# @chips/plugin-richtext（chips.basecard.richtext）

富文本基础卡片插件：Markdown 唯一持久化的内容节点（旧 `Chips-BaseCardPlugin/richtext-BCP` 迁移）。

## 契约身份

- 插件 ID：`chips.basecard.richtext`；卡片类型：`base.richtext`（09-官方插件与应用目录 §4.2）
- 权限（最小化）：`resources:read`；依赖：`chips.service.markdown ^0.1.0`
- 双入口：`dist/index.js`（validateConfig / createInitialContent / collectResourcePaths 纯函数）+ `render.js`（renderView / renderEditor）

## 数据面

- 内容字段（01-卡片文件格式 §6.6）：`card_type` / `content_format: markdown` / `content_source: inline|file` / `content_text` / `content_file` / `locale` / `markdown_capabilities`（七项能力矩阵显式声明）；
- 存储闸：提取纯文本 ≤200 字内联（`content_text`），>200 字文件化为卡片根目录相对 `.md`（`content_file`）；两种模式互斥；
- 展示配置（`config` 字段）：`fontSize`（12–48 整数）、`lineHeight`（≥1），schema 见 `assets/schemas/richtext-config.schema.json`。

## 查看态渲染链

`renderView` 经 `src/markdown-gateway.ts` 消费 `chips.service.markdown` 公开契约（`renderHtml`，输入/输出与 `plugins/services/markdown/contracts/render-html.*.schema.json` 同型；本包不 import 服务包内部）。平台插件执行通道（工单025 剩余 / #85）交付后由帧运行时调用 `attachMarkdownRendering(source)` 注入契约实现；未注入时 fail-closed 呈现简体中文状态行，不伪造渲染成功。

在册缺位（详见 `项目日志与笔记/W4迁移-richtext-开发计划与日志-2026-09-30.md`）：

1. 渲染源注入通道（#85）；
2. file 来源正文读取（帧内禁 `fetch`/`window.chips`，资源域接线归 W4 §七 条件四）；
3. `markdown_capabilities` 中 math/highlight/underline/superscript/subscript 五项扩展语法在 markdown 服务契约（breaks/linkify/typographer）中无承载面，查看态按能力对照如实降级提示，不建第二份 Markdown 渲染器（工单057 §六红线）。

## 编辑态

`renderEditor` 按 04-基础卡片插件开发指南 §九契约基线形制交付：Markdown 源文表单 + 展示配置 + 200 字阈值提示；inline 来源发 `replace` 变更，file 来源仅发 `config` 子树 `patch`（不回写不可读的正文）。Milkdown 所见即所得编辑引擎候用户选型（§三.2 登记项），选型后以正式编辑引擎升级。

## 不迁移面（零兼容裁决）

`LEGACY_RICHTEXT_CARD_TYPE`（`RichTextCard`）兼容别名不迁移、不声明 `aliases`；Milkdown/remark/katex 绑定臂、`file://` Bridge 读臂、`createRichTextMarkdownFileName`（时间/随机）随旧栈废弃。

## 命令

```bash
npx -y pnpm@9 install        # 根目录，持目录锁
npx -y pnpm@9 --dir plugins/basecards/richtext test
npx -y pnpm@9 --dir plugins/basecards/richtext typecheck
npx -y pnpm@9 --dir plugins/basecards/richtext lint
npx -y pnpm@9 --dir plugins/basecards/richtext build
```
