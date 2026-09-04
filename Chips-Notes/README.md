# 笔记

> 插件 ID：`chips-official.notes`  
> 插件类型：应用插件（`type: app`）  
> 工程角色：薯片生态笔记应用

## 1. 工程定位

笔记应用是薯片生态的笔记管理应用，负责：

- 笔记的创建、编辑与管理；
- 通过 Host / Bridge / `chips-sdk` 正式链路访问文件、配置、插件与模块能力；
- 在运行时统一消费 `RuntimeIcon`（`@ant-design/icons`）图标系统，而不是 emoji 或字符串图标。

当前工程不是脚手架示例，不允许再按模板工程理解其目录、脚本与运行边界。

## 2. 快速开始

```bash
cd <生态工作区>
npm install
cd Chips-Notes
npm run dev
```

常用命令：

- `npm run dev`：启动开发服务器
- `npm run run`：通过 `chipsdev-r run` 在真实 Host 开发链路中运行
- `npm run build`：构建插件产物
- `npm test`：运行测试
- `npm run lint`：执行 ESLint
- `npm run validate`：执行插件契约校验

## 3. 应用框架结构

笔记应用基于应用插件 vNext 基线：

- `src/App.tsx`：轻量入口，只导出 `AppRoot`
- `src/app/`：`AppRoot`（antd ConfigProvider/App + `@chips/ui` ChipsProvider/CommandProvider + AppRuntimeProvider）-> `AppShell`（AppChrome）
- `src/runtime/`：SDK client 单例、launch/surface context 与启动动作
- `src/scenes/`：场景注册
- `src/commands/`：本地 `CommandItem` 命令定义（简体中文 + antd 图标）与命令 Provider
- `src/lib/messages.ts`：应用中文文案表（`formatMessage` 插值）

启动时会读取 Host `platform.getLaunchContext()`，合并 `surfaceContext.launchParams` 与顶层 `launchParams`，并交给 `AppRuntimeProvider` 的应用运行时上下文。

## 4. 正式运行边界

- 系统能力访问统一经 `chips-sdk` 与 `window.chips.*`，不直连 Host 内部实现。
- 命令面板、快捷键共享同一组 `CommandItem` 命令定义，不各自绑定业务函数。

## 5. 目录概览

```text
Chips-Notes/
├─ manifest.yaml
├─ package.json
├─ chips.config.mjs
├─ assets/
│  └─ icons/
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ app/                # AppRoot / AppShell（antd + @chips/ui 编排）
│  ├─ commands/           # 本地命令定义（CommandItem）与命令 Provider
│  ├─ components/         # UI 组件
│  ├─ context/            # 全局上下文
│  ├─ hooks/              # 运行时 hooks
│  ├─ icons/              # 运行时图标描述符与统一图标包装
│  ├─ lib/                # 应用中文文案表（messages.ts）
│  ├─ runtime/            # SDK client / launch / boot
│  ├─ scenes/             # 场景注册
│  ├─ services/           # Bridge / SDK 等服务封装
│  ├─ types/
│  └─ utils/
└─ tests/
```

## 6. 图标系统

笔记应用当前图标链路已经收口为正式实现：

- 运行时 UI 图标入口：`src/icons/descriptors.ts`
- 统一运行时组件：`src/icons/RuntimeIcon.tsx`
- 应用品牌图标组件：`src/icons/AppBrandIcon.tsx`
- 命令图标均使用 `IconDescriptor`

正式规则：

- 运行时 UI 图标统一走 `RuntimeIcon`（`@ant-design/icons` 按 `IconDescriptor.name` 映射）
- 不再保留 emoji、字符图标或 `icon: string`
- `manifest.yaml -> ui.launcher.icon` 只表示系统入口图标文件路径

## 7. 启动图标资产

- `manifest.yaml` 当前声明：`ui.launcher.icon: assets/icons/app-icon.ico`
- `assets/icons/app-icon.ico`、`assets/icons/app-icon.icns`、`assets/icons/app-icon.png` 图标资产
- 资产来源说明见 `assets/icons/SOURCE.md`

这些文件属于操作系统入口图标，不属于运行时 `RuntimeIcon` 图标模型。

## 8. 视觉、文案与可访问性

- 主题系统已移除：统一固定苹果风格（antd `ConfigProvider theme={appleTheme}` + 固定色值），不再读取 Host 主题与 `--chips-sys-*` 变量
- 多语言系统已移除：界面文案统一简体中文，集中文案表为 `src/lib/messages.ts`
- 接入 `@chips/a11y` 公共键盘模型、roving tabindex、ARIA 关系和焦点恢复

## 9. 验证矩阵

正式验证基线：

```bash
cd Chips-Notes
npm run lint
npm test
npm run build
npm run validate
```

## 10. 相关说明

- 若公共图标契约或标准发生变化，应先更新 `生态共用技术文档/`
- 若项目文档与 `manifest.yaml`、真实代码冲突，以真实代码与正式共享文档为准
