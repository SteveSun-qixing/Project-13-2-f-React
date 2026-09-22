# chips-native（Neon 绑定）

> 版本：v0.1.0
> 日期：2026-09-23
> 状态：进行中
> 适用范围：`packages/native/` 的 Rust crate `chips-native`、ABI 导出面、类型映射与错误归一、构建脚本、契约检查与 JS 侧类型检查。

---

## 一、定位

`chips-native` 是 Rust 核心经 Neon 暴露给 Node.js 的唯一出口，产物为
`chips-native.node`，供 Electron 主进程调用。接口面的唯一权威是
《核心接口规范》§8（Neon 绑定约定）与 §9（版本与 ABI 边界）：

- 绑定层只做类型转换与错误映射，业务逻辑全部位于子系统 crate；
- 导出函数（`camelCase`）集中在 `src/abi.rs` 的 `export_table!` 中声明；
- 跨边界错误只有 `ChipsError` 一个形状；
- JS 值只在 JS 线程操作，跨线程回投只经 `Channel`；
- 导出面变更必须递增 `CORE_ABI_VERSION` 并同步本文、`abi/export-surface.json`、`types/chips-native.d.ts` 与契约测试。

## 二、目录

```
packages/native/
├── Cargo.toml                     # crate-type = ["cdylib"]；path 依赖 chips-core / chips-cordis / chips-bridge / chips-parser / chips-resource
├── package.json                   # build / copy-native / test / typecheck / lint / clean
├── src/
│   ├── lib.rs                     # #[neon::main] 唯一入口；模块声明与线程约束说明
│   ├── abi.rs                     # export_table!：导出名表 + 集中注册 + 元信息导出
│   ├── convert.rs                 # Rust ↔ JS 值映射（标量/容器/对象白名单/2^53 约束）
│   ├── envelope.rs                # { json, bin } 二进制信封（一次拷贝、JSON Pointer 键）
│   ├── error.rs                   # ChipsError → JS Error、JS 异常 → ChipsError、NATIVE_* 码
│   ├── runtime.rs                 # 绑定层 tokio 运行时与 Promise settle 助手
│   ├── bridge.rs                  # Bridge 域四导出 + TS 能力执行器（Channel 回投 + AbortSignal）
│   ├── parser.rs                  # 文档解析域十三导出（句柄装箱、DTO 转换、契约码透传）
│   ├── resource.rs                # 资源管理域十五导出（进程级单例、写流闭包对象、契约码透传）
│   ├── handles.rs                 # Root 持有：服务值、回调、Context 句柄载体
│   ├── cancel.rs                  # createCancelToken / cancelTokenCancel
│   └── context.rs                 # context* 导出与监听令牌翻译表
├── abi/export-surface.json        # ABI 清单：exports（已注册）+ blocked（工单引用）
├── types/chips-native.d.ts        # JS 侧 ABI 类型声明（与运行时导出面一致）
├── tests/typecheck/               # 消费全部导出面的类型检查夹具（含 @ts-expect-error 负例）
└── scripts/                       # build-native / copy-native / check-abi / check-types
```

## 三、导出面

已注册（`CORE_ABI_VERSION = 1`）：

| 域               | 导出                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 元信息           | `coreVersion`、`coreAbiVersion`                                                                                                                                                                                                                                                                                                |
| Cordis / Context | `contextProvide`、`contextInject`、`contextGet`、`contextOn`、`contextUnsubscribe`、`contextEmit`、`contextEffect`                                                                                                                                                                                                             |
| 取消令牌         | `createCancelToken`、`cancelTokenCancel`                                                                                                                                                                                                                                                                                       |
| Bridge           | `bridgeRegister`、`bridgeUnregister`、`bridgeRequest`、`bridgeCancelSession`、`bridgeActivateProvider`、`bridgeDeactivateProvider`、`bridgeGrantCapabilityId`、`bridgeOpenSession`、`bridgeCloseSession`、`bridgeShutdown`                                                                                                     |
| 文档解析         | `openDocument`、`openCard`、`openBox`、`documentMetadata`、`documentStructure`、`documentContent`、`documentEntries`、`documentLayoutConfig`、`documentRevision`、`documentReadResource`、`documentValidate`、`buildDocumentView`、`documentClose`                                                                             |
| 资源管理         | `resourceOpen`、`resourceStat`、`resourceRead`、`resourceReadChunk`、`resourceRelease`、`resourceCommitWrite`、`resourceCommitWriteStream`、`resourceListDirectory`、`resourceDelete`、`resourceRename`、`resourceCopy`、`resourceCreateDirectory`、`resourceOpenSession`、`resourceCloseSession`、`resourceRegisterTempScope` |

十五个资源管理导出全部转发 `chips-resource` 内核（《核心接口规范》§7.3，
《04.11-04-资源管理设计》§11.3 表序逐字实现）：

- 进程级单例：`ResourceManager` 以 `Arc` 一次初始化、生命周期与主进程一致
  （§11.5），`ResourceLimits::default()` 即《04.12》§12 生产默认值；
  注入的 `NoopDecisionObserver` 只是构造签名的编译随行，真实
  `DecisionObserver` 接线归后波（与 `bridge.rs` 同款的波界在册注记）；
- 同步/异步切分按 §11.3 返回形状：`resourceRelease` / `resourceOpenSession` /
  `resourceCloseSession` / `resourceRegisterTempScope` 四导出为同步
  （backing 为注册表内存操作），其余十一导出为异步（工作提交绑定层运行时线程、
  经 `Channel` 回投 settle，JS 线程不 `block_on`）；
- `resourceCommitWriteStream` 返回**写流闭包对象** `{ id, uri, append, commit, abort }`
  （neon 1.1.1 无 class API 实证，方法以捕获共享状态的 `JsFunction::new` 挂属性）：
  `commit` / `abort` 经 `AtomicBool` 换取一次性收口权，对象整体被 GC 回收且
  仍未收口时由 `Drop` 兜底 `abort_write_stream`（显式释放优先、兜底零残留，
  与 §8.4「Finalize 只作兜底」同构语义）；
- `RESOURCE_*` 契约码经 `ChipsError` 原样透传，绑定层只以
  `NATIVE_TYPE_UNSUPPORTED` / `NATIVE_VALUE_OUT_OF_RANGE` / `NATIVE_INTERNAL`
  三码拒绝非法入参；`handleId` / `sessionId` / `offset` / `length` / `maxBytes`
  一律经 `< 2^53` 线格式判闸；
- N-1 句柄归属闸在册交回：§11.3 的句柄四导出只携带 `handleId`、不携带会话源，
  归属比对在本导出面无输入可锁测，维持归收口后的 Rust 腾面小单
  （#185/#192 两波核证结论，本波 `manager.rs` 零改动）。

十个 Bridge 导出全部转发 `chips-bridge` 内核（工单005，《问题工单》）：
绑定层只做参数解析、`{ json, bin }` 信封编解码、错误归一与线程回投；
注册表、权限判定、Schema 校验、并发准入与超时取消语义在内核侧。
`bridgeRequest` 为异步导出（`Promise`），JS 线程不 `block_on`；TS 能力的
`handler` 由 `Root` 持有、经 `Channel` 回投 JS 线程执行（§8.3、§8.4）。
十三个文档解析导出全部转发 `chips-parser`（《核心接口规范》§6.4、§6.6，
《06-文档解析器设计》§12）：`DocumentHandle` 以 `JsBox` 不透明句柄暴露，
`documentClose` 显式释放、GC 终结器兜底；三入口与访问器均为异步
（工作提交绑定层运行时线程，经 `Channel` 回投 settle）；`DOCUMENT_*`
契约码经 `ChipsError` 原样透传，绑定层只以 `NATIVE_*` 三码拒绝非法入参。
《核心接口规范》§6.4 总表的 13 行中，`createCancelToken` /
`cancelTokenCancel` 两行已由取消令牌域注册；文档解析域在 11 行之外补齐
工单034 正式化两项（`documentLayoutConfig`、`documentRevision`），净增 13 项；
资源管理域十五项（见上）随段三 native 收官波落地后，导出面合计 49 项。
清单的 `blocked` 段当前为空，`scripts/check-abi.mjs` 强制校验三方一致。

## 四、命令

```bash
pnpm --filter @chips/native run build        # cargo release + 复制到 packages/host/native/
pnpm --filter @chips/native run test         # ABI 契约检查 + JS 侧类型检查
pnpm --filter @chips/native run test:rust    # cargo test -p chips-native
pnpm --filter @chips/native run typecheck    # tsc --noEmit（tests/typecheck）
node packages/native/scripts/check-abi.mjs   # 清单 ↔ Rust ↔ d.ts 三方一致
node packages/native/scripts/copy-native.mjs # 仅复制已构建产物

cargo fmt -p chips-native -- --check
cargo clippy -p chips-native --all-targets -- -D warnings
```

## 五、约定

- `abi/export-surface.json` 是导出清单事实源；Rust 单测与 JS 检查脚本共同消费。
- 句柄（`ContextHandle` / `CancelTokenHandle` / `DocumentHandle`）对 JS 不透明、无字段、不可序列化。
- 二进制一律 `Uint8Array`（主进程 `Buffer` 为其子类），禁止 base64；输入输出
  各一次拷贝。
- ID 与整数跨边界必须 `< 2^53`，否则 `NATIVE_VALUE_OUT_OF_RANGE`。
  视图投影修订号（`buildDocumentView` 回包 `revision`）为解析句柄会话内的
  构建单调源（首开基线 0、逐次构建 +1，工单037 裁定），构造性恒落该契约内；
  越界判闸保留为 fail-closed 兜底（《06-文档解析器设计》§5.2、
  《05-渲染引擎设计》§2.4 第 5 条）。
- `contextProvide` 的服务值只接受普通对象与函数；`contextGet` 对 Rust 注册的
  服务返回 `KERNEL_SERVICE_TYPE_MISMATCH`，不尝试跨语言下转。

---

**文档结束**
