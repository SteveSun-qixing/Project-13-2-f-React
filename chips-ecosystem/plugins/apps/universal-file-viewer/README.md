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
├── src/commands/     # cli.commands 对应命令元数据与 UI 命令运行时接线
├── src/ui/AppView.tsx # 应用窗口界面根组件 → render.js（引擎臂保持骨架态，壳重写另臂）
├── src/engine/       # 预览引擎（open-file-viewer 0.1.43 MIT 源码移植，含 LICENSE.open-file-viewer）
├── src/domain/       # 装载归类领域层：file-kind / engine-plugins / open-targets
├── tests/            # vitest 单元测试（骨架用例 + 引擎探测/解析真实夹具用例）
├── assets/icons/     # 启动器图标
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

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 下一步

执行 `pnpm --filter @chips/plugin-universal-file-viewer run build` 后用 `chips dev run` 启动开发宿主联调窗口。

## 引擎层（W5 迁移臂交付）

`src/engine/` 为 open-file-viewer 0.1.43 的 MIT 源码移植（RA-08，许可证文件随目录保留），迁移时按覆盖矩阵裁决完成三类收口：

- **剔除**：`sandbox-compat`（微前端沙箱垫片）、`cad-dwg`/`cad-webgl`（GPL 链路 DWG 解码，按《03-查看器设计》§8.3 不声明能力）与 `optional-modules.d.ts` 的 `@mlightcad/*` 声明、上游 `style.css`（判重写，随壳臂按 R4 重建）；DWG 仅保留元数据兜底卡路径；
- **改写**：`messages.ts` 按 R5/task030 重写为简体中文直写单语表（去 locale/en 双语层与 PreviewTheme），`viewer.ts` 同步去 locale/theme 机制与沙箱调度垫片调用，`cad.ts` 移除 DWG 解码入口；
- **适配**：全量通过生态基线严格 TS（`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`）与 typechecked ESLint；运行时依赖 26 项已按 uvf G-3 逐项核许可证并登记《第三方参考资产清单》§2.12（全部宽松许可，GPL 零命中），版本钉定与移植母本一致并全部经动态 `import()` 懒加载。

领域层 `src/domain/` 承载装载归类（`file-kind`）、引擎插件装配表（`engine-plugins`，含 pdf worker `?url` 接线）与打开预判（`open-targets`）。

## 已登记缺位（候另臂/候宿主波）

- 应用壳/工具栏/资源读取投递（`resource:open` fallback 注册与 >8MiB readRange/stream）随壳重写臂交付；
- 引擎样式重建（R4 token 化）随壳臂执行；`AppView` 当前保持骨架可用态。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
