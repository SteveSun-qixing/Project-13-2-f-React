# 旧功能覆盖矩阵-Chips-Host-Chips-Scaffold

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：W2 台账裁决交付（消灭流程步骤 [1]~[3] 完成，两仓库文件级清空）
> 裁决人：`ledger-host-scaffold`
> 范围：`Chips-Host`（241 文件）、`Chips-Scaffold`（325 文件），共 **566 行全部「已裁决」，剩余待评估 0 行**。
> 依据：《重构大计划/01-文件台账与消灭流程》裁决三问、《02-仓库映射与新工作区》、《00-总纲与路线图》、根 `AGENTS.md` 红线、《薯片生态文档库/01-架构设计》（01.04/01.05/01.08、02.03/02.07/02.08/02.09/02.10、03.02~03.05/03.09/03.10、05.02、17）、《04-能力契约规范》§八、《11-文档服务设计》、《12-编辑引擎设计》、《13-工作区设计》、《14-资源打开与默认处理器契约》、《15-文件处理契约》、《03-插件开发/01-快速开始》《02-插件清单规范》《06-服务插件开发指南》《09-官方插件与应用目录》《10-官方内容处理与阅读服务设计》、《06-开发与运维/02-构建与打包》《07-CLI完整参考》。
> 证据口径：旧侧「文件:行」取自治库 `symbols` 表（扫描器登记的导出符号真实行号）；新侧「文件:行」取自闭本矩阵时对 `chips-ecosystem/**` 的实测 grep（只读勘查，未修改任何实现文件）。

---

## 一、裁决计数总览

| 仓库 | 废弃 | 重写 | 迁移 | 保留设计 | 归档 | 合计 |
|---|---|---|---|---|---|---|
| Chips-Host | 136 | 47 | 13 | 9 | 36 | **241** |
| Chips-Scaffold | 177 | 12 | 0 | 56 | 80 | **325** |
| **合计** | **313** | **59** | **13** | **65** | **116** | **566** |

按类别（两仓合计）：code 146+31=177 全部逐文件真读后裁决（读文件头注释、导出面、被测对象、调用点）；test 57+63=120 按被测主体同批处置并逐行给因；config 4+19=23 逐行；doc 33+73=106 逐目录给因并对 5 篇设计文档单独判保留设计；other/asset（二进制、模板 .tpl、生成物、图标）按目录成批，批次理由见第四节。

台账复核查询：`files WHERE repo_id IN ('Chips-Host','Chips-Scaffold') AND status='已裁决' AND owner='ledger-host-scaffold'` = 566；notes 全部非空。`verify` 的「幻想 target」清单中无本裁决人名下任何行（本侧所有落点均 `ls` 实测存在，或以「计划归属：…」写法点名归属任务）。

---

## 二、Chips-Host 功能覆盖矩阵

判定基准：新侧 Host 生产组合根（W2 P0-1）、插件装载链（W2 P0-3）、渲染引擎进宿主（W2 P0-4）在途；已落位事实源为 `packages/host/src/{platform,protocol,preload,main,renderer,scripts}` + `runtime/{capability,resource}` + `capabilities/document` + `packages/{bridge,native,cli,sdk,ui,antd}` + `tools/{scaffold,gates,contract-gen,testing}` + `tests/{e2e,contract,perf}`。

### 2.1 功能已被新实现覆盖 → 旧实现废弃（主体）

| 功能 | 旧实现位置（文件:行） | 新实现位置（证据） | 判定 | 依据 |
|---|---|---|---|---|
| 宿主内置能力注册与派单 | `src/main/services/register-host-services.ts:8792`（8808 行，100+ 动作）、`src/main/services/register-schemas.ts:763`（1044 行） | `packages/host/src/runtime/capability/registry.ts:143 createHostCapabilityRegistry`、`router.ts:65 createHostCapabilityRouter`、`capabilities/document/service.ts:131 createDocumentService` | 废弃（旧巨石） | 能力面唯一事实源 `packages/sdk/src/generated/capability-ids.ts`（47 个 ID，133 行）无 `card./box./theme./zip./office./workspace./association./session.` 路由；《04-能力契约规范》§八；台账 2201/2200/2155 |
| 文档服务：会话/修订/脏状态/写租约/串行队列/摘要复算 | `packages/card-service/src/session/service.ts:59 CardSessionService`（534 行）、`packages/box-service/src/session/service.ts:196 BoxSessionService`（897 行）、`packages/card-info-service/src/card-info-service.ts:86` | `packages/host/src/capabilities/document/{service,session-store,validation,digest,contract,errors,ports}.ts`（digest.ts:136 行摘要复算） | 废弃 | 《11-文档服务设计》§三~§七；事件名取 `sdk/generated/event-ids.ts`；台账 2109/2077/2120/2104/2074 |
| 卡片/箱子解析与序列化、格式校验 | `packages/card-service/src/card-service.ts:1726 CardService`（2702 行）、`packages/box-service/src/box-service.ts:1001 BoxService`（2932 行）、`packages/card-packer/src/card-packer.ts:55` | `packages/core-rust/crates/chips-parser/src/{lib,model,source,digest,error}` + `chips-core` | 废弃（功能换载体） | 《04-文件格式规范》01/02 为字段权威；解析归 Rust 内核；台账 2099/2070/2066/2102/2073 |
| 三层 Bridge：传输、帧协议、错误归一、权限判定 | `packages/protocol/src/codec.ts:156`、`packages/common-basics/src/permission.ts:1 PermissionGuard`、`src/preload/{create-bridge,bridge-api,host-transport}` | `packages/core-rust/crates/chips-bridge/src/{bridge,schema,permissions,error_codes,naming}.rs` + `packages/bridge/src` + `packages/host/src/protocol/wire.ts`（IBridgeRequest/Response/EventEnvelope + toWireError） | 废弃 | 《01-架构设计/02-Bridge三层设计》§三/§六/§八/§九；`tests/contract/{frame-protocol,errors}.test.ts`、`packages/host/tests/wire.test.ts`；台账 2117/2118/2111/2112/2203/2204/2091 |
| 请求防重放 / 自动重试 | `packages/common-basics/src/idempotency-store.ts:1`、`packages/kernel/src/router.ts:12 KernelRouter`（重试+防重放） | 不落位：幂等语义由各能力实现自行保证 | 废弃（架构裁决否证） | 《02-Bridge三层设计》§八「Bridge 不自动重试，也不做幂等去重」；台账 2093/2136（此一行为否证式废弃，非覆盖式） |
| IPC 通道、窗口安全、资源协议与 URI | `src/main/ipc/chips-ipc.ts:154 bindKernelToElectronIpc`、`src/preload/plugin-window.ts`、`src/main/electron/render-document-protocol.ts:38`、`src/shared/resource-path.ts:42` | `packages/host/src/main/{ipc-channels.ts:69 registerIpcChannels,window-manager.ts:55,window-security,window-bindings,resource-protocol.ts:28/133/213}`、`preload/{index,subscriptions,permission-cache,resource-handle}`、`protocol/resource-uri.ts`（496 行，parseResourceUri/越界拒绝） | 废弃 | 《02.07 IPC 通道与消息格式》《02.10 资源句柄与 chips-resource://》；`packages/host/tests/{ipc-channels,window-security,resource-protocol,resource-uri}.test.ts`；台账 2187/2202/2191/2161 |
| 平台抽象（PAL）与跨端端口 | `packages/pal/src/node-adapter.ts:3124/3180/3237`（Node/Desktop/Headless 三适配器同文件，3239 行）、`packages/pal/src/types.ts`（625 行） | `packages/host/src/platform/contracts/*`（15 个分面契约 + index）、`platform/mac/*`（15 端口 + command-runner/net-request）、`platform/electron/{load-electron,electron-api}.ts`、`platform/matrix.ts` | 废弃 | 《17-跨端Shell与平台抽象设计》§3.2 唯一交互面 + 分面端口拆分；`packages/host/tests/mac-*.test.ts`、`load-electron.test.ts`；台账 2115/2114/2116/2174/2175/2190 |
| 宿主组合根与主进程生命周期、启动输入 | `src/main/core/main-process.ts:147 bootstrapHostMainProcess`、`src/main/core/host-core.ts:35 HostCore`、`src/main/electron/{app-entry,electron-loader}.ts`、`src/main/core/workspace-paths.ts` | `packages/host/src/main/{main.ts:62 startHostMain,runtime-provider.ts,electron-adapter.ts,startup-inputs.ts,session-resolver.ts,directory-variables}` | 废弃（生产装配在途） | R4 依赖边界（`packages/host/src/index.ts` 284 行受控导出，文件头自证 SL-5/SB-4）；`tests/{main,application,runtime-provider,production-assembly,startup-inputs}.test.ts`；台账 2170/2171/2173/2197/2168/2193 |
| CLI（用户/开发命令、补全、doctor、TUI、应用任务、Electron 承载协议） | `src/main/cli/index.ts:2778 runCli`（2827 行）、`src/main/cli/interactive.ts:1916`（2049 行）、`src/main/cli/{builtin-commands,plugin,dev}.ts`、`src/main/cli/runner.ts` | `packages/cli/src/{args/parse.ts(737),run.ts(365),commands/*,tui/*(927),plugin-cli/execute.ts(473),artifacts/*,client/service-router.ts}`，20 个测试面 | 废弃 | 《06-开发与运维/07-CLI完整参考》§二~§五；Host 不承载 CLI（台账 2178/2176/2177/2192~2198） |
| 快捷键与命令派发（渲染进程运行时） | `src/preload/command-shortcuts.ts:487 bootCommandShortcutRuntime`（588 行） | `packages/ui/src/command/{accelerator.ts(376),runtime.ts,context.tsx,platform-port.ts}` + `accelerator.test.ts` | 废弃 | 《13-命令系统契约》§2.6 文法、§5.5 可编辑上下文保护；唯一组件链路红线；台账 2205 |
| 渲染进程私有 hooks 面 | `src/renderer/{runtime-client.ts,hooks/*}` | `packages/sdk/src/client/chips-bridge.ts` + `window.chips` 单链 | 废弃 | 《05-接口与契约/02-SDK-API规范》§三；无兼容红线（禁止 legacy action 映射与内置重试）；台账 2143/2144/2145 |

### 2.2 功能必需、新面缺位或换载体 → 重写（待后续波次执行，47 行）

| 功能 | 旧实现位置 | 新归属（计划） | 目标波次 | 依据与缺口 |
|---|---|---|---|---|
| 统一渲染引擎（六阶段管线、DocumentView 组装、目标适配器、增量更新、渲染副作用、校验与诊断、布局） | `packages/unified-rendering/src/engine.ts:108 UnifiedRenderingEngine`（448 行）+ 同包 adapters/contract-diagnosis/effects/layout-solver/normalize/theme-resolver（2078~2090 共 11 件）+ `packages/card-service` 渲染视图组装 | `packages/host/src/renderer`（现仅 `renderer/shell-window.ts` + `shell.html`）+ `packages/ui/src/components/EmbeddedDocumentFrame` | **W2 P0-4** | 旧六段管线（normalize→theme→layout→contract→effect→adapters）与《05-渲染引擎设计》§二 六阶段（请求/解析/资源准备/插件渲染/组装/交付）不同构；归一发生在解析器→DocumentView（05.02 §2.5）、视图构建器在 §2.6；台账 2082/2078/2079/2081/2083~2090 |
| 插件运行时与装载（安装/启用/停用/卸载、权限与配额、init 握手、surface/launcher 解析、cli.commands 声明） | `src/runtime/plugin-runtime.ts`（2477 行）、`packages/kernel/src/module-loader.ts:79 ModuleLoader`（196 行） | `packages/host/src/runtime/capability` + `packages/host/src/main`（装载器） | **W2 P0-3** | 旧五角色（含 theme、card/layout 私有）收敛为 basecard/boxlayout/app/service 四角色；.cpk 与签名校验按《03.10 插件包 .cpk》《02.07 .cpk 插件打包与签名》重建；台账 2153/2135/2139 |
| 内置插件首启（发现 bundle→安装→启用→快捷方式） | `src/main/core/built-in-plugins.ts:211`（230 行） | `packages/host/src/main` | W2 P0-3 之后 | 依赖装载链；目录口径见《09-官方插件与应用目录》；台账 2169 |
| 资源打开路由与打开动作（含文件关联入口） | `packages/resource-open-service/src/resource-open-service.ts:79`、`packages/card-open-service/src/card-open-service.ts:26`、`src/main/core/file-association.ts:87` | `packages/host/src/runtime/capability`（resource:open 能力）+ `main/startup-inputs.ts` | W2 P0-1 之后能力派单 | 《14-资源打开与默认处理器契约》§二/§四/§五；新能力面无 `association.*`；台账 2127/2068/2172 |
| 归档导入、资源生命周期与封面引用核对 | `packages/zip-service/src/archive-import.ts:478`（503 行）、`packages/card-service/src/session/resource-lifecycle.ts:149`、`cover-reconcile.ts:143` | `packages/host/src/runtime/resource`（现仅 platform 作用域后端）+ W3 `chips-resource` | **W3** | 《04-资源管理设计》§八/§九 路径安全、§十 清理与泄漏防护；受控写路径归 Rust 内核；台账 2122/2103/2108 |
| 自动保存调度与撤销-重做 | `packages/card-service/src/session/autosave.ts:16 AutosaveScheduler`、`box-service/src/session/autosave.ts:16 BoxAutosaveScheduler`、`session/history.ts:9/:7` | `chips-ecosystem/plugins/apps`（编辑引擎应用侧） | **W5** | 《12-编辑引擎设计》§六 自动保存、§七 撤销-重做；Host 只暴露 `document:write/save`；台账 2107/2076/2101/2072 |
| 工作区扫描与文件树 | `packages/workspace-service/src/workspace-service.ts:117`（260 行） | `plugins/apps` 消费 `file:list`/`file:watch` | W5 | 新能力面无 `workspace:*`；《13-工作区设计》§三/§五；识别规则（`.card/metadata.yaml`、`.box`）属格式契约不变，可复用；台账 2134/2133 |
| 内容处理域：文件编辑会话、Office 加解密、xlsx 引擎、Office 文档创建、TIFF/视频帧转换 | `packages/file-session-service/src/index.ts:199`（600 行）、`office-crypto/*`、`packages/xlsx-engine-service/src/index.ts:64`（368 行）、`packages/office-document-service/src/index.ts:173`（461 行）、`packages/resource-image-service/src/resource-image-service.ts:187` | `chips-ecosystem/plugins/services`（服务插件） | **W4** | 《04-能力契约规范》§八 内容处理服务能力、《15-文件处理契约》§三/§四、《03-插件开发/10-官方内容处理与阅读服务设计》；Host 不再内置私有会话与子进程直连；台账 2094~2097/2130/2132/2131 |
| 服务（旧 module）插件运行时：provider/consumer 记录、semver 匹配、方法契约校验、任务进度 | `src/main/services/module-runtime.ts:344`（351 行） | `plugins/services` + 内核服务模型 | W4 | 《01.05 服务模型 provide-inject》《06-服务插件开发指南》§三/§七；语义版本已落 `packages/cli/src/artifacts/semver.ts`（316 行）；台账 2199 |
| macOS 安装器与内置插件随包发布链 | `src/main/installer/macos-installer.ts:1054 buildMacHostInstaller`（1103 行）、`installer/cli.ts`、`resources/launcher-stub` | `packages/host/scripts`（新工作区尚无打包实现） | **W6** | 《06-开发与运维/02-构建与打包》§六/§七/§九；根脚本 `package` 待各包实现；台账 2188/2189/1970 |

### 2.3 复用度高 → 迁移（13 行，Host 全部为 Chips-Scaffold 之外的「规则表 + 薄封装 + 真实素材用例」）

| 功能 | 旧实现位置 | 新归属 | 波次 | 依据 |
|---|---|---|---|---|
| 处理器解析优先级与偏好归一算法 | `packages/resource-open-service/src/handler-resolver.ts:314 buildHandlerSlots`（378 行） | `packages/host/src/runtime/capability`（随 resource:open 落地搬运） | W2 能力派单 | 与《14》§三/§四口径逐条一致（resource-handler→file-handler→通配 MIME→shell 兜底）；台账 2128/2129 |
| 文件类型识别规则表 | `src/shared/detect-type.ts:31 detectTypeByPath`（90 行） | `plugins/services`（文件处理域） | W4 | 生态统一口径（旧工单152 系）；《15-文件处理契约》§二；台账 2167/2019 |
| 扩展名→MIME 单点表 | `src/shared/mime.ts:98 guessMimeType`（`MIME_BY_EXTENSION` 常量在第 12 行，110 行） | `plugins/services` / 文件处理域单一事实源 | W4 | 旧工单154 生态统一表；新工作区当前无公开 MIME 表落位（与 SDK 矩阵 2.3 的同一缺口互证）；台账 2166/2042 |
| 泛型 undo/redo 历史栈 | `src/shared/history.ts:28 HistoryStack`（114 行，mergeKey 合并窗口 + 深度上限） | `plugins/apps`（编辑引擎） | W5 | 《12.07 撤销-重做》；台账 2156/2101/2072 |
| ZIP 条目顺序/时间保留与真实素材 round-trip、黄金回环用例 | `tests/unit/session-roundtrip-equivalence.test.ts`（331 行，真实成品素材）、`tests/unit/card-transfer-gold-loop.test.ts`（176 行）、`tests/integration/editing-chain-e2e.test.ts`（277 行）、`tests/unit/helpers/zip-fixture.ts`（101 行，最小合法 xlsx 构造） | `chips-ecosystem/tests/e2e`（现仅 golden-path/harness 两 spec） | W2 金链路 | 金链路「打开→解析→渲染→编辑→保存」与「离线↔网络资源卡片」验收形态直接对齐准出标准③；台账 2029/2011/2049/2045 |
| 其余 5 行（card/box 会话薄封装与用例配套） | 见台账 notes | `plugins/apps` / `tests/e2e` | W5 | 随主体搬运，不单独留第二份 |

### 2.4 本体不搬运、设计价值保留 → 保留设计（9 行）

| 内容 | 旧位置 | 保留给谁 | 理由 |
|---|---|---|---|
| xlsx-sidecar 引擎来源/许可/构建说明 + 双架构预编译二进制 + 上游构建脚本 | `resources/engines/xlsx-sidecar/SOURCE.md`、`{darwin-arm64,darwin-x64}/xlsx-sidecar`、`scripts/build-xlsx-sidecar.*` | `plugins/services`（W4） | 第三方引擎的来源与许可记录必须随链路保留；二进制本体不入库新工作区，按新工具链重建 |
| CardPacker 目录态↔归档态链路与摘要计算顺序 | `技术文档/16-CardPacker子模块与Card打包链路.md` | `chips-parser`（W2/W3） | 唯一成文的打包步骤不变量（清单/摘要先于压缩、回滚条件） |
| Host 安装器与内置插件随包发布链路 | `技术文档/17-Host安装器与内置插件发布链路.md`（186 行） | `packages/host/scripts`（W6） | 2188/2189 重写时的设计输入 |
| TIFF→PNG 资源转换服务设计（上限/降级） | `技术文档/20-TIFF转PNG资源转换服务设计.md` | `plugins/services`（W4） | 输入上限与失败降级为服务侧约束来源 |
| xlsx sidecar 协议模拟夹具 | `tests/unit/helpers/xlsx-sidecar-mock.mjs`（92 行） | `plugins/services` | 「mock 协议层 + 真实二进制集成」分层测试手法 |
| L9 性能基线报告与基准脚本 | `config/reports/perf/unified-rendering-baseline.json`、`scripts/bench-unified-rendering.mjs` | 不保留（已判归档） | 私有阈值不可平移，性能唯一来源《架构原则》§4.2/R18 + `tests/perf` |

### 2.5 归档（36 行）

工程配置与依赖锁 4 件（`.gitignore`/`package-lock.json`/仓库级 `AGENTS.md` 等）、性能报告与基准脚本 2 件、开发计划 8 件、需求文档 4 件、技术文档实现记录与索引 18 件（含主题运行时 2 件、声明式 UI 2 件、L9 验收 2 件、PAL/协议/安装器实现记录 6 件）、内置资源说明与其他过程件 若干。共同理由：口径绑定已作废的 L1~L12 分层 / 主题与多语言（task030）/ 私有路由表，或已被现行权威文档与本轮覆盖矩阵取代；**不作迁移输入、不作准出证据**。归档动作本身由主代理执行（旧仓只读，本裁决未移动或删除任何文件）。

---

## 三、Chips-Scaffold 功能覆盖矩阵

新侧唯一实现：`chips-ecosystem/tools/scaffold/src/{generator,templates/{index,shared,app,basecard,boxlayout,service},manifest,manifest-validate,validate,types,errors,yaml}.ts`（3815 行含测试）→ 经 `packages/sdk/src/scaffold/index.ts:51/81`（`./scaffold` 子路径）→ `packages/cli/src/artifacts/scaffold.ts:34 resolveScaffoldProvider` → `packages/cli/src/commands/plugin.ts:137 createCommand`（`chips plugin create --role app|basecard|boxlayout|service`）。

| 功能 | 旧实现位置（文件:行） | 新实现位置 / 计划归属 | 判定 | 依据 |
|---|---|---|---|---|
| 四角色工程生成 API（每角色一份私有包 API） | `chips-scaffold-app/src/cli/app-scaffold-api.ts:22 createAppProject`、`basecard/…:17 createBasecardProject`、`boxlayout/…:15 createBoxlayoutProject`、`module/…:15 createModuleProject` | `packages/sdk/src/scaffold/index.ts:81 createScaffoldPlan` + `chips plugin create --role` | 废弃 | 《07-CLI完整参考》§三；CLI 不复制模板（`artifacts/scaffold.ts` 文件头自证）；台账 4229/4096/4150/3993 |
| 模板渲染引擎（.tpl 文件树 + 占位符替换 + 目标目录判定，四包各一份 231~343 行） | `app/src/core/template-engine.ts:241 createAppProjectInternal`、`basecard/…:178 renderTemplateToTarget`、`boxlayout/…:156`、`module/…:176 collectTemplateChain` | `tools/scaffold/src/generator.ts:47 createScaffoldPlan` + `templates/index.ts:144 buildScaffoldFiles`（模板内容代码内联） | 废弃（module 份判重写） | 四份重复实现收敛为一份纯函数生成器；旧 `module` 角色更名 `service`；台账 4228/4094/4148/3991 |
| fs 落盘工具（三包逐字重复） | `{basecard,boxlayout,module}/src/core/fs-utils.ts`（各 82 行） | `packages/cli/src/artifacts/scaffold.ts` + `args/filesystem.ts` IFileSystemPort | 废弃 | 生成器不做 IO；台账 4095/4149/3992 |
| 类型与错误面（每包一份） | `{app,basecard,boxlayout,module}/src/core/{types,errors}.ts` | `tools/scaffold/src/{types.ts(175),errors.ts(24)}` | 废弃 | 单一类型面 + ScaffoldError；台账 4227/4226/4093/4092/4147/4146/3990/3989 |
| 模板元数据（10 份 template.json） | `templates/<模板>/template.json` | `generator.ts:7 SCAFFOLD_TEMPLATE_ROLES` + `templates/index.ts:60 scaffoldFilePaths/:113 roleDescription` | 废弃 | 元数据内联，不再每模板一份 JSON；台账 4188/4069/4126/3943 等 |
| 模板完整性 CI 检查（四包各一份 272~458 行） | `app/scripts/check-templates.mjs:64 main`、`basecard:…`、`boxlayout/scripts/check-templates.cjs`、`module/scripts/check-templates.cjs:344 assertRenderedManifestCliContract` | `tools/scaffold/tests/{templates,validate,yaml,generator}.test.ts` + `manifest-validate.ts`（角色专有规则） | 废弃 | .tpl 文件树与私有 i18n/theme 字段断言作废；新模板为代码内联并已有 602 行测试；台账 4173/4061/4118/3930 |
| **生成工程端到端门禁**（沙箱装配→构建→跑默认门禁→读报告→清洁度断言） | `app/scripts/run-generated-e2e.mjs:48 createWorkspaceSandbox`、`basecard:…assertGeneratedTextIsClean`、`boxlayout/scripts/run-generated-e2e.cjs:99 assertNoLegacyBoxRuntimeFields / :50 extractManifestLayoutType`、`module/scripts/run-generated-e2e.cjs`（600 行） | **缺位** → `tools/scaffold/tests`（W3 CI 门禁重建） | 重写（4 行） | 新工作区根脚本与 tools/gates 无「生成工程可构建/可验收」项 → 缺口 **G1**；配套设计输入判保留设计（四篇 05-测试策略与质量门禁设计） |
| **服务插件多形态模板矩阵**（7 形态：standard/pure-function/color-extraction/file-conversion/html-rendering/image-processing/orchestration，各带 capability 声明与 contracts 输入输出 Schema） | `chips-scaffold-module/templates/module-*/{src/index.ts.tpl,contracts/*.schema.json.tpl,manifest.yaml.tpl}`（37 件）、`src/core/template-engine.ts:176 collectTemplateChain`、`README.md「模板矩阵」`、`技术文档/02-模板目录与文件组织设计.md「1. 模板矩阵」` | **缺位** → `tools/scaffold/src/templates/service.ts`（现 164 行，只有心跳/健康检查骨架） | 保留设计（39 件）+ 引擎与标准形态用例重写 | 新 service 模板无能力注册样例、无契约 Schema 样例、无异步 job 进度/取消与编排形态 → 缺口 **G2**；权威《06-服务插件开发指南》§七、《04-能力契约规范》§八；台账 3991/3951/3929 + 37 件模板 |
| 生成工程自带测试模板（23 件 .tpl 用例） | `templates/app-standard/tests/{unit/app,unit/commands,e2e/basic-flow}.test.ts.tpl`（4195/4196/4197）、`card-standard/tests/{unit/render-view,unit/editor-panel,unit/schema,integration/card-flow}.tpl`、`boxlayout-standard/tests/unit/{layout-definition(539 行),schema}.tpl`、`module-*/tests/unit/module-definition.test.ts.tpl` | `templates/*.ts` 内 tests/ 输出项（现每角色仅 1 份测试模板） | 重写 12 / 保留设计 3 / 废弃 8（逐行见 notes） | 新模板测试深度显著低于旧模板（basecard 只有 config 用例、boxlayout 只有 render 用例、app 只有 app 用例）→ 视图挂载/编辑回流/分页与封面预取/assetRefs 路径安全等验收断言缺位，随各角色模板补强重建 |
| app 模板命令注册样例 | `templates/app-standard/src/commands/{app-commands.tsx,useAppCommands}.tpl`（127/132 行）+ `tests/unit/commands.test.ts.tpl` | **缺位** → `templates/app.ts` | 废弃（模板本体）+ 保留设计（用例） | 缺口 **G3**：新 app 模板无 `cli.commands`/命令注册与 `command.invoked` 派发样例；权威《13-命令系统契约》、《07-CLI完整参考》§5.1 |
| 图标资产与来源说明（四格式 + SOURCE.md） | `templates/app-standard/assets/icons/{app-icon.icns,.ico,.png,.svg,SOURCE.md.tpl}` | **缺位** → `templates/app.ts:116`（仅 `assets/icons/app.svg`） | 保留设计（5 件） | 缺口 **G4**：多平台图标格式与「来源/许可随模板交付」口径在新侧无落位；二进制本体按红线不入库 |
| 包工程与测试器配置（19 件 config + 4 件包根 vitest/.gitignore） | `{四包}/package.json`、`{四包}/tsconfig.json`、`{四包}/vitest.config.mts`、`basecard/package-lock.json`、`module/.gitignore` | `tools/scaffold/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}` + `tools/testing/src/vitest.ts` + 根 `.gitignore` | 废弃 18 + 归档 1 | npm workspaces→pnpm workspace 唯一口径；lock 文件不可能复用；台账 4151/4152/3996/3997/3995/4098/4099/3909/3910/3906/3908/3994/4097 |
| 模板文件树本体（.tpl，115 件） | `chips-scaffold-{app,basecard,boxlayout}/templates/**`（72 件判废弃）、`chips-scaffold-module/templates/**`（43 件：37 保留设计 + 6 废弃） | `tools/scaffold/src/templates/{app,basecard,boxlayout,service,shared,index}.ts` | 废弃 / 保留设计 | 载体从「文件树 + 占位符」换为「代码内联」；旧 chips.config.mjs、config/logging.ts、i18n/messages、scenes/views、preview-smoke、.eslintrc 模板在新侧各有归属或作废（逐批理由见第四节） |
| 生成物快照（42 件） | `chips-scaffold-basecard/tests/.tmp-basecard-tests/**`（22）、`tests/.tmp-e2e/**`（20） | 不落位 | 废弃 | 测试运行期可再生产物（`.tmp-*`），非源文件；新侧为纯函数计划、内存断言 |
| 旧仓过程文档与规则（80 件归档 + 6 件保留设计） | `AGENTS.md`×4、`开发计划/`×24、`技术文档/`×24（含 4 篇 05 与 1 篇 module 02 判保留设计）、`需求文档/`×16、`README.md`×1（module 模板矩阵，保留设计）、tmp 文档×4（随生成物废弃） | 计划归属 `Chips-Scaffold/归档/` | 归档 / 保留设计 | 口径基于「12 层架构」与四包 .tpl 结构，权威已换；生成工程门禁设计与服务形态矩阵为例外（保留设计） |

---

## 四、成批判定目录与共同理由（asset / data / other 与文档批次）

| 批次目录（仓库内相对） | 行数 | 判定 | 共同理由 |
|---|---|---|---|
| `Chips-Scaffold/chips-scaffold-app/templates/**`（other） | 33 | 废弃 | .tpl 树作废 → 模板内联 `templates/app.ts`；含无新归属的 chips.config.mjs、config/logging.ts、messages.ts（多语言）、scenes/views/scene-registry、preview-smoke、index.html、.eslintrc 模板 |
| `Chips-Scaffold/chips-scaffold-basecard/templates/**`（other） | 20 | 废弃 | 同上 → `templates/basecard.ts`；旧 mount\*/createBasecard\* 私有形状作废 |
| `Chips-Scaffold/chips-scaffold-boxlayout/templates/**`（other） | 19 | 废弃 | 同上 → `templates/boxlayout.ts`；分页/预取/区域安全断言另判重写（4132/4133） |
| `Chips-Scaffold/chips-scaffold-module/templates/**`（src+contracts+manifest+README） | 37 | 保留设计 | 唯一成文的服务多形态与能力契约样例（缺口 G2 的设计输入），本体不搬运 |
| `Chips-Scaffold/chips-scaffold-module/templates/**`（工程样板 6 件） | 6 | 废弃 | eslint/gitignore/config/package/tsconfig/vitest 样板，新模板已内联且 lint 由仓库根统一 |
| `Chips-Scaffold/chips-scaffold-{app,basecard,boxlayout}/归档/**` | 16 | 归档 | 已在旧仓 `归档/` 内的 task030 主题/多语言与被替代模板，史证保留 |
| `Chips-Scaffold/chips-scaffold-basecard/tests/.tmp-basecard-tests/**` 与 `.tmp-e2e/**` | 44 | 废弃 | 测试运行期生成物快照（含 README/parameters.md 4 件文档），可再生，不入库 |
| `Chips-Scaffold/chips-scaffold-app/templates/app-standard/assets/icons/**` | 5 | 保留设计 | 多格式图标 + 来源许可说明（缺口 G4） |
| `Chips-Scaffold` 各子包 `开发计划/`、`需求文档/`、`技术文档/`（除 4 篇 05 与 module 02/README） | 60 | 归档 | 过程材料：绑定 12 层架构与四包结构，新任务来源为《重构大计划》波次，需求权威为《03-插件开发》指南 |
| `Chips-Host/开发计划/**`、`需求文档/**`、`技术文档/**`（除 3 篇保留设计） | 29 | 归档 | 同上（旧仓内部实现记录/阶段验收/私有阈值） |
| `Chips-Host/resources/engines/xlsx-sidecar/**`（二进制 + SOURCE.md）+ `scripts/build-xlsx-sidecar.*` | 5 | 保留设计 | 第三方引擎来源与许可记录随链保留；二进制本体不入库，W4 重建 |
| `Chips-Host` 根 `.gitignore`、`package-lock.json`、仓库级 `AGENTS.md`、`config/reports/perf/*.json`、`scripts/bench-*` | 5 | 归档 | 依赖锁/忽略口径/私有性能阈值不可平移，过程史证 |

---

## 五、架构缺口点名（只报告，不登记工单、不改实现）

| 编号 | 缺口 | 证据（旧→新） | 建议归属 |
|---|---|---|---|
| G1 | **脚手架生成工程的端到端门禁缺位**：无「生成→构建→跑默认门禁→清洁度断言」的 CI 项 | 旧 `run-generated-e2e.{mjs,cjs}` 四份（4172/4060/4117/3929，共 1558 行）→ 新根脚本与 `tools/gates/gates-all.mjs` 无对应项 | W3 CI/门禁（配套设计：四篇 `技术文档/05-测试策略与质量门禁设计`，已判保留设计） |
| G2 | **服务插件多形态模板与能力契约 Schema 样例缺位**：新 `templates/service.ts` 仅 164 行心跳/健康检查骨架，无 capability 声明、无 `contracts/*.schema.json` 样例、无异步 job 进度/取消与编排形态 | 旧 `chips-scaffold-module/templates/<7 形态>/{src,contracts,manifest}`（37 件）+ 模板矩阵文档 | W4 服务插件波次（权威《06-服务插件开发指南》§七、《04-能力契约规范》§八） |
| G3 | **app 模板缺命令系统样例**（`cli.commands` 声明、命令注册与 `command.invoked` 派发、可序列化元数据） | 旧 `app-standard/src/commands/*` + `tests/unit/commands.test.ts.tpl`（4196 保留设计）→ 新 `templates/app.ts` 输出项无命令文件 | W2 收口或 W5（随命令系统链验收） |
| G4 | **图标多格式与来源许可说明缺位**：新 app/basecard/boxlayout 模板只输出单个 SVG，无 `.icns/.ico/.png` 与 `SOURCE.md` 口径 | 旧 `templates/app-standard/assets/icons/*`（4198~4202 保留设计） | W5 官方插件目录波次（与图标暂缓项合并决策） |
| G5 | **窗口装饰 / 插件 surface UI 配置端口缺位**：`packages/host/src/platform/contracts/window.ts` 无 chrome/titleBarStyle 字段，旧 Host 有完整映射 | 旧 `src/main/core/window-manager` + `packages/pal/src/types.ts` 的 chrome/UI 配置（Host 2160 判重写）→ 新分面契约缺字段 | W2 之后的窗口能力派单（权威《07-应用插件接口》§五 surface 与 launcher、《17-跨端Shell》） |
| G6 | **能力实现面尚薄**：`runtime/capability/registry.ts` 目前只承载 document 内置能力，`file:/window:/dialog:/clipboard:/config:/credential:/http:/shell:/menu:/tray:/shortcut:/system:/power:/transfer:/event:/command:/cli:task-*` 等 40+ 生成 ID 无宿主实现 | 旧 `register-host-services.ts`（100+ 私有动作）整体废弃后，新侧逐个待派单 → 是「废弃 2201」成立的前提约束 | W2~W3 能力派单（逐能力落位时以本矩阵 2.1/2.2 行核对） |
| O1 | 观察项：`capabilities/document` 无任何测试面（`packages/host/tests` 42 件、`tests/contract` 12 件均无 document 用例） | 与 2104/2109/2077/2035/2039 的「并入文档能力测试面」表述直接相关 | W2 P0-2 收口时补（非缺陷，属在途） |
| O2 | 观察项：`packages/host/src/renderer` 仅壳文件 | 渲染引擎 11 件旧实现全量判重写/废弃，验收依赖 P0-4 | W2 P0-4 |
| O3 | 观察项：`MIME` 扩展名表在 SDK 矩阵中被点名为缺口，与本轮 2166/2042「迁移至 W4 文件处理域」需同一落点，避免两仓各建一份 | Chips-SDK 矩阵 §2.3 + 台账 2166 | 由主代理统一登记为单一工单 |

---

## 六、残余与后续工作

1. **文件级**：`Chips-Host`、`Chips-Scaffold` 两仓 566 行 100% 已裁决，剩余待评估 0 行；未做任何 git 写操作，未删除/移动任何文件（所有「归档」行以 `计划归属：…` 写法点名由主代理执行）。
2. **符号级**：本两仓文件名下登记符号 **1039 个（Chips-Host 851 / Chips-Scaffold 188），已裁决 0**；本轮任务范围为文件级裁决（步骤 [1]~[3]）与功能核对清单骨架，符号级裁决（`symbols`/`symbol-dispose`）留待波次收口，需要时由主代理另行派发。
3. **台账工具**：本轮实际使用了 `claim`（按仓库认领 566 行，owner 唯一性由工具保证）、单行 `dispose`（逐行裁决与 6+1 处证据纠正）、`dispose-batch --dir/--id-file`（成批判定）、`verify`。`verify` 报告的 14 条「幻想 target」全部属于其他仓库/其他裁决人，与本裁决无关。
4. **准出标准③用法**：本矩阵每行「旧实现位置（文件:行）→ 新实现位置/计划波次」即为核对入口；G1~G6 为已确认的真实缺口，O1~O3 为在途观察项，二者均不应被解读为「已覆盖」。
