# RFC-G9 边界表放行 packages/sdk → @chips/scaffold 转发有向边

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：已实施（本 RFC 记录 G9 边界表公共资产改动的影响面与证据）
> 关联：`chips-ecosystem/tools/gates/gates.config.json`、`chips-ecosystem/tools/gates/check-boundaries.mjs`、提交 `f922978b`（工单交付：`@chips/sdk/scaffold` 薄转发层落地）

## 一、动机（G9 与权威规范的漂移）

工单交付提交 `f922978b` 按《02-SDK-API规范》§8.2 规则 9 落地了脚手架转发链路：

- `chips-ecosystem/packages/sdk/package.json` 新增依赖 `"@chips/scaffold": "workspace:*"`；
- `chips-ecosystem/packages/sdk/src/scaffold/index.ts` 以运行时 `import` + `import type` 转发 `@chips/scaffold` 公开面（值导出 `createScaffoldPlan` / `listScaffoldTemplates`，错误归一为 `ChipsError`）。

该实现正确且已验收，但 G9 架构边界门禁的依赖允许集（`tools/gates/gates.config.json` → `boundaries.rules` 中 `packages/sdk` 规则的 `allowedInternal`）当时只登记 `@chips/bridge`，导致 `gates:all` 实测红 3 条：

1. `[BOUNDARY010] packages/sdk/package.json` — 禁止依赖 `@chips/scaffold`（dependencies）；
2. `[BOUNDARY020] packages/sdk/src/scaffold/index.ts:14` — 源码禁止导入 `@chips/scaffold`；
3. `[BOUNDARY020] packages/sdk/src/scaffold/index.ts:19` — 同上。

即：门禁边界表落后于已收口的权威规范与已验收实现，属"配置面漂移"，须修配置面对齐规范面。

## 二、权威依据

- 《05-接口与契约/02-SDK-API规范》§8.2 规则 9（拆分件 `薯片生态文档库/05-接口与契约/02.08-02-SDK-API规范-八、脚手架（@chips-sdk-scaffold）.md` 第 42 行）：
  「模板实现位于 `chips-ecosystem/tools/scaffold/src/templates/`；`@chips/sdk/scaffold` 只转发公开面，不复制模板文本。」
- 判定原则：文档规范是权威。转发层是规范规定的生态公共链路，`@chips/sdk/scaffold` 子入口（`packages/sdk/package.json` exports `"./scaffold"`）要成立，`packages/sdk → @chips/scaffold` 这条有向边（依赖声明 + 源码 import 两个层面）必须被 G9 放行。

## 三、方案与备选

| 方案 | 内容 | 裁决 |
| --- | --- | --- |
| A（采纳） | 边界表放行 `packages/sdk → @chips/scaffold` 单向有向边：`gates.config.json` 的 `packages/sdk` 规则 `allowedInternal` 增加 `@chips/scaffold`；其余规则零改动 | 与 §8.2 规则 9 权威口径一致；改动最小（一处数据），判定强度不降；`@chips/scaffold` 自身零内部依赖，不构成环（BOUNDARY030 复核通过） |
| B（否决） | 反向拆除 `@chips/sdk/scaffold` 转发实现，回到 `packages/sdk` 不依赖 scaffold | 直接违反 §8.2 规则 9 与 02-SDK-API规范 §2.1 导出入口表，摧毁已验收交付；不可接受 |
| C（否决） | 引入豁免字段 / eslint-disable / 文件级白名单绕开 | 属豁免清单式绕开，破坏 G9「边界表即唯一事实源」的设计；AGENTS 质量红线禁止；不可接受 |

## 四、改动面与影响面

1. `chips-ecosystem/tools/gates/gates.config.json`：`boundaries.rules` 中 `id: "packages/sdk"` 规则的 `allowedInternal` 由 `["@chips/bridge"]` 扩为 `["@chips/bridge", "@chips/scaffold"]`；`typeOnlyInternal` 维持 `["@chips/bridge"]` 不变（转发入口是运行时 import，scaffold 不受 `import type` 限制是预期语义）。检查脚本 `check-boundaries.mjs` 零改动（边界表事实源在配置文件，脚本只消费）。
2. 放行面严格限定为这一条有向边：其他任何包（host/ui/antd/native/cli/plugins/examples/tools）指向 `@chips/scaffold` 的依赖或 import 仍按 BOUNDARY010 / BOUNDARY020 拒绝；`packages/sdk` 对其他内部包的反向边判定不变。
3. 循环依赖复核：`tools/scaffold/package.json` 无任何 `@chips/*` 依赖，`sdk → scaffold` 不成环；`workspace:*` 协议合规（BOUNDARY011 通过）。
4. 自测面（`tools/gates/tests/`）：新增夹具工作区 `fixtures/boundaries-scaffold/`（sdk 依赖+运行时/类型双 import scaffold 应放行；ui 依赖+import scaffold 应拒），新增 3 条用例（`check-boundaries.test.mjs`）分别断言「放行有向边」「其他跨包边仍拒」「生产配置 `gates.config.json` 的 sdk 规则已登记该边且仅 sdk 规则登记（防漂移锚点）」；既有 2 条用例零删改。`helpers.mjs` 新增独立配置构造器 `scaffoldBoundariesConfig()`，不与既有 `boundariesConfig()` 互相污染。
5. 文档面：`tools/gates/README.md` §4.3、`tools/gates/开发计划.md` §4.3 与 §五 补记放行边事实源与本 RFC 指向；`tools/gates/开发日志.md` 登记同日条目。
6. 实现面：`packages/sdk/**`、`tools/scaffold/**` 零改动（转发实现即交付原样）。

## 五、验证证据（2026-09-20 实测，全部 `> log 2>&1; echo EXIT=$?` 真实退出码）

| #   | 命令（工作目录 `chips-ecosystem/`）                                        | 退出码 | 关键输出                                                                       |
| --- | ------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| V1  | `npm run gates:all`                                                       | 0      | `[gates] 全部通过（4 项门禁，违规 0 条，警告 14 条）`（`/tmp/g9fix-gates.log`） |
| V2  | `node tools/gates/check-boundaries.mjs --no-report`                       | 0      | `通过；packages=15 sourceImports=1380 crates=5`（`/tmp/g9fix-boundaries.log`）  |
| V3  | `npm run gates:test`                                                      | 0      | `tests 48 pass 48 fail 0`（既有 45 + 新增 3；`/tmp/g9fix-gatest.log`）          |
| V4  | `npx prettier --check tools/gates`                                        | 0      | `All matched files use Prettier code style!`（`/tmp/g9fix-prettier.log`）       |

## 六、遗留与建议（不构成本单红点）

1. 《02-开发规范/01-代码组织规范》§4 依赖矩阵（拆分件 `01.04-…-四、依赖方向与循环依赖禁令.md` 第 22、40 行）仍写作 `packages/sdk → @chips/bridge（仅类型）`，未收录 §8.2 规则 9 的 scaffold 转发边，属文档库侧的对应口径欠账；文档库为公共资产且本轮有其他施工面在途，该矩阵的同步修订建议由主智能体按文档库更新流程另轮收口（口径=与本 RFC 一致：`packages/sdk` 允许集为 `@chips/bridge`（仅 `import type`）+ `@chips/scaffold`（转发边，运行时 import 合法））。
2. `问题工单.md` 第 002 行「`@chips/sdk/scaffold` 模板缺位由 W2 P1-8 承接」已由 `f922978b` 交付兑现；015/005 行实测与 scaffold 缺位无关，未做行内补记（避免跨行误写），工单面收口留给主智能体。
