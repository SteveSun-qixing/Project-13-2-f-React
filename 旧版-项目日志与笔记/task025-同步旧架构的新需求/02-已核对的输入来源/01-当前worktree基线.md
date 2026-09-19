# 当前 worktree 基线

- 当前分支：`task022-优化薯片组件库和主题系统`
- 原主工作区分支：`develop`
- merge-base：`b4ea582638ebb18944e209f36632e6e2f67b0706`
- 当前重构基线已存在：
  - `Chips-CardViewer` 的 AppRuntime / Scene / `document.window.render` 链路；
  - `Chips-BookReader` 的 AppRuntime、阅读引擎和 `InteractionManager` 分层；
  - `Chips-Host` 的 `card.renderCover`、`box.renderCover`、`box` 文档窗口和 Host 服务域；
  - `Chips-SDK` 的 `client.document.window.render`、`client.card.coverFrame.render`、`client.box.renderCover`；
  - `Chips-CommunityPlatformServer` 的 Web 插件宿主和 `HostedPluginSurface`；
  - `Chips-ModulePlugin/Chips-CardtoHTML-Plugin` 等已有模块插件能力。
