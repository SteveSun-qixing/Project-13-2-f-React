# 归档说明：ThemePanel

本目录保存 task031 润物计划（P0-1）中，编辑引擎移除的旧主题系统残留卡片主题选择面板 ThemePanel。

## 归档内容

| 原路径 | 归档位置 | 移除原因 |
|---|---|---|
| `src/components/CardSettings/panels/ThemePanel.tsx` | `ThemePanel.tsx` | 调用 `client.theme.list() / client.theme.getCurrent()`（Host 主题服务）让用户为卡片选明/暗主题；task030 已废弃主题系统（全生态单一苹果风格，见 task030-卸担计划/第一阶段/07-主题系统移除规范.md），此面板是旧体系在编辑引擎的唯一运行时消费点，且卡片已不再消费 `themeCssText`（task031 前端优化检查报告 P0-1） |
| `src/components/CardSettings/panels/ThemePanel.css` | `ThemePanel.css` | 仅被 ThemePanel.tsx 引用的样式，随组件一并归档 |
| `tests/unit/theme-panel.test.tsx` | `theme-panel.test.tsx` | ThemePanel 的专项测试，组件移除后随之一并归档，避免失效测试被 vitest 拾取 |

## 说明

- 以上文件均按"移动不删除"规则归档，如需恢复可从此目录取回。
- "主题"页签已从卡片设置对话框（`CardSettingsDialog.tsx`）移除，其余页签（基础信息/封面/导出）原样保留。
- 卡片格式契约 `.card` 的 `theme` 字段保留（`card-service.ts` 读写、`ExportPanel` 导出透传均不变），仅不再提供 UI 选择，卡片默认使用全生态统一苹果风格外观。
- `src/lib/messages.ts` 中仅被 ThemePanel 使用的 key（`card_settings.theme_*` 等）由 task031 收尾统一清理，本次未改动。
- `client.theme` 在编辑引擎内的调用面随本面板归档后清零（Host 侧 theme 服务面的后续清理另行立项，见 07-主题系统移除规范.md 第 4 节）。
