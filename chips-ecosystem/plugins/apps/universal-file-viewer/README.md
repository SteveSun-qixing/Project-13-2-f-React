# 万能文件查看器

> 角色：`app`；插件 ID：`chips.official.universal-file-viewer`；版本：`0.1.0`

万能文件查看器

## 目录结构

```text
universal-file-viewer/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-universal-file-viewer，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts  # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── src/index.ts      # IAppPlugin 实现 → dist/index.js
├── src/commands/     # cli.commands 对应命令元数据（12 命令族）与 UI 命令运行时接线
├── src/ui/           # 应用壳：AppView / UniversalViewerScene / EngineStage / ViewerToolbar /
│                      InfoPanel / ViewerEmptyState / UnsupportedCard / useViewerSession /
│                      engineStyles（engine-stage.css 经 ?raw 注入）
├── src/engine/       # 预览引擎（open-file-viewer 0.1.43 MIT 源码移植，含 LICENSE.open-file-viewer）
├── src/domain/       # 领域层：file-kind / engine-plugins / open-targets / viewer-target / source-loader
├── tests/            # vitest 用例（app/commands 锁测 + viewer-target/source-loader 领域 +
│                      stage 假桥集成 + 引擎探测/解析真实夹具）
├── assets/icons/     # 启动器图标
└── dist/             # 渲染分包产物（构建期生成；CPK 布局允许 dist/ 携带代码文件）
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-universal-file-viewer run typecheck
pnpm --filter @chips/plugin-universal-file-viewer run test
pnpm --filter @chips/plugin-universal-file-viewer run test:coverage
pnpm --filter @chips/plugin-universal-file-viewer run build
pnpm --filter @chips/plugin-universal-file-viewer run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口门面，外部化
React 与 `@chips/ui`）+ `dist/` 渲染分包。重依赖分包（RA-08 风险③红线）：引擎 18 格式插件的
按需依赖经引擎内部动态 `import()` 自然分包落 `dist/`（CPK 布局允许 dist/ 携带代码文件），
render.js 只保留壳层与引擎探测路由核心，单文件满足 16 MiB 上限；分包/资源的窗口装载语义
候工单069（随工单066 应用窗口装载波）收口。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 下一步

执行 `pnpm --filter @chips/plugin-universal-file-viewer run build` 后用 `chips dev run` 启动开发宿主联调窗口。

## 引擎层（W5 迁移臂交付）

`src/engine/` 为 open-file-viewer 0.1.43 的 MIT 源码移植（RA-08，许可证文件随目录保留），迁移时按覆盖矩阵裁决完成三类收口：

- **剔除**：`sandbox-compat`（微前端沙箱垫片）、`cad-dwg`/`cad-webgl`（GPL 链路 DWG 解码，按《03-查看器设计》§8.3 不声明能力）与 `optional-modules.d.ts` 的 `@mlightcad/*` 声明、上游 `style.css`（判重写，随壳臂按 R4 重建）；DWG 仅保留元数据兜底卡路径；
- **改写**：`messages.ts` 按 R5/task030 重写为简体中文直写单语表（去 locale/en 双语层与 PreviewTheme），`viewer.ts` 同步去 locale/theme 机制与沙箱调度垫片调用，`cad.ts` 移除 DWG 解码入口；
- **适配**：全量通过生态基线严格 TS（`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`）与 typechecked ESLint；运行时依赖 26 项已按 uvf G-3 逐项核许可证并登记《第三方参考资产清单》§2.12（全部宽松许可，GPL 零命中），版本钉定与移植母本一致并全部经动态 `import()` 懒加载。

领域层 `src/domain/` 承载装载归类（`file-kind`）、引擎插件装配表（`engine-plugins`，含 pdf worker `?url` 接线）与打开预判（`open-targets`）。

## 应用壳（W5 壳重写臂交付）

壳层消费引擎公开面（`createViewer` + `createViewerPlugins` 装配表 + `isPreviewSupported` 预判）：

- **打开投递**（《14-资源打开与默认处理器契约》）：运行中投递经 `resource:opened` 订阅消费
  （`domain/viewer-target` 解析单资源主投递与图包 image-sequence 载荷）；初始投递上下文通道
  未交付前以空态如实呈现（工单066）；
- **资源读取**（`domain/source-loader`）：`chips.resource(uri)` 句柄读取，>8MiB 按15-契约 §五
  降级 `stream()`；远程 http(s) 直通引擎按 URL 加载；
- **打开臂**：`dialog:open` + `resource:open` 正式面请求路由（本应用为 fallback 层），宿主路由
  未就绪时行内简体中文提示，不伪造成功（工单060 族）；
- **兜底信息卡**（§8.4）：装载前经 `isPreviewableTarget` 预判，无预览插件路径的格式如实呈现
  识别结果与重试入口；DWG 等元数据兜底格式仍交引擎按引擎臂裁决渲染；
- **引擎样式 token 化**：`src/ui/engine-stage.css`（旧引擎 style.css 的重建版）——铬层取色一律
  经 `--chips-*` Design Tokens，文档保真色与舞台恒暗色按层保留，经 `?raw` 编译期内联注入；
- **命令族**：manifest `cli.commands` 12 条与运行时注册逐字对应（打开卡片/刷新/上一个/下一个/
  放大/缩小/重置缩放/向左旋转/向右旋转/格式信息/全屏/打印），引擎控制经 `toolbar.render`
  上下文通道（缩放、页码、搜索、全屏、打印）驱动。

## 已登记缺位（候宿主波）

- 应用窗口运行时与初始上下文投递（工单066）；`resource:open` 路由与处理器注册（工单060~064 族）；
- render.js 分包/资源装载语义与 pdf worker 资产形态（工单069）。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
