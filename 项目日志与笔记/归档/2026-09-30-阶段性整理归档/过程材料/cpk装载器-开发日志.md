# cpk装载器-开发日志（任务 #56 · W2 波次 P0-3）

配套计划书：《cpk装载器-开发计划.md》。本日志按阶段追加；本文件由段一（阶段三：校验流水线）接管轮补建。

## 段一接管段（阶段三：校验流水线 · 收口）

- 背景：前任在批量模型中断，在途产物已快照入库（c6096c85）。本段先审计后收口，未回退任何既有交付。
- 审计范围：`packages/host/src/loader/` 十文件（codes/errors/limits/types/zip/semver/provider/signature/trust-roots/manifest/validate）与 `tests/loader-{contract,trust-roots,package}.test.ts` 三套件、`resources/trust-roots.json`、host 依赖 `yaml@2.8.2`。
- 审计命令与退出码：`cd chips-ecosystem/packages/host && npx vitest run tests/loader-contract.test.ts tests/loader-trust-roots.test.ts tests/loader-package.test.ts > /tmp/r56a_audit.log 2>&1; echo EXIT=$?` → `EXIT=0`（接管时 49 案全绿，无 skip/TODO/占位）。
- 审计结论：
  - `manifest.ts`（表行「manifest.yaml 解析与校验」）已完整：必填域、反向域名 ID 文法、semver（复用已落 `semver.ts`）、四角色约束、`runtime.targets`、`engines.chips` 门禁（不满足落 `CPK_ENGINE_UNSUPPORTED`）、权限目录结合（未登记/文法/限定值/角色不允许统一落 `CPK_MANIFEST_INVALID` 并保留 `details.permissionCode` 诊断语义，裁决口径已登记于本文档此前裁决记录位）、各域字段（capabilities/ui/fileAssociations/deepLinks/healthCheck/cli）逐域收紧。
  - `validate.ts` 五阶段流水线（archive→layout→manifest→signature→hash）编排完整：阶段失败携带已收集阶段列表（`details.stages`）；安装哈希归档态 = `"sha256:" + SHA-256(整包字节)`、目录态 = 成员内容清单摘要；校验全通过前不落盘（落盘归阶段四 `install.ts`）。
  - `trust-roots.ts` 双形态归一在途件已完成收口审计：编译期 `chips-trust-roots-v1`（Base64 原始公钥 → SPKI PEM）与注入形态 `{version,trustRoots:{keyId:SPKI PEM}}`，任一条目非法整表拒绝，`keys: []` 失效关闭（工单 028 口径一致）。
  - `provider.ts`（归档态/目录态双形态）、`signature.ts`（`chips-signature-v1`、contentHash 重算先于信任根查找、渠道规则）审计无缺口。
  - 唯一缺口：`tests/loader-package.test.ts` 校验段负矩阵缺「原生载荷 → `CPK_NATIVE_PAYLOAD`」逐码负例（计划书测试节第 2 条清单内，其余 10 码均已逐码断言）。
- 本段修复：补齐 `CPK_NATIVE_PAYLOAD` 两条负例（`.node` 扩展名成员；PE 魔数内容非扩展名命中），均断言 `stage=layout` 与 `details.file`；同步更新套件头注释的负矩阵清单。断言只增不减零放宽，错误码取自 `codes.ts`，未修改 `tests/e2e/fixtures/**`（负例全部内联构造）。
- 收口验收（volta PATH，全部真实退出码）：
  - `npx vitest run tests/loader-contract.test.ts tests/loader-trust-roots.test.ts tests/loader-package.test.ts > /tmp/r56a_vitest.log 2>&1; echo EXIT=$?` → `EXIT=0`（3 套件 51 案全绿，套件内无 skip）
  - `npm run build:main > /tmp/r56a_build.log 2>&1; echo BUILD_EXIT=$?` → `BUILD_EXIT=0`
  - `npx tsc -p tsconfig.json --noEmit > /tmp/r56a_tsc.log 2>&1; echo TSC_EXIT=$?` → `TSC_EXIT=0`（无在途红项需归因）
  - `npx eslint src/loader tests/loader-contract.test.ts tests/loader-trust-roots.test.ts tests/loader-package.test.ts > /tmp/r56a_eslint.log 2>&1; echo ESLINT_EXIT=$?` → `ESLINT_EXIT=0`
- 遗留与移交：
  - 阶段四：`install.ts`/`registry.ts`（临时目录→全量校验→原子落盘、同 ID 更新/降级拒绝）+ 正夹具全链测试（落盘→注册表→事件 `plugin:installed`）+ 负矩阵「撤销（安装期两表对照）」与失败无残留断言。
  - 阶段五：`activation.ts`/`lifecycle.ts` + `loader-lifecycle.test.ts` 状态机/事件/Bridge 链路测试。
  - 阶段六：`runtime/host-runtime.ts` 工厂位 + `production-assembly.ts` 注入 + 组合根 7 案不回退。
  - 阶段七：全量验收闸门 + Electron 承载冒烟。
  - 工单 028（宿主编译期信任根注册表正式内容缺位）保持登记；夹具再生成合缝归段二/三；生命周期事件漂移锁随阶段五在本契约套件补齐。

## 段二段（阶段四~五：安装落盘 + 注册表 + 激活端口 + 生命周期状态机 · 收口）

- 交付面：`packages/host/src/loader/` 新增四模块与公共面：
  - `install.ts`：`installCpkPackage` 临时目录（`mkdtemp`）写入 → `validateCpkPackage` 全量校验（消费阶段三五阶段流水线）→ 原子 `rename` 落盘 `<pluginsRoot>/<id>/<version>/`；失败清理临时目录不留半成品（测试断言 `.cpk-install-tmp` 无残留）；同 ID 重复安装（同版本/更新/降级）统一拒绝；撤销两表对照（`trustRoots` 与 `revocationRoots` 缺省同表，keyId 不在表 → `CPK_SIGNATURE_INVALID`，`details.{stage,keyId,table}`）。附 `removeInstalledPluginDirectory`。
  - `registry.ts`：`openPluginRegistry` 持久化 `registry.json`（版本 1，安装集合/启用偏好/授权集合）；`normalizeEntry` 严格校验（未知字段拒绝、role/source 枚举、依赖/权限数组）；承接 `state` 残留字段：`RUNTIME_STATE_RESIDUE`（pending/starting/active/stopping/failed）→ 回滚 installed + 诊断（《03-插件架构设计》§3.4）；原子持久化 tmp+rename；持久化层错误为非 CPK_*/KERNEL_* 域基础设施错误（`PluginRegistryPersistenceError`）。
  - `activation.ts`：`IPluginActivationPort`（内核 §6.1 PluginRunner 的 TS 契约视图）+ `createPluginActivationContext`（能力注册回调、事件发布、配置只读快照——命名空间未登记生效值为空对象；非 service 注册 → `KERNEL_APPLY_FAILED`；owner 强制预绑定 pluginId，04.24 §9.1；注销他人 owner 能力拒绝）。
  - `lifecycle.ts`：`createCpkPluginLoader` T1–T14 状态机（enable 首启用授权快照、依赖拓扑递归启用、依赖缺失落 pending T3/T4、失败落 failed T7/T11 retry、级联拒绝 `KERNEL_DEPENDENCY_CONFLICT`、非法迁移 `KERNEL_INVALID_TRANSITION`；enable 幂等/依赖版本不满足 `KERNEL_DEPENDENCY_VERSION`/环 `KERNEL_DEPENDENCY_CYCLE`）；`restore()` §4.6 启动恢复流程（installed 保持/active 重新启用/starting-stopping 残留回滚/失效偏好清理/依赖失败保持 pending/偏好成环整组 failed）；卸载 T12/T13（builtin 拒绝、依赖者拒绝、目录与 ID 父目录一并移除）；代际（generation）防陈旧 + inFlight 防重入；`stopAll` 逆拓扑；`PLUGIN_LIFECYCLE_EVENTS` 七事件常量与 05.05 §4.1 payload 接口；激活成功后 grantedPermissions 快照自注册表刷新。
  - `index.ts`：装载器公共面全量导出；对 `@chips/{bridge,sdk,cli}` 零运行时依赖（结构视图等价实现）。
- 测试：新增 `tests/loader-install.test.ts`（7 案）、`tests/loader-lifecycle.test.ts`（24 案，含 Bridge 真实链路：registry 命中→权限→Schema 准入→scheduler→handler→响应编码，停用后 `BRIDGE_CAPABILITY_NOT_FOUND`；§4.6 恢复矩阵以第二 loader 实例 + registry.json 残留注入验证）；`tests/loader-contract.test.ts` 补 `plugin:*` 七事件 ID 表与 payload 字段面漂移锁（运行态表锁 + `Equal` 编译期锁，漂移由 tsc 闸红）；`tests/loader-package.test.ts` 既有 19 案不回退。
- 裁决记录（本段）：
  1. 同 ID 重复安装（更新/降级/同版本）在生成表无专用码 → 落 `KERNEL_INVALID_TRANSITION`（不发明码），`details.{pluginId,existingVersion,incomingVersion,rule:'03.04 §4.2[4]'}`。
  2. 激活端口未接内核通道（工单 025 未交付）→ 按 #27「资源管理器未装配」同类诚实回退：`BRIDGE_INTERNAL`（`Object.assign(new Error(...), { code, retryable:false, wire })` 形态），插件落 failed 并发布 `plugin:failed`，正式通道归工单 025（登记不实施）。
  3. `plugin:*` 事件常量单一事实源落 `lifecycle.ts` 的 `PLUGIN_LIFECYCLE_EVENTS` 与 payload 接口；契约套件经运行时表锁 + 编译期字段锁双向锁定（此前「随阶段五补齐」的登记至此销账）。
  4. 激活失败归一（内核 §6.3[4] `Ok(Err)` → `KERNEL_APPLY_FAILED`）：装载器自身抛出的 `LoaderError`（超时、注册冲突）按原码保留；端口抛出的裸错误包装为 `KERNEL_APPLY_FAILED`（`details.{pluginId,cause}`）。
- 收口验收（volta PATH，全部真实退出码）：
  - `npx vitest run tests/loader-contract.test.ts tests/loader-trust-roots.test.ts tests/loader-package.test.ts tests/loader-install.test.ts tests/loader-lifecycle.test.ts > /tmp/r75_vitest.log 2>&1; echo EXIT=$?` → `EXIT=0`（5 套件 84 案全绿：trust-roots 24 + contract 10 + package 19 + install 7 + lifecycle 24；段一收口基线 51 案 → 本段收口 84 案，+33；套件内无 skip）
  - `npm run build:main > /tmp/r75_build.log 2>&1; echo BUILD_EXIT=$?` → `BUILD_EXIT=0`
  - `npx tsc -p tsconfig.json --noEmit > /tmp/r75_tsc.log 2>&1; echo TSC_EXIT=$?` → `TSC_EXIT=2`（他路红项归因：`tests/renderer-frame-channel.test.ts`、`tests/renderer-card-surface.test.ts` 两个红项均在 #74 在途的 renderer 面（禁碰面），与本段 src/loader / tests/loader-* 改动无关；本段范围文件 tsc 零错）
  - `npx eslint src/loader tests/loader-contract.test.ts tests/loader-trust-roots.test.ts tests/loader-package.test.ts tests/loader-install.test.ts tests/loader-lifecycle.test.ts > /tmp/r75_eslint.log 2>&1; echo ESLINT_EXIT=$?` → `ESLINT_EXIT=0`
- 遗留与移交（段三）：
  - 阶段六：`runtime/host-runtime.ts` 工厂位装配 `createCpkPluginLoader` + `production-assembly.ts` 注入 + 组合根 7 案不回退。
  - 阶段七：全量验收闸门 + Electron 承载冒烟。
  - 工单 025（内核激活通道）、工单 028（宿主编译期信任根正式内容）保持登记。

## 段三段（阶段六~七：组合根接线 + 夹具合缝 + 全链验收 · 收口）

- 交付面：
  - **阶段六接线**：`runtime/host-runtime.ts` 增 `HostRuntimeOptions.pluginLoaderFactory?: (deps: IHostPluginLoaderDeps) => IPluginLoaderSurface`（工厂递交宿主能力注册表与 `plugin:*` 事件出口；事件经既有 `publishEvent` 管线向全部已订阅该事件的活动会话广播，05.05 下行口径）；`restorePlugins()`/`stopPlugins()` 工厂注入后委托装载器 `restore()`/`stopAll()`，缺省保持 #27 组合根缺位无操作（口径不变）。`main/production-assembly.ts` 注入：`createRuntime` 时 `openPluginRegistry(<userData>/chips-plugins/registry.json)`（文档非法整表拒绝原样上抛，壳以 `HOST_STARTUP_FAILED` 终止启动，失效关闭）、`pluginsRoot = <userData>/chips-plugins`、信任根 `createEmbeddedTrustRootRegistry()`（内嵌编译期形态，keys 空集失效关闭＝工单 028 口径）、`hostVersion` 取 PAL 宿主快照 `appVersion`；激活端口注入位 `ProductionRuntimeOptions.pluginActivationPortFor` 预留（工单 025 正式通道），缺省未注入 → `enable` 路径 `BRIDGE_INTERNAL` 诚实回退（段二裁决口径不变，登记不实施）。能力注册消费链接真实 registry 面：装载器经工厂递交的 `IHostCapabilityRegistry` 即运行时路由同一实例，service 激活预绑定注册/停用摘除直达 Bridge 路由；#28 document 服务、#27 能力注册面契约对接形态不变。
  - **阶段七合缝 a（夹具再生成链）**：根 `pnpm test:contract` 唯一红为 `tests/contract/tests/cpk-fixtures.test.ts`（packages/bridge 镜像同红）「重建链逐字节不一致」——根因＝`examples/plugins/hello/render.js` 派生漂移（波 C 包体对比+SDK cli 面 #43 合入后重建产物，防丢快照 c6096c85 在库）未同步进 `.cpk` 夹具。处理：核对 render.js 为现行源码的确定性构建产物（生成器重建后逐字节一致，无源改动）后收编为期望态；以段一/段二交付的校验权威语义跑 `generate-cpk-fixtures.mjs` 写模式重建四夹具+checklist.json，五阶段校验矩阵（1 正 3 负）经 `@chips/cli` 正式引擎库面全过，`--check` 复跑 EXIT=0（确定性确认）。校验器与《装载器契约》文档无冲突，未修实现。
  - **阶段七合缝 b（render.js 收编）**：`chips-ecosystem/examples/plugins/hello/render.js` 在途漂移核对后收编为期望态（内容=现行 React+`@chips/ui`+SDK 主入口源码的 vite 生产构建产物，含 ChipsProvider 挂载链与 config/clipboard 能力消费），零手工编辑。
  - **阶段七合缝 c（工单 028 落档）**：按计划书边界口径与事实落档——新建 `项目日志与笔记/工单028-宿主编译期信任根注册表正式内容缺位/任务说明.md`（背景/证据/影响/复现/期望行为/验收口径六节；`resources/trust-roots.json` keys 空集失效关闭为设计内现状而非缺陷，编码统一裁决悬置登记），`问题工单.md` 编号 028 未被占用、按序插入 027/029 之间。
- Electron 承载冒烟（包内 `build:main` 后）：`node ./node_modules/electron/cli.js ./dist/main/self-check.js`，pgrep 口径 `pgrep -f self-check` 取真进程 3 个、存活 27s（≥14s）、运行期 stderr 0 字节、`HOST_STARTUP_FAILED` 0 次；`kill -TERM`（主 Electron 进程）优雅收口，包装器实录 `EXIT=0`、进程全清（pgrep 0）。命令与口径已同步 `packages/host/开发日志.md`。
- 收口验收（volta PATH，全部真实退出码）：
  - `cd chips-ecosystem && pnpm test:contract > /tmp/seg3_contract.log 2>&1; echo EXIT=$?` → `EXIT=0`（tests/contract 63 案、bridge/sdk 镜像 63+63、host 24 案全绿；夹具红清零，且本轮重建链零副作用——render.js 未再漂移）
  - `cd chips-ecosystem/packages/host && npm run build:main > /tmp/seg3_build.log 2>&1; echo EXIT=$?` → `EXIT=0`
  - `pnpm exec vitest run tests/loader-trust-roots.test.ts tests/loader-contract.test.ts tests/loader-package.test.ts tests/loader-install.test.ts tests/loader-lifecycle.test.ts tests/composition-root.test.ts tests/production-assembly.test.ts tests/renderer-engine.test.ts tests/renderer-height.test.ts tests/renderer-frame-channel.test.ts tests/renderer-frame-protocol.test.ts tests/renderer-card-frame-host.test.ts tests/renderer-card-surface.test.ts > /tmp/seg3_host.log 2>&1; echo EXIT=$?` → `EXIT=0`（13 套件 162 案全绿：loader 84 + 组合根 7 + 生产组合根 6 + 渲染 65，零回退）
  - `pnpm exec tsc -p tsconfig.json --noEmit > /tmp/seg3_tsc.log 2>&1; echo EXIT=$?` → `EXIT=0`
- 遗留与移交：
  - 工单 025（宿主 `chips-native` 原生绑定与激活通道）：激活端口注入位已在 `production-assembly.ts`（`pluginActivationPortFor`）与 `host-runtime.ts` 工厂缝就位，正式通道交付后一行注入即通；本路只登记不实施。
  - 工单 028（宿主编译期信任根正式内容）：已按事实落档，Phase 3/4 交付后按验收口径收口；裁决前 `trust-roots.json` 保持空集失效关闭。
  - 生产安装入口（能力面/IPC 暴露 `plugin:*` 管理面）不在本装载器任务范围，属后续波次组合根扩展。
