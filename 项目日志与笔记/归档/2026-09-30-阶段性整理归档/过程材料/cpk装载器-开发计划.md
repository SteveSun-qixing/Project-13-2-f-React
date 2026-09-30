# cpk装载器-开发计划（任务 #56 · W2 波次 P0-3）

- 交付对象：`chips-ecosystem/packages/host/src/loader/**`（owner 唯一新目录）+ `tests/loader-*.test.ts` +
  `src/main/main.ts`/运行时装配面最小接线。
- 前置已验收：#34 真实 Ed25519 签名 .cpk 夹具链（`tests/e2e/fixtures/cpk/`）、#49 真 Electron PAL 承载
  （`604b5863`）、#27 Host 生产组合根（`ef84e367`，`tests/composition-root.test.ts` 7 案不得回退）、
  #43 SDK CLI 面（`3510eca1`）。
- 禁区：`src/capabilities/document/**`、`tests/document-*`、`tests/helpers/document-fake-ports.ts`（R28 并行）；
  `packages/cli/**`（R46 并行；`src/artifacts/{cpk-validate,zip,trust-roots,manifest,permission-catalog}.ts`
  只读参考）；`packages/sdk/**`、`crates/**`、03.06/07.02/07.03 文档分册（R46 在修）。
- 边界口径：《01-薯片内核设计》§六——「清单校验、包读取与安装由插件管理层完成」；Host 装载器即插件管理层
  TS 侧主体。插件代码执行（`PluginRunner.apply/stop`）划归内核/Neon 通道（工单 025 开放），装载器以契约
  定义的激活端口接口编程；信任根正式内容供给源（编译期注册表密钥材料）Phase 3/4 未交付，登记工单 028，
  装载器侧以夹具信任根材料经正式注入面完成本层验证。无 TODO/占位/临时实现。

## 模块设计（`packages/host/src/loader/`）

结构与风格沿 `src/protocol/error-codes.ts`（结构视图先例）与 `src/capabilities/document/**`（模块分面先例）。
Host 对 `@chips/{bridge,sdk,cli}` 零运行时依赖：CPK/KERNEL 错误码、ZIP Store 读取、manifest 校验、contentHash
签名口径均为主进程侧结构视图等价实现，逐项一致由漂移锁测试对 `@chips/sdk` 生成源文本断言。

| 文件 | 职责 | 权威 |
|---|---|---|
| `codes.ts` | `CPK_ERROR_CODES`（11 码）+ 生命周期域 `KERNEL_*` 引用子集 + retryable/简体中文文案表 + `loaderWireError` 构造 `IWireChipsError` | 03.08 §八、01.06 §6.7、生成表 |
| `limits.ts` | `CPK_LIMITS`（归档/总字节/成员数/单文件/manifest/入口/路径长/深度）+ `LIFECYCLE_APPLY_TIMEOUT_MS=30000`、`LIFECYCLE_STOP_TIMEOUT_MS=10000` | 03.04 §四、01.06 §6.7 |
| `types.ts` | `PluginRole/PluginState/PluginSource`、`IPluginRecord`、`IPluginDependency`、清单归一形态 | 03.03 §3.3 |
| `errors.ts` | `LoaderError`（携带 `IWireChipsError` 面，`retryable:false`） | 03.08 |
| `zip.ts` | ZIP Store 读取器：EOCD/中心目录/本地头/CRC32；拒 ZIP64、多卷、加密、method≠0、extra 字段、重复与大小写重复路径、尺寸不符 | 03.02、03.05 §5.2[1] |
| `provider.ts` | `ICpkPackageProvider` Provider 口径：`.cpk` 归档态 与 开发目录态（§2.7）差异在边界内吸收；目录态仅跳过归档与签名两阶段 | 03.05、03.06 |
| `manifest.ts` | `manifest.yaml` 解析与校验（必填/反向域名 ID/semver/角色/`runtime.targets`/`engines.chips` 门禁/权限目录结合/各域字段），权限词表复用 host `runtime/capability` 已知权限面 | 03.02 §5.2[3]、03.05 |
| `signature.ts` | `signature.json`（`chips-signature-v1`）解析、contentHash 重算比对（成员按路径字节序 `path\nsha256hex\n` 拼接，排除 `signature.json`）、Ed25519 验签（`node:crypto`）、渠道规则（builtin 必签 / user 缺签=未签名发布者判定交正式授权面、无效签=拒绝 / development 跳过） | 03.06 |
| `trust-roots.ts` | `ITrustRootRegistry` + 两种正式形态归一：宿主编译期 `chips-trust-roots-v1`（keys[] Base64 原始公钥，经 `trust-roots.embedded.json` 内嵌，当前 keys=[] 即未注册密钥全集→签名包一律按未注册拒绝，**失效关闭**）与夹具/库面 `{version,trustRoots:{keyId:SPKI PEM}}`；撤销=keyId 不在表 | 06.02-06 §二、02.07-02 §7.3 |
| `validate.ts` | 五阶段流水线：archive→layout→manifest→signature→hash/落盘前置；安装哈希 `"sha256:"+SHA-256(整包字节)` | 03.05 §五 |
| `install.ts` | 临时目录写入→全量校验→原子重命名落盘 `pluginsRoot/<id>/<version>/`；失败清理不留半成品；同 ID 更新/降级拒绝（§4.2[4]） | 03.05、03.04 §4.2 |
| `registry.ts` | 注册表持久化（`registry.json`）：安装集合/启用偏好/授权集合；运行态不持久化；加载时 `starting/stopping` 残留回滚为 `installed` | 03.03 §3.4 |
| `activation.ts` | `IPluginActivationPort`（内核 §6.1 `PluginRunner` 的 TS 契约视图：`apply(ctx,config)` 30s 上限、`stop(ctx)` 10s 上限）+ 装载器提供的激活上下文（能力注册回调、事件发布、配置只读快照——命名空间未登记时生效值为空对象，符合 10 §2.5） | 01.06 §6.1/§6.7 |
| `lifecycle.ts` | `createCpkPluginLoader`：T1–T14 状态机（enable 首启用授权快照、依赖拓扑、pending/failed、级联拒绝 `KERNEL_DEPENDENCY_CONFLICT`、非法迁移 `KERNEL_INVALID_TRANSITION`）、`restore()` §4.6 流程、`IHostCapabilityRegistry` 注册/摘除（仅 service 角色经激活上下文预绑定注册，04.24）、生命周期事件 `plugin:*`（05.05 payload） | 03.03 §3.2、03.04、05.05 |
| `index.ts` | 装载器公共面导出 | — |

过期口径裁决：cpk 签名域契约面无独立「过期」错误码/字段（各分册 grep `过期|expiry|expiresAt|notAfter` 0 命中），
密钥撤销与过期统一落「keyId 不在信任根表 → `CPK_SIGNATURE_INVALID`」的契约语义（06.02-06：撤销=移除 keyId），
负矩阵按此逐码断言，不放宽、不发明码。

## 接线面（最小、只增不改语义）

- `runtime/host-runtime.ts`：`HostRuntimeOptions` 增 `pluginLoaderFactory?: (deps: { registry; emitEvent }) => IPluginLoaderSurface`；
  `restorePlugins()`/`stopPlugins()` 在工厂存在时委托装载器 `restore()`/`stopAll()`，缺省保持 #27 文档化无操作
  （组合根缺位口径不变，7 案组合根测试不得回退）。
- `main/production-assembly.ts`：注入工厂——`pluginsRoot = <userData>/chips-plugins`、内嵌编译期信任根（失效关闭）、
  `hostVersion` 取包版本、激活通道经 `activationPort?` 注入位；未注入激活通道时 `enable` 路径按 #27
  「资源管理器未装配」同类诚实回退报内部错误（正式通道=工单 025 范围），自检/启动链不受影响、stderr 0 字节不回退。
- `main/main.ts`：如装配序需要则最小透传，不改现有阶段。

## 依赖

- `yaml@2.8.2`（ISC）：`manifest.yaml` 解析。Host 首个运行时依赖；版本与 `tools/scaffold/package.json` 锁致一致
  （生态既选事实源），主进程 vite 构建打包进 `dist/main`（外部化仅 `electron`/`node:`/`*.node`）。
  不 import `@chips/cli`（架构边界+R46 在途）。

## 测试（`packages/host/tests/loader-*.test.ts`）

1. `loader-contract.test.ts`：CPK/KERNEL 码与 `@chips/sdk` 生成源文本逐项漂移锁（沿 `document-capability-contract.test.ts` 先例）；事件 ID/payload 面。
2. `loader-package.test.ts`：正夹具 `hello-0.1.0.cpk` 全链（解包→五阶段→原子落盘→注册表记录→事件 `plugin:installed`）；
   负矩阵逐码：篡改签名/错误 contentHash/未注册 keyId→`CPK_SIGNATURE_INVALID`(stage=signature)、
   撤销（安装期两表对照）→同上、CRC 破坏→`CPK_ARCHIVE_INVALID`、缺 manifest→`CPK_MANIFEST_MISSING`、
   坏 manifest/未知权限/engines 不满足→`CPK_MANIFEST_INVALID`/`CPK_ENGINE_UNSUPPORTED`、布局错位→`CPK_LAYOUT_INVALID`、
   缺入口→`CPK_ENTRY_MISSING`、原生载荷→`CPK_NATIVE_PAYLOAD`、路径穿越→`CPK_PATH_UNSAFE`、超限→`CPK_LIMIT_EXCEEDED`、
   builtin 缺签→`CPK_SIGNATURE_REQUIRED`；失败无残留断言。
3. `loader-lifecycle.test.ts`：状态机全迁移（含 pending 依赖等待→就绪自动续、failed retry、stopping 超时 10s 不阻断、
   apply 30s 超时 `KERNEL_LIFECYCLE_TIMEOUT`、非法迁移/卸载前置、依赖级联拒绝、§4.6 恢复矩阵、遮蔽与偏好清理）；
   service 激活经正式端口注册能力→Bridge 路由真实链路调用（不绕行）；`plugin:loaded{pluginId,version,role}` payload。
4. `loader-trust-roots.test.ts`：两形态归一、Base64 原始公钥 JWK 验签闭环、SPKI PEM 验签闭环、空表失效关闭（内嵌注册表面）。

## 工单

- 新增 `工单028-宿主编译期信任根注册表正式内容缺位`：登记「`packages/host/resources/trust-roots.json` 正式通道
  与密钥材料（Phase 3/4）、SPKI-PEM 与 Base64 原始公钥编码统一裁决」未交付事实；只写问题/影响/证据/验收。
- 激活通道（宿主未接原生绑定且缺激活与会话通道）沿用开放中工单 025，不重复立单。

## 阶段

1. 计划落档（本文）。
2. 结构视图底座：codes/limits/types/errors/zip + 漂移锁测试先绿。
3. 校验流水线：provider/manifest/signature/trust-roots/validate + 负矩阵夹具测试。
4. 安装与注册表：install/registry + 正夹具落盘链。
5. 生命周期：activation/lifecycle + 状态机/事件/Bridge 链路测试。
6. 接线：host-runtime 工厂位 + production-assembly 注入 + 组合根 7 案不回退 + `yaml` 依赖安装。
7. 验收闸门（全部重定向 /tmp、无斜杠文件名、真实退出码）：
   - `cd chips-ecosystem/packages/host && npx vitest run tests/loader-* tests/composition-root.test.ts > /tmp/r56_vitest.log 2>&1; echo EXIT=$?` → 0
   - `npm run build:main > /tmp/r56_build.log 2>&1; echo EXIT=$?` → 0；`npx tsc -p tsconfig.json --noEmit > /tmp/r56_tsc.log 2>&1; echo EXIT=$?` → 0（R28 在途红项逐项归因）
   - `npx eslint src/loader tests/loader-* src/main > /tmp/r56_eslint.log 2>&1; echo EXIT=$?` → 0
   - Electron 承载冒烟：`node ./node_modules/electron/cli.js ./dist/main/self-check.js`，pgrep 取真进程、存活 ≥14s、
     stderr 0 字节、`HOST_STARTUP_FAILED` 0 次、`pkill` 收尾，证据（pid/时长/stderr 字节数）入日志。
8. 每阶段追加 `项目日志与笔记/cpk装载器-开发日志.md`；收口追加 `packages/host/开发日志.md` 接管段；若轮次将尽，
   先写完成态与「遗留与移交」。
