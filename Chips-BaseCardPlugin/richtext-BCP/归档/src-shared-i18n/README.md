# 归档说明

- 归档时间：2026-08（task030 卸担计划）
- 归档原因：废弃 `createTranslator(locale)` 翻译器（含 `en-US` 字典与 `normalizeLocale` 解析），界面文案统一简体中文直写。
- 归档内容：`i18n.ts` —— 旧的轻量翻译函数实现（`normalizeLocale` / `interpolate` / `createTranslator`）。
- 替代方案：`src/lib/messages.ts` 的 `formatMessage(key, params)`（简体中文文案总表），调用点由 `t(...)` 迁移为 `formatMessage(...)`。
- 关联规范：`项目日志与笔记/task030-卸担计划/06-多语言系统移除规范.md`、`04-组件映射对照表.md` 第 11 节第 7 条（i18n 移除样板）。
