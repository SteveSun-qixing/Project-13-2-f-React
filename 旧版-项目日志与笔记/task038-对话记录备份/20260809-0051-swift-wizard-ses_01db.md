# 会话记录：swift-wizard

- 会话 ID：ses_01db64023ffeqIO1jQ0b0ak8zx
- 目录：/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React
- 会话创建：2026-08-09 00:51:51

---

## 2026-08-09 00:51:51

在 /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/Chips-BookReader 扩展排版自由度（task031 建议 2.3 + 5.4 竖排入口）。不做 Git 提交。

## 你的文件域（严格只改这些，禁止碰其他文件）
- src/utils/book-reader.ts：ReaderPreferences 增加 lineHeight(1.4–2.0, 默认1.65)、letterSpacing(0–0.06em, 默认0.01em)、textAlign("justify"|"left"|默认justify)、fontFamily 扩展("serif"|"sans"|"round"|"system")、writingMode("horizontal"|"vertical"|默认horizontal)；对应 clamp 函数；SUPPORTED 常量不动
- src/engine/readium-css-manager.ts：注入/更新 `--user-line-height`、`--user-letter-spacing`、`--user-text-align`、`--user-font-family-round` 变量与竖排 `writing-mode`（horizontal-tb/vertical-rl）应用（在现有 CSS 变量注入链路中追加；竖排时内容宽度自动适配窄列 `--user-content-width` 缩至 min(contentWidth, 560px)）；注意与现有 ReadiumCSS 变量命名兼容
- src/components/PreferencesPanel.tsx：新增"排版"分组：
  - 行高 Slider（1.4–2.0 step 0.1，实时预览）
  - 字距 Slider（0–0.06 step 0.005，显示 em）
  - 对齐 Segmented（两端/左对齐）
  - 字体 Segmented 扩展为 4 项（衬线/无衬线/圆体/系统），标签用对应字体渲染（fontFamily 内联样式）
  - 排版方向 Segmented（横排/竖排，竖排仅 CJK 内容建议提示）
  - 字号 Slider 改为显示 px（映射 clamp(12, fontScale*17, 28) 显示，值仍存 fontScale）
  - 现有 阅读模式/背景色调/列宽 分组保留
- 新文案直写中文（**不要改 src/lib/messages.ts**）；面板样式沿用现有 book-reader-preferences 类（需要时在本文件同目录加内联 style 或新建 preferences-extras.css）

## 实现要求
- 实时预览：所有控件 onChange 直接调 onUpdatePreferences（引擎 update 已有节流）；
- 竖排切换后提示"竖排模式适合中文书籍"（一行小字）；
- 偏好默认值保持向后兼容（旧存储无新字段时用默认值）；
- 禁 any/TODO/占位/删文件；不 import @chips/component-library。

## 验证
npx tsc --noEmit 只看你文件域无错。不跑 npm install / npm test。

## 汇报
改动文件清单、新增偏好字段与 CSS 变量说明、tsc 结论。
