# 任务020：默认主题包 Token 与 Contract 升级

## 1. 任务目标

将 `ThemePack/Chips-default` 升级为新框架默认浅色主题基线，完整覆盖组件库扩容后的 token、组件 contract、布局 token、状态 token 与运行时注入要求。

## 2. 对应阶段任务

- `05-开发任务方案/任务14-主题系统与组件Contract治理.md`
- `05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`

## 3. 涉及项目

- `ThemePack/Chips-default`
- `Chips-ComponentLibrary/packages/tokens`
- `Chips-ComponentLibrary/packages/theme-contracts`
- `Chips-Host`
- `生态共用技术文档/主题系统`
- `生态共用技术文档/组件库`

## 4. 开发内容

1. 重新核对默认主题包现有 `manifest.yaml`、`tokens/`、`contracts/`、`src/build-tokens.ts`、`src/build-css.ts` 与测试。
2. 补齐新组件清单对应的 `chips.comp.*` token，至少覆盖布局原语、基础控件、复杂组件、导航、菜单、工具栏、表单、反馈、数据展示和编辑类组件。
3. 补齐 `chips.layout.*`、`chips.motion.*`、`chips.sys.*` 在 App/Scene/surface、Window、Document、Command、Preview 场景下的需要。
4. 将组件 contract 校验升级为读取组件库正式契约清单，不再维护局部最小 token 列表。
5. 确认 `dist/tokens.json`、`dist/theme.css`、图标字体、基础 CSS 与组件 CSS 能被 Host 主题服务读取并注入。
6. 补充主题矩阵快照，覆盖浅色主题在应用插件、基础卡片、箱子布局、模块配置面板中的表现。
7. 同步更新默认主题包内部技术文档；若新增跨生态 token 规范，先写入生态共用技术文档。

## 5. 验收标准

- 默认主题包覆盖组件库全部公开 contract。
- `theme.contract.get` 可以报告默认主题完整满足新框架要求。
- 所有组件在默认主题下无硬编码视觉依赖、无缺失 CSS 变量、无浅色专属临时样式。
- 主题构建产物可以被 Host、应用插件、卡片 iframe 与箱子布局复用。

## 6. 验证命令

```bash
cd ThemePack/Chips-default
npm run build
npm run validate:theme
npm test

cd ../../Chips-ComponentLibrary
npm run validate:contracts
npm run quality:gate
```

## 7. 注意事项

- 主题包只提供 token、CSS 和契约实现，不写 Host/SDK 运行时逻辑。
- 不在主题包中发明新的跨生态协议；新增 token 必须先进入组件库 token 与公共文档。
- 本任务开发前必须重新核对 Apple SwiftUI 当前主题/控件样式能力、组件库实际 contract 与 Host 主题运行时实现。
