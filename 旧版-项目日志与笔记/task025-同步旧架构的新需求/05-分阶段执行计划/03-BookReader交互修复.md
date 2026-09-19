# 阶段 3：BookReader 交互修复

1. 将旧提交中的 iframe 键盘接管需求迁入当前 `InteractionManager.attachToFrame`。
2. 补单测覆盖 iframe focus 下 PageDown 阻止默认滚动并触发 `onNavigate("next")`。
3. 更新阅读器实现说明。

验收命令：

```bash
npm --prefix Chips-BookReader test
npm --prefix Chips-BookReader run lint
npm --prefix Chips-BookReader run build
npm --prefix Chips-BookReader run validate
```
