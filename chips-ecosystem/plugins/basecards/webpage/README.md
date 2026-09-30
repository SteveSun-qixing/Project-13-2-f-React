# 网页基础卡片插件

> 角色：`basecard`；插件 ID：`chips.basecard.webpage`；卡片类型：`base.webpage`；版本：`0.1.0`

在复合卡片中呈现网页内容的内容节点，支持两种来源：

- 远程网址（http(s)）；
- 卡片内网页目录（入口文件正式为 `index.html`，`resource_paths` 记录目录资源清单）。

显示区域支持两种正式模式（《01-卡片文件格式》§6.5）：

- `fixed`：固定为宽:高 `7:16` 视口，在窗口内滚动查看网页；
- `free`：按页面实际高度展开，最高不超过当前宽度的 `20` 倍，超出转窗口内滚动。

## 目录结构

```text
webpage/
├── manifest.yaml                            # 唯一权威清单
├── package.json                             # 工作区包 @chips/plugin-webpage，version 与 manifest 一致
├── tsconfig.json                            # 继承仓库 tsconfig.base.json
├── vite.shared.ts                           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts                      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts                    # 渲染入口构建 → render.js
├── vitest.config.ts                         # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts                           # jsdom 环境补充（matchMedia / ResizeObserver 桩）
├── src/config.ts                            # 内容模型：归一、校验、URL 安全分析、视口布局纯函数
├── src/embed.ts                             # srcdoc 组装（安全转义）与视口同步协议 DOM 面
├── src/main.ts                              # 主进程纯函数源码 → dist/index.js
├── src/view.tsx                             # 查看态视图 → render.js
├── src/editor.tsx                           # 编辑态面板 → render.js
├── src/render.tsx                           # renderView / renderEditor 源码 → render.js
├── src/index.ts                             # 源码拆分导出（非构建入口）
├── tests/                                   # vitest 单元测试（jsdom）
├── assets/icons/webpage.svg                 # 卡片类型图标
└── assets/schemas/webpage-card-config.schema.json  # 内容 schema（2020-12，§6.1+§6.5 合成口径）
```

## 卡片内容（`content` 平铺字段）

内容形状以《01-卡片文件格式》§6.5 为准（类型在册，字段平铺于内容根，不设 `config` 包），
schema 见 `assets/schemas/webpage-card-config.schema.json`：

| 字段               | 类型                       | 默认值       | 说明                                                                 |
| ------------------ | -------------------------- | ------------ | -------------------------------------------------------------------- |
| `card_type`        | `"base.webpage"`           | 必填         | 正式类型标识；历史别名 `WebPageCard` 只读取归一                       |
| `source_type`      | `url` \| `bundle`          | `url`        | 网页来源                                                             |
| `source_url`       | string                     | `""`         | 远程地址；非空时必须是可打开的 http(s) 地址（携带凭据即拒绝）          |
| `bundle_root`      | string                     | `""`         | 网页目录相对卡片包根的路径                                            |
| `entry_file`       | string                     | `index.html` | 入口文件，正式必须为 `index.html`                                     |
| `resource_paths`   | string[]                   | `[]`         | 目录资源清单（相对卡片包根），bundle 模式必须包含入口                 |
| `display_mode`     | `fixed` \| `free`          | `fixed`      | 视口显示模式                                                          |
| `fixed_ratio`      | `"7:16"`                   | `"7:16"`     | 固定比例（宽:高），当前正式固定值                                     |
| `max_height_ratio` | `20`                       | `20`         | 自由展开最大高度阈值（宽度倍数），当前正式固定值                      |

通用字段 `theme` 按 §6.1 写入保持空字符串；`layout` 为通用可选布局参数。

## 来源加载链路（双臂）

- **url 臂**：`analyzeWebpageUrl` 只接受 http(s)、拒绝携带凭据的地址；地址直载于收紧沙箱
  嵌套帧（`allow-scripts allow-forms allow-popups`，无 `allow-same-origin` / `allow-modals` /
  `allow-top-navigation`）。
- **bundle 臂（srcdoc 臂）**：以渲染帧注入的受管基址（`document.baseURI`，插件不自造作用域）
  解析 `bundle_root/index.html` 为 `chips-resource://` URI → 经 SDK `chips` 客户端真调用
  `resource:read`（manifest 权限 `resources:read`，能力 `resource:read` 为 R19 在册）→ 组装
  srcdoc（`<base href>` 指向包目录 + 视口桥脚本；属性值与脚本内容双重转义、`</script`
  防逃逸），嵌套页相对引用由帧内资源协议解析。
- **bundle 臂（src 臂）**：读取通道不可用或被拒绝时，回退嵌套帧 `src = chips-resource://`
  入口 URI，由帧内资源协议直接加载；帧策略仍不允许嵌套帧时按加载超时呈现诚实状态，不伪造成功。

## 视口同步协议（旧语义保留）

- 宿主侧 → 嵌套页：视口载荷（`version/displayMode/fixedRatio/width/height/baseHeight/
  maxHeight/scrollMode`）经 postMessage `chips:webpage-card:viewport` 下发 + 同源可达文档
  直写（CSS 变量、data 属性、全局键、`chips:webpage-card:viewport-change` 事件）；桥脚本
  保留 vh/dvh/svh/lvh 单位改写、`innerHeight`/`clientHeight` 度量覆写与虚拟 resize 派发。
- 嵌套页 → 宿主侧：内容高度经 `chips:webpage-card:content-height` 回报，驱动 free 模式
  高度展开（上限 `max(baseHeight, width×20)`，超高转滚动）与 fixed 模式 7:16 视口内滚动。
- 嵌入被拒检测：帧加载未在 10 秒内完成、或同源可达文档呈 about:blank 空文档形态时，
  url 来源呈现「该网页禁止被 iframe 嵌入。」，bundle 来源呈现「网页包加载失败。」。

## 编辑器

- 只产出配置变更（`IBaseCardEditor` replace 回流），不写文件、不保存、不导入/删除资源
  （05-渲染引擎设计 §6.3、09-箱子布局插件接口 §7.3：资源写入与清理由编辑链路正式资源桥承担）。
- 网页 ZIP 解压导入由编辑链路资源桥承担；本面板以「安全路径输入 + 资源清单逐行维护」
  承接已导入内容的配置面（旧 `importArchiveBundle` / `deleteResource` 宿主回调面随旧契约作废）。
- 允许中间非法态：字段级错误以行内简体中文提示呈现；仅当整份内容合法
  （url 非空即合法 / 目录入口齐备）时才发布 replace 变更。

## 已知边界（平台侧交回项，与本插件实现无关）

- 当前查看态渲染帧 CSP `frame-src 'none'`（`packages/host/src/main/window-security.ts`
  卡片帧臂唯一交付面），卡片帧内不允许任何嵌套帧：url 臂与 src 臂的帧加载在查看帧内会走
  嵌入被拒/加载失败语义（编辑容器页 `frame-src chips-resource:` 可达 src 臂）。平台为卡片
  帧开设网页帧臂（或按帧种类下发 CSP，#190 勘查在册）后，本插件零改动生效。
- 渲染帧内平台不注入 `window.chips`（08-基础卡片插件接口 §5.4）：srcdoc 臂依赖的
  `resource:read` 调用在就近渲染容器（编辑预览）真实可用，查看帧内自动回退 src 臂
  （工单025 剩余 / #85 渲染帧插件执行通道波次）。
- 帧内用户打开动作的正式通道 `frame:action`（14-资源打开与默认处理器契约 §8.5）未交付，
  本插件不假接线。

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-webpage run typecheck
pnpm --filter @chips/plugin-webpage run test
pnpm --filter @chips/plugin-webpage run test:coverage
pnpm --filter @chips/plugin-webpage run build
pnpm --filter @chips/plugin-webpage run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React
与 `@chips/ui`）。

## 规范入口

《08-基础卡片插件接口》《04-基础卡片插件开发指南》《01-卡片文件格式》§6.1/§6.5、
《06-资源协议规范》《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》
《08-@chips-ui 共享层使用指南》。
