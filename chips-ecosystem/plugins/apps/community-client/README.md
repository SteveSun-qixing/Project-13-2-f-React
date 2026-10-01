# 薯片社区

> 角色：`app`；插件 ID：`chips.official.community-client`；版本：`0.1.0`

薯片社区：社区浏览、认证与会话、卡片上传、完整下载与本地查看。

权威设计：《16-社区客户端设计》（薯片生态文档库/01-架构设计/01-子系统设计）；
传输协议口径：《16-卡片传输协议》；服务端接口：《11-社区平台API契约》。

## 目录结构

```text
community-client/
├── manifest.yaml                     # 唯一权威清单
├── package.json                      # 工作区包 @chips/plugin-community-client，version 与 manifest 一致
├── tsconfig.json                     # 继承仓库 tsconfig.base.json
├── vite.shared.ts                    # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts               # 主进程入口构建 → dist/index.js
├── vite.render.config.ts             # 渲染入口构建 → render.js
├── vitest.config.ts                  # 测试配置（单元测试与包级集成测试，jsdom）
├── src/index.ts                      # IAppPlugin 实现 → dist/index.js
├── src/commands/                     # cli.commands 对应命令元数据与 UI 命令运行时接线
├── src/domain/community/             # 领域层（纯函数）：内容模型 / 路由表 / 服务器配置 / 卡片归一
│   ├── contentModel.ts               #   社区内容模型（11-契约 §4.5/§4.6 投影 + 受管封面 URI 归一）
│   ├── routeTable.ts                 #   窗口路由表与守卫（16-CC §3.2/§3.3）
│   ├── serverConfig.ts               #   服务器基址归一与域集合校验（16-CC §5.3/§8.2）
│   ├── cardPaths.ts                  #   卡片路径归一：规范化/结构文件/系统生成物/候选路径（16-传输协议 §4.2）
│   ├── cardRewrite.ts                #   YAML/cover.html 资源改写与还原（16-传输协议 §4.3/§4.5）
│   ├── restoreManifest.ts            #   可逆恢复清单消费面（16-传输协议 §4.4）
│   └── pendingCapabilities.ts        #   候前置件登记表（起步臂诚实降级登记）
├── src/ui/                           # 渲染面 → render.js（AppView 为默认导出）
│   ├── AppView.tsx                   #   应用窗口界面根组件（顶栏 + 路由内容 + 页脚）
│   ├── useCommunityRoute.ts          #   Hash 路由接线（window.location.hash + hashchange）
│   ├── runtime/communityRuntime.ts   #   窗口会话运行时（服务器基址会话内存态 + 会话状态）
│   └── pages/                        #   欢迎页/社区简介/设置页/候前置件登记页/404 页
├── tests/                            # vitest 单元测试与壳层舞台集成测试
│   └── fixtures/card-archive.ts      #   真实卡片夹具（01-卡片文件格式权威重建）
└── assets/icons/                     # 启动器图标
```

## 起步臂口径（W5）

本包按 W5 派单行表 #8 以三段式第③段交付**起步臂**：领域层（社区内容模型 + 卡片归一纯函数，
迁移自旧 `Chips-CommunityUploader-Plugin` 的 publisher/card-rewrite 实现材料）、Hash 路由壳层、
设置面（服务器基址会话内存生效）、命令族（`community-client:open-card` / `community-client:refresh-view`）。

候前置件（诚实降级登记，不假接线；详见 `src/domain/community/pendingCapabilities.ts`）：
`http:*` 域宿主处理器未注册（G6 后续批）——网络请求臂；`credential:*` / `config:*`（工单066）——
会话与配置持久化；`transfer:*`——上传/完整下载/本地查看编排；服务端 W6 未迁移——联调面。

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-community-client run typecheck
pnpm --filter @chips/plugin-community-client run test
pnpm --filter @chips/plugin-community-client run test:coverage
pnpm --filter @chips/plugin-community-client run build
pnpm --filter @chips/plugin-community-client run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。插件包根不设独立 `.css`（16-CC §2.2）。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》；
《08-@chips-ui共享层使用指南》《13-命令系统契约》《14-资源打开与默认处理器契约》。
