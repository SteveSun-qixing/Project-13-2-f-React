# 任务054：开放项目 Thorium 长期同化评估

## 状态

- 状态：已完成
- 完成日期：2026-05-26
- 评估报告：`项目日志与笔记/task022-优化薯片组件库和主题系统/08-草稿笔记/任务054-Thorium长期同化评估报告-20260526.md`
- 工作日志：`项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务054-开放项目Thorium长期同化评估-20260526.md`
- 结论：Thorium 适合作为阅读器长期能力地图与复杂 Web 项目同化样本，不适合未经拆解直接并入 Host、BookReader 或 book-BCP。后续应按 Host 能力、模块插件、BookReader 应用 UI、book-BCP 资源卡片和公共契约分别吸收。

## 1. 任务目标

使用 `OpenSourceProjectHandlingFolder/thorium-reader-develop` 评估大型阅读器项目同化难度，为阅读器、电子书基础卡片和长期复杂 Web 项目吸收提供路线。

## 2. 对应阶段任务

- `05-开发任务方案/任务16-Web项目同化CLI与迁移报告.md`
- `05-开发任务方案/任务27-开放项目同化样本工程.md`

## 3. 涉及项目

- `OpenSourceProjectHandlingFolder/thorium-reader-develop`
- `OpenSourceProjectHandlingFolder/thorium-reader-repowiki`
- `Chips-BookReader`
- `Chips-BaseCardPlugin/book-BCP`
- `Chips-ModulePlugin/*`

## 4. 开发内容

1. 重新核对 Thorium README、架构、包结构、构建脚本、许可证、阅读格式和外部资源。
2. 使用同化命令生成大型项目扫描报告：进程模型、状态管理、阅读核心、格式解析、无障碍、国际化、主题、依赖。
3. 判断哪些能力应进入 Host/模块插件，哪些能力进入阅读器应用，哪些能力只作为参考。
4. 对 EPUB/PDF/DOCX/漫画图片等阅读格式建立能力缺口清单。
5. 评估从 Thorium 吸收代码、吸收架构思想、或仅作为竞品参考的三种路线。
6. 输出长期同化阶段计划，不在本轮强行迁移完整 Thorium。
7. 登记阻断工单：许可证、依赖、性能、安全、格式支持、Web/Electron 差异。

## 5. 验收标准

- 有完整大型阅读器同化评估报告。
- 清楚区分短期可落地能力和长期生态能力。
- 不把复杂外部项目未经拆解直接放入 Host 或应用插件。
- 阅读器迁移任务可根据本报告补充能力路线。

## 6. 验证命令

```bash
cd OpenSourceProjectHandlingFolder/thorium-reader-develop
npm install
npm run build
npm test
```

## 7. 注意事项

- Thorium 是长期评估对象，不要求本轮完整同化。
- 本任务开发前必须重新调查该项目当前源码、许可证和构建状态。
