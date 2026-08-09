# 基础卡片插件与 SDK 显示链路规范

## 1. 目标

统一基础卡片插件包职责与 SDK 显示链路，确保“任意应用调用同一显示接口即可得到一致卡片窗口”。

## 2. 基础卡片插件包职责

每个基础卡片插件包必须包含（播放器/文本编辑器等通用能力除外）：

- 前端渲染窗口模块
- 编辑器模块
- 基础卡片元信息与配置文件
- 内容模板
- 参数表与填写说明

这些模块在插件包内闭环，可被生态统一调用。

## 3. 渲染输出规范

基础卡片插件渲染模块必须：

1. 接收卡片记录内容与配置参数
2. 填充前端渲染模板 HTML
3. 产出完整可运行网页
4. 最终交付 iframe 可挂载对象

## 4. SDK 统一显示接口规范

SDK 必须提供统一入口（命名示意）：

- `sdk.card.coverFrame.render(...)`
- `sdk.card.compositeWindow.render(...)`

接口约束：

- `sdk.card.compositeWindow.render` 的 `mode` 仅允许 `view | preview`。
- SDK 应输出稳定 iframe `origin` 元信息，供组件端做消息来源白名单校验。

调用方（查看器、编辑器、其他应用）只需：

- 传入卡片文件
- 挂载返回的 iframe 窗口

不承担基础卡片分发、模板编译、拼接逻辑。

### 组件库侧适配器契约（已落地）

在真实 SDK 未交付前，组件库通过适配器契约保持可开发状态：

- `resolveCoverFrame({ cardId, cardFile, cardName, signal })`
- `resolveCompositeWindow({ cardFile, mode, signal })`

正式类型入口：

- 主定义入口：`@chips/card-runtime`
- 聚合转发入口：`@chips/component-library`
- 允许直接消费的类型/常量包括：
  - `CardDisplayAdapter`
  - `CompositeWindowMode`
  - `loadCoverFrameData`
  - `loadCompositeWindowData`
  - `validateCardDisplayAdapter`

组件库适配器校验约束：

- `resolveCompositeWindow.mode` 非 `view | preview` 直接阻断并返回标准错误。

适配器返回值必须包含：

- 封面接口：`coverUrl`
- 复合窗口接口：`frameUrl`

## 5. 复合卡片自动分发与拼接

SDK 处理流程：

1. 接收复合卡片文件
2. 解析结构并识别基础卡片类型
3. 自动分发到对应基础卡片插件渲染模块
4. 收集各基础卡片 iframe 产物
5. 按结构拼接为复合卡片窗口
6. 返回统一复合 iframe

## 6. 业务应用职责（套壳化）

卡片查看器、编辑引擎等业务应用原则上是显示接口套壳层：

- 负责文件接入（拖动/导入/内核传递）
- 负责调用 SDK 显示接口
- 负责窗口容器与业务外壳

不重复实现渲染引擎。

## 7. 质量与兼容要求

- 基础卡片插件必须通过 manifest 与契约校验。
- SDK 显示接口跨应用行为必须一致。
- 单插件失败不得拖垮复合窗口整体展示。
- 当前首版阶段不为历史口径保留兼容层；接口调整必须先在生态级文档中完成收口，再统一落地。

## 8. SDK 阻断项记录

真实 SDK 对接阻断已登记：

- 工单编号：`工单001-SDK-UNIFIED-CARD-DISPLAY-API`
- 记录位置：`项目日志与笔记/问题工单.md`
