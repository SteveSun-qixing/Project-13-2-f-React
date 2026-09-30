# 文档库布局插件

> 角色：`boxlayout`；插件 ID：`chips.layout.documentlibrary`；版本：`0.1.0`

文档库布局插件：左侧目录树 + 右侧内容 / 封面，层级目录组织条目呈现；未放入目录树的条目在查看态继续展示。

## 目录结构

```text
document-library/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-document-library，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts           # jsdom 环境补充（matchMedia 桩）
├── src/config.ts            # 布局配置模型：归一、校验与目录树纯函数（构建/排序/扁平化/编辑操作）
├── src/main.ts              # 主进程纯函数源码 → dist/index.js
├── src/render.tsx           # renderLayout / renderEditor 源码 → render.js
├── src/index.ts             # 源码拆分导出（非构建入口）
├── tests/                   # vitest 单元测试（jsdom）
├── assets/icons/            # 布局类型图标
└── assets/schemas/          # 布局配置 schema
```

## 常用命令

```bash
pnpm install                                            # 在工作区根建立链接
pnpm --filter @chips/plugin-document-library run typecheck
pnpm --filter @chips/plugin-document-library run test
pnpm --filter @chips/plugin-document-library run test:coverage
pnpm --filter @chips/plugin-document-library run build
pnpm --filter @chips/plugin-document-library run package   # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 布局配置（`layout_config`）

配置 schema 见 `assets/schemas/document-library-config.schema.json`（JSON Schema 2020-12），字段口径与 `src/config.ts` 的归一/校验保持一致：

| 字段            | 类型                                             | 默认值            | 说明                                                                       |
| --------------- | ------------------------------------------------ | ----------------- | -------------------------------------------------------------------------- |
| `sort_mode`     | `manual` \| `name-asc` \| `name-desc`            | `manual`          | 目录树排序方式，递归作用于各层级；名称比较用简体中文习惯，同名称按标识兜底   |
| `tree_nodes`    | `IDocumentTreeNode[]`                            | `[]`              | 目录树节点（深度 ≤ 8、总数 ≤ 500、标识全局唯一）                            |
| `sidebar_width` | `compact` \| `regular` \| `wide`                 | `regular`         | 目录侧栏宽度档位（220 / 280 / 360px）                                       |
| `show_summary`  | boolean                                          | `true`            | 封面态是否显示条目摘要                                                      |
| `background`    | `{ mode, assetPath?, html? }`                    | `{ mode: 'none' }` | 背景区域（16:9）                                                            |
| `top_region`    | `{ mode, assetPath?, html? }`                    | `{ mode: 'none' }` | 顶部内容区（自适应高度）                                                    |

`tree_nodes` 节点形状：`{ id, entryId?, titleOverride?, presentation?, collapsed, children }`；
目录节点不携带 `presentation`，条目节点缺省 `content`，箱子条目固定 `cover`。

## 行为要点

- **目录树**：配置节点按层级映射（标题覆盖优先、缺失条目如实标记并保留配置）；未放入目录树的启用条目按呈现顺序追加在根层；禁用条目不进入呈现。
- **侧栏显隐是会话态**：隐藏目录只改变本次浏览呈现，不写入布局配置（官方布局视觉细则 §4.7）；窄屏（≤720px）自动切换单列。
- **右侧预览**：内容态把右侧空间直接交给平台托管条目帧（`requestEntries`/`mountEntry`），不重复标题、类型、摘要、标签与打开按钮；封面态呈现封面壳层（纵横比取条目 `layout_hints.aspectRatio`，兜底 3:4）与元信息，点击封面或「打开文档」经 `openDocument` 打开条目。
- **键盘无障碍**：目录树支持上下移动选中、左右折叠展开、回车 / 空格切换预览。
- **资源**：背景与顶部区域图片一律为 `assets/` 开头的箱子自有资源相对路径，经布局帧注入的 `<base href>` 解析；`asset_refs` 由 `deriveAssetRefs` 派生。
- **编辑面板**：显示（排序 / 侧栏宽度 / 摘要）、目录树（添加目录、标题覆盖、展示方式、默认折叠、上移下移、缩进取消缩进、移除、未放入目录树条目加入）与背景 / 顶部区域字段组；编辑器只产出配置变更，不写文件、不导入资源。
