# 阶段十一：卡片显示 iframe 高级组件专项

## 阶段目标

交付薯片生态独有的两类 iframe 高级组件，并打通基础卡片插件到 SDK 统一显示接口的完整链路：

- `CardCoverFrame`（卡片封面组件）
- `CompositeCardWindow`（复合卡片窗口组件）

## 适配原则

- 应用层（查看器/编辑器）只做接口套壳，不重复实现渲染引擎。
- 基础卡片分发、模板编译、iframe 拼接全部由 SDK 统一显示接口处理。
- 单基础卡片故障不可拖垮复合窗口整体展示。

## 开发任务

### 1. 组件与契约定义

- 完成 `CardCoverFrame` 与 `CompositeCardWindow` API 定义。
- 输出组件契约文件（scope/part/state）。
- 明确 iframe 生命周期事件和错误对象规范。

### 2. SDK 接口对齐

- 定义封面显示接口与复合窗口显示接口。
- 明确输入模型（卡片文件路径/ID、模式参数、回调）。
- 明确输出模型（可挂载 iframe 句柄/描述对象）。
- 若真实 SDK 未交付，必须先提阻断工单并按适配器契约继续组件侧开发。

### 3. 基础卡片插件协同规范

- 固化基础卡片插件包必备模块清单（渲染/编辑/模板/配置/参数表）。
- 固化插件渲染模块输出协议（HTML -> iframe）。
- 固化 SDK 分发与拼接协议。

### 4. 安全与隔离

- 落地 iframe sandbox 最小权限策略。
- 约束跨 iframe 通信通道。
- 明确敏感能力禁止直连规则。

### 5. 测试与验证

- 封面组件加载/失败/空态测试。
- 复合窗口分发拼接一致性测试。
- 节点失败降级测试。
- 查看器与编辑器调用一致性测试。

## 阶段产物

- 两个组件技术文档与生态共用标准文档。
- 组件契约与测试用例清单。
- SDK 显示链路规范文档。
- 接入补充计划。
- SDK 阻断工单与任务说明（如触发）。

## 退出条件

- 任何应用场景只需调用统一 SDK 显示接口即可稳定显示卡片。
- `CardCoverFrame` 与 `CompositeCardWindow` 文档、契约、测试标准齐全。
- 失败隔离、回退与安全策略可验证。

## 执行进展（2026-03-05）

已完成：

- `CardCoverFrame`、`CompositeCardWindow` 组件实现已落地（含状态解析、标准错误归一化、iframe 消息协议解析）。
- 安全策略增强已落地：
  - iframe sandbox 归一化与危险权限剔除（`resolveIframeSandboxPolicy`）
  - 复合窗口消息来源白名单校验（`allowedOrigins`）
  - 复合窗口切卡状态重置（节点错误计数与致命错误隔离）
- SDK 模式契约增强已落地：
  - `CompositeWindowMode` 仅允许 `view | preview`
  - `loadCompositeWindowData` 对非法 mode 阻断并返回标准错误
- 组件契约文件已落地：
  - `packages/theme-contracts/contracts/components/card-cover-frame.contract.json`
  - `packages/theme-contracts/contracts/components/composite-card-window.contract.json`
- 基础链路文档已落地：
  - `技术文档/13-卡片封面组件规范.md`
  - `技术文档/14-复合卡片窗口组件规范.md`
  - `技术文档/15-基础卡片插件与SDK显示链路规范.md`
- 非 SDK 依赖测试已通过（状态、消息协议、适配器校验、安全策略校验）。

阻断项：

- 真实 SDK 统一显示接口尚未交付，已提交工单：
  - `工单001-SDK-UNIFIED-CARD-DISPLAY-API`
  - 位置：`项目日志与笔记/问题工单.md`
  - 待 SDK 对齐项：统一接口实现、`mode(view|preview)` 口径、iframe origin 元信息输出、事件协议与错误码契约测试
