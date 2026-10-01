# W5 迁移：rich-text-editor card-document 迁移臂（三段式第③段）开发日志

> 日期：2026-10-01
> 任务：富文本编辑器（`chips.official.rich-text-editor`）card-document 迁移臂（W5 派单行表 #7「迁移臂可先派」段）
> 独占目录：`chips-ecosystem/plugins/apps/rich-text-editor/`
> 勘查底册：`项目日志与笔记/W5开工前置-应用族逐仓勘查-2026-10-01.md` 行表 #7；矩阵裁决按 `项目日志与笔记/重构计划/旧功能覆盖矩阵-音乐富文本社区客户端-2026-09-20.md` §三（67 行裁决）逐文件执行
> 格式权威：《01-卡片文件格式》（薯片生态文档库/04-文件格式规范，含 01.04 metadata / 01.05 structure / 01.07 content 通用字段 / 01.12 base.richtext / 01.17 cover.html / 01.18 资源组织 / 01.19 文件命名）；ID 文法：《05-ID生成规范》
> 旧仓（只读冻结）：`Chips-RichTextEditor/`（全程零写、零 git 操作）
> 同族判例：`plugins/apps/book-reader/`（迁移臂资产落位与日志形制）、`plugins/basecards/richtext/`（LEGACY 兼容面未迁判例）

## 一、范围与裁决执行

按派单范围执行矩阵 §三 row64/row65「迁移」裁决四件：`card-document.ts`（构建/校验/序列化）、`richtext-card.ts`（base.richtext 配置 + markdown_capabilities 能力矩阵）、`id.ts`（ID 文法）、`path.ts`（卡片根相对路径文法），配套 `card-document.test` 随迁 + 以《01-卡片文件格式》为唯一权威重建 fixtures（rte G-5：LEGACY 类型对照无夹具）。

**本臂不做**（如实登记，见 §五）：编辑臂（richtext 编辑引擎选型用户裁决挂起，牵动 basecards/richtext 编辑态）、UI 壳（AppView 保持脚手架骨架态）、编辑会话 / 打开投递 / 命令面（矩阵 row67/row68 判重写，属编辑臂）、会话工作目录与打包持久化（row65 注则「按新插件私有数据目录适配」，属编辑臂落地时适配）。

## 二、迁移资产落位（新包内路径 ← 旧仓路径）

- `src/domain/card/card-document.ts` ← `src/lib/card-document.ts`（迁移适配：G-5 对照后重建，见 §三）
- `src/domain/card/richtext-card.ts` ← `src/lib/richtext-card.ts`（迁移适配：G-5 清 LEGACY，见 §三）
- `src/domain/card/id.ts` ← `src/lib/id.ts`（迁移适配：按《05-ID生成规范》收窄为文法校验面，生成面不迁，见 §三.3）
- `src/domain/card/path.ts` ← `src/lib/path.ts`（迁移适配：仅保留卡片文档域路径文法 `normalizeRelativeResourcePath`；其余纯函数随其消费面归属编辑臂重写，见 §三.4）
- `tests/fixtures/composite-card.ts`（新建）：文档库权威字节夹具（metadata/structure/content/cover 逐字对齐 01 §4/§5/§6.6/§7.6；标识取文档在册示例 `a1B2c3D4e5` / `f6G7h8I9j0` / `k1L2m3N4o5`，不自造 ID）
- `tests/unit/{card-document,richtext-card,id,path}.test.ts`（新建 73 例）：旧 `card-document.test` 三例随迁 + 全分支校验闸矩阵（35 个诊断码逐码断言）
- `package.json`：`dependencies` 增 `yaml@2.8.2`（与 host/cli 同版本锁；文档模型序列化唯一第三方依赖；持目录锁 `/tmp/w4-lockguard` 执行 `npx -y pnpm@9 install --no-frozen-lockfile`，lockfile 仅 importer 段 4 行增量、无新解析）

域文件落 `src/domain/card/`（book-reader 判例 `src/domain/` 形制）；不进 `src/index.ts` 公开导出面（主逻辑公开面零变化，消费方为编辑臂）。

## 三、G-5 格式权威对照（逐字段，旧码 → 新码）

### 3.1 card-document.ts

| 对照点 | 旧实现 | 《01-卡片文件格式》口径 | 处置 |
|---|---|---|---|
| metadata 写入字段 | 含 `description: ""` | §4.1 Schema 无 `description` | **清除** |
| structure 节点字段 | `id`/`type`/`created_at`/`modified_at` | §5.1 items 仅 `id`/`type`（与 SDK `IStructureEntry` 同面） | **清除节点级时间戳** |
| 节点类型读取 | `base.richtext` 或 LEGACY `RichTextCard` | §5.3 历史别名只允许读取归一、不作为新写入值；零兼容宪法 + ADR-010 不留兼容映射 | **仅认 `base.richtext`**，`RichTextCard` 读取归一面不迁（有负向断言） |
| 时间戳校验 | `Date.parse` 任意 ISO（含非 UTC 偏移） | §4.1 `format: date-time`，示例全 UTC | **从严为 ISO 8601 UTC 字面**（与宿主 `validation.ts` 在册口径同字面）+ 可解析为真实时刻 |
| `modified_at ≥ created_at` | 未校验 | §4.3「不得早于 created_at」 | **新增诊断码 `CARD_METADATA_MODIFIED_BEFORE_CREATED`** |
| 清单资源 `size` | 非负有穷数 | §5.1 Schema `type: integer` | **从严为非负整数** |
| 节点标识集合 | 无等价查重 | 《05-ID生成规范》§二.6/§六.1 大小写不敏感等价查重 | **新增 `CARD_STRUCTURE_NODE_ID_DUPLICATED`**（复用 id 模块判定） |
| 默认封面 | 自绘径向渐变 + 标题内嵌 | §7.6 官方默认封面模板（`linear-gradient(135deg,#f5f7fb,#eef3ff)` + `.card-name`） | **逐字对齐 §7.6**，`{{CARD_NAME}}` 替换并做 HTML 转义 |
| 诊断码 / 消息 | 英文 message | 界面与异常文案简体中文直写 | **中文化**（诊断码字面随迁不变，测试断言逐码对应） |
| 保留面 | — | §8.2 资源路径不落入 `.card/`、`content/` 保留命名空间 | 维持旧判定并对照在册 |

### 3.2 richtext-card.ts

| 对照点 | 旧实现 | 口径 | 处置 |
|---|---|---|---|
| `LEGACY_RICHTEXT_CARD_TYPE`（`RichTextCard`） | 导出并参与归一 | §6.6 `card_type` const `base.richtext`；零兼容宪法 | **不迁**，模块面负向断言（`'LEGACY_RICHTEXT_CARD_TYPE' in module` 为 false） |
| `markdown` 字段别名 | 归一面消费为正文 | §6.6 无此字段；SDK `CardContent` 允许不透明附加字段 | **不消费**（附加字段存在不报错、不进模型；有负向断言） |
| 「有 `content_file` 即判 file」推断 | 归一面容错推断 | §6.6 `content_source` 为必填枚举，非法取值如实报告 | **删除推断**：仅显式 `content_source: "file"` 判 file，其余按 inline 收敛交校验闸 |
| 能力矩阵七项 | 同名同判 | §6.6 required 七项、缺省全 `true` | 维持（仅显式 `false` 关闭） |
| 资源引用收集 | 正则扫描链接/图片/内联 HTML | §5.3 清单与配置引用一致 | 维持（去重 + 字典序稳定排序，协议化/绝对路径由路径文法过滤） |
| `theme` / `locale` | 归一保留 | §6.1 `theme` 保留字段写空串；§6.6 示例 `locale: zh-CN` | 维持（装配面写空串，缺省 `zh-CN`） |

存储闸（§6.6「纯文本 ≤200 字写 `content_text`、>200 字文件化」）属保存/持久化写入面，由编辑臂在保存链执行（basecards/richtext `content.ts` 已有同口径存储闸判例）；文档模型校验闸维持 inline/file 互斥与字段合法性，不重复 200 字闸。

### 3.3 id.ts（ID 文法）

- 文法 `^[0-9A-Za-z]{10}$`（§二.1；与宿主 `MEMBER_ID_PATTERN`、内核 `is_base62_id` 同字面）+ `isValidChipId` 精确校验（§七.1：不修剪、不归一化、拒绝全/半角变体）。
- 节点集合大小写不敏感等价查重 `hasCaseInsensitiveDuplicate`（§二.6/§六.1），供文档校验闸消费。
- **旧 `generateId62` 生成面不迁**（登记）：《05-ID生成规范》§四/§10.1 明文——`card_id` 生成方为文档服务（Rust 核心受控写口）、节点 ID 生成方为编辑链路，「应用插件……不得生成、复制或改写四类 ID，不得拼装含 ID 的文档字节」。旧实现另有 §3.1.2 禁止的直接取模偏差（`byte % 62`）。新文档模型构造函数（`createEmptyRichTextCardDocument`）只收调用方按正式链路取得的 ID，不自带生成。

### 3.4 path.ts

- 保留并对照在册：`normalizeRelativeResourcePath`（§8.2 资源路径合法形态 + §9.4 正斜杠 + `..` 逃逸拒绝），含 `null/undefined` 直读容面。
- **不迁（随消费面归属编辑臂重写，矩阵 row67/row68 判重写）**：`SessionRuntimePaths`/`createSessionRuntimePaths`（旧 `.chips-rich-text-editor-runtime` 会话目录语义，row65 注则改按新插件私有数据目录适配）、`toFileUrl`（`file://` 非正式持久化形态，运行时统一 `chips-resource://`，§8.2）、`ensureCardExtension`/`stripCardExtension`（`.card` 文件名装配属保存面；本应用不声明 `.card` 文件关联）、`sanitizeFileStem`/`joinPath`/`dirname`/`basename`（会话与文件对话框消费面）。

## 四、测试（先测后码，79 例全绿）

- `tests/unit/card-document.test.ts`（44 例）：旧 `card-document.test` 三例随迁（构建回读/真实资源清单/坏结构拒绝，标识换文档库在册示例）+ G-5 构建面断言（无 `description`、节点仅 `id/type`、封面逐字对齐 §7.6）+ 解析面五分支 + YAML 形态/metadata/structure/content/manifest/封面 35 诊断码逐码正断言 + `RichTextCard` 与 `markdown` 别名零兼容负向断言 + 断言面异常分支。
- `tests/unit/richtext-card.test.ts`（16 例）：常量对齐、LEGACY 零迁移负向断言、装配/收集/归一全分支。
- `tests/unit/id.test.ts`（8 例）：文法精确匹配、边界与变体拒绝、大小写精确、等价查重分支。
- `tests/unit/path.test.ts`（5 例）：归一、前导 `./`、空值、协议化/绝对/查询/片段/逃逸拒绝全分支。
- 夹具 `tests/fixtures/composite-card.ts`：文档库权威真实字节样本（rte G-5「无现成夹具」的补齐），门禁边界机检天然豁免目录（gates `ignoredDirs` 含 `fixtures`）。

## 五、缺位面登记（本臂如实登记，不代填、不临时绕过）

1. **编辑臂整体候裁**：richtext 编辑引擎选型（用户裁决挂起，牵动 `basecards/richtext` 编辑态 `renderEditor`）；编辑会话（打开/保存/另存/自动保存/放弃确认）、打开投递与命令面重写、会话工作目录按新插件私有数据目录适配，均候该裁决后落地。
2. **UI 壳保持骨架态**：`src/ui/AppView.tsx` 与 `src/commands/*` 为脚手架样貌（四闸绿）；`《09-官方插件与应用目录》§7.2` rte 行维持「待实现」，不因迁移臂交付翻正。
3. **文档服务建卡/发号面**：`card_id` 按规范由文档服务受控写口生成；宿主 `IDocumentStoragePort` 现为 open/read/write/save 四能力（工单036 波C3），新建文档与 ID 发号入口未在册——编辑臂接保存链时按正式面消费，本臂模型已收窄为「ID 由调用方传入」。
4. **结构清单可选维度字段**：`CompositeCardResourceManifestEntry` 已按 §5.1 收录 `duration/width/height/language/checksum` 透传可选面（图片/媒体引用未来需要）；计算口径归写入链，校验闸不代算。

## 六、验证记录（亲跑，2026-10-01）

- 包内四闸（`plugins/apps/rich-text-editor`）：
  - `test`：PASS——6 文件 / 79 例全绿（4 新域测试 73 例 + 骨架 app/commands 6 例回归）；
  - `typecheck`：PASS——`tsc -p tsconfig.json --noEmit` 零错误；
  - `lint`：PASS——`eslint src tests` 零错误零警告；
  - `build`：PASS——`dist/index.js`（0.22 kB）+ `render.js`（10.14 kB / gzip 3.77 kB），render.js 与骨架态字节一致（UI 壳零改动）。
- cpk 打包校验：`chips plugin pack` 五阶段通过（成员 4、ZIP Store 12.3 KiB、`校验: 通过`）。
- 机检：`src`/`tests` 对 `antd`/`@chips/antd` 直接导入零命中（FORBIDDEN_ANTD_EXPORTS 同界）；`node:` 内置导入零命中（plugins-apps 边界 `forbidNodeBuiltins`）；旧 LEGACY 痕迹机检仅命中文档注释与零兼容负向断言，零实际兼容面。
- 格式：迁移文件过 `prettier --check`（仓库根 `.prettierrc.json` 口径，先 warn 后 `--write` 归一复检）。
- 边界纪律：未跑 `gates:all`；未改旧仓/文档库/`重构台账.db`；未做任何 git 写操作；安装持目录锁 `/tmp/w4-lockguard`。

## 七、遗留与追记

- 矩阵 row64「对照《01-卡片文件格式》base.composite/base.richtext 节」中 `base.composite` 词形在现行文档库 §5 为复合容器结构面（`structure` + `manifest`），无独立 `base.composite` 类型标识——本臂按现行 §5 结构面对照，特此注记。
- 旧 `normalizeBasecardConfig` 的 file 来源容错推断删除后，「`content_source` 缺失但 `content_file` 存在」的旧文件读取形态归文档校验闸 `RICHTEXT_SOURCE_INVALID` 如实报告；旧仓写出的文件均带显式 `content_source`，无数据迁移牵连。
- `yaml` 三方依赖复核：MIT、社区维护活跃（host/cli 在册同版本 2.8.2，工作区既有选型沿用）、纯 JS 无原生/跨端风险、包体影响限于主进程自包含构建，符合引入红线。
