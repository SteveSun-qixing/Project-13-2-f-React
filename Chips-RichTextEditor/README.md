# 富文本编辑器

`Chips-RichTextEditor` 是一个运行在 Chips Host 内部的单文档 Markdown 所见即所得编辑器。它不重写富文本编辑运行时，而是直接调用正式的富文本基础卡片编辑器，把这条能力包装成一个独立应用。

当前正式界面采用统一应用壳（antd + `@chips/ui`）：

1. Electron 原生窗口标题栏；
2. 中央连续正文编辑区；
3. 信息弹窗（antd Modal）与轻量状态提示。

当前应用入口已迁移到共享层运行时基线：

1. `src/App.tsx` 只 re-export `src/app/AppRoot.tsx`；
2. `AppRoot` 串联 `ConfigProvider(appleTheme, zhCN)`、antd `App`、`ChipsProvider` 与 `CommandProvider`；
3. `AppShell` 使用共享层 `AppChrome` 渲染内容区与命令面板；
4. 文件、预览、信息与基础编辑入口统一注册到共享层 `CommandProvider`，快捷键由共享层分发。

本应用创建和保存的正式产物始终是复合卡片 `.card` 文件，结构固定为：

1. 一个复合卡片容器；
2. 一个富文本基础卡片。

## 目录

- `src/`：应用壳层、编辑器 iframe 宿主、卡片会话与保存链路
- `需求文档/`：产品范围、使用场景、验收标准
- `技术手册/`：实现架构、卡片写回、运行时资源桥说明
- `开发计划/`：阶段拆分与当前交付状态

## 正式能力边界

- 富文本编辑能力来自 Host `card.renderEditor` / SDK `client.card.editorPanel.render(...)` 正式链路；
- Markdown 持久化格式遵循 `base.richtext` 基础卡片正式配置，包含 `markdown_capabilities` 能力矩阵；
- 命令面板与快捷键统一通过共享层 `CommandProvider` 命令注册表分发；
- 文件读写通过 `chips-sdk` 的 `card.*`、`file.*`、`platform.*` 完成；
- 本项目当前不声明 `file-handler:.card`，避免在现有 Host 处理器优先级规则下与卡片查看器争抢默认 `.card` 打开入口。

## 开发与验证

```bash
npm install
npm run lint
npm test
npm run build
npm run validate
```
