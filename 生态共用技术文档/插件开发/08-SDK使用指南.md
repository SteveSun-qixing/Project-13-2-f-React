# SDK使用指南

## 概述

薯片 SDK 当前主要面向两类场景：

- 薯片主机内部应用插件；
- 第三方集成与生态内部工具链。

SDK 提供对 Host 正式能力的类型化封装。运行时主实现仍在 Host，SDK 不承载主运行时。

## 安装

生态一方仓库统一通过根工作区安装：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f
npm install
```

随后在工程中声明正式 semver 依赖，例如：

```json
{
  "dependencies": {
    "chips-sdk": "^0.1.0"
  }
}
```

## 架构边界

- Host 负责运行时主链路，包括主题、插件分发、统一渲染、基础卡片会话与 Bridge 服务。
- SDK 负责类型、调用封装、脚手架和测试辅助。
- 用户设备只安装 Host 即可运行应用；SDK 仅在开发和集成阶段使用。

## 开发工作区与用户工作区

与 SDK 配套的正式命令是 `chipsdev`。

- `chips` 管理用户工作区 `~/.chips-host`
- `chipsdev` 管理开发工作区 `.chips-host-dev`

开发态下安装插件、启用主题、切换主题或检查 Host 状态，应优先使用 `chipsdev`。

## 基础调用

SDK 客户端通过 Bridge 调用 Host 服务域。

常见能力：

- `client.card.parse(...)`
- `client.card.validate(...)`
- `client.card.render(...)`
- `client.card.renderCover(...)`
- `client.card.editorPanel.render(...)`
- `client.card.basecard.*`
- `client.plugin.*`
- `client.theme.*`

## 复合卡片显示

复合卡片显示的正式接口为：

```ts
client.card.compositeWindow.render({
  cardFile: string,
  mode?: 'view' | 'preview',
  interactionPolicy?: 'native' | 'delegate'
}): Promise<IframeWindow>
```

说明：

- `mode` 只允许 `view | preview`
- `interactionPolicy` 只允许 `native | delegate`
- `CompositeCardWindow` 仍是对外公开的正式 Host 托管复合卡片链路

推荐事件订阅：

```ts
const preview = await client.card.compositeWindow.render({
  cardFile: '/workspace/demo.card',
  mode: 'preview',
  interactionPolicy: 'delegate',
});

const disposeResize = client.card.compositeWindow.onResize(preview.frame, (payload) => {
  console.log(payload.height, payload.reason);
});

const disposeNodeSelect = client.card.compositeWindow.onNodeSelect(preview.frame, (payload) => {
  console.log(payload.nodeId, payload.cardType, payload.pluginId);
});

const disposeInteraction = client.card.compositeWindow.onInteraction(preview.frame, (payload) => {
  console.log(payload.intent, payload.deltaX, payload.deltaY);
});
```

## 封面显示

封面的正式接口为：

```ts
client.card.coverFrame.render({
  cardFile: string,
  cardName?: string
}): Promise<IframeWindow>
```

正式规则：

- Host 返回 `.card/cover.html` 的受控 `coverUrl`
- SDK 使用该 `coverUrl` 创建 iframe
- 封面资源保存在卡片根目录
- `cover.html` 作为入口文件，内部资源按卡片根目录规则解析
- 封面链路不自动注入主题和多语言运行时

## Host 托管编辑器

通用编辑器 iframe 接口为：

```ts
client.card.editorPanel.render({
  cardType: string,
  initialConfig?: Record<string, unknown>,
  baseCardId?: string,
  cardRootDir?: string
}): Promise<IframeWindow>
```

说明：

- 适用于第三方宿主、调试工具和需要 Host 托管编辑器 iframe 的应用
- `cardRootDir` 用于资源导入和资源解析遵循卡片根目录规则

推荐事件订阅：

```ts
const result = await client.card.editorPanel.render({
  cardType: 'base.richtext',
  baseCardId: 'base-1',
  cardRootDir: '/workspace/demo.card',
  initialConfig: {
    id: 'base-1',
    body: '<p>Hello</p>',
  },
});

const disposeReady = client.card.editorPanel.onReady(result.frame, () => {
  console.log('editor ready');
});

const disposeChange = client.card.editorPanel.onChange(result.frame, (payload) => {
  console.log(payload.baseCardId, payload.config);
});
```

## 基础卡片会话 API

`client.card.basecard.*` 是 Host 托管的单基础卡片会话能力，当前正式用于编辑引擎，也可供未来正式纳入生态决议的宿主使用。

```ts
const session = await client.card.basecard.openSession({
  cardType: 'base.richtext',
  baseCardId: 'base-1',
  cardRootDir: '/workspace/demo.card',
  sourceConfig: {
    body: '<p>Hello</p>',
  },
});

const preview = await client.card.basecard.renderView({
  sessionId: session.sessionId,
  interactionPolicy: 'delegate',
});

const editor = await client.card.basecard.renderEditor({
  sessionId: session.sessionId,
});

await client.card.basecard.closeSession(session.sessionId);
```

`openSession` 返回：

- `sessionId`
- `pluginId`
- `cardType`
- `baseCardId`
- `displayName`
- `normalizedConfig`
- `validation`
- `referencedResources`
- `commitDebounceMs`
- `supportsEditor`

正式规则：

- `referencedResources` 使用卡片根目录相对路径
- 传入 `cardRootDir` 后，Host 生成的单卡文档会按卡片根目录解析内部资源
- 宿主不得绕过 `openSession` 自行实现插件归一和校验

## 资源导入与路径规则

- 卡片内部资源路径统一以卡片根目录为基准记录
- 基础卡片编辑器通过宿主正式资源桥导入和管理资源：
  - `importResource({ file, preferredPath? })`
  - `resolveResourceUrl(resourcePath)`
  - `releaseResourceUrl(resourcePath)`
  - `deleteResource(resourcePath)`
- 正式默认导入目录为 `assets/`
- 封面资源通常位于 `cardcover/`

示例：

- `assets/photo-1.png`
- `cardcover/cover-image.png`

## 与编辑引擎的关系

- `compositeWindow/editorPanel/coverFrame` 仍是 SDK 对外公开的正式接口
- 官方 `Chips-EditingEngine` 编辑态不再把 `compositeWindow/editorPanel` 作为主链路
- 官方编辑引擎改为“自己装配复合卡片窗口 + 使用 `client.card.basecard.openSession(...)` 获取权威会话结果，再直接挂载基础卡片编辑器导出”

## 插件管理

常用插件接口：

```ts
client.plugin.list(options?: { type?: PluginType; capability?: string }): Promise<PluginInfo[]>;
client.plugin.install(manifestPath: string): Promise<{ pluginId: string }>;
client.plugin.enable(pluginId: string): Promise<void>;
client.plugin.disable(pluginId: string): Promise<void>;
```

主题相关接口：

```ts
client.theme.getCurrent();
client.theme.getAllCss();
client.theme.apply({ id: 'chips-official.default-theme' });
```

## 约束

- 普通应用和第三方宿主不得直接 import 基础卡片插件源码
- 不得自行复制 Host 统一渲染主链路
- 不得把内部资源路径改写为宿主私有绝对路径
- 需要基础卡片级别控制时，应使用正式 `client.card.basecard.*`
