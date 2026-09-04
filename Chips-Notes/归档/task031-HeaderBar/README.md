# 归档说明：HeaderBar

本目录保存 task031 润物计划（P1-2）中，编辑引擎移除的旧自研菜单栏/工具栏组件 HeaderBar。

## 归档内容

| 原路径 | 归档位置 | 移除原因 |
|---|---|---|
| `src/components/HeaderBar/HeaderBar.tsx` | `HeaderBar.tsx` | E3 迁移时已 props 化（接收 `CommandItem[]`），但全仓无任何渲染点，属于死代码（E1 遗留疑问 5、task031 前端优化检查报告 P1-2） |
| `src/components/HeaderBar/HeaderBar.css` | `HeaderBar.css` | 仅被 HeaderBar.tsx 引用的样式，随组件一并归档 |

## 说明

- 以上文件均按"移动不删除"规则归档，如需恢复可从此目录取回。
- 组件功能已由共享层 `@chips/ui` 的 AppChrome（命令面板 Mod+P 与快捷键分发）承载，工作台、工具窗口、Dock 等应用内容区 UI 由 `WorkspaceScene` 提供（见 `src/app/AppShell.tsx` 与 `src/scenes/WorkspaceScene.tsx`）。顶层菜单栏/工具栏已于共享层 AppChrome 精简时移除，归档后无功能缺失。
- `src/lib/messages.ts` 中仅被 HeaderBar 使用的 key（`commands.menu.*` 等）与 `// HeaderBar` 注释由 task031 收尾统一清理，本次未改动。
- 归档后 `rg 'HeaderBar' src tests --glob '*.ts' --glob '*.tsx'` 仅命中：`src/lib/messages.ts` 的 `// HeaderBar` 注释（收尾清理）与 `tests/unit/workspace-scene-chrome.test.ts` 的防回归断言（校验 WorkspaceScene 不再挂载 HeaderBar，仍有效）。
