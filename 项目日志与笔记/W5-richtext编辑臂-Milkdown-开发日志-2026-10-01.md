# W5-richtext 编辑臂（Milkdown）开发计划与日志-2026-10-01

> 臂别：W5 编辑臂 ｜ 独占范围：`chips-ecosystem/plugins/basecards/richtext/` 与《第三方参考资产清单》Milkdown 增补节 ｜ 依据：用户裁决记录-2026-10-01 第 3 项（编辑引擎统一引入 Milkdown）

## 一、任务目标

1. 选型登记先行：Milkdown 全家桶按实际需要最小集逐包核许可证（MIT 预期）→ 登记《第三方参考资产清单》新节（用途/版本钉定/包体评估/替代方案不选理由）→ 写入 `plugins/basecards/richtext/package.json`（锁测钉定版本）。**登记完成前禁引入。**
2. 编辑臂实现：`renderEditor` 升级为 Milkdown 真编辑器（ProseMirror 实例挂载、GFM 预设、markdown 序列化与查看态同源）；编辑回流严格走 `IBaseCardEditor` 契约唯一时序（`getChange` → 宿主校验 → `document:write` → `update(view, revision)` → `markCommitted`，经 `@chips/sdk` 正式面，编辑器不写文件）；`MAX_INLINE_RICHTEXT_LENGTH = 200` 闸在编辑入口执行；markdown 能力对照（capabilities）/resource-links 查看态↔编辑态同源。
3. 测试先测后码：编辑链契约测试（fake 桥形制）、Milkdown 装载/序列化真实断言（jsdom）、200 字闸、回流时序 journal 锁测。基线 49 用例只增不减。

## 二、开工前置研读（已完成）

- 用户裁决记录-2026-10-01-六项.md 第 3 项：统一编辑引擎 = Milkdown（ProseMirror 内核）；授信口径 = 宽松协议可引入，须「许可证核验→清单登记→锁测钉定」三步。
- 现状：`plugins/basecards/richtext/` 查看态全量交付（markdown 服务契约消费、resource-links、container-lifecycle、200 字闸、49 用例）；编辑臂为 04 §九契约基线形制（Markdown 源文 TextArea 表单）+「编辑引擎候用户选型」缺位登记（W4迁移-richtext §三.2）——本臂收口该缺位。
- 旧族编辑面（只读参照）：`Chips-BaseCardPlugin/richtext-BCP/src/editor/{panel,runtime}.tsx` —— Milkdown 7.19.2 全家桶（core/ctx/prose/utils/preset-commonmark/preset-gfm/plugin-listener）、listener.markdownUpdated 驱动提交、GFM singleTilde=false、扩展语法臂（==/++/^/~/$）以 remark 插件自建 schema。
- 契约：08 §4（IBaseCardEditor 类型面与回流时序）、04 §五（renderEditor 与容器生命周期）、12 §6.1（编辑回流唯一时序）、`packages/sdk/src/types/roles/basecard.ts` 类型单点。
- 查看态渲染链同源基线：markdown 服务 = markdown-it 15.0.2，`html:false`（原始 HTML 降级为文本）、GFM 表格/删除线（`~~` 双波浪）、commonmark 基线；五项扩展语法在渲染链无承载（capabilities.ts 在册缺位，双态降级提示）。

## 三、选型与登记结论

- 引入载体：`@milkdown/kit`（官方 v7 聚合包，子路径导入按需取用）——单一运行时依赖位，子路径取 `core` / `preset/commonmark` / `preset/gfm` / `plugin/listener` / `utils`；替代方案（@tiptap/\*、自研 ProseMirror 封装、slate/lexical、第二套渲染器）不选理由见清单 §2.14。
- 版本钉定：`@milkdown/kit@7.22.2`（npm latest，2026-10-01 观测）；全家桶（core/ctx/prose/utils/transformer/exception/preset-commonmark/preset-gfm/plugin-listener）逐包许可证核验均为 MIT，GPL 系零命中。
- 扩展语法臂（==高亮==/++下划线++/^上标^/~下标~/$数学$）不随编辑臂引入：渲染链（markdown 服务）无承载面，编辑态引入富渲染将造成查看态↔编辑态双态漂移，违反同源红线；两态统一按纯文本呈现 + 能力降级提示，待渲染链扩展臂统一收口。
- file 来源正文编辑：读取通道缺位不变（帧内禁 fetch/window.chips），编辑器不得以不可读正文回写覆盖 `content_file`，维持 config patch 分流。

## 四、实施记录

### 4.1 登记（先行完成）

- 《第三方参考资产清单》§2.1 总览表追加 RA-11；新增 §2.14「编辑引擎统一选型运行时依赖登记（RA-11 Milkdown，用户裁决 2026-10-01 第 3 项）」：用途、版本钉定、逐包许可证核验、包体评估、替代方案不选理由、登记外裁决（@tiptap/\* 翻正为「不引入」）。
- `plugins/basecards/richtext/package.json` 写入 `@milkdown/kit: 7.22.2`（精确钉定，无语义化范围）。

### 4.2 编辑臂实现

模块落位（全在 `plugins/basecards/richtext/`）：

- `src/milkdown/engine.ts`（新增）：Milkdown 装配唯一口径——`@milkdown/kit` 子路径最小集（`core` / `preset/commonmark` / `preset/gfm` / `plugin/listener` / `prose/state` / `utils`）；GFM `singleTilde:false` 与查看态 markdown 服务（markdown-it 双波浪删除线）同方言；`listener.markdownUpdated` → `normalizeMarkdown`（与 readContent 同一归一口径）→ 草稿回流；附程序化编辑入口 `insertTextIntoRichTextEditor` / `replaceRichTextDocument` / `focusRichTextEditor`（宿主驱动/测试面，与键入同一事务路径）。
- `src/markdown/html-node.ts`（新增）：原始 HTML 保形 schema——查看态 `html:false` 转义呈现的同源镜像：remark `html` 节点承载为原子文本节点、序列化按原文逐字回写；容器位 html 归一包入段落（解析侧 $remark，序列化仍输出裸 html 节点）。
- `src/editor.tsx`（重写）：`MilkdownBodyEditor` 组件（宿主 div + 引擎生命周期：异步装载、卸载/基线替换销毁、`data-engine-ready` 就绪标记）+ 展示配置表单（antd Form）+ 200 字闸实时提示 + 能力降级提示（与查看态同一 capabilities 对照面）；file 来源维持缺位状态行、不挂载正编辑面、patch 分流。
- `src/render.tsx`（升级）：`RichTextEditor` 句柄持有引擎引用（onMilkdownReady），`focus()` 走引擎臂、`insertText` / `replaceDocument` 程序化编辑入口；回流唯一时序、`markCommitted` / `update` / `dispose` 纪律保持 W4 基线不变。
- 同源边界落地：五项扩展语法（==/++/^/~/$）不装配富渲染臂（清单 §2.14 同源边界 2），编辑态与查看态一致按纯文本呈现 + 降级提示；`html` 保真保证 resource-links 扫描口径（`<img>`/`<a>`）编辑往返不丢。

### 4.3 测试

- `tests/milkdown-engine.test.ts`（新增）：引擎装载（ProseMirror 真实挂载、基线解析结构断言）、序列化同源（GFM 结构/相对资源引用/扩展语法纯文本/原始 HTML 保真 getMarkdown 往返）、事务回流（listener 序列化、程序化全文替换、空文中间态归一）——全部 jsdom 真实断言，零 mock。
- `tests/render.test.tsx`（编辑臂重写）：inline replace 分流（事务驱动、locale/能力矩阵保留、GFM+资源引用保真）、清空中间非法态不过闸、markCommitted 基线、200 字闸实时切换、update 重挂载/单实例/revision 忽略、dispose 纪律；file 来源 patch 分流与缺位提示保持；新增「编辑回流唯一时序 fake 桥 journal 锁测」三例（全时序 journal 逐位锁测、宿主校验不过闸不写文档不推进、连续回流 revision 严格递增）。

## 五、验证记录（四闸亲跑，2026-10-01）

- `pnpm test`：5 文件 64 用例全绿（W4 基线 49 用例只增不减，新增 15：Milkdown 引擎装载/序列化 12 + 回流时序 journal 锁测等）；
- `pnpm typecheck`：0 错；`pnpm lint`：0 错 0 警；`pnpm build`：dist/index.js 4.15 KB（主进程自包含不变）+ render.js 720.28 KB / gzip 189.27 KB（臂前基线 14.4 KB，增量 ≈706 KB 即全家桶构建后进包体积，已登记清单 §2.14）；
- 未跑 gates:all（按臂约束）；未执行任何 git 写操作（分支「第五次重构」由用户管理）。

## 六、过程中的关键判定与实证

1. **锁接管**：/tmp/w4-lockguard 为 W5-office-三域迁移臂残留（09:57 后无持锁进程、无 pnpm 活动的 stale 锁，全进程扫描确认后接管；前任 README 留存在 `/tmp/w4-lockguard-released-README.stale-office-arm.md`）。
2. **上游缺陷实证（风险①登记）**：`@milkdown/preset-commonmark@7.22.2` 的 image schema `alt`/`title` 为 `validate:"string"`，而 remark 缺省出料为 `null`——无 alt/title 图片装载抛 RangeError 且节点被静默丢弃（最小复现：纯 `Editor.make()+commonmark+gfm` 即复现，与本臂装配无关）。收口：`src/milkdown/parse-normalize.ts` 解析侧归一回填空串，序列化按无 alt/title 形态输出，往返保真；rich-text-editor 应用臂、office word 域启用 Milkdown 时须随行同款归一（已写入清单 §2.14 风险与限制）。
3. **装配形制实证（风险②登记）**：`$remark` 产物的 `options` 切片必须先于插件本体注册（漏注册即 `Context not found`）；`preset-commonmark` 7.22.2 已内建 `html` 原文保真 schema，本臂不重复建 schema，只补容器位归一（初稿 html-node.ts 草案作废，按归档政策移入包内 `归档/`）。
4. **序列化规范形态（风险③登记）**：remark 序列化 bullet 规范为 `*`、表格列宽对齐、尾随换行——持久化一律经 `normalizeMarkdown` 归一，禁止字节级 diff 判等（引擎测试以规范形态断言锁定）。
5. **同源边界落地**：五项扩展语法不装配富渲染臂（两态一致纯文本 + 降级提示）；`html:false` 同源（编辑态原文保真、查看态转义呈现）；file 来源不挂载正编辑面、仅 config patch。
6. **变更发布粒度**：每个 ProseMirror 事务发布一次变更（与 W4 契约基线表单的逐次 onChange 同粒度、同 08 §4.3 规则 5 的「同一事务合并」口径）；回流节奏归编辑链路（12 §6.3 自动保存防抖）。
7. **文档同步**：清单 §2.14 + RA-11 行 + §2.13 tiptap 行终局化；包 README 编辑态/不迁移面章节与 manifest description 翻正。

