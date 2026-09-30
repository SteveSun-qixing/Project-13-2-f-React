# 图片查看器

> 角色：`app`；插件 ID：`chips.official.photo-viewer`；版本：`0.1.0`

薯片生态的单图查看入口：缩放、平移、旋转、适应窗口、实际大小、保存副本与有序图包队列（`chips.book-card` image-sequence 载荷）。处理器层级为 image 槽位 `primary`（manifest `fileAssociations`，《14-资源打开与默认处理器契约》§3.1）；tiff/heic 等未覆盖格式由万能文件查看器兜底（《03-查看器设计》§8.2），本包不含任何格式归一/解码算法。

## 目录结构

```text
photo-viewer/
├── manifest.yaml            # 唯一权威清单（image 槽位 primary + dialogs:use / filesystem:write:${userHome} 权限）
├── package.json             # 工作区包 @chips/plugin-photo-viewer，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建 → render.js（外部化 React 与 @chips/ui）
├── vitest.config.ts         # 测试配置（jsdom + 平台面补充桩）
├── src/
│   ├── index.ts             # IAppPlugin：launch / openFile（标题与诊断；07-应用插件接口 §3）
│   ├── commands/            # cli.commands 对应命令元数据与 UI 命令运行时接线（13-命令系统契约 §5.6）
│   ├── viewer/
│   │   ├── image-viewer.ts          # 缩放/平移/旋转纯函数（旧仓迁移裁决件，测试随迁）
│   │   ├── usePhotoViewerCamera.ts  # 相机交互状态机（指针/滚轮/双指，旧仓迁移裁决件）
│   │   └── openQueue.ts             # 打开投递 → 查看队列（14-契约 §5 消费规则重写面）
│   └── ui/
│       ├── AppView.tsx              # 窗口界面根（ChipsProvider + CommandProvider 各挂一次）
│       ├── usePhotoSession.ts       # 查看会话：resource:opened 订阅、字节读取、打开臂与保存副本
│       ├── PhotoStage.tsx           # 查看舞台：视口 + 相机 + 反馈浮层 + 右键菜单
│       ├── ViewerDock.tsx           # 底部浮动 dock 工具栏（03-查看器设计 §3.1 分组）
│       ├── Filmstrip.tsx            # 胶片条（图包队列缩略图导航）
│       └── InfoPanel.tsx            # 信息侧栏（名称/类型/大小/尺寸/队列位置）
├── tests/                   # vitest 单元测试与舞台集成测试（50 例）
└── assets/icons/            # 启动器图标
```

## 正式链路

- 打开投递：运行中经 `resource:opened` 标准事件消费（《14》§5.5，UI 侧 `chips.subscribe`）；单图主资源与 `chips.book-card` image-sequence 图包载荷按 §5.4 消费规则建队。
- 字节读取：`chips.resource(uri)` 句柄（>8MiB 按《15-文件处理契约》§五降级 `stream()`）；远程 http(s) 引用交 `<img>` 原生加载。
- 打开臂：应用内「打开图片」（dock 按钮 / 空态按钮 / `Ctrl`+`O`）经 `dialog:open` + `resource:open` 正式面请求 image 槽位；宿主处理器未就绪时行内简体中文提示（工单063），不伪造成功。
- 保存副本：`dialog:save` + `file:write`（base64，临时文件 + 原子替换在能力侧完成）。
- 命令：`photo-viewer:open-card` / `photo-viewer:refresh-view` 与 manifest `cli.commands` 逐字对应，UI 侧经命令运行时 attach 承接业务效应。

## 已登记缺位（零绕过）

- `resource:open` 路由宿主侧无处理器注册、image 槽位无候选：端到端打开链路候宿主波（工单063）；应用内打开臂失败时行内如实提示。
- 应用窗口运行时装载与初始上下文投递缺位：界面以空态如实等待运行中投递（工单066）；`ctx.args.resourceOpen` 的初始队列回填已按纯函数交付待通道。

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-photo-viewer run typecheck
pnpm --filter @chips/plugin-photo-viewer run test
pnpm --filter @chips/plugin-photo-viewer run test:coverage
pnpm --filter @chips/plugin-photo-viewer run build
pnpm --filter @chips/plugin-photo-viewer run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 规范入口

《应用插件开发指南》《应用插件接口》；《资源打开与默认处理器契约》《命令系统契约》《查看器设计》《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
