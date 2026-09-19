# 任务011：应用脚手架 Environment 入口子代理勘察报告

时间：2026-05-24

## 勘察结论

子代理只读检查了 `chips-scaffold-app` 标准应用模板、测试门禁、生成工程 e2e 脚本和脚手架内部文档。结论是旧模板仍存在以下旧口径：

- `App.tsx.tpl` 手写 `useEffect + chipsClient.theme.getCurrent()` 读取主题；
- `App.tsx.tpl` 直接读取 `window.chips` 作为 `ChipsThemeProvider.eventSource`；
- `src/hooks/useChipsBridge.ts.tpl` 会被生成到新应用工程；
- `useAppCommands.ts.tpl` 默认直接导入 singleton `chipsClient`，没有通过 Environment 获取；
- `README.md.tpl`、脚手架内部需求/技术文档还残留 `useChipsBridge` 与 Bridge/API/SDK 并列入口描述；
- 模板检查和 e2e 只禁止 `window.chips.invoke("command.*")`，没有覆盖旧 `useChipsBridge` 与根 Environment Provider。

## 已吸收的处理项

本阶段已吸收并完成：

- App 模板改为 `ChipsEnvironmentProvider + useChips*`。
- 命令 hook 改为 `useChipsClient()` 获取同一 SDK client。
- `ExamplePanel` 改为从 `useChipsI18n().locale` 驱动本地资源 fallback。
- 旧 `useChipsBridge.ts.tpl` 移入脚手架仓内部 `归档/`，不再进入生成工程。
- `check-templates.mjs` 改为递归扫描 active `src/**` 模板源码，并增加 Environment hooks 与旧 Bridge hook 禁止断言。
- `template-engine.test.ts` 与 `run-generated-e2e.mjs` 增加生成工程 Environment 入口断言。
- README、脚手架内部文档与生态公共文档同步到新口径。

## 允许与禁止的 `window.chips` 口径

允许出现：

- 公共 Bridge 文档、插件开发指南中解释 L5 Bridge 或非 React/底层直连场景的引用。
- SDK Bridge adapter、类型声明、测试 mock 或 transport 实现中描述公共 Bridge 形状。
- 组件库或 hook 层内部为了事件源兼容而抽象的接口类型。

不应留在模板业务源码中：

- `templates/app-standard/src/**` 直接出现 `window.chips` 或 `(window as any).chips`。
- 本地 `useChipsBridge` hook。
- App 根组件手写 `window.chips` 作为主题事件源。
- 菜单、工具栏、命令、主题、多语言、surface/launch context 示例绕过 SDK client 或 Environment hooks 直连 Bridge。

## 后续任务建议

以下缺口不属于任务011第二阶段主线，已转为后续任务文档：

- `@chips/testing` 若要被模板 TS 测试正式导入，需要确认类型声明是否完整。
- `useChipsI18n().t` 当前偏异步接口，渲染期同步 i18n adapter 仍需要正式设计。
- 标准应用模板需求仍包含“语言切换示例”，当前没有 `i18n.write` 权限与切换入口，需要后续专项补齐。
