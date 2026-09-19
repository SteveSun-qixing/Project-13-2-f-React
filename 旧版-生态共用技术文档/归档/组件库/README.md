# 归档说明：薯片组件库文档（task030 卸担计划）

> 归档时间：2026-08（task030 卸担计划 M5 收尾）
> 归档目录：`生态共用技术文档/归档/组件库/`（原 `生态共用技术文档/组件库/`）

## 为什么废弃

自研组件库 `@chips/component-library`（含 `@chips/hooks`、`@chips/components`、`@chips/card-runtime`、`@chips/a11y`、`@chips/theme-contracts` 等子包）在 task030 卸担计划中被整体废弃。原因：

- 自研组件库存在大量重复建设成本（基础控件、布局容器、数据组件均需自研），且与生态"统一为同一款软件"的目标相比，维护成本高、覆盖度有限；
- antd（Ant Design）v6 组件覆盖度 100%、默认简体中文、中文文档最全、MIT 许可、Electron 兼容成熟，可等价替换全部自研组件；
- 组件库的无头组件（Component Headless / L10）与主题契约体系随主题系统一并废弃（见 `归档/主题系统/README.md`）；
- 废弃后视觉统一由单一苹果风格主题（`@chips/ui` `appleTheme`）+ antd 组件达成，不再需要运行时解析与主题包注入链路。

## 替代方案

| 旧能力 | 替代 |
|---|---|
| `@chips/component-library` 全部组件（ChipsButton/ChipsForm/ChipsDataGrid 等） | antd v6（按 `项目日志与笔记/task030-卸担计划/04-组件映射对照表.md` 映射） |
| `ChipsIcon` 图标体系 | `@ant-design/icons` |
| `EmbeddedDocumentFrame` / `CardCoverFrame` | `@chips/ui` `EmbeddedDocumentFrame`（共享层唯一实现） |
| `ChipsCommandProvider` / `ChipsMenuBar` / `ChipsToolbar` / `ChipsCommandPalette` | `@chips/ui` `CommandProvider` / `MenuBar` / `Toolbar` / `CommandPalette` |
| `ChipsErrorBoundary` / `ChipsLoadingBoundary` | antd `ErrorBoundary` / `Result`；`@chips/ui` `StateBoundary` |
| `useChipsState` / `createBinding` / `useFieldBinding` 等 | React 原生 `useState/useEffect` |
| 组件 token / 主题契约（L10/L11） | `@chips/ui` `appleTheme` + antd token |

现行正式口径：

- 技术选型与版本基线：`生态共用技术文档/前端基础/01-前端技术选型.md`
- 统一视觉规范：`生态共用技术文档/前端基础/02-统一视觉规范.md`
- 共享层使用：`生态共用技术文档/前端基础/03-共享层使用指南.md`
- 组件映射细节：`项目日志与笔记/task030-卸担计划/04-组件映射对照表.md`（任务过程材料）

## 文档清单（历史参考）

| 编号 | 文档 | 原用途 |
|---|---|---|
| 00 | 组件库文档索引 | 组件库文档索引与统一口径 |
| 01 | 组件库对外使用总览 | 开发者接入方式与边界 |
| 02 | 组件契约标准 | `data-scope/data-part/data-state` 标准 |
| 03 | Token与主题对接标准 | 组件与主题包的 token 契约 |
| 04 | 组件库接入指南 | 新项目接入流程 |
| 05 | 可访问性与质量基线 | a11y、测试、性能门禁 |
| 06 | 卡片封面组件标准 | `EmbeddedDocumentFrame` / `CardCoverFrame` |
| 07 | 复合卡片窗口与SDK显示链路标准 | CompositeCardWindow 与 SDK 显示接口 |
| 08 | 编辑引擎基础卡片装配与编辑运行时标准 | 编辑引擎 iframe 拼装与编辑运行时 |
| 09 | SwiftUI对标基础控件能力矩阵 | 基础控件覆盖矩阵 |
| 10 | 状态环境与Binding模型 | State / Environment / Binding / Form |
| 11 | 焦点键盘与A11y交互模型 | FocusScope、roving tabindex 等 |
