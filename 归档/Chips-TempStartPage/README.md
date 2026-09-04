# Chips TempStartPage

> 插件 ID：`com.example.chips-tempstartpage`

这是一个薯片生态 `type: app` 应用插件工程，默认使用 Host surface、`chips-sdk`、React、antd 组件库、`@chips/ui` 共享层、命令系统、预览 smoke 与质量门禁。

## 快速开始

```bash
cd <生态根工作区>
npm install
cd Chips-TempStartPage
npm run dev
```

应用插件依赖通过生态根工作区解析；工程根 `manifest.yaml` 是唯一正式清单源，Host 通过 `entry: dist/index.html` 加载构建产物。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint`：执行源码规范检查。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm test`：运行单元测试与 e2e smoke。
- `npm run build`：构建应用插件产物。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run preview:smoke`：生成 Host mock 预览链路报告并校验报告，报告写入 `reports/preview/app-preview-smoke.json`。
- `npm run quality:gate`：生成生态质量门禁摘要报告，报告写入 `reports/quality/quality-gate.json`。
- `npm run verify`：串联执行完整本地验证。

`reports/` 是本地验证产物目录，默认不纳入版本管理。`preview:smoke` 是报告级 smoke，用于确认 mock 预览、manifest、surface 与入口资产状态；真实 Host 窗口联调仍使用 `chipsdev-r run`。`quality:gate` 是生态态势摘要，失败检查会阻断本地验证，warning 需要开发者按报告判断。

## 命令行入口

`manifest.yaml` 默认声明一条 `cli.commands` 应用入口：

```bash
chips chips-tempstartpage open "启动参数"
```

该命令由 Host 动态发现，执行时通过 `surface.open` 打开当前应用，并把位置参数写入 launch context 的 `cli.payload.subject`。应用插件不是独立 OS CLI 程序，后续如需投递应用内部 command，应继续通过 Host `command.invoke` 链路。

## 目录结构

```text
Chips-TempStartPage/
├─ manifest.yaml
├─ package.json
├─ chips.config.mjs
├─ index.html
├─ assets/
│  └─ icons/
├─ config/
│  ├─ app-config.ts
│  └─ logging.ts
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ app/
   │  ├─ AppRoot.tsx
   │  ├─ AppRuntimeProvider.tsx
   │  ├─ AppShell.tsx
   │  ├─ app-shell.css
   │  └─ scene-registry.ts
   ├─ commands/
   │  ├─ app-commands.tsx
   │  └─ useAppCommands.ts
   ├─ lib/
   │  └─ messages.ts
   ├─ preview/
   ├─ runtime/
   ├─ scenes/
   ├─ testing/
   │  ├─ mock-environment.ts
   │  └─ render-with-antd.tsx
   └─ views/
      └─ RuntimeDiagnosticsView.tsx
└─ tests/
   ├─ unit/
   └─ e2e/
```

## 技术口径

- 官方前端栈使用 React；组件库使用 antd（`6.5.4`），图标使用 `@ant-design/icons`，日期使用 `dayjs`。
- 视觉统一由 `@chips/ui` 共享层提供：`ConfigProvider theme={appleTheme}`、`AppleStyle` 全局基础样式、`ChipsProvider`（`window.chips.*` 运行时）、`CommandProvider`（应用内命令注册表）、`AppChrome`（菜单栏/工具栏/命令面板外壳）。
- 系统能力通过 `chips-sdk` 与 `window.chips.*` 正式链路消费，禁止跨层直连 Host 内部实现。
- 应用内命令通过 `client.command.*` 注册、查询、调用和监听，同时以共享层 `CommandItem` 模型驱动菜单与工具栏；命令行入口写入 `manifest.cli.commands`，不写入旧 `manifest.commands`。
- 用户可见文案简体中文直写，需要参数插值或集中维护的文案统一放在 `src/lib/messages.ts`（`formatMessage(key, params)`）。
- 视觉表达走 antd token 与 `@chips/ui` 共享层样式；应用私有样式放 `src/app/app-shell.css`（`app-*` 类名前缀，颜色取生态苹果色固定值），JSX 内不写复杂内联样式。
- 应用入口图标来自 `manifest.ui.launcher.icon`，运行时 UI 图标使用 `@ant-design/icons`。
