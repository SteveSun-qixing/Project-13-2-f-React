# 书籍阅读器 iframe 焦点键盘翻页修复

目标：

- 在章节 iframe 获得焦点后，PageDown、PageUp、方向键、空格等仍进入阅读器交互管理器。
- `InteractionManager.attachToFrame(...)` 应同步挂载当前 `KeyboardHandler`。
- iframe 内键盘事件必须阻止浏览器默认小段滚动，并映射为正式阅读导航意图。
- 保留现有导航锁、防抖和连续输入行为。

当前新架构落点：

- `Chips-BookReader/src/interaction/interaction-manager.ts`
- `Chips-BookReader/tests/unit/interaction-manager.test.ts`
- `Chips-BookReader/技术文档/02-书籍阅读器实现说明.md`
