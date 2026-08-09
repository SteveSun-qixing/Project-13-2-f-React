# 归档说明：薯片主题系统文档（task030 卸担计划）

> 归档时间：2026-08（task030 卸担计划 M5 收尾）
> 归档目录：`生态共用技术文档/归档/主题系统/`（原 `生态共用技术文档/主题系统/`）

## 为什么废弃

主题系统（ThemePack、theme 插件、token 五层体系、CSS 变量注入、`data-chips-theme-id`、Host 主题运行时消费侧）在 task030 卸担计划中被整体废弃。原因：

- 多主题动态切换与生态"所有应用打开都像同一款软件"的目标冲突，统一改为单一苹果风格视觉；
- 主题包运行时（`theme.getAllCss` / `theme.resolve` 注入、`--chips-sys-*` 变量、Material Symbols 图标字体）链路复杂，插件侧不再消费；
- 视觉统一改由 antd `ConfigProvider theme`（`@chips/ui` `appleTheme`）+ 共享层 `global.css` 达成，一处定义全生态生效，无需运行时解析。

注意：Host 服务面保留（`theme` 服务、`theme.read` 权限服务、theme 插件类型解析等属于 Host 内部能力，未在本任务范围清理，后续单独立项）；废弃的是插件侧对主题系统的消费。

## 替代方案

| 旧能力 | 替代 |
|---|---|
| ThemePack / theme 插件（`type: theme`） | 废弃；不再创建主题插件工程（`chipsdev create theme` 为 Host 工具链保留能力） |
| 五层 token（ref/sys/comp/layout/motion） | `@chips/ui` `appleTheme`（antd token） |
| `--chips-sys-*` CSS 变量 | antd token（`theme.useToken()`）或苹果色值常量（`#f5f5f7` / `#1d1d1f` / `#0a84ff` 等） |
| `ChipsThemeProvider` / `useChipsTheme` | antd `ConfigProvider theme={appleTheme}` / `theme.useToken()` |
| `theme-changed` 事件监听刷新 UI | 删除（单一主题无需监听） |
| 图标字体（Material Symbols） | `@ant-design/icons` |

现行正式口径：`生态共用技术文档/前端基础/02-统一视觉规范.md`；废弃规则细节见 `项目日志与笔记/task030-卸担计划/07-主题系统移除规范.md`（任务过程材料）。

## 文档清单（历史参考）

| 编号 | 文档 | 原用途 |
|---|---|---|
| 01 | 主题包开发指南 | theme 插件开发流程 |
| 02 | 主题接口规范 | 主题插件、token、CSS、图标字体接口 |
| 03 | 图标与字体系统设计规范 | 图标字体与字体系统设计 |
