# 任务06：应用脚手架 vNext 默认模板

## 1. 任务目标

把 `chips-scaffold-app` 升级为薯片前端框架的默认入口，让新应用一生成就具备：

- App/Scene/surface 结构。
- SDK client 和 React hooks。
- 统一 `View/Stack/Grid/Form/List` 页面结构。
- 主题系统初始化。
- 多语言初始化。
- 基础命令、导航、错误边界、空状态。
- 测试、预览、质量门禁。

## 2. 当前基础

已核对：

- `Chips-Scaffold/chips-scaffold-app/AGENTS.md`
- `Chips-Scaffold/chips-scaffold-app/package.json`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/*`
- `Chips-Scaffold/chips-scaffold-app/scripts/check-templates.mjs`
- `Chips-Scaffold/chips-scaffold-app/scripts/run-generated-e2e.mjs`

当前模板已有 React、组件库、主题 Provider、manifest、i18n 文件，但仍存在：

- 直接 `window.chips.invoke` 示例。
- 页面结构偏示例，不是框架默认结构。
- 硬编码少量中文文案。
- 没有 App/Scene/Command 心智。
- 没有默认预览/质量报告结构。

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-app`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `Chips-Host`
- `生态共用技术文档/插件开发/02-应用插件开发.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`

## 4. 开发内容

1. 模板结构升级。
   - `src/main.tsx`：创建应用入口。
   - `src/App.tsx`：App/Scene 根。
   - `src/scenes/MainScene.tsx`。
   - `src/routes` 或 `src/views`：页面组合。
   - `src/commands`：命令注册。
   - `src/runtime`：SDK client 初始化。
   - `src/i18n`：多语言 key。
   - `src/theme`：主题初始化。
   - `src/testing`：测试辅助。

2. manifest 默认升级。
   - 保留 `type: app`。
   - 必须声明 `runtime.targets`。
   - 必须声明 `ui.surface`。
   - 权限最小化。
   - 不能硬编码 Desktop-only 心智。

3. 默认 App Shell。
   - 使用 `ChipsThemeProvider`。
   - 使用 `useChipsTheme/useChipsI18n/useChipsSurface`。
   - 使用 `ChipsView/ChipsStack/ChipsSection` 等统一结构。
   - 默认包含错误边界、加载状态、空状态。

4. 默认命令和导航。
   - 示例命令从业务中抽离。
   - 命令可被 toolbar/menu/shortcut 复用。
   - 默认不创建复杂业务，只展示标准接线。

5. 测试和质量门禁。
   - 模板生成后 `npm run lint/typecheck/test/build/validate` 全部可过。
   - E2E 生成工程后验证 manifest、i18n、theme、SDK 接线。
   - 模板检查禁止残留 `{{ ... }}`。

6. README 更新。
   - 说明这是标准应用插件模板。
   - 不写任务计划或临时说明。
   - 明确 Host/SDK/组件库/主题包使用方式。

## 5. 建议文件范围

- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/*`
- `Chips-Scaffold/chips-scaffold-app/src/*`
- `Chips-Scaffold/chips-scaffold-app/scripts/check-templates.mjs`
- `Chips-Scaffold/chips-scaffold-app/scripts/run-generated-e2e.mjs`
- `Chips-Scaffold/chips-scaffold-app/tests/*`

## 6. 验收标准

- 新应用不直接调用 `window.chips.invoke`。
- 新应用默认使用 SDK 和官方 hooks。
- 新应用默认没有硬编码主题色和静态可见文案。
- 生成工程无模板占位符残留。
- 生成工程能通过 build/test/validate。
- manifest 与生态公共规范一致。

## 7. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-app
npm run build
npm test
npm run test:templates
npm run test:e2e
```

联动验证：

```bash
cd Chips-SDK && npm test
cd Chips-ComponentLibrary && npm run verify
```

## 8. 依赖任务

- 依赖：[任务04-App-Scene-surface-commands应用结构能力.md](./任务04-App-Scene-surface-commands应用结构能力.md)
- 依赖：[任务05-SDK-RuntimeClient与React消费入口.md](./任务05-SDK-RuntimeClient与React消费入口.md)

## 9. 风险与注意事项

- 脚手架只能消费已冻结契约，不要把未定接口写进模板。
- 不要生成 TODO、空实现、示例身份残留。
- 不要为了模板好看而绕开主题系统。

