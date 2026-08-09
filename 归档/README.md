# 工作区归档总说明

> 本目录统一保存薯片生态工作区中已废弃、已被替代或暂存的历史内容。归档遵循 AGENTS.md 规则：禁止删除文件，需要移除的内容统一移动到就近 `归档/` 目录，并保留"为什么废弃"的说明，避免后人重复造轮子。

---

## 2026-08-08 · task030 卸担计划归档

### 背景

薯片生态完成 antd 迁移（task030 卸担计划）：自研组件库、主题系统、多语言系统全部废弃，全生态统一为 **React 18 + antd v6 + @ant-design/icons + @chips/ui** 技术栈，界面文案简体中文直写，视觉统一走 antd 主题 token。

### 废弃原因

- 自研组件库（@chips/component-library）维护成本高、生态封闭，难以满足长期拓展需求；
- 主题系统（ThemePack）与 antd 主题体系重复，视觉样式无法与行业成熟方案对齐；
- 多语言系统与"简体中文直写"决策重复。

### 替代方案

- **antd v6（6.5.4）+ @ant-design/icons（6.3.2）+ dayjs**：行业成熟组件方案；
- **@chips/ui（Chips-Ui 仓库）**：antd 主题配置（apple-theme.ts）、全局样式、公共组件与运行时统一收拢；
- 视觉规范唯一事实源：`Chips-Ui/src/theme/apple-theme.ts` + `global.css`。

### 本次归档清单（2026-08-08）

| 源 | 目标 | 说明 |
|---|---|---|
| `Chips-ComponentLibrary/` | `归档/Chips-ComponentLibrary/` | 自研组件库整体归档，自带 README.md 保留 |
| `ThemePack/` | `归档/ThemePack/` | 主题系统整体归档（与既有 stale 归档内容合并） |
| `Chips-Scaffold/chips-scaffold-theme/` | `归档/Chips-Scaffold/chips-scaffold-theme/` | 主题脚手架归档，其余脚手架由其他任务同步适配 |

> 每个归档单元内均有一份 `归档说明.md` 记录归档时间、背景、废弃原因与替代方案。
