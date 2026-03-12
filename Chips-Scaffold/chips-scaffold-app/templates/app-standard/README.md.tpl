# {{ DISPLAY_NAME }} 应用插件工程（由 chips-scaffold-app 生成）

> 插件 ID：`{{ PLUGIN_ID }}`  
> 模板：`app-standard`  
> 生成自：`chips-scaffold-app`

## 1. 快速开始

```bash
cd <生态根工作区>
npm install
cd {{ PROJECT_NAME }}
npm run dev        # 启动开发服务器（等价 chips dev server）
```

应用插件的一方依赖（如 `chips-sdk`、`@chips/component-library`）统一通过生态根工作区解析，本工程应通过 `chipsdev create` 接入生态工作区，不再单独在项目目录执行首次 `npm install`。

开发服务器启动后，薯片主机通过 `manifest.yaml` 中的 `entry: dist/index.html` 加载本插件窗口；标准模板同时预置 `ui.window.chrome`，默认启用白色窗口壳层与隐藏式标题栏覆盖层。

## 2. 可用脚本

- `npm run dev`：启动开发服务器（`chips dev server`）
- `npm run build`：构建 `cpk` 插件包（`chips dev build`）
- `npm test`：运行单元测试与组件测试（`chips dev test`，基于 Vitest）
- `npm run lint`：运行代码规范检查（`chips dev lint`）
- `npm run validate`：执行插件规范校验（`chips dev validate`）

## 3. 目录结构总览

```text
{{ PROJECT_NAME }}/
├─ .eslintrc.cjs        # 工程级 ESLint 配置（供 chipsdev lint 调用）
├─ manifest.yaml        # 插件清单（id/name/version/type/permissions/entry 等）
├─ package.json         # NPM 包描述与脚本
├─ tsconfig.json        # TypeScript 配置
├─ chips.config.mjs     # Chips Dev 构建/运行配置
├─ index.html           # HTML 入口文件
├─ src/
│  ├─ main.tsx          # React 入口（挂载到 index.html）
│  ├─ App.tsx           # 根组件
│  ├─ i18n.ts           # 本地词典与运行时语言适配
│  ├─ components/       # 示例组件
│  └─ hooks/            # 示例 hooks（如 useChipsBridge）
├─ config/
│  ├─ app-config.ts     # 应用级配置（Feature Flag 等）
│  └─ logging.ts        # 日志封装（预留接入 Host 日志服务）
├─ i18n/
│  ├─ zh-CN.json        # 中文文案
│  └─ en-US.json        # 英文文案
├─ tests/
│  ├─ unit/             # 单元/组件测试
│  └─ e2e/              # 主流程 smoke / 项目级回归测试种子
└─ assets/
   └─ icons/            # 图标等静态资源
```

## 4. 技术栈与规范

- 前端框架：React（参见生态设计原稿与应用插件开发指南）
- UI 能力：`@chips/component-library`（组件库对外使用总览）
- 多语言：所有界面文案通过 `i18n/*.json` 管理，不在组件内硬编码文本
- 主题系统：通过组件库 `ChipsThemeProvider` 接入主题运行时，并监听 `theme.changed` 事件，不在业务代码中硬编码主题颜色链路
- 系统能力调用：仅通过 `window.chips.*`（Bridge API），不越层直接访问 Host 内部模块
- 快捷方式图标：将应用图标放在 `assets/icons/app-icon.ico`，Host 在为应用插件创建系统快捷方式时会优先读取该文件

## 5. 快捷方式与启动上下文

- `manifest.yaml` 已预置 `ui.launcher.displayName` 与 `ui.launcher.icon`，用于 Host 创建应用快捷方式；
- 当前 Host 正式入口：
  - Windows：桌面快捷方式
  - macOS：`~/Applications/Chips Apps/*.app`，并显示于启动台
- 模板示例已包含 `window.chips.platform.getLaunchContext()` 读取逻辑，可用于区分：
  - `app-shortcut`
  - `file-association`
  - `chipsdev.run`
- 如果你的应用需要在被快捷方式或文件关联拉起时恢复状态，应优先从 `launchContext.launchParams` 中读取参数，而不是解析命令行。

## 6. 下一步开发建议

1. 根据业务需要在 `src/features/` 或 `src/components/` 中扩展页面与组件；
2. 通过组件库与主题系统接入真实 UI 并补充交互测试；
3. 按需扩展 `manifest.yaml` 中的权限与 capabilities（遵循插件开发规范与 Manifest 配置规范）；
4. 若模板启用了隐藏式标题栏，页面头部必须提供拖拽区，并将交互控件显式标记为 `no-drag`；
5. 在编写或调整 Host/Bridge 调用前，查阅生态共用技术文档中的协议与接口标准章节，避免契约漂移。
