# Chips-default AGENTS

## 角色

- 本项目是官方默认主题包；负责默认主题的 token、CSS、契约与构建产物。

## 开发规则

- 保持 token、CSS、组件契约和构建脚本同步，不要让主题实现和组件契约分叉。
- 不要在主题包内加入 Host、组件库或 SDK 的运行时行为补丁；主题只负责视觉表达。
- 若某条规则会被多个主题共同复用，应优先沉淀到共享主题文档，而不是只写在本主题里。

## 验证

- 优先运行 `npm run build`、`npm run validate:theme` 和 `npm test`。
