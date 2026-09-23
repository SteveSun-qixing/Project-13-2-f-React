# 网格布局插件

> 角色：`boxlayout`；插件 ID：`chips.layout.grid`；版本：`0.1.0`

网格布局插件

## 目录结构

```text
grid/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-grid，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts  # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts           # jsdom 环境补充（matchMedia 桩）
├── src/config.ts     # 布局配置模型：归一、校验与列数算法
├── src/main.ts       # 主进程纯函数源码 → dist/index.js
├── src/render.tsx    # renderLayout / renderEditor 源码 → render.js
├── src/index.ts      # 源码拆分导出（非构建入口）
├── tests/            # vitest 单元测试（jsdom）
├── assets/icons/     # 布局类型图标
├── assets/schemas/   # 布局配置 schema
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-grid run typecheck
pnpm --filter @chips/plugin-grid run test
pnpm --filter @chips/plugin-grid run test:coverage
pnpm --filter @chips/plugin-grid run build
pnpm --filter @chips/plugin-grid run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 布局配置（`layout_config.props`）

配置 schema 见 `assets/schemas/grid-config.schema.json`（JSON Schema 2020-12），字段口径与 `src/config.ts` 的归一/校验保持一致：

| 字段                  | 类型                                  | 默认值               | 说明                                                           |
| --------------------- | ------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `gap`                 | integer 0–64                          | `16`                 | 条目间距（px）                                                 |
| `show_tags`           | boolean                               | `true`               | 是否显示条目标签                                               |
| `information_density` | `comfortable` \| `compact`            | `comfortable`        | 信息密度                                                       |
| `sort_mode`           | `manual` \| `name-asc` \| `name-desc` | `manual`             | 条目排序方式（名称比较按简体中文习惯，同名按条目标识稳定兜底） |
| `background`          | 区域对象                              | `{ "mode": "none" }` | 背景区域：固定 16:9，位于内容壳层之后                          |
| `top_region`          | 区域对象                              | `{ "mode": "none" }` | 顶部内容区：条目网格上方，按内容自适应高度                     |

区域对象 `mode` 取 `none`（不显示）/ `image`（`assetPath` 引用箱子自有资源，须为以 `assets/` 开头的包内相对安全路径，由布局帧 `chips-resource://` 基址解析到箱子作用域）/ `html`（`html` 内联文档，经 `@chips/ui` 受控文档帧沙箱呈现）。编辑器只产出配置变更，不写文件；箱子资源的写入与清理由编辑链路的正式资源桥承担（05.06 §6.3）。

## 打包与校验

```bash
pnpm --filter @chips/plugin-grid run package   # 产出 dist/grid-<version>.cpk
chips plugin validate <产物 .cpk 路径>          # 归档/结构/清单/摘要全链校验
```

## 下一步

实现布局接口后，执行 `pnpm --filter @chips/plugin-grid run build`，再用 `chips dev plugin install` 安装到开发工作区，打开引用该布局类型的箱子触发装载。

## 规范入口

《箱子布局插件开发指南》《箱子布局插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
