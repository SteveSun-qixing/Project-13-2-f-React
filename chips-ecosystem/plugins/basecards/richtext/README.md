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

`renderEditor` 交付 Milkdown 真编辑器（用户裁决 2026-10-01 第 3 项；《第三方参考资产清单》RA-11 / §2.14 登记，`@milkdown/kit` 锁测钉定 7.22.2）：

- ProseMirror 实例经 `src/milkdown/engine.ts` 唯一装配点挂载：commonmark + GFM 预设（`singleTilde: false`，与查看态 markdown 服务同方言）+ listener 序列化回流；解析侧归一（`src/milkdown/parse-normalize.ts`）保障图片空属性与容器位原始 HTML 的往返保真；
- Markdown 唯一持久化不变：编辑产物按 remark 序列化回 `content_text`，经与查看态同一 `normalizeMarkdown` 归一；渲染链无承载的五项扩展语法两态一致按纯文本呈现 + 能力降级提示（同源边界）；
- 回流走 `IBaseCardEditor` 唯一时序：`getChange` → 宿主校验 → `document:write` → 渲染会话 `update` → `markCommitted`；编辑器不写文件；
- inline 来源发 `replace` 变更，file 来源仅发 `config` 子树 `patch`（不回写不可读的正文）；`MAX_INLINE_RICHTEXT_LENGTH = 200` 闸在编辑入口实时提示。

## 不迁移面（零兼容裁决）

`LEGACY_RICHTEXT_CARD_TYPE`（`RichTextCard`）兼容别名不迁移、不声明 `aliases`；旧栈绑定臂（自建扩展语法 schema、katex、`file://` Bridge 读臂、`createRichTextMarkdownFileName` 时间/随机命名）随旧栈废弃；Milkdown 以 RA-11 登记口径（`@milkdown/kit` 聚合包）重新引入，不搬旧绑定代码。

## 命令

```bash
npx -y pnpm@9 install        # 根目录，持目录锁
npx -y pnpm@9 --dir plugins/basecards/richtext test
npx -y pnpm@9 --dir plugins/basecards/richtext typecheck
npx -y pnpm@9 --dir plugins/basecards/richtext lint
npx -y pnpm@9 --dir plugins/basecards/richtext build
```
