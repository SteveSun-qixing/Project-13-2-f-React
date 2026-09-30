# 时间线布局插件

> 角色：`boxlayout`；插件 ID：`chips.layout.timeline`；版本：`0.1.0`

时间线布局：条目绑定到时间点，横向或竖向轴线排布；时间点名称、日期、说明沿轴呈现；未绑定任何时间点的启用条目归入「未安排条目」区块，不因配置未完成而丢失（《官方布局视觉细则》§4.6）。

## 目录结构

```text
timeline/
├── manifest.yaml                        # 唯一权威清单
├── package.json                         # 工作区包 @chips/plugin-timeline，version 与 manifest 一致
├── tsconfig.json                        # 继承仓库 tsconfig.base.json
├── vite.shared.ts                       # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts                  # 主进程入口构建 → dist/index.js
├── vite.render.config.ts                # 渲染入口构建 → render.js
├── vitest.config.ts                     # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts                       # jsdom 环境补充（matchMedia 桩）
├── src/config.ts                        # 配置模型：归一、校验与时间线布局计算纯函数
├── src/main.ts                          # 主进程纯函数源码 → dist/index.js
├── src/render.tsx                       # renderLayout / renderEditor 源码 → render.js
├── src/index.ts                         # 源码拆分导出（非构建入口）
├── tests/                               # vitest 单元测试（jsdom）
├── assets/icons/                        # 布局类型图标
└── assets/schemas/                      # 布局配置 schema
```

## 常用命令

```bash
npx -y pnpm@9 install                                    # 在工作区根建立链接
npx -y pnpm@9 --filter @chips/plugin-timeline run typecheck
npx -y pnpm@9 --filter @chips/plugin-timeline run test
npx -y pnpm@9 --filter @chips/plugin-timeline run test:coverage
npx -y pnpm@9 --filter @chips/plugin-timeline run build
npx -y pnpm@9 --filter @chips/plugin-timeline run package  # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 布局配置（`layout_config.props`）

配置 schema 见 `assets/schemas/timeline-config.schema.json`（JSON Schema 2020-12），字段口径与 `src/config.ts` 的归一/校验保持一致：

| 字段           | 类型                                        | 默认值               | 说明                                                                     |
| -------------- | ------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `orientation`  | `vertical` \| `horizontal`                  | `vertical`           | 时间线方向                                                               |
| `scale_mode`   | `equal-points` \| `date-distance`           | `equal-points`       | 比例方式：等距；或按可解析日期的间距排布（不可解析日期按声明位次参与）   |
| `show_covers`  | boolean                                     | `true`               | 是否为条目保留平台条目帧槽位（正式封面）；关闭时只呈现标题外壳           |
| `card_density` | `compact` \| `comfortable` \| `spacious`    | `comfortable`        | 卡片密度：条目封面槽位宽度（72/104/132）与内边距档位                     |
| `points`       | 时间点数组                                  | `[]`                 | 轴上节点：`id`/`label`/`date`/`entry_ids`/`note`                          |
| `background`   | 区域对象                                    | `{ "mode": "none" }` | 背景区域：固定 16:9，位于内容壳层之后                                    |
| `top_region`   | 区域对象                                    | `{ "mode": "none" }` | 顶部内容区：时间线上方，按内容自适应高度                                 |

时间点 `id` 文法 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` 且配置内唯一；`entry_ids` 同一时间点内唯一，跨时间点先到先得；`date` 为自由文本，可解析日期参与日期间距比例与简体中文本地化呈现，不可解析按自由文本显示。归一链路对非法标识（回退 `point-N`）、冲突标识（`-2/-3` 后缀去重）、缺失名称（`时间点 N`）确定性兜底，渲染不因坏配置失败。

区域对象 `mode` 取 `none`（不显示）/ `image`（`assetPath` 引用箱子自有资源，须为以 `assets/` 开头的包内相对安全路径，由布局帧 `chips-resource://` 基址解析到箱子作用域）/ `html`（`html` 内联文档，经 `@chips/ui` 受控文档帧沙箱呈现）。编辑器只产出配置变更，不写文件；箱子资源的写入与清理由编辑链路的正式资源桥承担（05.06 §6.3）。

## 呈现与交互要点

- 条目呈现：封面槽位（`show_covers` 开启时经 `requestEntries` + `mountEntry` 挂载平台条目帧）+ 标题 + 可选摘要；激活统一经 `openDocument(entry.url)` 转发。
- 时间点折叠：多于两个条目的时间点默认直呈前两个，其余经「展开其余 N 个条目」与时间点头部往复切换；仅一条时点击头部直接打开该条目。
- 横向时间线：根节点横向滚动 + scroll-snap，键盘左右方向键按 320px 步长滚动；窄容器（≤720px）自动切换为紧凑堆叠排布。
- 未安排区块：未绑定条目集中呈现并附说明文案，不因配置未完成而丢失。
- 视觉全部走 `@chips/ui` Design Tokens（轴线 `colorSplit`、圆点 `colorPrimary`/`colorPrimaryBg`、边框 `colorBorderSecondary` 等），无硬编码色值。

## 打包与校验

```bash
npx -y pnpm@9 --filter @chips/plugin-timeline run package   # 产出 dist/timeline-<version>.cpk
chips plugin validate <产物 .cpk 路径>                       # 归档/结构/清单/摘要全链校验
```

## 规范入口

《箱子布局插件开发指南》《箱子布局插件接口》；《插件清单规范》§7.3《官方布局视觉细则》§3/§4.6《TypeScript 编码规范》《测试规范》。
