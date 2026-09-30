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
├── src/ui/AppView.tsx # 应用窗口界面根组件 → render.js
├── tests/            # vitest 单元测试
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

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
