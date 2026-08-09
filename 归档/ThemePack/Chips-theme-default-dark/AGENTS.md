# Chips-theme-default-dark AGENTS

## 角色

- 本项目是官方暗夜主题包；负责暗夜主题的 token、CSS、契约与构建产物。

## 开发规则

- 暗夜主题是独立主题包，不要在本包内额外实现 light / dark 模式切换分支。
- 保持 token、CSS、组件契约和构建脚本同步，不要把运行时逻辑或应用私有视觉修补写进主题包。
- 公共规则应优先回到共享主题文档；本仓只记录暗夜主题如何消费既有契约。

## 验证

- 优先运行 `npm run build`、`npm run validate:theme` 和 `npm test`。
