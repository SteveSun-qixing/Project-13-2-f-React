/**
 * 插件角色共享类型（08-基础卡片插件接口 §2.1、§4.1；09-箱子布局插件接口 §3.1、§7.1）。
 *
 * `Dispose` 与 `EditorState` 在 08 与 09 两篇接口文档中以同名同形状声明，
 * SDK 只定义一次并从主入口导出；两类编辑句柄（`IBaseCardEditor` / `ILayoutEditor`）
 * 只共享成员语义、不共享类型名（09 §7.1）。
 */

/**
 * 释放句柄：等价于 `() => void`；必须幂等、不得抛出，已释放效果不得再次触碰容器。
 *
 * 帧运行时按调用顺序收集返回的 `Dispose`，帧销毁时逆序执行（08 §2.4.1 契约 5、09 §3.3 第 5 条）。
 */
export type Dispose = () => void;

/**
 * 编辑句柄状态：`active` 可编辑；`disposed` 已释放，除 `state` / `dispose()` 外一切行为为空操作
 * （08 §4.2、09 §7.1）。
 */
export type EditorState = 'active' | 'disposed';
