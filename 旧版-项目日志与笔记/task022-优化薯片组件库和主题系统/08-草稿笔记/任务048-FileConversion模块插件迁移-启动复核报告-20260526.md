# 任务048-FileConversion模块插件迁移-启动复核报告-20260526

## 1. 开工阅读

- 已阅读根 `AGENTS.md`、`项目日志与笔记/AGENTS.md`、`生态设计原稿/AGENTS.md`、`生态共用技术文档/AGENTS.md`。
- 已阅读任务048工单文档、任务23模块插件能力契约与运行时迁移方案。
- 已复核文件转换系统设计、模块能力契约、文件转换能力契约、模块插件开发指南、SDK module invoke 说明。
- 已勘察 `Chips-ModulePlugin/Chips-FileConversion-Plugin` 当前 `manifest.yaml`、contracts、src、tests、README、需求文档、技术文档。

## 2. 当前基线

- 插件已经是 `type: module`，正式提供 `converter.file.convert/convert` job 方法。
- `manifest.module.consumes` 已声明 `converter.card.to-html`、`converter.html.to-pdf`、`converter.html.to-image`。
- 源码已通过 `ctx.module.invoke` 调用原子模块，没有直接 import 下游源码。
- 现有测试覆盖了直接 HTML 导出、card -> pdf 两步流水线、子 job 轮询、取消、非法 html -> html、输出冲突。

## 3. 发现缺口

- `overwrite: true` 旧实现会在转换前删除最终输出；如果后续步骤失败，旧输出会丢失，不满足任务048“失败回滚”目标。
- 下游 provider 缺失、权限不足、依赖未声明尚未用独立错误语义覆盖测试。
- 项目技术文档未写清最终交付物 staged 发布、备份和恢复策略。

## 4. 拆分判断

任务048范围集中在同一个 FileConversion 编排模块，当前实现已接近正式迁移尾段，不需要再创建 `048.xx` 子任务文档。
