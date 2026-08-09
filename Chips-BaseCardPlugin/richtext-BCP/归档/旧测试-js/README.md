# 归档说明

- 归档时间：2026-08（task030 卸担计划，richtext-BCP antd 迁移）
- 归档原因：这 4 个 `.js` 测试文件是脚手架旧版 HTML 方案（chips-scaffold-basecard 早期模板）遗留的陈旧测试，引用当前代码中已不存在的 API 与 DOM 结构（`sanitizeRichTextHtml`、`.chips-basecard__body`、`.chips-basecard-editor__richtext`、`{ id, body, locale }` 旧配置形状），无法通过 vitest 收集（`vitest.config.mts` 仅 include `tests/**/*.test.ts` / `tests/**/*.test.tsx`），也未被 tsconfig 纳入检查，属于死代码。
- 归档内容：
  - `editor-panel.test.js`：旧版正文编辑面板测试（对应现行 `tests/unit/editor-panel.test.tsx`）
  - `render-view.test.js`：旧版查看态渲染测试（对应现行 `tests/unit/render-view.test.tsx`）
  - `card-flow.test.js`：旧版集成流测试（对应现行 `tests/integration/card-flow.test.ts`）
  - `sanitizer.test.js`：旧版 HTML 清洗函数测试（当前正式方案为 Markdown 内容模型，无该函数；对应现行 `tests/unit/sanitizer.test.ts` 的 Markdown 工具测试）
- 替代方案：现行 `.ts` / `.tsx` 测试（见上）覆盖同等验证面。
