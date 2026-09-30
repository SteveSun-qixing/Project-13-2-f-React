# 超链接基础卡片插件

> 角色：`basecard`；插件 ID：`chips.basecard.hyperlink`；卡片类型：`base.hyperlink`；版本：`0.1.0`

在复合卡片中呈现一个指向外部 http(s) 网页的超链接内容节点：可配置锚点文本、链接地址、
描述、图标、展示密度与安全提示；打开动作统一经 `shell:openExternal`（14-资源打开与默认
处理器契约 §8.5.2）。

## 目录结构

```text
hyperlink/
├── manifest.yaml                            # 唯一权威清单
├── package.json                             # 工作区包 @chips/plugin-hyperlink，version 与 manifest 一致
├── tsconfig.json                            # 继承仓库 tsconfig.base.json
├── vite.shared.ts                           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts                      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts                    # 渲染入口构建 → render.js
├── vitest.config.ts                         # 测试配置（单元测试与包级集成测试）
├── tests/setup.ts                           # jsdom 环境补充（matchMedia / ResizeObserver 桩）
├── src/config.ts                            # 配置模型：归一、校验、URL 安全分析
├── src/main.ts                              # 主进程纯函数源码 → dist/index.js
├── src/view.tsx                             # 查看态视图 → render.js
├── src/editor.tsx                           # 编辑态面板 → render.js
├── src/render.tsx                           # renderView / renderEditor 源码 → render.js
├── src/index.ts                             # 源码拆分导出（非构建入口）
├── tests/                                   # vitest 单元测试（jsdom）
├── assets/icons/hyperlink.svg               # 卡片类型图标
└── assets/schemas/hyperlink-card-config.schema.json  # 配置 schema（2020-12）
```

## 卡片配置（`content.config`）

配置 schema 见 `assets/schemas/hyperlink-card-config.schema.json`，字段口径与 `src/config.ts`
的归一/校验保持一致：

| 字段                 | 类型                                   | 默认值        | 说明                                                       |
| -------------------- | -------------------------------------- | ------------- | ---------------------------------------------------------- |
| `anchor_text`        | string                                 | `""`          | 链接显示标题（锚点文本）                                   |
| `url`                | string                                 | `""`          | 链接地址；非空时必须是可打开的 http(s) 地址（携带凭据即拒绝） |
| `description`        | string                                 | `""`          | 标题下方的说明文字                                         |
| `icon_url`           | string                                 | `""`          | 可选 http(s) 图标地址；未填写或加载失败时显示默认图标       |
| `display_density`    | `compact` \| `comfortable` \| `spacious` | `comfortable` | 展示密度                                                   |
| `show_security_hint` | boolean                                | `true`        | 是否在标题旁显示安全状态提示                               |

相对旧版超链接卡片的字段变化：`open_mode` 删除（新生态外部链接统一 `shell:openExternal`，
`resource-router` 无对应路由）；`theme` / `locale` 删除（主题与多语言系统已随 task030 废弃）。

## 打开链路与已知边界

- 查看态打开臂经 SDK `chips` 客户端真调用 `shell:openExternal`（能力已注册：
  `packages/sdk/src/generated/capability-ids.ts`、`packages/bridge/src/protocol/capability-contracts.ts`；
  manifest 权限为 `shell:external`）。在就近渲染容器（编辑预览）内真实可用；
  调用失败时以行内简体中文提示呈现，不伪造成功。
- 渲染帧（sandbox iframe）内平台不注入 `window.chips`（08-基础卡片插件接口 §5.4），帧内
  打开臂的正式通道是 `frame:action{kind:'open-external'}`（14 §8.5.2）。该通道依赖渲染帧
  插件装载臂与 basecard 帧运行时注入面，目前尚未交付（工单025 剩余 / #85 渲染帧插件执行
  通道波次）；平台交付后，本卡片的查看态打开调用切换到帧运行时句柄，其余实现不变。
  此为交回项：basecard 角色在 SDK `types/roles/basecard.ts` 中尚无 `IBoxLayoutRuntimeAware`
  的等价注入面（09 §6.1 仅覆盖 boxlayout）。
- 渲染帧 CSP `img-src chips-resource: data:`（平台帧页 `frame.html`）不放行远端 https 图片：
  `icon_url` 的远端图标在帧内会走加载失败兜底（显示默认箭头图标）；编辑预览内可正常显示。
  若需帧内远端图标，属平台 CSP 策略决策，另行交回。

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-hyperlink run typecheck
pnpm --filter @chips/plugin-hyperlink run test
pnpm --filter @chips/plugin-hyperlink run test:coverage
pnpm --filter @chips/plugin-hyperlink run build
pnpm --filter @chips/plugin-hyperlink run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React
与 `@chips/ui`）。

## 规范入口

《08-基础卡片插件接口》《04-基础卡片插件开发指南》《14-资源打开与默认处理器契约》；
《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》《08-@chips-ui 共享层使用指南》。
