# 薯片社区客户端（Chips Community Client）

> 插件 ID：`com.chips.community-client`
> 插件类型：`app`（薯片生态官方社区客户端应用插件）

薯片社区客户端用于浏览社区内容（欢迎页、个人主页、卡片、箱子等），并在客户端内直接完成卡片上传、完整下载与本地查看器打开：

- **本地查看**：查看卡片时直接获取卡片资源，由本地卡片查看器（`com.chips.card-viewer`）解析渲染，不依赖服务器渲染缓存；
- **上传 / 下载**：通过社区卡片传输模块（`community.card.transfer`，`Chips-ModulePlugin/Chips-CommunityUploader-Plugin`）执行，文件字节直传对象存储，API 只做控制面。

页面结构与视觉体验与网页版社区（`Chips-CommunityPlatformServer/packages/web`）保持一致。

## 快速开始

```bash
# 生态根工作区
npm install

# 构建并打包客户端
cd Chips-CommunityClient
npm run build
npm run package

# 在真实 Host 中启动客户端（需先安装启用社区传输模块与卡片查看器）
chipsdev-r run
```

启动后请在客户端设置页（`/settings`）确认社区服务器地址：本地联调使用 `http://127.0.0.1:3000`，生产使用 `https://www.chipscard.space`。

## 常用脚本

- `npm run dev`：启动开发服务器。
- `npm run lint`：执行源码规范检查。
- `npm run typecheck`：执行 TypeScript 类型检查。
- `npm test`：运行单元测试（应用基线、命令契约、传输服务、服务器配置）。
- `npm run build`：构建应用插件产物。
- `npm run validate`：校验 manifest 与构建产物。
- `npm run preview:smoke`：生成 Host mock 预览链路报告并校验，报告写入 `reports/preview/app-preview-smoke.json`。
- `npm run quality:gate`：生成生态质量门禁摘要，报告写入 `reports/quality/quality-gate.json`。
- `npm run verify`：串联执行完整本地验证总门禁。

`reports/` 是本地验证产物目录，默认不纳入版本管理。真实 Host 窗口联调使用 `chipsdev-r run`。

## 命令行入口

`manifest.yaml` 声明一条 `cli.commands` 应用入口：

```bash
chips chips-community open "启动参数"
```

该命令由 Host 动态发现，执行时通过 `surface.open` 打开当前应用，并把位置参数写入 launch context 的 `cli.payload.subject`。

## 目录结构

```text
Chips-CommunityClient/
├─ manifest.yaml          插件清单（id / 权限 / runtime.targets / ui.surface）
├─ chips.config.mjs
├─ index.html             入口页与 CSP（connect-src 放行社区服务器来源）
├─ config/                应用配置与日志
├─ src/
│  ├─ app/                AppRoot / AppShell（AppChrome + 路由外壳）
│  ├─ commands/           本地命令定义与注册（CommandItem + useCommandRegistry）
│  ├─ community/
│  │  ├─ api/             社区 API 客户端（认证 / 内容 / 房间）
│  │  ├─ contexts/        AuthContext / PreferencesContext
│  │  ├─ lib/             传输服务、服务器配置、工具函数
│  │  ├─ pages/           移植页面与客户端专属页面
│  │  ├─ components/      顶部导航、页脚、作品网格等
│  │  └─ styles/          全局样式（布局与私有样式）
│  ├─ lib/                中文文案表（messages.ts）
│  ├─ runtime/            chipsClient 单例、社区运行时绑定
│  ├─ preview/            预览 smoke 脚本
│  └─ testing/            测试辅助
├─ tests/                 unit / e2e
├─ 归档/                  旧多语言 / 主题 / 运行时代码归档
└─ 技术文档/               客户端技术文档
```

## 技术口径

- 官方前端栈使用 React；路由使用 `HashRouter`（入口经 `file://` / `chips-render://` 加载）。
- 系统能力统一通过 `chips-sdk` client 单例消费，不直接访问 Electron / Node 私有 API。
- 会话凭据：`refreshToken` 存 Host credential（ref `community.refreshToken`），`accessToken` 仅存内存，401 自动刷新。
- 卡片传输统一走 `community.card.transfer` 模块，客户端不自建上传下载协议。
- 用户可见文案统一维护在 `src/lib/messages.ts`（简体中文直写，全生态仅中文）。
- 视觉走 `@chips/ui` 的 `appleTheme` 与 antd 组件体系；私有样式只保留页面布局与装饰。

## 相关文档

- 客户端技术文档：`技术文档/00-文档索引.md`
- 社区平台 API 契约：`生态共用技术文档/协议与契约/09-社区平台API契约.md`
- 社区卡片传输模块：`Chips-ModulePlugin/Chips-CommunityUploader-Plugin/技术文档/01-社区卡片传输模块技术方案.md`
