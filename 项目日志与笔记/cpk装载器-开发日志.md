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
