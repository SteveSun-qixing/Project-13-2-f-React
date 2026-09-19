# 阶段 4：社区打开链路与 Web 插件宿主

1. 实现 open-view 和 render-status 接口。
2. 社区 `/cards/:cardId`、`/boxes/:boxId` 路由只负责读取来源信息并创建 `com.chips.card-viewer` Web 会话。
3. 新增或迁移 `DocumentPluginRoutePage`，向插件传递 `launchParams.cardSource`。
4. `HostedPluginSurface` 消费 `plugin.chrome.update/action` 与 `plugin.surface.resize`，在 document 模式下提供返回、标题日期和 action slot。
5. 列表与详情页使用独立封面字段，移除对旧 `htmlUrl` 是否存在的打开判断。
6. 保持 `resource.open` 命中图片查看器等二级 app 插件的正式链路。

验收命令：

```bash
pnpm --dir Chips-CommunityPlatformServer --filter @ccps/server test
pnpm --dir Chips-CommunityPlatformServer --filter @ccps/server build
pnpm --dir Chips-CommunityPlatformServer --filter @ccps/web build
```
