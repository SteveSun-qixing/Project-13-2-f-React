# 你好世界（`chips.example.hello`）

最小应用插件（`app` 角色）示例：窗口应用，注册启动器入口，窗口标题跟随自身配置，界面展示问候语并演示主进程与渲染进程两条平台访问链路。本插件是金链路（W2）的首个被测插件，与 `@chips/sdk/scaffold` 的 `app` 角色模板同构。

## 目录结构

```text
examples/plugins/hello/
├── manifest.yaml                 # 唯一权威清单
├── package.json                  # 工作区包 @chips/plugin-hello
├── tsconfig.json                 # 继承仓库 tsconfig.base.json
├── vite.shared.ts                # 构建期 R4 导入红线守卫
├── vite.main.config.ts           # 主进程入口构建（dist/index.js）
├── vite.render.config.ts         # 渲染入口构建（render.js，外部化平台 vendor）
├── vitest.config.ts              # 单测与组件测试配置
├── assets/
│   ├── icons/app.svg             # 启动器图标
│   └── schemas/config.schema.json # 插件自身配置 schema 与默认值
├── tests/
│   └── setup.ts                  # 断言扩展与 jsdom API 兜底（不伪造平台调用）
└── src/
    ├── index.ts                  # IAppPlugin 实现（构建为 dist/index.js）
    ├── index.test.ts             # 主逻辑单测
    └── ui/
        ├── AppView.tsx           # 应用窗口 UI 根组件（构建为 render.js）
        └── AppView.test.tsx      # 组件测试
```

## 功能

| 项       | 说明                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 表面     | `ui.surface: window`，关闭主窗口即结束实例（`runtime.background: false`）                                                                       |
| 配置     | `title` 控制窗口标题，`greeting` 控制界面问候语；默认值来自配置 schema，未显式覆盖时不落盘                                                      |
| 界面     | 问候语、点击计数按钮（金链路冒烟项）、复制问候语按钮                                                                                            |
| 命令     | `hello:set-greeting`、`hello:notify`、`hello:exit`，在 `launch` 中经 `command:register` 注册，由平台以 `handleCommand(commandId, payload)` 派发 |
| 能力调用 | 主进程：`ctx.bridge.request('notification:send', …)`；渲染进程：`chips.request('config:get'                                                     | 'clipboard:write', …)`与`chips.subscribe('config:changed', …)` |
| 权限     | `command:write`、`notifications:send`、`clipboard:access`（最小范围）                                                                           |

命令用法（平台命令面板或命令系统调用方）：

```text
hello:set-greeting  { "greeting": "早上好！" }   # 写入用户层配置，界面与窗口标题联动
hello:notify        { "title": "你好", "body": "来自示例插件的通知" }
hello:exit                                       # 结束当前应用实例
```

## 构建与验证

```bash
pnpm --filter @chips/plugin-hello run typecheck
pnpm --filter @chips/plugin-hello run test
pnpm --filter @chips/plugin-hello run build
pnpm --filter @chips/plugin-hello run package
pnpm exec chips plugin validate examples/plugins/hello
```

开发宿主中按 `薯片生态文档库/03-插件开发/01-快速开始.md` 的流程启用：插件管理中出现开发来源的「你好世界」，启用后启动器出现入口，打开窗口标题为「你好世界」，界面显示计数按钮。

## 约束

- 主逻辑与 UI 不共享内存：两者各自访问平台，协作经配置与标准事件（`config:changed`）。
- 模块顶层只声明，全部副作用在 `launch` 中；`beforeExit` 只做收尾。
- UI 只从 `@chips/ui` 导入组件与令牌，样式只用 Design Tokens 与内联布局，文案为简体中文直写。
- `dist/index.js` 完全自包含，`render.js` 只引用平台 vendor URL；两个入口均不超过 8 MiB。

---

**文档结束**
