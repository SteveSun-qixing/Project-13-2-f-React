# 地图布局插件

> 角色：`boxlayout`；插件 ID：`chips.layout.map`；版本：`0.1.0`

地图布局插件

## 目录结构

```text
map/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-map，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts           # jsdom 环境补充（matchMedia 桩）
├── src/config.ts            # 布局配置模型：归一、校验与线性边界投影算法
├── src/main.ts              # 主进程纯函数源码 → dist/index.js
├── src/render.tsx           # renderLayout / renderEditor 源码 → render.js
├── src/index.ts             # 源码拆分导出（非构建入口）
├── tests/                   # vitest 单元测试（jsdom）
├── assets/icons/            # 布局类型图标
└── assets/schemas/          # 布局配置 schema
```

## 常用命令

```bash
pnpm install                                  # 在工作区根建立链接
pnpm --filter @chips/plugin-map run typecheck
pnpm --filter @chips/plugin-map run test
pnpm --filter @chips/plugin-map run test:coverage
pnpm --filter @chips/plugin-map run build
pnpm --filter @chips/plugin-map run package   # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 布局配置（`layout_config.props`）

配置 schema 见 `assets/schemas/map-config.schema.json`（JSON Schema 2020-12），字段口径与 `src/config.ts` 的归一/校验保持一致：

| 字段                   | 类型                                                         | 默认值                     | 说明                                                             |
| ---------------------- | ------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------- |
| `map_source`           | `{ mode, projection, assetPath?, bounds }`                    | 图片模式 + 内置静态底图     | 底图来源：`image` 静态图片（箱子资源）、`host-map` 为宿主能力预留 |
| `map_source.bounds`    | `{ west, south, east, north }`                                | `-180/-85/180/85`           | 底图经纬度边界，`west < east`、`south < north`                    |
| `default_view`         | `{ latitude, longitude, zoom }`                               | `0/0/1`                     | 初始中心点与缩放倍率（0.5–8）                                     |
| `marker_style`         | `dot-title` \| `pin-title`                                    | `dot-title`                 | 点位标记样式                                                      |
| `show_cover_on_select` | boolean                                                       | `true`                      | 选中点位时是否按需挂载条目预览帧                                  |
| `entries`              | `Record<entryId, { latitude, longitude, labelOverride? }>`    | `{}`                        | 条目定位映射；显示名称覆盖最长 120 字符                           |
| `top_region`           | `{ mode, assetPath?, html? }`                                 | `{ mode: 'none' }`          | 顶部内容区（地图上方的自适应区域）                                |

## 行为要点

- **投影**：静态图片底图使用线性边界插值（`projectLinear`，经纬度按边界映射为世界层百分比坐标）；`web-mercator` 为 Host 地图预留投影，静态图片一律 `linear-bounds`。
- **诚实降级**：`host-map` 为预留模式，当前宿主未提供地图能力契约，查看态呈现简体中文状态提示并保留配置，不联网加载地图、不伪造渲染。
- **条目交互**：点位标记按条目定位呈现；单击选中并按需经帧运行时 `requestEntries`/`mountEntry` 挂载条目预览帧，再次单击或点「打开条目」经 `openDocument` 打开；未定位条目单列呈现。
- **视图控制**：放大/缩小（0.25 步进，夹取 0.5–8）、四向平移（5° 步进，纬度夹取 ±90、经度夹取 ±180 不绕回）、重置视图。
- **资源**：底图与顶部区域图片一律为 `assets/` 开头的箱子自有资源相对路径，经布局帧注入的 `<base href>` 解析；`asset_refs` 由 `deriveAssetRefs` 派生。
