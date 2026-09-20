# chips-native（Neon 绑定）

> 版本：v0.1.0
> 日期：2026-09-20
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
├── Cargo.toml                     # crate-type = ["cdylib"]；path 依赖 chips-core / chips-cordis / chips-bridge
├── package.json                   # build / copy-native / test / typecheck / lint / clean
├── src/
│   ├── lib.rs                     # #[neon::main] 唯一入口；模块声明与线程约束说明
│   ├── abi.rs                     # export_table!：导出名表 + 集中注册 + 元信息导出
│   ├── convert.rs                 # Rust ↔ JS 值映射（标量/容器/对象白名单/2^53 约束）
│   ├── envelope.rs                # { json, bin } 二进制信封（一次拷贝、JSON Pointer 键）
│   ├── error.rs                   # ChipsError → JS Error、JS 异常 → ChipsError、NATIVE_* 码
│   ├── runtime.rs                 # 绑定层 tokio 运行时与 Promise settle 助手
│   ├── bridge.rs                  # Bridge 域四导出 + TS 能力执行器（Channel 回投 + AbortSignal）
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

| 域               | 导出                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| 元信息           | `coreVersion`、`coreAbiVersion`                                                                                    |
| Cordis / Context | `contextProvide`、`contextInject`、`contextGet`、`contextOn`、`contextUnsubscribe`、`contextEmit`、`contextEffect` |
| 取消令牌         | `createCancelToken`、`cancelTokenCancel`                                                                           |
| Bridge           | `bridgeRegister`、`bridgeUnregister`、`bridgeRequest`、`bridgeCancelSession`                                       |

四个 Bridge 导出全部转发 `chips-bridge` 内核（工单005，《问题工单》）：
绑定层只做参数解析、`{ json, bin }` 信封编解码、错误归一与线程回投；
注册表、权限判定、Schema 校验、并发准入与超时取消语义在内核侧。
`bridgeRequest` 为异步导出（`Promise`），JS 线程不 `block_on`；TS 能力的
`handler` 由 `Root` 持有、经 `Channel` 回投 JS 线程执行（§8.3、§8.4）。
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
- 句柄（`ContextHandle` / `CancelTokenHandle`）对 JS 不透明、无字段、不可序列化。
- 二进制一律 `Uint8Array`（主进程 `Buffer` 为其子类），禁止 base64；输入输出
  各一次拷贝。
- ID 与整数跨边界必须 `< 2^53`，否则 `NATIVE_VALUE_OUT_OF_RANGE`。
- `contextProvide` 的服务值只接受普通对象与函数；`contextGet` 对 Rust 注册的
  服务返回 `KERNEL_SERVICE_TYPE_MISMATCH`，不尝试跨语言下转。

---

**文档结束**
