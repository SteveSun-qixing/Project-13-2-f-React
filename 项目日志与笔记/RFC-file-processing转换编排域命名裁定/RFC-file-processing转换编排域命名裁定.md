# RFC：file-processing 转换编排域命名裁定（草案，候裁）

> 状态：草案（只陈述问题、证据、方案对比与验收标准，**不含裁定**；裁定权在用户）
> 日期：2026-09-30
> 起草：契约工程师（只读勘查后起草）
> 裁定对象：W4 交付包 `chips-ecosystem/plugins/services/file-conversion`（74 用例全绿）的编排角色身份——归 `file-processing` 域，还是新设 converter 编排域登记收口
> 关联登记：《04-能力契约规范》§8.4 处置表 `converter.file.convert` 不登记注记；W4 迁移日志「编排能力 ID 不在册」缺口
> 证据口径：本文所有证据均为 `路径:行号`；行号以当前工作区文件为准

---

## 一、问题与证据

### 1.1 问题陈述

W4 迁移交付的 `plugins/services/file-conversion` 包（服务插件，编排 content-converter 三腿链路：卡片→HTML→PDF/图片）在能力登记体系中**没有在册身份**：

- 旧模块编排能力 `converter.file.convert` 在《04-能力契约规范》§8.4 处置表被明文判为**不登记**：「转换编排归 `file-processing` 服务（15-文件处理契约 §3.5）」——`薯片生态文档库/05-接口与契约/04.23-04-能力契约规范-八、内容处理服务能力.md:103`；
- 该包当前 Cordis 服务名 `content-file-conversion` 是按 §8.2 文法**自洽推导**的值，未发布 descriptor.json、未冒用任何在册 ID，服务对象不携带 capabilityId——`chips-ecosystem/plugins/services/file-conversion/src/descriptor.ts:5-7`、`:14`；
- 该缺口已在 W4 迁移日志如实登记为候 RFC 收口项——`项目日志与笔记/W4迁移-file-conversion-开发计划与日志-2026-09-30.md:36-38`、`:93-94`、`:140-142`；
- 机检已把「§8.4 未登记编排能力，命名按 §8.2 文法自洽（候 RFC 收口）」锁定为契约测试断言——`chips-ecosystem/plugins/services/file-conversion/tests/contract.test.ts:26-27`。

需要裁定的是：这一编排角色最终以什么身份进入登记体系。

### 1.2 现实现三面（服务名 / 能力声明 / 注入依赖）

| 面 | 现值 | 证据 |
|---|---|---|
| 插件 ID（manifest） | `chips.service.file-conversion` | `chips-ecosystem/plugins/services/file-conversion/manifest.yaml:1`；`src/descriptor.ts:11` |
| Cordis 服务名 | `content-file-conversion`（文法自洽推导，无在册 ID） | `chips-ecosystem/plugins/services/file-conversion/src/descriptor.ts:14`；`src/plugin.ts:56`（`ctx.provide`）；`src/executor.ts:42`（错误 details 标签 `OUTPUT_CAPABILITY`） |
| 能力声明 | **无**：不携带 capabilityId、无 descriptor.json、manifest 无能力声明段；仅在 contracts 两 schema 的 title 中自述为 `content-file-conversion.convert` | `src/descriptor.ts:5-7`；`chips-ecosystem/plugins/services/file-conversion/contracts/file-convert.input.schema.json:4`；`contracts/file-convert.output.schema.json:4` |
| 注入依赖 | `ctx.inject` 三兄弟服务名 `content-converter` / `content-html-to-pdf` / `content-html-to-image` | `src/plugin.ts:49`；常量定义 `src/descriptor.ts:24-26` |
| manifest 静态依赖 | `chips.service.cardtohtml` / `chips.service.htmltopdf` / `chips.service.htmltoimage`（旧 1:1 拆形三包） | `chips-ecosystem/plugins/services/file-conversion/manifest.yaml:14-20` |
| Bridge 权限 | `filesystem:read` / `filesystem:write` / `filesystem:delete`（bridge file port 直写暂存与产物） | `manifest.yaml:21-24`；`src/plugin.ts:53` |
| 错误面 | 只用在册 `CONVERTER_*` 三码 + 通道码 `BRIDGE_CANCELLED`，不新增前缀 | `src/errors.ts:19-23`；词表在册证据 `chips-ecosystem/packages/sdk/src/generated/error-codes.ts:96-98` |
| 测试 | 74 用例（executor 20 / planner 18 / paths 10 / plugin 8 / contract 9 / base64 5 / ports 4） | `chips-ecosystem/plugins/services/file-conversion/tests/` 各 `*.test.ts` |

### 1.3 文档库内部的两处口径张力（裁定需要直面的事实）

1. **张力甲（§8.4 vs 09 处置行）**：`04.23:103` 判「转换编排归 `file-processing` 服务」；而《09-官方插件与应用目录》§6.2 处置行却把旧 Chips-FileConversion-Plugin 的新归属写为「**内容处理服务**：格式转换编排；通用会话与受控提交归 `file-processing`」——`薯片生态文档库/03-插件开发/09-官方插件与应用目录.md:192`。前者意为编排整体归 file-processing（平台服务），后者意为「格式转换编排」单列为一个内容处理服务。两文均为正式版，编排角色的领属在文档库内部本身未收口。
2. **张力乙（file-processing 的「编排」领属）**：`09:175` 登记 `chips.service.file-processing` 职责为「通用文件处理会话与**编排**：打开 / 预览 / 转换 / 另存……不实现格式算法」（状态：已设计）；W4 计划 §9.1 同口径「`chips.service.file-processing` 不持能力 ID，持**会话与编排**契约」，且**未派、硬依赖 C3 宿主存储适配器收口**——`重构大计划/W4-开工波次计划.md:277`。若「编排」全归 file-processing，则 W4 已交付的转换编排实现无处安放直至 file-processing 派工；若「格式链路编排」单列，则 `04.23:15`「编排归 15-文件处理契约」的边界句需要收窄。

---

## 二、文法与既有口径核对

### 2.1 能力 ID 文法（§3.1，Bridge 冒号形）——对本问题不适用但有禁令

- `capability-id = domain ":" action [ ":" target ]`——`薯片生态文档库/05-接口与契约/04.03-04-能力契约规范-三、能力 ID 与权限 ID 命名规则.md:14-24`；
- 内容处理类实现不注册为 Bridge 能力、不进 R19 全表，按第八节登记——`04.03:47`；
- 命名禁令：把内容处理实现写成 Bridge 能力 ID，或复用已作废旧标识（`image.*`、`converter.*` 等）→ 无效标识——`04.03:62`；
- 未登记 ID 不得注册、不得调用；domain 由平台统一登记分配——`04.03:32`。

结论：无论 A/B 哪案，本编排角色都**不得**以 `converter.*` 旧 ID 或任何冒号形 ID 存续。

### 2.2 内容处理能力与服务命名文法（§8.2，点号形）——两案的共同文法基座

- `content-capability-id = service "." operation`；`service = "content-" 1*(lowercase/digit/"-")`；恰两段、全小写、点号唯一分隔——`04.23:23-29`；
- 服务名沿用内核服务文法 `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` 并**统一使用 `content-` 前缀**；每个能力 ID 绑定唯一服务名与唯一提供方插件——`04.23:31`；
- 旧模块能力 ID（`converter.*` 等）不得复用，一律作废——`04.23:30`；
- 官方服务插件使用 `chips.service.*` 命名空间，插件 ID 由《09》按本节登记分配并回写（R20），提供方不得自造——`04.23:32`；《09》规则 1 同口径——`09:198`。

文法核对结论：

- `content-file-conversion` 服务名与 `content-file-conversion.convert` 能力 ID（若登记）均满足 §8.2 文法（content- 前缀、两段点号、全小写连字符）；
- `file-processing` 服务名**不持** content- 前缀也**不违** §8.2——它不是内容处理能力提供方，而是平台文件处理会话服务（`09:175`「不实现格式算法」；W4:277「不持能力 ID」）；§8.2 的 content- 前缀只约束内容处理服务的登记名。

### 2.3 §8.4 登记表现状（精确行号）

- §8.4 官方登记表（canonical）起于 `04.23:64`；正表 `04.23:68-82` 共 **13 项能力 / 4 个服务**：`content-image`（3 项，:70-72）、`content-media`（2 项，:73-74）、`content-converter`（3 项，:75-77）、`content-office`（5 项，:78-82）；计数声明 `04.23:84`；
- 「不登记与已替代」处置表 `04.23:96-107`；关键行 `04.23:103`：`converter.file.convert`（旧模块编排能力）→「**不登记**：转换编排归 `file-processing` 服务（15-文件处理契约 §3.5）」；
- 边界句：内容处理能力「编排归 15-文件处理契约」——`04.23:15`；错误码族按能力域登记、提供方禁用 `FILE_*` 等前缀——`04.23:120`、`:127`；
- 登记维护：新增/变更/注销内容处理能力必须走 RFC 与评审；登记表、提供方契约与 15-文件处理契约的描述符消费、08-官方应用功能总览的应用依赖必须同 PR 更新——`04.23:134`、`:137`。

### 2.4 15-文件处理契约对转换编排的既有规定

- §3.5 `convert`（`04.23:103` 引用的锚点）：把来源编排为单一文件产物——`薯片生态文档库/05-接口与契约/15.03-15-文件处理契约-三、会话契约.md:275-277`；
- §4.1 阶段模型 prepare/transform/stage/publish/cleanup——`薯片生态文档库/05-接口与契约/15.04-15-文件处理契约-四、转换编排规则.md:12-23`；§4.2 提供方静态依赖声明 + 描述符只读消费——`15.04:27-28`；§4.3 受控提交只走资源管理器——`15.04:34-42`；§4.4 暂存区限插件作用域/平台临时作用域——`15.04:46-49`；
- 适用范围自述「会话与转换编排」——`薯片生态文档库/05-接口与契约/15-文件处理契约.md:6`。

### 2.5 W4 计划 §9.1 canonical 拆包表对 file-processing 的定位

- §9.1 起于 `重构大计划/W4-开工波次计划.md:267`；
- `content-converter` 行：三包合一包三能力，#265/#266 按旧 1:1 拆形在途，交付后由合流单归一——`W4:275`（现状印证：`plugins/services/cardtohtml`、`htmltopdf`、`htmltoimage` 三包并存；三包实际提供的 Cordis 服务名分别为 `content-converter` / `content-html-to-pdf` / `content-html-to-image`——`cardtohtml/src/plugin.ts:15`、`htmltopdf/src/descriptor.ts:14`、`htmltoimage/src/descriptor.ts:14`，即拆形态与 §8.4 单服务口径暂不一致，候合流）；
- `chips.service.file-processing` 行：**不持能力 ID，持会话与编排契约**；未派，**硬依赖 C3 宿主存储适配器收口**——`W4:277`。

### 2.6 同族判例：content-converter 域三服务的「命名-登记-描述符」三面对齐

以 `cardtohtml` 包（`content-converter.card-to-html`）为判例，三面全对齐：

| 面 | 值 | 证据 |
|---|---|---|
| 命名（插件 ID） | `chips.service.cardtohtml` | `chips-ecosystem/plugins/services/cardtohtml/manifest.yaml:1`（旧 1:1 形，候合流归一为 `chips.service.content-converter`，W4:275） |
| 登记（能力 ID/服务名） | `content-converter.card-to-html` / `content-converter`（§8.4 正表 :75 在册） | `04.23:75` |
| 描述符 | `contracts/descriptor.json`：id/service/provider/operations/sourceFormats/targetFormats/streaming/maxInlineInputBytes/contractPackage 八字段齐备 | `chips-ecosystem/plugins/services/cardtohtml/contracts/descriptor.json:2-13` |
| 服务提供 | `ctx.provide('content-converter', …)` | `cardtohtml/src/plugin.ts:15`、`:22` |
| manifest 自述 | description 内嵌能力 ID | `cardtohtml/manifest.yaml:6` |

同族对照：`htmltopdf` / `htmltoimage` 两包**尚无 descriptor.json**（仅 `descriptor.schema.json` + IO schema）——`chips-ecosystem/plugins/services/htmltopdf/contracts/`、`htmltoimage/contracts/` 目录清单；属合流单待办面，不影响本判例的「三面对齐」标准形。file-conversion 包与之相比，正是缺「登记」与「描述符」两面（`descriptor.ts:5-7` 头注自认候 RFC）。

### 2.7 门禁与生成物基线

- G8 契约一致性门禁：`pnpm test:contract` 通过、快照无未审阅差异、契约类文档与实现同一 PR——`薯片生态文档库/06-开发与运维/05.03-05-CICD与质量门禁-三、质量门禁清单.md:25`（门禁表行）、`:65-77`（§3.4 细则，含「能力契约比对《04-能力契约规范》」「禁止以文档后补合并」）；
- 错误码词表为生成物：`chips-ecosystem/packages/sdk/src/generated/error-codes.ts`（生成头注 :1-25）；`CONVERTER_*` 三码在册 :96-98；`FILE_PROCESS_*` 15 码在册 :148-163（事实源含 15.06 §六 与 04.23 §8.6）。**两案所需错误码均已在册，SDK 词表预计零改动**；
- 脚手架模板 `Chips-Scaffold/chips-scaffold-module/templates/module-file-conversion/template.json` 只绑定模块形状名，不含服务名/能力 ID 引用，两案均无需改动。

---

## 三、方案 A/B 详表

> 两案均满足：不复用作废旧 ID（`04.03:62`、`04.23:30`）；错误码不新增前缀；SDK 词表零改动；G8 文档与实现同 PR。差异在于**编排角色的登记领属**与**包的姓**。

### 3.1 方案 A：按 §8.4 处置行归 file-processing 域（编排整体并入 file-processing 服务）

**核心命题**：按 `04.23:103` 的文义，转换编排不是内容处理能力，而是 `file-processing` 服务的会话编排实现；`content-file-conversion` 作为独立服务名不复存在，W4 交付的 planner/executor 逻辑成为 file-processing 的转换会话（`convert`，15.03:275）之 `transform`/`stage` 阶段实现（15.04:18-22）。

**完整 ID 形与服务名**：

| 项 | 方案 A 值 |
|---|---|
| 内容处理能力 ID | **无**（不进 §8.4 正表——这正是与 `04.23:103`「不登记」的对齐点） |
| 对外标识 | Cordis 服务名 `file-processing` × 会话操作 `convert`（15.03:275） |
| 插件 ID | `chips.service.file-processing`（`09:175` 已在册） |
| 错误码族 | `FILE_PROCESS_*`（15.06 词表，`error-codes.ts:148-163` 在册；file-processing 是该族属主，不受 `04.23:127` 提供方禁令约束） |

**manifest/service 改动清单**（`chips-ecosystem/plugins/services/file-conversion/` → `file-processing/`）：

1. 目录与包名：`plugins/services/file-conversion` → `plugins/services/file-processing`；`package.json:2` `@chips/service-file-conversion` → `@chips/service-file-processing`；
2. `manifest.yaml:1` `id` → `chips.service.file-processing`；`:4` 名称、`:5` description 改写（会话与转换编排，不再自称「内容处理服务」）；
3. `src/descriptor.ts:11` 插件 ID 常量、`:14` `FILE_CONVERSION_SERVICE_NAME` → `'file-processing'`、`:5-7` 头注改写（删除「候 RFC 收口」缺口自述）；
4. `src/executor.ts:42` `OUTPUT_CAPABILITY` 标签 → `'file-processing'`；
5. `src/errors.ts:19-35` **错误面整面重映射**：`CONVERTER_*` 三码 → `FILE_PROCESS_*` 族（`CONVERTER_INPUT_UNSUPPORTED` → `FILE_PROCESS_SOURCE_UNSUPPORTED`/`FILE_PROCESS_TARGET_UNSUPPORTED` + `details.reason`；链路腿失败 → `FILE_PROCESS_TRANSFORM_FAILED` + `details.cause`，15.04:19、15.04:64 口径）；`details.reason` 词表与 planner/executor 归一点同步；
6. `contracts/file-convert.input.schema.json:4`、`file-convert.output.schema.json:4` title 改写；`tests/contract.test.ts:26-27` 服务名断言改写并去除「候 RFC」语义；
7. `manifest.yaml:14-20` dependencies 维持三兄弟静态声明（与 15.04:27 判例同形）；`src/plugin.ts:49` 注入面不变。

**能力登记表动作文本**（A 案 §8.4 正表**不增行**；登记动作=处置行改写+目录行回写）：

- `04.23:103` 改写为：
  `| `converter.file.convert`（旧模块编排能力） | 不登记：转换编排归 `file-processing` 服务（`chips.service.file-processing`，15-文件处理契约 §3.5；官方实现包 `plugins/services/file-processing`） |`
- `09:175` 状态列「已设计」→「已实现」（随实现 PR 回写）；
- `09:192` 「新归属」列改写为：`归 `chips.service.file-processing`：格式转换编排为其会话转换链（convert）的编排实现；通用会话与受控提交同服务承载`（消除张力甲）；
- `W4:277` file-processing 行「当前路态」回写为已派/已交付（编排腿先行，会话与受控提交随 C3 收口补齐）。

**A 案必须直面的缺口**：现实现为 bridge file 直写 + 输出同级暂存（`src/executor.ts:6-8` 头注自述；暂存前缀 `.chips-file-conversion-*`，`descriptor.ts:29-31`），与 15 §4.3 受控提交（15.04:34-42）和 §4.4 暂存区规定（15.04:46-49）不一致；file-processing 正式形态硬依赖 C3 宿主存储适配器（`W4:277`）。故 A 案只有两条现实路径：

- A-挂起候并：包姓不动、保持现缺口登记，待 file-processing lane（C3 收口）后一步并入——W4 交付物在途悬置；
- A-两步走：先改姓后补受控提交——中间态即「临时形态」，触碰工作区红线「不做临时版、简化版」（AGENTS.md 架构红线），**不建议**。

### 3.2 方案 B：新设 converter 编排域（把现行推导名转正登记）

**核心命题**：按 `09:192` 处置行的文义，「格式转换编排」单列为一个内容处理服务；以 RFC 为入口（`04.23:134` 登记维护流程），把 §8.2 文法自洽推导的服务名 `content-file-conversion` 与能力 ID `content-file-conversion.convert` 转正登记，处置行 `04.23:103` 由「不登记」改写为「已替代/新设」，并收窄 `04.23:15` 的「编排归 15」边界句。

**B1（主形态，推荐基形）**：新能力挂新服务 `content-file-conversion`，现行包零姓改。

**B2（变体，不建议）**：新能力 `content-converter.convert` 挂既有 `content-converter` 服务第四能力。不建议理由：content-converter 在 15 §4.2 模型中是「被 file-processing/编排方按描述符选择的**原子腿**提供方」（15.04:28），让同一服务既提供原子腿又消费自家原子腿做编排，混淆提供方/消费方分工；且 content-converter 三包合流在途（W4:275），此刻扩族叠加变动。

**B1 完整 ID 形与服务名**：

| 项 | 方案 B1 值 |
|---|---|
| 内容处理能力 ID | `content-file-conversion.convert`（§8.2 文法核对通过：两段点号、content- 前缀、全小写连字符） |
| Cordis 服务名 | `content-file-conversion`（与现行 `descriptor.ts:14` 一致，**零姓改**） |
| 插件 ID | `chips.service.file-conversion`（与现行 `descriptor.ts:11` 一致；按 `09:198` 回写《09》） |
| 原子操作 | `convert`（与 `contracts` 两 schema title 自述、`types.ts:33`/`:94` 请求/回执名一致） |
| 错误码族 | 沿用在册 `CONVERTER_*`（`errors.ts:19-23` 零改动；族领属见候裁项 2） |

**manifest/service 改动清单**（包名、目录、服务名、插件 ID 全部不动）：

1. 新增 `contracts/descriptor.json`（对齐 cardtohtml 判例八字段，`cardtohtml/contracts/descriptor.json:2-13`）：id=`content-file-conversion.convert`、service=`content-file-conversion`、provider=`chips.service.file-conversion`、operations=`["convert"]`、source/targetFormats、streaming、maxInlineInputBytes、contractPackage=`chips.service.file-conversion/contracts`；
2. `manifest.yaml:5` description 补登能力 ID；`:14-20` dependencies 不动（合流联动见候裁项 4）；
3. `src/descriptor.ts:5-7`、`src/plugin.ts:1-9`、`src/executor.ts:1-12`、`src/types.ts:1-6` 各头注清除「候 RFC 收口/无在册 ID」缺口自述，改引 §8.4 新登记行；
4. `tests/contract.test.ts:26-27` 断言改写：由「§8.4 未登记、文法自洽」改为「§8.4 在册 + descriptor.json 八字段与登记行一致」机检。

**能力登记表增行文本**：

- `04.23` 正表 `:82`（`content-office.font-metrics` 行）之后增行：
  `| `content-file-conversion.convert` | `content-file-conversion` / `chips.service.file-conversion` | `convert` | 卡片文档（经 `document:*` 与平台渲染链路）或 HTML 来源 → 目录态 / 压缩态 HTML、PDF、PNG / JPEG / WebP 产物 | 无 | `CONVERTER_*` |`
- `04.23:84` 计数句改为：「计数：14 项内容处理能力、5 个内容处理服务（`content-image`、`content-media`、`content-converter`、`content-office`、`content-file-conversion`）。」
- `04.23:103` 处置行改写（**与「不登记」注记的冲突处置**）：
  `| `converter.file.convert`（旧模块编排能力） | 已替代：归 `content-file-conversion.convert`（RFC-file-processing转换编排域命名裁定，2026-09-30）；旧 ID 不登记口径不变，`file-processing` 保留通用会话与受控提交 |`
- `04.23:15` 边界句收窄（冲突处置的另一半）：「……消费方经 `ctx.inject` 注入后按提供方契约的类型化接口调用；**格式转换链路编排归 `content-file-conversion.convert`，通用文件处理会话、跨格式通用编排与受控提交归 15-文件处理契约**。」
- `09` §6.1 表 `:177`（`chips.service.markdown` 行）之后增行：
  `| `chips.service.file-conversion` | `content-file-conversion` | 格式转换链路编排：卡片 / HTML 来源到 HTML / PDF / 图片目标的转换链路规划与产物暂存提交（content-file-conversion.convert） | chips.service.content-converter（合流后）等链路腿提供方（按会话需求静态依赖） | 不注册 Bridge 能力；Cordis 服务，描述符随包发布 | 待实现（已按 W4 交付，候登记回写） |`
  （状态列措辞候裁；若按「登记后即已交付」口径则为「已实现」。）
- `09:192` 状态列「待实现（按服务插件发布）」→「已实现（`chips.service.file-conversion`）」；
- `W4:277` file-processing 行职责描述微调：「会话与编排」→「会话与通用编排；格式转换链路编排归 `content-file-conversion`（09 §6.1）」；
- `15-文件处理契约.md:6` 适用范围句微调：「会话与转换编排」→「会话与通用编排（格式转换链路编排归 `content-file-conversion.convert`，04-能力契约规范 §8.4）」。

### 3.3 两案逐项对比

| 对比项 | 方案 A（归 file-processing） | 方案 B1（新设 converter 编排域） |
|---|---|---|
| 与 §8.4:103「不登记」注记的关系 | 完全一致（正表不增行，处置行改写点名承接方） | 改写该注记为「已替代/新设」（本次 RFC 即 `04.23:134` 要求的 RFC 入口） |
| 与 09:192 处置行「内容处理服务：格式转换编排」的关系 | 需改写该行文义（消除张力甲） | 完全一致（该行即 B 案的文档依据） |
| 包姓/目录 | 改（file-conversion → file-processing，10 文件 12 处命名引用：`package.json:2`、`manifest.yaml:1`、`descriptor.ts:11/:14`、`executor.ts:42`、`plugin.ts`、`types.ts:317`、两 contracts title、`vitest.config.ts` 等） | 不改（现行推导名转正） |
| 错误面 | 整面重映射 `CONVERTER_*` → `FILE_PROCESS_*`（errors.ts 约 60-80 行 + 归一点 + 测试） | 零改动（`CONVERTER_*` 沿用） |
| 包内改动行数（估） | 高：约 150-200 行（姓改名 + 错误面重映射 + 头注 + 契约测试） | 低：约 30-50 行（descriptor.json 新增 + 头注 + 契约测试增断言） |
| 文档库改动处数 | 3-4 处（04.23:103 改写；09:175/:192 回写；W4:277 回写） | 6-8 处（04.23 正表增行+计数+处置行改写+边界句收窄；09 §6.1 增行+§6.2 回写；15 §1 微调；W4:277 微调） |
| G8 门禁工作量 | 契约测试服务名/错误码断言全面改写，快照更新 | descriptor.json 增断言 + 快照更新，面小 |
| 生成物（SDK 词表） | 零改动（FILE_PROCESS_* 已在册） | 零改动（CONVERTER_* 已在册；若候裁项 2 裁独立族则需再生） |
| 对 C3 宿主存储适配器的依赖 | 硬依赖（W4:277）：受控提交未收口前只能挂起候并或出临时形态（红线冲突） | 无依赖（包保持现形态，暂存治理缺口维持既有登记，W4 日志 :96-100） |
| 与 15 §4 阶段模型的收敛速度 | 远期即收敛（编排成为 file-processing transform/stage 实现） | 中间态：暂存/提交治理留在编排服务内，待 file-processing 落成后由会话层接管（现登记口径延续） |
| 可逆性 | 不可逆方向（吸收即终态） | 可逆（未来 file-processing 收口后仍可吸收其实现，登记按注销流程收口，04.23:134） |
| 主要风险 | ①受控提交缺口期触碰「不做临时形态」红线；②74 用例交付物悬置；③错误面重映射引入回归面 | ①「编排」一词领属须在 04.23:15/15 §1/W4:277 三处同步收窄，漏改即留双口径；②新增一个内容处理服务常驻位（配额/生命周期面扩一席） |

---

## 四、影响面与验收标准

### 4.1 影响面总表（两案通用核对清单）

| 面 | 文件/位置 | 动作 |
|---|---|---|
| 文档库-登记 | `薯片生态文档库/05-接口与契约/04.23-04-能力契约规范-八、内容处理服务能力.md:68-84`（正表/计数）、`:103`（处置行）、`:15`（边界句） | 按所裁方案增行/改写；§8.7:137 要求的同 PR 项 |
| 文档库-目录 | `薯片生态文档库/03-插件开发/09-官方插件与应用目录.md:173-177`（§6.1 表）、`:186-194`（§6.2 处置表） | 增行/回写 |
| 文档库-契约 | `薯片生态文档库/05-接口与契约/15-文件处理契约.md:6` | 仅 B 案微调；A 案核对即可 |
| 文档库-计划 | `重构大计划/W4-开工波次计划.md:275-277` | 路态回写 |
| 门禁 | G8（`薯片生态文档库/06-开发与运维/05.03-05-CICD与质量门禁-三、质量门禁清单.md:65-77`） | 契约文档与实现同 PR；`pnpm test:contract` 快照无未审阅差异 |
| 生成物 | `chips-ecosystem/packages/sdk/src/generated/error-codes.ts` | 两案均预计零改动（除非候裁项 2 裁独立错误族） |
| 包内 | `chips-ecosystem/plugins/services/file-conversion/`（A 案含目录改名） | 按 §3.1/§3.2 改动清单执行 |
| 脚手架 | `Chips-Scaffold/chips-scaffold-module/templates/module-file-conversion/template.json` | 两案均零改动（无服务名绑定，已核实） |

### 4.2 验收标准（裁定后执行 PR 时逐项验收）

1. **登记一致性**：`04.23` 正表/计数/处置行、《09》§6.1/§6.2、（B 案）15 §1、W4 §9.1 与包内实现三方逐字一致；登记表改动与实现改动同一 PR（`04.23:137`、G8 `05.03:75-76`）。
2. **文法合规**：最终服务名/能力 ID 满足 §8.2 文法（`04.23:23-31`）；不出现任何冒号形内容能力 ID、不复用 `converter.*` 旧 ID（`04.03:62`）；机检断言在 `tests/contract.test.ts` 锁定新口径。
3. **描述符齐备**：B 案新增 `contracts/descriptor.json` 八字段与 §8.3 结构（`04.23:39-53`）及 cardtohtml 判例（`cardtohtml/contracts/descriptor.json`）逐字段一致；A 案以 15 §3.5/§4 契约面替代描述符并在《09》:175 行回写对应文档锚点。
4. **错误面合规**：所用错误码全部在 `error-codes.ts` 在册词表内；不新增 `BRIDGE_*`/`FILE_*`/`RESOURCE_*`/`DOCUMENT_*` 冒用（`04.23:127` 对内容处理提供方的禁令继续成立）。
5. **测试与门禁**：包内既有 74 用例全绿（仅允许因改名/错误码断言同步的等价改写）；`pnpm --filter @chips/service-file-conversion run test`、`typecheck`、`lint` 全通过；`pnpm test:contract` 无未审阅快照差异。
6. **无残留缺口自述**：`descriptor.ts:5-7`、`plugin.ts:1-9`、`executor.ts:1-12`、`types.ts:1-6` 各头注的「候 RFC 收口/无在册 ID」字样清除；代码零 TODO。
7. **双口径消除**：张力甲（04.23:103 vs 09:192）在文档库内不再并存两种编排领属表述；`04.23:15`、`15-文件处理契约.md:6`、`W4:277` 三处「编排」领属表述互相一致。

---

## 五、候裁项清单

| # | 候裁项 | 选项 | 备注 |
|---|---|---|---|
| 1 | **总裁定（唯一必裁项）** | A（归 file-processing）/ B1（新设 `content-file-conversion` 编排域）/ B2（并入 `content-converter` 第四能力） | B2 不建议（§3.2）；A 案若裁，需连带裁候裁项 3 |
| 2 | （若裁 B）错误码族领属 | 沿用 `CONVERTER_*`（登记行按 §3.2 文本，零改动）/ 为 `content-file-conversion` 新设独立族 | 现实现只用 CONVERTER_* 三码（`errors.ts:19-23`）；新设族须同步 `04.23:120` 与 SDK 词表再生 |
| 3 | （若裁 A）实施路径 | 挂起候并（C3 收口后一步并入）/ 两步走（先改姓后补受控提交） | 两步走构成临时形态，触碰工作区红线，不建议；挂起候并则 W4 交付物在途悬置期需明确 |
| 4 | 联动项（两案通用，非本次裁定） | content-converter 三包合流（W4:275）后，本包 `manifest.yaml:14-20` dependencies 与 `descriptor.ts:24-26` 服务名随之改写；htmltopdf/htmltoimage 的 descriptor.json 缺位由合流单统一 | 已在案，随合流单执行；不阻塞本次裁定 |
| 5 | 既有缺口登记维持（非本次裁定） | 进度面无正式通道、`file:stat` 缺位以 `file:list` 收口、暂存位置旧语义 | 维持 W4 迁移日志 :88-100 既有登记，不因本次裁定改变 |

**推荐倾向（不落改，仅供参考）**：B1。理由：(1) 包内零姓改、错误面零重映射，74 用例交付物即时收口，无 C3 硬依赖；(2) 与《09》:192 处置行「内容处理服务：格式转换编排」的既有登记文义一致，登记动作是「补登记」而非「改判」；(3) 完整复刻 content-converter 同族「命名-登记-描述符」三面对齐判例（§2.6）；(4) 可逆——未来 file-processing 会话层收口后仍可按注销流程吸收其实现，A 案的终态不因 B1 关闭。代价是文档库 6-8 处同步改写与「编排」领属三处收窄（验收标准 7 兜底）。

**阻塞**：勘查与起草无阻塞；本 RFC 为本次任务唯一新建物，未改动任何现有文件、未执行任何 git 写操作。裁定前不动任何文件（本 RFC 即唯一新建物之外的候选改动全部冻结）。

---

**文档结束**
