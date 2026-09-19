/**
 * `@chips/bridge` 唯一公开入口（01-代码组织规范 §3、§6）。
 *
 * 分层：
 * - `protocol/`：协议类型与契约登记数据（`IChipsBridge` / `ChipsError` / IPC 消息 / 权限词表 / 能力与事件登记表 / 资源 URI）；
 * - `schema/`：JSON Schema Draft 2020-12 平台子集编译与校验；
 * - `core/`：Bridge 核心机制（主进程侧 TS 实现与 Rust 替换接缝）；
 * - `client/`：preload 与渲染进程共用的类型化壳。
 */

export * from './protocol/index.js';
export * from './schema/index.js';
export * from './core/index.js';
export * from './client/index.js';
