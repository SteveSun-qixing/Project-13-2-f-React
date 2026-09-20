# RFC-ChipsError 统一裁定（工单024 收口：全生态唯一错误类权威归属、统一形状与四实现分叉逐成员裁决、实施波清单）

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：已裁定（本 RFC 为纯文档面与契约面裁定；本轮 `chips-ecosystem/**` 代码只读，实施波见第八节，由主智能体统一派单验收）
> 关联：`项目日志与笔记/工单024-ChipsError唯一错误类四份实现分叉/任务说明.md`（本单权威）、工单013《RFC-权限码三方收口》（错误码三方一致先例）、《RFC-chips-bridge契约发布面裁定》（结构与编号惯例、§8.6 命名口径先例）、《RFC-G9边界表放行sdk转发边》（G9 边界表 amendment 先例）、`task043《契约-代码漂移审计-2026-09-20》` 面 1 第 5/6/7 条与面 2 第 4 条

---

## 一、背景与动机

《02-SDK-API规范》§6.2 与《01-Bridge-API规范》§2.5 规定全生态只有 `ChipsError` 一个错误类；实测该类存在四处互不兼容的源码级定义，跨包守卫恒假、构造入参三形状并存、兜底策略两套并行，是审计判定的最严重架构级漂移（工单024 全部证据在册，本 RFC 复核时点 2026-09-20 仍成立）。

四处实现与守卫分叉的实测复核（行号以 2026-09-20 重读为准）：

| 位置 | 类定义 | 构造入参 | 守卫 | 归一函数 | 序列化 |
|---|---|---|---|---|---|
| `packages/sdk/src/errors.ts` | `:38`（implements `IChipsError`） | `IChipsErrorInit`（`:11`） | `isChipsError` 结构判定（`:62-68`，不读原型链，测试锚 `errors.test.ts:66-69`） | `toChipsError` 单参（`:85`，兜底 `SDK_UNKNOWN_ERROR`） | 无实例序列化方法 |
| `packages/bridge/src/protocol/errors.ts` | `:23`（implements `IChipsError`） | `IChipsErrorOptions`（`:16`） | 静态 `ChipsError.isChipsError` 走 `instanceof`（`:51-52`）+ 独立结构判定 `isPlainChipsError`（`:66-77`） | `normalizeError`（`:182`，兜底 `BRIDGE_INTERNAL` + `onDiagnostic` 诊断回调） | 实例 `toPlain()`（`:39`）+ 静态 `fromPlain()`（`:55`） |
| `packages/cli/src/errors.ts` | `:118`（不 implements 任何共享接口） | `IChipsErrorOptions` + `exitCode`（`:98,108`） | `hasErrorCode` 仅查 `code`（`:155-162`） | 本地 `normalizeError`（`:165`，兜底 `CLI_COMMAND_FAILED`，未识别异常原文直入 `message`，`:194-195`） | 自由函数 `toErrorObject`（`:236`，`retryable` 缺省时省略） |
| `packages/host/src/preload/chips-error.ts` | `:27`（implements 本包私有 `IChipsErrorShape`） | `IChipsErrorShape`（`:15`） | `isChipsErrorShape`：`code`/`message` 均要求非空（`:57-69`） | `toChipsError` 三参（`:78-82`，`fallbackCode='BRIDGE_INTERNAL'`、`fallbackMessage='宿主内部错误'`；调用点 `preload/bridge.ts:92` 注入 `'宿主通信失败'`） | 实例 `toPlain()`（`:46-53`） |

守卫语义分叉后果（工单024 §三）：bridge 侧 `ChipsError.isChipsError`（`instanceof`）对本包类之外的任何 `ChipsError`（含跨 IPC 还原的普通对象）恒假；四处结构判定的判据（`code` 非空、`message` 非空、`retryable` 类型校验）互不一致。

## 二、消费方面（实测，2026-09-20 全 workspace grep，无幻构消费点）

1. **`@chips/sdk` 面**：主入口冻结值导出六项含 `ChipsError`/`isChipsError`/`toChipsError`（`src/index.ts:21,24`；《02-SDK-API规范》§2.2 导出表 `02.02:37-39,57`，类型 `IChipsErrorInit`/`IChipsError` 亦为主入口冻结项）。SDK 内部消费点：`client/target-invocation.ts:9,37`（reject 前 `toChipsError` 包装）、`client/chips-bridge.ts:23,97`（`bridgeUnavailableError`）、`scaffold/index.ts:21,68`、testing 全套（`assert-chips-error.ts`、`mock-bridge.ts`、`mock-resource.ts`、`codes.ts`）。插件构建产物内嵌该类副本（证据：`examples/plugins/hello/render.js:10` 为编译后的 SDK 类）。**插件对 `@chips/bridge` 零直接依赖**：G9 边界表 `plugins/*/*` 与 `examples/plugins/*` 的 `allowedInternal` 仅 `@chips/ui`、`@chips/sdk`（`tools/gates/gates.config.json` 实测）。
2. **`@chips/bridge` 面**：根入口 `export * from './protocol/index.js'`（`src/index.ts`），`protocol/index.ts:27-41` 发布 `ChipsError`、`createBridgeError`、`isPlainChipsError`、`normalizeError` 与错误码三表。包内消费：`protocol/ipc.ts:176,182-187,207-209,237,266,360`（编解码与兜底）、`core/permission-evaluator.ts:9,261`、`core/capability-registry.ts:12,94`、`core/router.ts:12-13`。静态 `ChipsError.isChipsError` 的全部消费点仅测试文件自身（`protocol/errors.test.ts:45-46`）。
3. **`@chips/cli` 面**：`package.json:38-40` 声明依赖 `@chips/bridge` 与 `@chips/sdk`；G9 放行二者运行时边。全 `src` 对 `@chips/*` 的运行时 import 实测只有一处（`artifacts/permission-catalog.ts:9`，工单013 收口产物）；其余全部走本地 `src/errors.ts`（消费点：`run.ts:9,281`、`plugin-cli/execute.ts:13,249`、`index.ts:14` 及 args/commands/artifacts 各面的 `cliError`/`normalizeError`/`toErrorObject`/`exitCodeForError`）。
4. **`@chips/host` 面**：`package.json` 无任何 `@chips/*` 依赖；preload 消费点 `preload/bridge.ts:15,92`、`preload/resource-handle.ts:19,283`；`src/index.ts:266-267` 从 preload 模块再导出 `ChipsError`/`isChipsErrorShape`/`toChipsError`，**该再导出面对 `@chips/host` 包的外部消费者实测 0 命中**（全 workspace grep `from '@chips/host'` 无结果）。G9 `packages/host` 规则 `allowedInternal` 已含 `@chips/bridge`（无 `typeOnlyInternal` 限制，运行时 import 合规）。同包另有协议镜像面 `protocol/wire.ts:12` `IWireChipsError`、`protocol/error-codes.ts`、`loader/errors.ts`/`loader/codes.ts`（非本单「类」主体，边界备注见第六节 4.3 口径）。
5. **契约测试面**：`tests/contract/src/code/bridge.ts:13-18` 直读 `packages/bridge/src/protocol/errors.ts` 常量；`src/check/permission-errors.ts` 锁定「文档 §9.1 ↔ bridge 常量 ↔ sdk 生成常量」三方一致（工单013 先例）；`tests/sdk-exports.test.ts` 锚定 SDK 主入口导出结构。

## 三、裁定口径（总则）

### 3.1 架构红线与既有约束逐条核对

| # | 约束（出处） | 对本裁定的硬结果 |
|---|---|---|
| R1 | 插件访问系统能力只能经 `window.chips.*` / Bridge / `chips-sdk` 正式链路；插件运行时代码只允许导入 SDK 主入口（AGENTS.md + 《02-SDK-API规范》§2.1；G9 `plugins/*/*` 禁 `@chips/bridge`，见二.1） | 类无论定义在哪，插件侧取值路径必须保持 `import { ChipsError } from '@chips/sdk'` 不变；不允许「插件改 import 桥包」类方案 |
| R2 | SDK 只负责类型化封装，不承载 Host 运行时主实现（AGENTS.md） | 错误模型是平台协议事实，权威定义不应落在 SDK；SDK 以 re-export 承载插件面 = 纯转发，合规 |
| R3 | CLI 是独立进程（Node 工具链） | 类可以同源（构建期打包同一模块），但错误对象永不跨进程共享身份；`exitCode` 等进程内事实不得进入共享错误模型 |
| R4 | host-preload 不能引入 SDK 运行时依赖链 | `@chips/sdk` 依赖 `@chips/scaffold`（`packages/sdk/package.json` dependencies），preload 引 SDK 会把脚手架链路拉进宿主运行时；且 G9 `packages/host` 的 `allowedInternal` 不含 `@chips/sdk`。preload 只能直连 `@chips/bridge`（G9 已放行；`@chips/bridge` 零依赖、`sideEffects: false`，preload 包体影响受控） |
| R5 | 依赖方向：`@chips/bridge` 是零依赖底层（G9 `packages/bridge` `allowedInternal: []`、禁 electron），`sdk → bridge`、`cli → {bridge, sdk}`、`host → bridge` 为在册有向边 | 唯一实现只能落在 bridge 协议层或新底层包；SDK/CLI/Host 单向消费，不存在反向收敛可能 |
| R6 | 不做临时版、不留兼容包袱（AGENTS.md，v1 未发布） | 更名与废弃一律单点收口，不留别名、不留双形状 |

### 3.2 权威归属裁定

**裁定：全生态唯一的 `ChipsError` 源码级类定义归属 `@chips/bridge` 协议层（`packages/bridge/src/protocol/errors.ts`）；`@chips/sdk` 主入口、`@chips/cli`、`@chips/host`（preload 面）一律消费该定义，不再自定义。**

备选方案对比（如实陈述强弱）：

| 方案 | 内容 | 裁决与理由 |
|---|---|---|
| A（采纳） | 归属 `@chips/bridge` 协议层 | ① 依赖方向唯一可行（R5：bridge 是零依赖底层，四条消费边全部已在 G9 在册，其中 host→bridge、cli→bridge 已是运行时放行，sdk→bridge 只差解除 type-only 一处表项）；② 错误模型权威文档即《02-Bridge三层设计》§9，类与 `BRIDGE_ERROR_CODES`/`BRIDGE_ERROR_RETRYABLE`/`BRIDGE_ERROR_MESSAGES`/`createBridgeError`/`normalizeError` 同址共存，retryable 口径零跨包跳转；③ `tests/contract` 已按此址读取 bridge 错误事实（二.5）；④ host preload 注释既有口径「错误类权威定义在 `@chips/bridge`（协议类型归属）」（`packages/host/src/preload/chips-error.ts:10-11`）与 01-Bridge-API §2.5 相互印证，裁定即兑现该集成缺口 |
| B（否决） | 归属 `@chips/sdk` | bridge 不可能反向依赖 sdk（R5 + G9 `allowedInternal: []`），bridge 面（ipc/core 十余消费点，二.2）必然保留第二份实现，分叉依旧；且违反 R2（把平台协议主实现压给 SDK）；host-preload 消费还违反 R4 |
| C（否决） | 独立零依赖底层包（如 `@chips/errors`） | 技术上成立（R5 满足），但为「四字段类 + 两个守卫」新增第五个包的发布、构建、版本、边界规则（G9 需为 4 个消费方各加边）不划算；且错误码三表与 `normalizeError` 等域绑定成员仍须留在 bridge，会把单一错误模型拆成「类与码表分家」两处事实源，削弱工单013 已建立的三方锚定可读性。收益（sdk 免于 runtime import bridge）仅值 G9 一处表项修改，不足以支撑 |
| D（否决） | 四实现保留、文档口径统一 | 守卫假阴性（bridge `instanceof` 恒假面）是运行时行为缺陷而非文字缺陷；正是工单024 主体 |

### 3.3 消费方式裁定（不违反 R1 的关键设计）

1. **SDK 面**：`packages/sdk/src/errors.ts` 改为「`export { ChipsError, isChipsError, type IChipsError, type IChipsErrorInit } from '@chips/bridge'` 式薄再导出 + 保留 SDK 域自有成员（三个 `SDK_*` 码、`bridgeUnavailableError`、单参 `toChipsError`）」。插件 import 路径与 §2.2 冻结导出面逐项不变；`sdk.ChipsError === bridge.ChipsError` 成为可测事实（实施波 C 锚定）。
2. **G9 边界表 amendment（前置，实施波 B）**：`tools/gates/gates.config.json` 的 `packages/sdk` 规则 `typeOnlyInternal` 移除 `@chips/bridge`（`allowedInternal` 维持含之）。理由：`sdk → bridge` 这条有向边在 `package.json` 依赖声明与类型 import 两个层面早已在册（`packages/sdk/package.json` dependencies；`src/types/bridge.ts:12,26` 为 `import type`），本裁定只把该边的 import 形态从 type-only 放开到运行时、且规范上限定用途（见下条），不新增包图边——与《RFC-G9边界表放行sdk转发边》同类「配置面对齐规范面」处置。
3. **SDK→bridge 运行时消费用途边界（规范条款，非门禁条款）**：运行时 import 仅限 `@chips/bridge` 错误模型面（本裁定再导出项）；其余 bridge 成员对 SDK 仍以 `import type` 消费。`@chips/bridge` 根 barrel 为唯一入口、`sideEffects: false`，插件打包器可按 import 面 tree-shaking，仅错误模块进入包体；包体影响以实施波 C 的示例插件构建产物对比为验收证据。
4. **CLI 面**：`packages/cli/src/errors.ts` 保留 CLI 域成员（错误码/文案/退出码映射表、`toCliError` 等，见第四节），类与结构守卫改为 `import { ChipsError, isChipsError } from '@chips/bridge'`（G9 运行时边在册）。
5. **Host-preload 面**：删除 `packages/host/src/preload/chips-error.ts` 的类与三参兜底，改为 `import { ChipsError, isChipsError, normalizeError } from '@chips/bridge'`，并给 `packages/host/package.json` 增加 `"@chips/bridge": "workspace:*"` 依赖声明（G9 运行时边在册）。**该面与 #56 装载器收口共享 host 在途文件，实施排期整体置于 #56 之后**（第八节波 E）。

## 四、统一形状与语义（权威定义，实施波逐字节落地）

### 4.1 形状（`@chips/bridge` `protocol/errors.ts`）

```typescript
/** 跨 Bridge 传输的普通对象结构；全生态唯一结构别名。 */
export interface IChipsError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

/** 唯一构造入参类型（命名沿用《02-SDK-API规范》§6.2 与 §2.2 主入口冻结类型）。 */
export interface IChipsErrorInit {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
  readonly retryable?: boolean;
}

/** 全生态唯一错误类；源码级定义仅此一份。 */
export class ChipsError extends Error implements IChipsError {
  constructor(init: IChipsErrorInit);
  readonly code: string;
  readonly details?: unknown;
  readonly retryable: boolean;          // 归一 boolean，缺省 false
  toPlain(): IChipsError;               // 唯一实例序列化出口
  static fromPlain(value: IChipsError): ChipsError;  // 唯一还原入口
}
```

成员基线 = 现 bridge 类（`packages/bridge/src/protocol/errors.ts:23-63`）三处调整：`IChipsErrorOptions` 更名为 `IChipsErrorInit`；删除静态 `isChipsError`（instanceof 守卫，现消费面仅 `errors.test.ts:45-46`）；`details` 声明为 `readonly details?: unknown`（与构造行为一致，消除 bridge 现形「无 `?` 但可 undefined 赋值」的表述歧义）。`name` 固定 `'ChipsError'`；构造参数一律初始化对象、禁止位置参数（§6.2 既有规则，不动）。

### 4.2 守卫与判定（跨 Realm 策略）

1. **唯一权威判定**：结构守卫 `isChipsError(value: unknown): value is ChipsError`，判据三条合取——`code` 为非空字符串；`message` 为字符串；`retryable` 缺省或为 boolean。不读取原型链。语义「入口宽、出口严」：判定放行即按错误结构消费；本类实例永远通过判定；跨边界普通对象同构即通过。
2. 现四处判据的归属：SDK 版（`errors.ts:62-68`，缺 `code` 非空与 `retryable` 类型两条）与 bridge `isPlainChipsError`（`:66-77`，判据即上述三条，仅谓词目标类型为 `IChipsError`）**收敛为同一函数**：名称取 `isChipsError`（SDK 主入口冻结名），判据取三条合取，谓词收窄到 `ChipsError`（沿用 §5.1「类实例与同构普通对象一并接受」的既有契约表述）；preload `isChipsErrorShape` 的「`message` 也须非空」判据废弃（输入端不设内容门槛，文案质量是生产者侧 §9.1 规则）；CLI `hasErrorCode` 废弃。
3. **跨 Realm 口径**：收敛后全生态仍只有一个类定义，但每个打包上下文（插件 bundle、preload bundle、CLI bundle、各平台组件 bundle）持有各自副本；`instanceof ChipsError` **仅在同一副本的 Realm 内有效**（例：SDK 客户端已对平台 reject 值 `toChipsError` 再包装——`client/target-invocation.ts:37`——故插件 catch 到的是插件 bundle 副本实例，SDK 路径示例中 `instanceof` 成立）。任何可能跨副本的判定（平台 reject 原值、跨 IPC 还原点、工具链消费外部输入）**必须**走 `isChipsError`。禁止把 `instanceof` 用于守卫函数实现。
4. 归一链路（§6.4）逐环节不变：能力实现 → bridge `normalizeError` → 线格式普通对象（`toPlain()`）→ preload `ChipsError.fromPlain`/`new ChipsError` 还原 → SDK `toChipsError` → 插件按 `code` 分支。

### 4.3 序列化口径（`toPlain` / 输出形状）

- 跨 IPC / contextBridge 的传输形态唯一：`toPlain()` 普通对象；`code`/`message`/`retryable` 恒输出（`retryable` 已归一 boolean），`details` 仅在非 `undefined` 时输出（现 bridge 行为，`errors.test.ts:25-38` 锚定；preload 版随之收口）。
- CLI stdout 错误对象（《CLI完整参考》§2.6）改为 `toPlain()` 输出（信封键名映射归 CLI 域，见第四节波 D 备注），废弃条件省略 `retryable` 的旧行为。
- 不引入 `toJSON`：错误对象不经 `JSON.stringify` 直发是既有纪律（结构化克隆 + 显式 `toPlain`），隐式 `toJSON` 会绕开诊断脱敏检查。

### 4.4 错误码类型来源

- 统一类的 `code` 维持 `string`：跨域码值开放（Host 业务码原样透传，§9.1），类定义不携带任何枚举、不为单一域收窄——`BridgeErrorCode`/`PermissionErrorCode` 等派生类型继续作为**构造辅助**（`createBridgeError` 等）的入参类型，不进入类形状。
- 码值权威 = 文档错误码总表；机器面 = `@chips/sdk` 生成常量（`packages/sdk/src/generated/error-codes.ts`，源头 `tools/contract-gen` 解析文档表格）+ `@chips/bridge` 域常量表；三方逐项一致由 `tests/contract`（`src/check/errors.ts`、`check/permission-errors.ts`）锁定——完全沿用已收口的工单013 先例，消费方禁止字符串硬编码。本裁定**不新增、不修改任何错误码**。
- `toChipsError` 的「SDK 只产生三个码」口径（§6.3：`SDK_BRIDGE_UNAVAILABLE`/`SDK_INVALID_SCAFFOLD_OPTIONS`/`SDK_UNKNOWN_ERROR`）与 `normalizeError` 的平台码口径并行不变——分层兜底是设计，不是分叉。

### 4.5 `retryable` 语义与 §九「日志不泄漏」口径对齐

1. `retryable: boolean` 缺省 false；取值权威在各域码表（`BRIDGE_ERROR_RETRYABLE` 等，§9.2 表为 Bridge 域权威）。
2. 语义 = 提示：Bridge/SDK 均不自动重试；`retryable: false` 不得自动重试（§9.4 既有规则，零改动）。
3. 归一兜底与脱敏（§9.1 口径推广为全层统一）：未识别异常 → 所在层的域兜底码（平台侧 `BRIDGE_INTERNAL`、插件侧 `SDK_UNKNOWN_ERROR`、CLI 侧 `CLI_COMMAND_FAILED`），`message` = 该码的通用中文文案；**原始异常文本、堆栈与内部路径一律不进入 `message`**；结构化诊断只进 `details`（形态 `{ name?, cause }`，不含堆栈），完整原始信息经 `normalizeError` 的 `onDiagnostic` 回调写宿主日志，不进入跨边界返回值。
4. 按 3 收敛的两处分叉：preload 三参 `toChipsError`（自定义兜底文案「宿主通信失败」「宿主内部错误」，`chips-error.ts:78-82`、`preload/bridge.ts:92`）废弃，调用点改 `normalizeError(error, { onDiagnostic })`，文案取 `BRIDGE_ERROR_MESSAGES.BRIDGE_INTERNAL`（「平台内部错误」）；CLI `normalizeError` 把原始 `Error.message` 直入 `message` 的行为（`packages/cli/src/errors.ts:194-195`）按 3 收敛（原始文本移 `details.cause`）。
5. CLI 域 `details` 承载路径/参数是《CLI完整参考》§2.6 的明示要求（开发者工具诊断），与「不携带堆栈」不冲突；该差异登记为域规则合法差异，不视为漂移。

### 4.6 CLI `exitCode` 扩展字段裁定

**废弃 `exitCode` 作为错误对象成员。** 理由：① 退出码是 CLI 进程的输出事实，其权威映射表《CLI完整参考》§2.5 本就在 CLI 域；把进程本地控制流编码进全生态共享形状，正是「构造入参三形状并存」的病根；② 统一形状冻结为四字段，任何扩展字段都会诱导跨层按私有字段对齐（工单024 §三 第 2 条）。替代机制：CLI 进程内维护 `WeakMap<ChipsError, CliExitCode>` 旁表（`registerExitCodeHint(error, code)`），`exitCodeForError(error) = 旁表提示 ?? 码值映射（§2.5 表）?? 1`；唯一显式提示点 `plugin-cli/execute.ts:249`（任务失败终态固定 7，失败类别优先于码值）迁移到旁表登记。错误对象抛出值身份在同进程 catch 链上保持不变（`normalizeError`/`toCliError` 对本类实例原样返回），旁表无丢失路径；`exitCode` 永不跨进程、永不进输出。`CliInterruptedError`（`cli/src/errors.ts:147`）**保留**：Ctrl+C 控制流哨兵，退出码 130 无错误码（§2.5），不携带 `code` 字段、不进入错误模型输出链路，非「同形错误类」，不属唯一化对象。

## 五、差异逐条裁决表（四实现全成员，保留 / 收敛 / 废弃 + 依据）

### 5.1 `packages/sdk/src/errors.ts`

| 成员（实测行号） | 裁定 | 依据 |
|---|---|---|
| `IChipsErrorInit`（`:11-16`） | 收敛：更名/定义移入 bridge，SDK 再导出 | §4.1；名称为 §2.2 主入口冻结类型（`02.02:57`），冻结名存活、定义地唯一化 |
| `IChipsError`（`:19-24`） | 收敛：唯一化到 bridge（现状两处同构定义并存本身即分叉） | §4.1；R2/R5 |
| `SDK_BRIDGE_UNAVAILABLE`/`SDK_INVALID_SCAFFOLD_OPTIONS`/`SDK_UNKNOWN_ERROR`（`:27-33`） | 保留（SDK 域） | §6.3 三码口径；SDK 自有错误是 §6.2 之外唯一合法域内实现 |
| `ChipsError` 类（`:38-52`） | 废弃本地定义 → 再导出统一类 | §3.2 |
| `isChipsError`（`:62-68`） | 收敛：判据按 §4.2 三条合取补严（定义地移 bridge，名称与 SDK 主入口导出处保留） | §4.2；两条缺失判据是审计面 1 第 6 条判据不一致的一侧 |
| `toChipsError`（`:85-113`） | 保留（单参、§5.2 规则表逐条不变），实现基座换统一类 | §4.2 条 4 归一链路插件环节 |
| `bridgeUnavailableError`（`:120-126`） | 保留（SDK 域工厂） | `client/chips-bridge.ts:97` 在册消费点 |
| `UNKNOWN_ERROR_MESSAGE`（`:35`） | 保留（模块私有） | §5.2 通用中文文案 |

### 5.2 `packages/bridge/src/protocol/errors.ts`（定义地）

| 成员（实测行号） | 裁定 | 依据 |
|---|---|---|
| `IChipsError`（`:9-14`） | 保留：唯一结构别名 | §4.1 |
| `IChipsErrorOptions`（`:16-21`） | 废弃：更名为 `IChipsErrorInit`（含 `protocol/index.ts:39` 导出名与包内引用面） | §4.1、R6 不留别名 |
| `ChipsError`（`:23-63`） | 保留：全生态唯一实现；基线三调整见 §4.1 | §3.2 |
| `toPlain()`（`:39-49`） | 保留：唯一序列化口径 | §4.3 |
| `static isChipsError`（`:51-53`） | 废弃：instanceof 守卫跨副本恒假（工单024 证据 2）；唯一消费面为自身测试 `errors.test.ts:45-46`，随波 A 改结构守卫 | §4.2 |
| `static fromPlain()`（`:55-62`） | 保留：唯一还原入口 | §4.2 条 4 |
| `isPlainChipsError`（`:66-77`） | 收敛：更名 `isChipsError`（判据即本文三条合取），`protocol/ipc.ts` 六处与 `protocol/index.ts:29` 同步 | §4.2；根 barrel 已发布 `isPlainChipsError` 名，生态内消费者实测仅 bridge 包内（二.2），更名无外部破坏面 |
| `BRIDGE_ERROR_CODES`/`BridgeErrorCode`/`BRIDGE_ERROR_RETRYABLE`/`BRIDGE_ERROR_MESSAGES`（`:80-124`） | 保留：Bridge 域权威表 | §9.2；§4.4 |
| `PERMISSION_ERROR_CODES`/`PermissionErrorCode`/`KERNEL_INVALID_TRANSITION`（`:132-143`） | 保留：零改动 | 工单013 已收口，三方锚定在册 |
| `createBridgeError`/`ICreateBridgeErrorOptions`（`:145-162`） | 保留 | ipc/core 在册消费面（二.2） |
| `normalizeError`/`INormalizeErrorOptions`/`isAbortError`（`:164-194`） | 保留：平台侧归一唯一实现；新增规范地位 = preload 还原/兜底的唯一入口（§4.5 条 4） | §9.1 |

### 5.3 `packages/cli/src/errors.ts`

| 成员（实测行号） | 裁定 | 依据 |
|---|---|---|
| `CliExitCode`/`EXIT_CODE_SET`/`CLI_EXIT_CODES`/`CROSS_DOMAIN_EXIT_CODES`/`CLI_ERROR_MESSAGES`/`CliErrorCode`/`exitCodeForCode`（`:11-87,256-266`） | 保留：CLI 域（§2.5 权威表的执行面） | §4.4 域码表原则 |
| `IChipsErrorShape`（`:90-95`） | 废弃：统一用 bridge `IChipsError` | §4.1 |
| `IChipsErrorOptions`（`:98-109`，含 `exitCode`） | 废弃：构造入参统一 `IChipsErrorInit`；`exitCode` 移除 | §4.6 |
| `ChipsError`（`:118-141`） | 废弃本地定义 → `import { ChipsError } from '@chips/bridge'`（G9 边在册） | §3.2、R3 |
| `CliInterruptedError`（`:147-152`） | 保留 | §4.6 |
| `hasErrorCode`（`:155-162`） | 废弃：统一 `isChipsError` | §4.2 |
| `normalizeError`（`:165-196`） | 收敛：更名 `toCliError`（消除与 bridge `normalizeError` 的同名混淆），判据走统一守卫，未识别异常按 §4.5 条 3 脱敏（原文进 `details.cause`，`message` 用 `CLI_COMMAND_FAILED` 表文案），`exitCode` 载体改旁表 | §4.5、§4.6；消费点 `run.ts:9,281`、`plugin-cli/execute.ts:13` |
| `cliError`/`cliErrorWithExitCode`（`:199-233`） | 收敛：`cliError(code, message?, details?, retryable?)` 保留；`cliErrorWithExitCode` 改为「构造 + `registerExitCodeHint`」组合（签名收敛为 `toCliError` 家族），调用点 `execute.ts:249` 同步 | §4.6 |
| `toErrorObject`（`:236-253`） | 废弃：改 `error.toPlain()`（stdout 信封的键名映射留在 `output/result.ts` 信封层） | §4.3 |
| `exitCodeForError`（`:269-271`） | 收敛：读旁表 + 码值映射（§4.6 公式） | §4.6 |

### 5.4 `packages/host/src/preload/chips-error.ts`

| 成员（实测行号） | 裁定 | 依据 |
|---|---|---|
| `IChipsErrorShape`（`:15-24`） | 废弃：`import type { IChipsError } from '@chips/bridge'` | §4.1；消除「本包私有形状」镜像面 |
| `ChipsError`（`:27-54`） | 废弃本地定义：直连 bridge 类（G9 host→bridge 运行时边在册，R4 合规）；该文件自身注释既认「权威定义在 @chips/bridge」（`:10-11`），本裁定兑现其「交付后单点收敛」预留 | §3.2 |
| `isChipsErrorShape`（`:57-69`） | 废弃：统一 `isChipsError`（`message` 非空判据按 §4.2 条 2 废弃） | §4.2 |
| `toChipsError` 三参（`:78-98`） | 废弃：还原点改 `ChipsError.fromPlain`，兜底改 `normalizeError(error, { onDiagnostic })`；`fallbackCode/fallbackMessage` 参数面整体消失，「宿主通信失败」等私有文案废弃 | 工单024 证据 3、§4.5 条 4 |
| 调用点 `preload/bridge.ts:15,83,92-97` | 收敛：类 import 换 bridge 来源；`:92` 改 `normalizeError`；`:83,94-97` 构造面随统一类生效 | 同上 |
| 调用点 `preload/resource-handle.ts:19,283` | 收敛：`:283` 改 `normalizeError` | 同上 |
| `src/index.ts:266-267` 再导出面 | 废弃：外部消费者实测 0 命中（二.4），不再对外再导出错误面；host 内部与测试一律直连 `@chips/bridge` | 无幻构消费方原则 |
| `tests/preload-chips-error.test.ts` | 收敛：类/守卫面并入 bridge 测试面（波 A）；host 侧保留调用点行为测试（transport 失败 reject `BRIDGE_INTERNAL`、还原保真） | §4.2/§4.5 行为锚定 |

## 六、边界备注（非本单裁定面，登记不处置）

1. **host 主进程协议镜像面**：`protocol/wire.ts:12` `IWireChipsError`（+`:114` `isWireChipsError`）、`protocol/error-codes.ts`、`loader/errors.ts`/`loader/codes.ts`、`runtime/capability/registry.ts`、`capabilities/document/errors.ts:117` 注释预留的「依赖边打通后单点收敛」——均为壳主进程线格式与装载器域成员，形状与统一 `IChipsError` 同构是既有约定；其类型面收敛（`IWireChipsError` → `import type IChipsError`）与 `@chips/bridge` 依赖边声明一并随 **#56 装载器收口** 处理，本 RFC 只锁定其形状不得再分叉。
2. **Rust 侧 `ChipsError`（thiserror）**：与 TS 侧同构映射是 §6.1 既有约定，`crates/chips-parser` 等在途面不在本单范围；TS 收敛不触发其任何改动。
3. **三类版本**：纯 TS 协议面收口，`CORE_ABI_VERSION` 与线格式（四字段普通对象）零变化；`chip_standards_version` 无关。
4. **示例文档中的 `instanceof` 面**：全库 grep 实测另有 9 处示例使用 `instanceof ChipsError`（`01.06:150,204`、SDK `02.03:208`、`06.08:67`、`08.09:52`、三层 `02.03:150`、`11.18:95`、调试 `07.02:82`、核心 `03.05:239`——末者为 Neon 示例面的 Rust `ChipsErrorClass`，按 3.3 节序列化/判定口径复核）；判定口径按 §4.2 条 3 双轨：SDK 路径示例（错误值必过 `toChipsError` 再包装，如 SDK `02.03:208`）instanceof 同副本成立、可保留；裸 `window.chips`/跨边界路径示例改 `isChipsError`。逐文件清扫列入实施波 F，本轮只改第七节所列五处权威锚点文档。

## 七、文档面对齐（本轮已执行，均为不依赖代码落地的裁定口径）

1. **《01-Bridge-API规范》二、接口定义（`01.02`）§2.5**：唯一类归属条款（bridge 协议层定义、各包消费、`IChipsErrorInit` 统一命名）；「可用 `instanceof` 判定」条改为 §4.2 条 3 双轨口径（结构守卫为跨边界唯一权威）；补 `toPlain()`/`fromPlain()` 传输与还原成员。版本行 v1.0.0→v1.1.0。
2. **《02-Bridge三层设计》九、错误归一（`02.09`）§9.1**：类定义唯一归属与 re-export 关系条款（`@chips/sdk` 继续「导出错误类」，实现同源）；§9.3 示例的 `instanceof` 判定改 `isChipsError`（其 import 行随之取 `@chips/sdk`——该守卫在实施波落地前已由 SDK 导出处在同名函数，示例语义即时有效且更严格方向一致）。版本行 v1.0.0→v1.1.0。
3. **《02-SDK-API规范》五、辅助函数（`02.05`）§5.1**：`isChipsError` 判据行收敛为三条合取口径；§5.2 归一规则表不动（与 `packages/sdk/src/errors.ts:85-113` 实测一致）。版本行 v1.0.0→v1.1.0。
4. **《02-SDK-API规范》六、错误类与归一（`02.06`）§6.1/§6.2**：§6.1 补唯一实现归属与跨 Realm 判定条款；§6.2 类形状块与成员表补 `toPlain()`/`static fromPlain()`、构造入参类型统一命名条款；§6.3 三码表与 §6.4 归一链路不动。版本行 v1.0.0→v1.1.0。
5. **《02-TypeScript编码规范》八、错误处理（`02.08`）§8.1**：原示例接口名 `IChipsErrorOptions` 与裁定统一命名冲突，随裁定改 `IChipsErrorInit`；条款行补唯一归属（bridge 定义、SDK 薄再导出消费）、禁自定义同形错误类、守卫双轨口径一句。版本行 v1.0.0→v1.1.0。
6. **不动项（改前重读代码复核结论）**：错误码值零增减 → 《04-能力契约规范》§十一、《08-权限系统设计》§9.1、《02-Bridge三层设计》§9.2 码表全部零改动；《CLI完整参考》§2.5/§2.6 的输出形状口径（`retryable` 恒带、退出码载体）依赖代码落地，随实施波 D 同步，本轮不改；《02-SDK-API规范》§2.2 主入口导出清单（`02.02`）零改动（冻结面按 §3.3 保持）；《06-资源协议规范》§7.37 行「`ChipsError` 是唯一错误类」既有表述以 §9/01-Bridge 为准，随锚点文档自动对齐，零改动。
7. **AGENTS.md 文档纪律**：上述每处修改前均已重读对应实现（第一、二节行号即复核证据），文档表述与实际代码不符的存量口径（§2.5 instanceof 条、§5.1 两判据条）以本裁定为准修正。

## 八、实施波清单（按文件面分组；依赖偏序；验收命令统一在 `chips-ecosystem/`、`export PATH="$HOME/.volta/bin:$HOME/.cargo/bin:$PATH"` 执行，退出码以 `> /tmp/x.log 2>&1; echo EXIT=$?` 口径记录）

| 波 | 文件面 | 内容 | 验收命令 | 依赖 |
|---|---|---|---|---|
| A | **bridge 面**：`packages/bridge/src/protocol/errors.ts`、`protocol/index.ts`、`protocol/ipc.ts`、`core/router.ts`、`core/capability-registry.ts`、`core/permission-evaluator.ts`、`protocol/errors.test.ts` | §4.1 基线三调整；`isPlainChipsError`→`isChipsError`（含 6 处 ipc 调用点与导出面）；删除静态 instanceof 守卫（测试改结构守卫断言）；吸收原 host 面「判据/序列化」测试点 | `pnpm --filter @chips/bridge run build`、`run test`、`run typecheck`；`pnpm gates:contracts` | 无（最先执行） |
| B | **G9 边界面**：`tools/gates/gates.config.json`、`tools/gates/tests/**`（fixture 用例：sdk runtime-import bridge 应放行、其他未放行边仍拒、生产配置锚点防漂移）、`tools/gates/README.md`/`开发计划.md`/`开发日志.md` 同步 | §3.3 条 2 表项 amendment（先例：RFC-G9 放行 sdk→scaffold 的同型处置） | `pnpm gates:boundaries`、`pnpm gates:all`、`pnpm gates:test` | 无（与 A 并行；须先于 C） |
| C | **sdk 面**：`packages/sdk/src/errors.ts`（薄再导出 + SDK 域成员保留）、`errors.test.ts`、`index.test.ts`（补「与 bridge 类同源」断言：`sdk.ChipsError === bridge.ChipsError`、守卫/归一同函数断言）、示例插件构建包体对比记录 | §3.3 条 1/3；`toChipsError` §5.2 规则表行为逐条回归 | `pnpm --filter @chips/sdk run build`、`run test`、`run typecheck`；`pnpm --filter @chips/testing run test:contract`；示例插件（hello）build 产物尺寸对比 | A、B |
| D | **cli 面**：`packages/cli/src/errors.ts`、`run.ts`、`plugin-cli/execute.ts`、`index.ts`、`output/result.ts` 及各 `cliError` 调用文件、cli 测试面；《CLI完整参考》`07.02` §2.6 口径同步（`retryable` 恒带、`exitCode` 不出现于输出） | §4.5 条 4、§4.6、§5.3 全部收敛项 | `pnpm --filter @chips/cli run build`、`run test`、`run typecheck` | A |
| E | **host-preload 面（待 #56 装载器收口后执行）**：删除 `packages/host/src/preload/chips-error.ts`（归档至 `packages/host/归档/`，禁直删）、`packages/host/package.json` 增 `@chips/bridge` workspace 依赖、`preload/bridge.ts`、`preload/resource-handle.ts`、`src/index.ts:266-267`、`tests/preload-*.test.ts`；第六节 1 的 `IWireChipsError` 类型面收敛一并按 #56 排期合缝 | §5.4 全部收敛项 | `pnpm --filter @chips/host run build:preload`、`run test`、`run typecheck` | A、**#56** |
| F | **契约锚点 + 文档清扫面**：`tests/contract/`（新增锚：全 `packages/*/src` 源码面 `export class ChipsError` 命中唯一性 = 仅 bridge 定义处；负例注入风格：自定义第二份类即红）；§六.4 所列 9 处示例文档双轨清扫；`pnpm test:contract` 全链 | 防工单 024 型漂移再发（先例：工单013 三方锚定） | `pnpm -r run test:contract`；`python3 "项目日志与笔记/task043-生态梳理/工具/检查文档链接.py"` == 0 | A、C、D（E 可后置于本波，锚点先覆盖四包面再扩 host 主进程面） |

依赖图：`A → {C, D, F}`；`B → C`；`A + #56 → E`。工单024 收口判定：A–F 全波验收绿后，`问题工单.md` 024 行置「已收口」并回写结论。

## 九、影响范围

- **受影响子系统**：`@chips/bridge`（定义地基线微调）、`@chips/sdk`（errors 面改再导出，插件可见面零变化）、`@chips/cli`（本地类废弃 + 归一/退出码机制重排，stdout 形状字段集不变）、`@chips/host`（preload 面收敛，依赖声明新增一条 G9 已放行边）、`tests/contract`（新锚点）、`tools/gates`（一处边界表项 + fixture）。
- **不变面**：插件 import 路径、SDK 主入口冻结导出、IPC/contextBridge 线格式（四字段普通对象）、全部错误码值、Rust 侧、`CORE_ABI_VERSION`。
- **门禁**：G8/G9 波内联动（B/F 波）；`docs:check` 与链接校验在文档面改动后即时复验（本轮已跑，见第十节）。

## 十、实施与验证（本轮）

1. 本轮实施：第一节至第八节为纯裁定与文档面；第七节 1–4 号文档已同步落地；`问题工单.md` 024 行推进为「RFC 已裁定、实施波待派」；工单024 `任务说明.md` 末尾追加裁定记录。
2. 本轮证据命令（2026-09-20 实测）：
   - `grep -rn "export class ChipsError" chips-ecosystem/packages/*/src --include="*.ts"` → 四处命中（本单主体证据复验仍成立，收敛后该命令应且仅应命中 bridge 一处，为波 F 锚点前身）。
   - 消费面 grep 记录见第二节各行内引用位置。
   - 链接校验：`python3 "项目日志与笔记/task043-生态梳理/工具/检查文档链接.py"` 退出码 0（记录于工单024 任务说明裁定记录）。
3. 评审结论：**接受（本 RFC 正文即裁定）**。关联 ADR 判定：属「契约裁定→以实现收敛」的实施前置件，不推翻既有 Bridge 分层设计，不新增 ADR；若主智能体认为「错误模型唯一实现归属 bridge 协议层」值得独立决策留痕，可取材第四节直接补 ADR。

---

**文档结束**
