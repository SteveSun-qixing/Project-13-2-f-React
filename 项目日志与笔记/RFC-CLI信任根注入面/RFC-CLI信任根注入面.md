# RFC-CLI 信任根注入面：`chips plugin validate` 的签名信任根正式注入链路

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：实施中（§五 验证证据表在收口时以真实退出码回填）
> 关联：工单019（插件签名信任根无正式注入链路）、工单020（插件 package 命令 bin 解析漂移与目录态校验口径缺口）、`chips-ecosystem/packages/cli`、《04-文件格式规范/03-插件包格式》§6.3、《06-开发与运维/07-CLI完整参考》§2.7/§3.5、《06-开发与运维/02-构建与打包》§7.3

## 一、动机（信任根判定有实现、无注入口）

`@chips/cli` 的五阶段校验引擎已冻结签名判定语义（`packages/cli/src/artifacts/cpk-validate.ts` `verifySignature`）：

- 信任根注册表以进程内参数 `trustRoots: Record<keyId, SPKI-PEM>` 传入（`ICpkValidateOptions.trustRoots`，`createLocalArtifacts` 构造选项同源）；未注册 `keyId` 判 `CPK_SIGNATURE_INVALID`（"信任根未注册的 keyId"）。
- 但命令面（`chips plugin validate`）**没有任何通道**把信任根送进引擎：`validateCommand` 只传 `path/source/platformVersion/fileSystem`（`src/commands/plugin.ts:223-252`），缺省信任根恒为 `{}` —— 任何已签名 `.cpk` 在命令面都被判"信任根未注册"而拒绝。夹具链 `tests/e2e/fixtures/cpk/keys/trust-roots.json` 的存在正说明"有一群已签名产物等着被校验，却没有正式注入链路"（工单019 核心缺口）。

结论：信任根判定逻辑存在且单一，缺的是**公共注入面**。本 RFC 裁决注入面形态并给出落地与回写清单。生态无已发布版本，兼容包袱为零，公共面一次冻结。

## 二、权威依据

- 《03-插件包格式》§6.3（拆分件 `03.06-…六、签名与信任根.md` 第 40-46 行）：渠道与签名要求冻结；「信任根注册表、密钥生成、签名工具与分发属于发布链路……（Phase 3/4 落地）」；「信任根未注册的 `keyId` 视为签名无效」。即：**判定语义已权威、加载通道留白**——本 RFC 补的是开发/验证期的加载通道，不侵占发布链（host 编译期内嵌注册表）职责。
- 《07-CLI完整参考》§2.1（全局选项仅 `--json/--plugin/--workspace/--help/--version/--yes/--`）、§2.7（环境变量登记表，既有先例 `CHIPS_SIGNING_KEY_FILE`：机密只以文件路径注入）、§2.5（退出码：`CLI_PATH_NOT_FOUND`→5、`CLI_ARGUMENT_INVALID`→2、`CPK_*`→1）。
- 《02-构建与打包》§7.3：host 编译期内嵌注册表 `packages/host/resources/trust-roots.json`（`chips-trust-roots-v1`，Base64 原始公钥）——发布链工件；`packages/host/**` 本轮禁改，且该文件目前无消费方实现（Phase 3/4）。
- 《03-插件包格式》§2.7（拆分件 `03.02-…`）：「目录根布局与 `.cpk` 解包后的包根完全一致」——目录态校验口径的权威依据（工单020 缺陷② 裁决用）。
- 夹具链事实：`tests/e2e/fixtures/cpk/keys/trust-roots.json` 已入库，形状 `{ version: 1, description?, trustRoots: { keyId: SPKI-PEM } }`；夹具与生成器（禁改面）均按此形状消费。

## 三、方案与备选（三路裁决）

| 方案 | 内容 | 裁决 |
| --- | --- | --- |
| A（采纳） | **环境变量 + 信任注册文件**：新增 `CHIPS_TRUST_ROOTS_FILE`（§2.7 登记），值为信任注册文件路径；`chips plugin validate` 读取该变量 → `loadTrustRootsFile` 严格解析 → 作为 `trustRoots` 传入**同一** `verifySignature` 判定实现。文件形状冻结为夹具在用形状 `{ version: 1, description?, trustRoots: { keyId: SPKI-PEM } }`（未知字段拒绝、`version` 必须为数值 1、公钥必须是字符串表） | 与 `CHIPS_SIGNING_KEY_FILE` 先例对称（同为"路径注入、内容不落命令行/日志"，§2.7/§2.8 纪律）；不扩全局/命令选项语法面；程序面 `createLocalArtifacts({ trustRoots })` 与命令面 `CHIPS_TRUST_ROOTS_FILE` 汇入同一引擎参数，**判定实现全局唯一**；夹具文件零改动即可作为正例注入源（`tests/e2e/fixtures/cpk/` 是禁改面） |
| B（否决） | **全局选项** `chips --trust-roots <file> …` | §2.1 全局选项面只承载输出/确认/消歧职责，注入型语义选项进入全局语法会污染所有命令的解析面、帮助面、补全脚本面与 TUI 透传链；且信任根是"引擎构造期"事实而非"本次调用"开关，全局选项形态与语义错位 |
| C（否决） | **配置文件**（工作区/平台配置层，如 `config set` 系） | 配置层读写经平台承载适配器（`platform.config*`，缺载体即 `CLI_TARGET_UNAVAILABLE`，§2.2/§2.5）——而 `validate` 是承诺**离线可用**的本地命令（§3.5），注入面不得反向依赖载体；且配置系统语义归插件配置域（《04-配置系统》），信任根注册不是用户可调配置项 |

分支内两个附带裁决：

1. **注入通道只开一条**：命令面仅 `CHIPS_TRUST_ROOTS_FILE`（不设 `--trust-roots` 命令选项，避免同一事实两个入口的漂移面）；程序面 `trustRoots`（构造期）与 `trustRootsFile`（`validate` 输入，逐次）并存，`trustRootsFile` 在输入中给出时**覆盖**构造期值——覆盖规则显式化，防"两个来源同时生效"歧义。
2. **消费面划分**：本轮接通 `validate`（本地判定发生地）；`pack` 的输入是私钥（`CHIPS_SIGNING_KEY_FILE`，既有），`--key-id` 是否在信任根登记属发布链校验，CLI 不重复实现；`install` 是平台侧动作（`platform.pluginInstall` 纯透传，宿主尚未集成 CLI 引擎），其信任根消费方是 host 装载器（Phase 3/4，见 §六 遗留）。

## 四、改动面与影响面

1. `packages/cli/src/artifacts/trust-roots.ts`（新增）：`TRUST_ROOTS_ENV`、`loadTrustRootsFile(fileSystem, path)`（严格 schema：缺失→`CLI_PATH_NOT_FOUND`(5)、非文件→`CLI_PATH_INVALID`(5)、JSON/schema 非法→`CLI_ARGUMENT_INVALID`(2)）；经 `src/index.ts` 导出为公共库面。
2. `packages/cli/src/client/types.ts`：`ICliArtifactsApi.validate` 输入新增可选 `trustRootsFile`（与 `pack.signingKeyFile` 对称的路径注入字段）。
3. `packages/cli/src/artifacts/index.ts`：`validate` 封装接线——输入带 `trustRootsFile` 时经 `loadTrustRootsFile` 覆盖构造期 `options.trustRoots`，否则维持 `options.trustRoots ?? {}`。判定仍单一：`cpk-validate.ts` `verifySignature` 零改动。
4. `packages/cli/src/commands/plugin.ts`：`validateCommand` 读 `context.env.CHIPS_TRUST_ROOTS_FILE`（空串按未设置，与 pack 对 `CHIPS_SIGNING_KEY_FILE` 的处理口径一致）透传。
5. 工单020 邻接落地（同单收口，裁决依据见 §二）：
   - 缺陷①（bin 解析漂移）：根 `package.json` `devDependencies` 增加 `"@chips/cli": "workspace:*"`——`pnpm exec chips` 自任意 workspace 子包解析到当前工作区 `node_modules/.bin/chips`（pnpm 将 workspace 根 bin 目录前置于 PATH，已实测）；`examples/plugins/hello` **不加**自有依赖（G9 边界表 examples 允许集无 `@chips/cli`，`tools/gates/**` 禁改面）；`tools/scaffold` 模板 `devDependencies` 补 `@chips/cli`（新 spawn 工程自带正确锚点）。杜绝静默落到 `~/.volta/bin/chips` 陈旧全局。
   - 缺陷②（目录态口径）：文档面收敛到 §2.7 权威口径（目录态=包根形态）；代码面把 `cpk-validate.ts:589-611` 的不可达版本比对死代码替换为**前置诊断**：目录根存在 `package.json` → `CPK_LAYOUT_INVALID`，错误信息明示"源码工程目录需先 `chips plugin pack`"。不改判定强度（该场景今天就拒，仅错误定位更准），不走 pack 投影（投影会改变既有既绿用例的错误码口径，违反零放宽）。
6. 测试面：`packages/cli/tests` 新增信任根注入用例（loader 单元 + 命令面 env 接线 + 真实夹具内容命令端正/负/未注入三态 + 目录态源码工程诊断）；`tests/contract` 新增脚本链登记用例（`pnpm exec chips` 解析锚点 + `pnpm --filter @chips/plugin-hello run package` 端到端 + 夹具命令面验证，自清理）。既有用例零删除零放宽；`tests/e2e/fixtures/cpk/` 只读消费。
7. 文档回写面（清单）：
   - `06-开发与运维/07.02-…调用约定.md` §2.7 环境变量登记表：新增 `CHIPS_TRUST_ROOTS_FILE` 行（含文件形状与错误口径）；
   - `06-开发与运维/07.03-…用户侧命令 chips.md` §3.5.3：信任根注入说明、目录态=包根形态澄清与示例；
   - `04-文件格式规范/03.06-…六、签名与信任根.md` §6.3：登记开发/验证期注入通道归属（不改变 Phase 3/4 发布链职责表述）；
   - `04-文件格式规范/03.07-…七、打包命令与示例.md`：目录态示例按 §2.7 口径纠偏；
   - `06-开发与运维/02.07-….md` §7.3：注入文件形状与 host 编译期注册表的关系注记；
   - `packages/cli/开发日志.md` 与两工单 `收口记录.md`。回写后 `校验拆分件.py`、`检查文档链接.py` 必须 EXIT=0。

## 五、验证证据（收口时以真实退出码回填，工作目录 `chips-ecosystem/`）

| # | 命令 | 退出码 | 关键输出 |
| --- | --- | --- | --- |
| V1 | `pnpm --filter @chips/cli build / test / lint / typecheck` | 待回填 | |
| V2 | `CHIPS_TRUST_ROOTS_FILE=tests/e2e/fixtures/cpk/keys/trust-roots.json node packages/cli/dist/bin.js plugin validate tests/e2e/fixtures/cpk/packages/hello-0.1.0.cpk` | 待回填 | 期望 EXIT=0 且 `签名校验: 通过` |
| V3 | 同上注入，逐件 validate 三个负夹具 | 待回填 | 各按 `CPK_SIGNATURE_INVALID` / `CPK_MANIFEST_INVALID` / `CPK_ARCHIVE_INVALID` EXIT=1 |
| V4 | 不注入信任根 validate 正夹具 | 待回填 | `CPK_SIGNATURE_INVALID`（信任根未注册）EXIT=1 |
| V5 | `cd examples/plugins/hello && pnpm exec which chips` | 待回填 | 解析到当前工作区 bin（非 `~/.volta/bin/chips`） |
| V6 | `pnpm --filter @chips/plugin-hello run package` + 产物 validate | 待回填 | EXIT=0，用例自清理 |
| V7 | `node tools/gates/check-boundaries.mjs --no-report`、契约测试、`test:e2e:cpk-fixtures:check`、`校验拆分件.py`、`检查文档链接.py` | 待回填 | |

## 六、遗留与建议（不构成本单红点）

1. **host 装载器消费同一注入契约**：`plugin install` 的信任根判定在平台侧（宿主装载器，工单 W2-P0-3 域）；本 RFC 冻结的文件形状应被 host 侧复用或经转换适配（host 编译期内嵌注册表 `chips-trust-roots-v1` 采用 Base64 原始公钥编码，与注入文件 SPKI-PEM 的编码统一收口建议随 Phase 3/4 发布链落地一并裁决）。`packages/host/**` 为本单禁改面。
2. **pack 重跑幂等**：`--out dist/` 二次执行时旧产物 `dist/<名称>-<版本>.cpk` 命中既有"嵌套归档拒绝"检查（该检查是既有校验强度且被既有用例锚定，本单禁改面不动）。链上建议：重跑前清理（`pnpm --filter <pkg> clean` 或删旧产物）；是否为"自身同名产物"开豁免属校验强度裁决，另轮处理。
3. **examples 子包自有 bin 锚点**：examples 规则 `allowedInternal` 不含 `@chips/cli`，子包自有 devDependency 方案被 G9 拒绝；本轮以根 bin 锚点解决。若 #45 在途工单对边界表有调整，可复议为子包自有锚点。
4. **注册表持久化位置**：用户级信任根注册表目录（平台数据区）随 Phase 3/4 平台信任管理落地；本轮不提供多文件合并/默认查找路径，注入通道保持单源。
