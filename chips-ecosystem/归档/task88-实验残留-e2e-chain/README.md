# 链路四

> 角色：`basecard`；插件 ID：`chips.e2e.chain4`；版本：`0.1.0`

链路四

## 目录结构

```text
e2e-chain/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-e2e-chain，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts  # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── src/config.ts     # 配置模型：读取、归一、校验与默认值
├── src/main.ts       # 主进程纯函数源码 → dist/index.js
├── src/render.tsx    # 查看态与编辑态渲染源码 → render.js
├── src/index.ts      # 源码拆分导出（非构建入口）
├── tests/            # vitest 单元测试
├── assets/icons/     # 卡片类型图标
├── assets/schemas/   # 卡片配置 schema
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-e2e-chain run typecheck
pnpm --filter @chips/plugin-e2e-chain run test
pnpm --filter @chips/plugin-e2e-chain run test:coverage
pnpm --filter @chips/plugin-e2e-chain run build
pnpm --filter @chips/plugin-e2e-chain run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 下一步

实现卡片接口后，执行 `pnpm --filter @chips/plugin-e2e-chain run build`，再用 `chips dev plugin install` 安装到开发工作区，由查看器与编辑引擎打开卡片触发装载；`chips dev run` 只面向 `app` 角色。

## 规范入口

《基础卡片插件开发指南》《基础卡片插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
