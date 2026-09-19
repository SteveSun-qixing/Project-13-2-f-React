# Bridge 与能力体系

> 版本：v1.0.0
> 日期：2026-09-19
> 状态：正式版
> 适用范围：Bridge 三层职责、对外唯一接口形状、三条链路、二进制信封、会话与身份、能力注册与权限判定、超时取消并发与错误归一；术语、类型与错误码以《本轮架构收口裁决》与契约文档为准

---

## 一、定位与三层职责

Bridge 是插件访问平台的**唯一门**（R17）：插件访问系统能力只能经 `window.chips`，不存在第二个入口。

| 层 | 职责 | 明确不负责 |
|---|---|---|
| 插件层 | 发起请求、订阅事件、创建句柄、按 `ChipsError.code` 处理结果 | 身份声明、授权判断（输入一律不可信） |
| Bridge 层 | 会话解析、能力注册表、权限判定、JSON Schema 校验、路由、超时 / 取消 / 并发、事件通道、错误归一 | 业务实现；Cordis 生命周期 |
| Host 层 | 能力实现、系统 API 封装、资源级二次约束（路径安全、域名白名单） | 不重复权限与校验；不反向调用插件 |

分层落地：

- Bridge 核心与能力实现运行在**主进程**；渲染进程 preload 仅做转发、订阅登记、错误还原与快速失败预检（预检不是安全边界）。
- 平台自身调用同样过注册表、权限与校验，不绕行、不短路。
- 插件发布事件必须走能力 `event:publish`，没有独立发布通道。

权威：[《Bridge 三层设计》](../../../薯片生态文档库/01-架构设计/01-子系统设计/02-Bridge三层设计.md)。

---

## 二、权威接口形状

### 2.1 `IChipsBridge`（对外唯一形状，R2）

```typescript
interface IChipsBridge {
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription;
  resource(uri: string): IResourceHandle;
}

interface ISubscription {
  dispose(): void;
}
```

- **不包含 `context()`**：插件上下文由 Cordis 注入的 `ctx` 提供。
- `window.chips` 暴露与 `IChipsBridge` 相同的方法面；不得额外暴露 `ipcRenderer`、`process`、`require` 等原始对象。
- 方法面冻结：新增 / 删除方法必须走 RFC 与评审。

### 2.2 `ICapability`（Host 侧注册形状）

```typescript
interface ICapabilityContext {
  readonly signal: AbortSignal;     // 会话销毁、超时、能力注销或 Bridge 关闭时触发
  readonly deadline?: number;       // 调用截止时间（Unix epoch 毫秒）
  readonly sessionId: string;       // 仅用于诊断与审计
  readonly callerId: string;        // 插件 ID 或 'platform'；不参与授权
}

interface ICapability<TInput = unknown, TOutput = unknown> {
  id: string;
  execute(input: TInput, ctx: ICapabilityContext): Promise<TOutput>;
  schema: JSONSchema;
  permissions: string[];
}
```

- `execute` 必须响应 `ctx.signal` 的取消与 `ctx.deadline` 的截止，不得忽略取消后继续占用资源。
- 能力 ID 不携带版本号；同一 ID 同时只有一个生效注册；Bridge 不做能力级版本协商。
- `TInput` / `TOutput` 仅存在于编译期；跨 Bridge 的值必须是结构化克隆兼容的 JSON 值。

### 2.3 `IResourceHandle`（句柄）

`uri` / `state`（`open` / `invalidated` / `released`）/ `metadata()` / `read()` / `readRange()` / `stream()` / `release()` / `onInvalidate()`。

- `read()` 超过 8 MiB 返回 `RESOURCE_TOO_LARGE`，改用 `readRange()` 或 `stream()`；
- `release()` 幂等；释放后除 `uri`、`state`、`release()` 外的方法返回 `RESOURCE_HANDLE_RELEASED`；
- 会话结束强制释放全部句柄。

---

## 三、三条链路

### 3.1 能力调用

```
chips.request(id, input) → preload 生成 requestId → bridge:request
  → 会话解析 → 注册表查找 → 权限判定 → schema 校验
  → 超时 / 并发策略 → 内核路由 → Host 执行 → 错误归一 → 返回
```

### 3.2 事件订阅

Host 事件总线 → `event:<eventId>` 单向推送；订阅控制经 `event:control`；会话销毁时一次性清理该会话全部订阅与转发标记。

### 3.3 资源访问

```
chips.resource(uri) → preload 同步预检 → bridge:resource
  → 解析、作用域与会话校验、权限判定（纵深防御）
  → 分配句柄 ID → 句柄代理 → Resolver / Provider → IResourceHandle
```

`resource()` 接受裸 `http(s)://`（按资源协议规范 §2.6 归一）；外部资源内容类型必须匹配消费场景。

---

## 四、调用信封：`{ json, bin }`

Bridge 调用信封固定为两段，由 Bridge 层在能力调用链路上拆分与合并：

| 段 | 内容 |
|---|---|
| `json` | 结构化 JSON 值；schema 中标记 `x-chips-binary` 的字段，其值替换为 `bin` 表键 |
| `bin` | 二进制表；键为 `json` 中引用名，值为字节 |

规则：

1. Rust 侧以 `CapabilityInput { json, bin: BTreeMap<String, Vec<u8>> }` 承载；Neon 边界二进制**一次拷贝**。
2. schema 校验针对 `json` 段执行（`x-chips-binary` 字段只校验键存在）；字节长度按 schema 声明的上限校验，缺键、多余键或超限返回 `BRIDGE_INVALID_INPUT`。
3. Host 侧 TS 适配层在执行 `execute(input, ctx)` 前把 `bin` 按键合并回输入（`Uint8Array`），能力作者不感知信封形态。
4. **禁止以内联 base64 承载二进制**；文本编码是显式接口语义（如 `file:read` 的 `encoding` 选项）。

---

## 五、会话与身份

- **会话（Session）**是插件一次运行实例与一个渲染宿主（窗口 / 表面）的绑定，是 Bridge 的身份与限权单位。
- **身份不可自报**：调用方身份（插件 ID、会话、权限）只由 Bridge 层按 IPC 来源（`webContents` + frame）解析；请求负载中即使携带身份字段也仅作诊断，不参与授权。
- **三步校验全部在主进程**：会话有效性 → 权限 → schema；渲染进程不可信。
- 会话记录包含：`sessionId`、`grantedPermissions`（权限快照）、`openedDocuments`、`state`；会话关闭后拒绝全部新调用（`BRIDGE_SESSION_UNKNOWN`），在途调用取消并丢弃结果。
- **权限快照经 `session:permissions` 下行同步**到 preload，供快速失败预检；授权变更后由主进程推送更新；预检不构成安全边界。

---

## 六、能力注册与权限判定

### 6.1 能力与权限是两个命名空间（R3）

- 能力 ID：`<domain>:<action>[:<target>]`，如 `file:read`、`document:write`；表达"做什么"。
- 权限 ID：`<domain>:<scope>[:<qualifier>]`，如 `filesystem:read`、`network:http:*.example.com`；表达"被允许访问什么范畴"。
- **能力 ID 与权限 ID 不得相同**；能力声明自己需要的权限（`capability.permissions`），manifest 的 `permissions` 是插件申请集合；判定按两者交集。
- 未登记的能力 ID 不得注册、不得调用；domain 由平台统一登记与分配，插件不得自造。

### 6.2 注册主体与注册校验

- 只有 `service` 角色插件可以注册能力；`basecard` / `boxlayout` / `app` 不得注册。
- 每次注册在写入注册表前完成全部校验，任一项失败原子拒绝：

| # | 校验项 | 失败错误码 |
|---|---|---|
| 1 | `id` 符合文法与命名规则 | `BRIDGE_CAPABILITY_CONFLICT` |
| 2 | `id` 在能力契约登记内，且登记绑定的提供方与 `owner` 一致 | `BRIDGE_CAPABILITY_CONFLICT` |
| 3 | `id` 未被其他提供方占用 | `BRIDGE_CAPABILITY_CONFLICT` |
| 4 | `id` 与任何权限 ID 不相同（R3） | `BRIDGE_CAPABILITY_CONFLICT` |
| 5 | `schema` 符合 JSON Schema 2020-12 子集且可离线编译 | `BRIDGE_INVALID_SCHEMA` |
| 6 | `permissions` 每项已注册且已在提供方 manifest 声明 | `PERMISSION_NOT_DECLARED` / `PERMISSION_UNKNOWN` |
| 7 | `owner` 已处于 `active` 状态 | `KERNEL_INVALID_TRANSITION` |

### 6.3 权限判定

- 放行条件：`capability.permissions` 中每一项都能在会话快照中匹配（"申请集合 ∩ 能力声明 ∩ 会话快照"全覆盖）；带 `qualifier` 的权限按限定值规则匹配（路径前缀、域名通配、标识相等）。
- 每次调用都在 Bridge 层判定；会话快照在授权变更时更新，判定为常数开销的集合匹配。
- 拒绝信息只包含本次调用所需与缺失的权限，不暴露其他插件、其他会话的权限信息。
- 权限词表与能力映射的**唯一权威**：[能力契约规范](../../../薯片生态文档库/05-接口与契约/04-能力契约规范.md) §6.2 与 [权限系统设计](../../../薯片生态文档库/01-架构设计/01-子系统设计/08-权限系统设计.md) §4。

---

## 七、超时、取消与并发

- 超时来源：调用方 `deadline`、能力注册项 `timeoutMs`、会话级上限；超时返回归一错误并取消执行。
- 取消：`ctx.signal` 在会话销毁、超时、能力注销或 Bridge 关闭时触发；`execute` 必须协作响应。
- 并发：注册项含 `concurrency` / `maxQueue`；`sessionInFlightLimit = 64`，同一会话对该能力的在途调用超限返回 `BRIDGE_SESSION_BUSY`。
- 输出不做运行时 schema 校验；输入校验失败返回 `BRIDGE_INVALID_INPUT`。

---

## 八、错误归一

- 跨边界错误只有一个形状：`ChipsError { code, message, details?, retryable? }`；`IChipsError` 仅作结构别名。
- 码前缀按来源归一：`KERNEL_*`、`BRIDGE_*`、`DOCUMENT_*`、`RESOURCE_*`、`PERMISSION_*` / `PLUGIN_PERMISSION_DENIED`、`EVENT_*`、Host 业务码、未识别异常的 `<DOMAIN>_INTERNAL`。
- `PLUGIN_PERMISSION_DENIED` **只表示权限拒绝**；owner 未 active 等生命周期状态错误使用内核状态码。
- `retryable` 仅作提示：`true` 表示重新执行可能成功；`false` 不得自动重试。
- `message` 为简体中文、面向用户；不携带堆栈、内部路径与原始输入；诊断细节放 `details`，故障排查按错误码组织。

---

## 九、施工自检

- [ ] 是否只经 `window.chips` 访问平台，没有自建通道或直接 IPC？
- [ ] 是否遵守 `{ json, bin }` 信封，没有 base64 兜底？
- [ ] 能力与权限是否分属两个命名空间，能力 ID 是否已登记？
- [ ] 会话是否由 Bridge 解析、三步校验是否全部在主进程？
- [ ] `execute` 是否响应 `ctx.signal` / `ctx.deadline`，长调用是否可取消？
- [ ] 错误是否归一为 `ChipsError`，`code` / `retryable` 是否按契约设置？

---

## 十、权威文档

- [Bridge 三层设计](../../../薯片生态文档库/01-架构设计/01-子系统设计/02-Bridge三层设计.md)：本文机制的唯一权威
- [Bridge API 规范](../../../薯片生态文档库/05-接口与契约/01-Bridge-API规范.md)：`window.chips` 与 `IChipsBridge` 完整参考
- [能力契约规范](../../../薯片生态文档库/05-接口与契约/04-能力契约规范.md)：能力模型、注册校验、schema 约定、内置能力逐项契约
- [权限系统设计](../../../薯片生态文档库/01-架构设计/01-子系统设计/08-权限系统设计.md)：权限词表、授予与判定、审计
- [资源协议规范](../../../薯片生态文档库/05-接口与契约/06-资源协议规范.md)：`chips-resource://` 语法与句柄生命周期
- [核心接口规范](../../../薯片生态文档库/05-接口与契约/03-核心接口规范.md) §3.3：`ChipsError` 唯一形状
- [本轮架构收口裁决](../本轮架构收口裁决.md) §一、§四：命名、信封与契约裁决

---

**文档结束**
