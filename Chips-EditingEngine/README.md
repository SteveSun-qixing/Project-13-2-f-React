# Chips-EditingEngine

> 薯片生态编辑引擎应用插件工程
> 当前阶段：已完成阶段二应用壳层，并开始阶段三工作区文件会话与预览链路开发

## 当前状态

- 已使用官方应用插件脚手架初始化工程骨架；
- 已完成 `需求文档/`、`技术文档/`、`开发计划/` 三套迁移文档；
- 已闭环工单028，修复应用脚手架输出契约问题；
- 已落地编辑引擎阶段二基线：运行时 Provider、主题/多语言/配置接入、布局偏好持久化、Host / 预览双模式壳层。
- 已启动阶段三：工作区文档会话、最近目标持久化、`.card` / `.box` 文件打开与预览链路。

## 文档入口

- `需求文档/00-文档索引.md`
- `技术文档/00-文档索引.md`
- `开发计划/00-开发计划索引.md`

## 本轮已完成的正式能力

- 应用插件清单已补齐正式权限与 launcher 图标配置；
- `src/app/providers/EditorRuntimeProvider.tsx` 已建立编辑引擎运行时上下文；
- `src/shared/runtime/editor-runtime-service.ts` 已完成主题、语言、布局偏好、平台信息、插件上下文的统一加载；
- `src/features/shell/EditorShell.tsx` 已实现可运行的编辑引擎应用壳层与工作区文件预览面板；
- `src/app/providers/WorkspaceSessionProvider.tsx` 已建立工作区会话与最近目标治理；
- `chipsdev lint/test/build/validate` 已全部通过。

## 当前执行原则

- 作为 `type: app` 应用插件运行在 `Chips-Host` 内，不保留旧版独立 Electron 运行方式；
- 严格使用薯片组件库、SDK、主题系统、多语言系统和正式接口协议；
- 若发现生态能力缺口，先提工单，再停止相关开发；
- 不做临时实现，不做旧版兼容回退。
