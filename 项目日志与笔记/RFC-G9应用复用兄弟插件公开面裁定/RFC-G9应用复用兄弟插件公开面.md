# RFC-G9 应用复用兄弟插件公开面裁定

- 日期：2026-10-01 ｜ 提出方：G9 门禁收口批（W5 勘查矩阵裁「复用价值高」收口） ｜ 状态：已生效
- 影响面：`chips-ecosystem/tools/gates/gates.config.json`（`boundaries.rules` 新增 `plugins-apps`，原 `plugins` 规则保持不变）；`plugins/apps/book-reader`、`plugins/apps/music-player` 的 `package.json` 依赖声明面与三个构建/测试配置；G9 门禁判定结果。

## 一、问题

G9 架构边界门禁对 `plugins/*/*` 采用单一 `plugins` 规则（`allowedInternal` 仅 `@chips/ui`、`@chips/sdk`），而 app 角色插件（`plugins/apps/*`）按 W5 勘查矩阵裁定复用兄弟 basecard 插件已交付的纯解析公开导出（禁第二份拷贝），复用依赖随之落在 `devDependencies`，触发两类红面（gates:all，2026-10-01）：

1. **BOUNDARY010（依赖面）**：`plugins/apps/book-reader` 的 devDependencies 声明 `@chips/plugin-book`；`plugins/apps/music-player` 同型声明 `@chips/plugin-music`。运行时复用却声明在 devDependencies，语义错位（devDep 语义仅限开发/打包期工具链，见 RFC-G9插件devDep放行chips-cli裁定）。
2. **BOUNDARY020（Node 内置模块）**：`plugins/apps/book-reader` 的 `vite.main.config.ts` / `vite.render.config.ts` / `vitest.config.ts` 各在 ：1 导入 `node:url`（`fileURLToPath` 做路径锚点）；`plugins/apps/music-player` 三配置同型。

## 二、裁定

### 2.1 规则拆分（fail-closed 扩表）

`boundaries.rules` 新增 `plugins-apps` 规则并置于原 `plugins` 规则**之前**（`classify` 按数组顺序首个命中生效，`plugins/apps/*` 必须先于 `plugins/*/*` 被截获）；原 `plugins` 规则原样保留，继续约束 basecards/layouts/services：

```json
{
  "id": "plugins-apps",
  "match": "plugins/apps/*",
  "allowedInternal": ["@chips/ui", "@chips/sdk", "@chips/plugin-book", "@chips/plugin-music"],
  "forbiddenModules": ["electron", "chips-native", "chips-native.node"],
  "forbidNodeBuiltins": true
}
```

`allowedDevInternal`（`@chips/testing`、`@chips/cli`）等其余字段继承全局，不在规则内重复声明。

### 2.2 依赖面归位

运行时复用的兄弟插件依赖从 `devDependencies` 移入 `dependencies`（import 面不动）：`@chips/plugin-book-reader` → `@chips/plugin-book`；`@chips/plugin-music-player` → `@chips/plugin-music`。`pnpm-lock.yaml` 随之刷新（importer 段 `dependencies` 归位）。

### 2.3 BOUNDARY020 不走白名单

`node:url` 一律改写消除，不设白名单（延续 RFC-G9插件devDep放行chips-cli裁定 §三.3 口径）。六个配置统一改用 grid 判例写法：

```ts
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
```

## 三、理由与边界

1. **纯逻辑公开导出复用，非服务能力调用**：本白名单只放行兄弟插件的纯函数库公开导出（book 的 EPUB/ZIP 解析、music 的音频嵌入标签解析）经构建期内联复用；**任何系统能力调用仍必须经 `window.chips.*` / Bridge / `chips-sdk` 与内核路由**，禁止跨服务直接 import 服务实现，架构红线不因本裁定松动。
2. **白名单显式逐名登记**：`@chips/plugin-book`、`@chips/plugin-music` 逐名入表，不开放 `@chips/plugin-*` 通配；fail-closed 哲学不变——白名单是显式登记而非豁免扫描，`forbiddenModules` 与 `forbidNodeBuiltins` 与 `plugins` 规则完全同权。
3. **新复用必须走 RFC 增名**：后续任何 app 复用新的兄弟插件公开面，先在本 RFC（或后续裁定）登记增名并同步 `gates.config.json`，不得先斩后奏。
4. **作用面收窄**：`plugins-apps` 只匹配 `plugins/apps/*`；basecards/layouts/services 仍由原 `plugins` 规则约束（`allowedInternal` 维持 `[@chips/ui, @chips/sdk]` 不变），不允许兄弟插件互相复用。
5. **跨端边界**：`new URL('.', import.meta.url).pathname` 路径锚点仅服务开发机（macOS 优先）；非 POSIX 平台的配置收口归属跨端波次，与本裁定无涉。

## 四、验收

- `pnpm gates:boundaries` EXIT=0（原 5 条 book-reader + 3 条 music-player BOUNDARY020 与 2 条 BOUNDARY010 全部消除，2026-10-01 实测）；
- `--filter @chips/plugin-book-reader run build|test|lint|typecheck` 与 `--filter @chips/plugin-music-player run build|test|lint|typecheck` 全绿（两包四闸 × 2）；
- `pnpm gates:test` 门禁自测 75/75 全绿（walk 规则分类用例覆盖 glob 截获顺序语义）；
- `pnpm -r --if-present --no-bail run lint` 全工作区 73 包 EXIT=0；
- 依据命令：`node -e "…matchGlob('plugins/apps/*','plugins/apps/book-reader')"`（截获验证）；`grep -A3 plugins-apps tools/gates/gates.config.json`。

---

## 五、增名登记（§二.3 程序执行记录）

### 5.1 `@chips/plugin-richtext`（2026-10-01，W5 富文本编辑器编辑臂）

- **提出方**：W5 应用迁移——富文本编辑器（`chips.official.rich-text-editor`）编辑臂。
- **复用面**：`plugins/basecards/richtext` 公开导出 `renderEditor`（08-基础卡片插件接口 §2.4.2 编辑态唯一装配点，内部唯一持有 Milkdown 引擎装配 `src/milkdown/engine.ts`）与 `validateConfig`（§2.4.3 主进程纯函数）。消费依据：《08-官方应用功能总览》§十二——富文本编辑器应用「不重写富文本编辑运行时，直接调用富文本基础卡片的正式编辑器能力并包装为独立应用」；W5 派单行表 #7 编辑臂「复用 basecards/richtext 公开导出，禁复制装配逻辑」。
- **消费形制**：与 book-reader/music-player 判例同构——workspace 依赖 `@chips/plugin-richtext: workspace:*`（dependencies，运行时复用归位），vite/vitest 构建期 alias 到 `plugins/basecards/richtext/src/index.ts` 内联；引擎装配逻辑零复制（装配点唯一性保持，§2.14 解析归一随行生效）。
- **同步面**：`tools/gates/gates.config.json` `plugins-apps.allowedInternal` 增名（先登记本节、后同步配置，§二.3 顺序遵行）；`tsconfig.base.json` `paths` 增 `@chips/plugin-richtext` 精确条目（工单003 解析锚定机制，紧邻 book/music 判例位）。
- **边界不变**：仍只放行公开导出消费；系统能力调用一律经 Bridge 正式面；basecards/layouts/services 互不复用规则不受影响。
