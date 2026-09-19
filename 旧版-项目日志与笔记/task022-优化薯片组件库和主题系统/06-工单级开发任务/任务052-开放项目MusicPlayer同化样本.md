# 任务052：开放项目 MusicPlayer 同化样本

## 状态

- 状态：已完成
- 完成日期：2026-05-26
- 同化评估报告：`项目日志与笔记/task022-优化薯片组件库和主题系统/08-草稿笔记/任务052-MusicPlayer同化评估报告-20260526.md`
- 工作日志：`项目日志与笔记/task022-优化薯片组件库和主题系统/07-工作日志/任务052-开放项目MusicPlayer同化样本-20260526.md`
- 结论：`MusicPlayer-main` 适合作为低复杂度静态 Web 项目同化样本，核心价值是 Apple Music 风格歌词滚动、封面取色动态背景、音频/歌词/封面三件套选择体验和播放器交互参考；不能直接复制为薯片应用插件。正式吸收应以现有 `Chips-MusicPlayer` 的 React App/Surface/Command/i18n/theme/Host 资源链路为落点，保留样本算法与交互思想，重写 DOM、权限、主题、多语言和可访问性实现。

## 1. 任务目标

使用 `OpenSourceProjectHandlingFolder/MusicPlayer-main` 验证外部静态 Web 项目同化流程，形成低复杂度项目迁入薯片生态的样板。

## 2. 对应阶段任务

- `05-开发任务方案/任务16-Web项目同化CLI与迁移报告.md`
- `05-开发任务方案/任务27-开放项目同化样本工程.md`

## 3. 涉及项目

- `OpenSourceProjectHandlingFolder/MusicPlayer-main`
- `Chips-Scaffold/chips-scaffold-app`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `Chips-MusicPlayer`

## 4. 开发内容

1. 重新核对 MusicPlayer-main 的 README、目录结构、资源、依赖和运行方式。
2. 使用 SDK/Scaffold 同化命令生成扫描报告：入口、资源、全局样式、硬编码文案、浏览器 API、媒体 API、外部依赖。
3. 评估它应成为独立应用插件、组件参考，还是合并为 `Chips-MusicPlayer` 的交互参考。
4. 生成同化目标结构：manifest、surface、theme、i18n、资源路径、质量门禁。
5. 将可复用播放交互、队列、封面和歌词经验沉淀到音乐播放器迁移任务。
6. 记录无法直接同化的内容和需要底座支持的能力缺口。
7. 输出可复用同化报告模板，供后续简单 Web 项目使用。

## 5. 验收标准

- 有完整同化报告，不是简单复制外部项目。
- 清楚说明哪些代码进入底层、组件库、音乐播放器或归档参考。
- 不引入未经确认的新依赖。
- 同化结果能通过新框架应用质量门禁或明确阻断工单。

## 6. 验证命令

本样本没有 `package.json`，实际验证以静态源码语法检查和文件扫描为准，不运行 `npm install` 或 `npm run build`。

```bash
cd OpenSourceProjectHandlingFolder/MusicPlayer-main
test ! -f package.json
node --check index.js
```

## 7. 注意事项

- 外部项目同化必须遵守薯片生态 Host/SDK/组件库/主题/多语言链路。
- 本任务开发前必须重新调查该项目当前代码和许可证状态。
