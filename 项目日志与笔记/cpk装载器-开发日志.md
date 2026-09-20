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
