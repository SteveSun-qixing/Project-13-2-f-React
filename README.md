# 薯片生态工作区（Project-13-2-f-React）

> 薯片生态：用户态操作系统级的跨平台软件环境——平台底座（Cordis 内核 + Rust 核心 + 能力 Bridge + Electron 壳 + React/@chips/ui 前端）+ 四角色插件（基础卡片 / 箱子布局 / 服务 / 应用）+ `.card`/`.box` 用户内容。
>
> 本目录是薯片生态的整体重构工作区：**单仓新生态（`chips-ecosystem/`）+ 22 个冻结旧仓参考 + 重构指挥系统（`重构大计划/`）+ 唯一权威契约（`薯片生态文档库/`）**。
>
> 定位铁律：全部旧仓库与旧文档已冻结，只读参考，不再修改；全部新代码只落在 `chips-ecosystem/`；全部正式技术契约以 `薯片生态文档库/` 为唯一依据。

---

## 一、目录地图（与磁盘实测一致）

```
Project-13-2-f-React/
├── AGENTS.md                        # 生态工作区规则：架构红线、文档边界、工单纪律（必读）
├── README.md                        # 本文件
├── package.json / package-lock.json # 根 npm workspaces——旧接线（workspaces 指向冻结旧仓），仅保留历史接线与少量辅助脚本，勿作为开发入口
├── scripts/                         # 根工作区辅助脚本（npm scripts 接线：成品物料收集、工作区校验、打包等）
│
├── chips-ecosystem/                 # ★ 新生态唯一实现工作区（pnpm@9 + Cargo 双工作区）
│   ├── packages/                    #   8 个平台包：core-rust / native / bridge / host / sdk / ui / antd / cli
│   ├── plugins/                     #   官方插件四族：basecards（7 包）/ layouts（4 包）/ services（6 包）/ apps（13 应用包）
│   ├── tools/                       #   工具链：scaffold / contract-gen / testing / gates
│   ├── tests/                       #   contract / e2e / perf 三层测试
│   ├── docs/ examples/ CONTRIBUTING.md README.md   # 工程流程、示例与仓库说明
│   └── …（Cargo.toml、eslint/vitest/tsconfig 等工程配置）
│
├── 重构大计划/                       # ★ 重构指挥系统
│   ├── 00-总纲与路线图.md            #   W0~W7 波次路线图；「当前波次」权威章节在此
│   ├── 01-文件台账与消灭流程.md      #   台账子命令口径（§四）
│   ├── 02-仓库映射与新工作区.md
│   ├── 03-并行开发与子智能体规范.md
│   ├── W3 / W4 开工波次计划.md
│   ├── 重构台账.db                   #   旧生态文件级 + 符号级台账（SQLite）
│   ├── 工具/重构台账.py              #   台账命令行工具
│   └── 归档/ 项目日志/ 台账操作.log
│
├── 薯片生态文档库/                   # ★ 唯一权威技术契约库（00-愿景与原则 ~ 08-产品与交互 九分区 + README 索引）
│
├── 项目日志与笔记/                   # ★ 过程资产：问题工单.md + 工单NNN-*/ 目录 + RFC-*/ 目录 + 各波开发日志与 checkpoint + 归档
├── 交接文档/00-总交接说明.md         # 接手团队总入口
├── 归档/                             # 全局归档区（旧仓、错位物、历史批次；只进不出，禁止删除）
├── 投资问卷/                         # 个人域材料（非工程资产）
│
├── 旧版-生态设计原稿/                # ─ 旧文档库（冻结只读）
├── 旧版-生态共用技术文档/
├── 旧版-生态共用技术文档-2/
├── 旧版-项目日志与笔记/
│
├── Chip-iconMaker、Chips-Host、Chips-SDK、Chips-Ui、Chips-Scaffold、  ─ 22 个旧实现仓
├── Chips-BaseCardPlugin、Chips-BoxLayoutPlugin、Chips-ModulePlugin、    （合计 22 个，
├── Chips-CardViewer、Chips-EditingEngine、Chips-RichTextEditor、        每仓根均有
├── Chips-PhotoViewer、Chips-VideoPlayer、Chips-MusicPlayer、            「旧版-标记.md」，
├── Chips-BookReader、Chips-Notes、Chips-Office、Chips-UniversalFileViewer、 冻结只读）
├── Chips-CommunityClient、Chips-CommunityPlatformServer、
├── Chips-PersonalServer、Chips-EcoSettingsPanel
│
├── cordis-main/                      # Cordis 框架上游参考源码（第三方，非生态代码）
├── deepseek-harness-master/          # 第三方开源参考工程（非生态代码）
├── OpenSourceProjectHandlingFolder/  # 第三方开源参考项目收储（DPlayer、thorium-reader 等）
├── design-assets/                    # 设计物料（应用/卡片/布局/模块图标、材质符号等）
├── ProductFinishedProductTestingSpace/ # 旧版成品样例与测试内容（示例 .card/.box 与素材）
├── dist/ node_modules/               # 构建产物与本机依赖
└── .gitignore、.zcodeignore 等       # 版本与工具忽略配置
```

> 各目录是否承载全局契约：见 `AGENTS.md`「文档边界」——生态通用信息进 `薯片生态文档库/`，单仓内部细节进各仓自己的技术文档目录。

---

## 二、快速开始（全部在 chips-ecosystem 内进行）

前置要求：Node.js >= 18、Rust 工具链（cargo）。TS 侧统一使用 pnpm@9（未全局安装时以 `npx pnpm@9` 调用即可）。

```bash
cd chips-ecosystem

npx pnpm@9 install            # 安装 TS 依赖

npx pnpm@9 dev                # 启动开发环境（@chips/host Electron 壳）

# 五闸（逐条或直接跑集成链）
npx pnpm@9 lint               # 闸1：ESLint + Prettier + cargo fmt + clippy
npx pnpm@9 typecheck          # 闸2：TS 全量类型检查
npx pnpm@9 test               # 闸3：cargo test + 全包测试（契约测试另见 test:contract）
npx pnpm@9 build              # 闸4：Rust + 各包构建
npx pnpm@9 gates:all          # 闸5：文档/契约/边界/覆盖率/入口机检门禁总闸
npx pnpm@9 ci                 # 五闸集成链一次性执行
```

重构台账（进度机读口径）：

```bash
python3 重构大计划/工具/重构台账.py stats
# 子命令全集（scan/stats/next/dispose/report/claim 等）以 重构大计划/01-文件台账与消灭流程.md §四 为准
```

注意：根目录 npm workspaces 属旧接线（workspaces 指向冻结旧仓），不是开发与构建入口；未经用户裁决不得改动根 `package.json`。

---

## 三、当前进度（指针制，本文不写死数字）

进度数字会滞后腐化，本 README 只给权威指针：

- **波次定义**：W0 台账与准备 → W1 基础设施 → W2 金链路 → W3 全链路测试 → W4 官方插件迁移 → W5 官方应用迁移 → W6 服务端与分发 → W7 验收与发布准备，见 [`重构大计划/00-总纲与路线图.md`](./重构大计划/00-总纲与路线图.md)。
- **当前波次权威口径**：[`重构大计划/00-总纲与路线图.md`](./重构大计划/00-总纲与路线图.md) 的「当前波次」章节（每波收尾由主代理刷新）。
- **最新阶段证据**：[`项目日志与笔记/`](./项目日志与笔记) 下各波 checkpoint 与开发日志（如 `W4-B1-checkpoint-2026-10-01.md` 及后续 W5 各臂日志）。
- **机读进度**：`python3 重构大计划/工具/重构台账.py stats`。
- **定性快照（仅供定向，精确状态以上述指针为准）**：W0~W3 已收口；W4 官方插件迁移主体收口；W5 官方应用迁移按三段式推进中；W6、W7 尚未开波。

---

## 四、质量红线摘要

全文见 [`AGENTS.md`](./AGENTS.md) 与文档库《[架构原则](./薯片生态文档库/00-愿景与原则/01-架构原则.md)》，此处仅摘要：

1. Host 是唯一运行时承载；插件访问系统能力只能通过 `window.chips.*` / Bridge / `chips-sdk` 正式链路。
2. 服务间调用必须走内核路由；禁止跨服务直接 `import`、禁止跨层直连。
3. SDK 只做类型化封装、脚手架与测试辅助，不承载 Host 运行时主实现。
4. 前端统一 React + antd（唯一组件库）+ `@chips/ui` 唯一共享层；文案简体中文直写；禁止硬编码样式与第二套组件库；主题/多语言系统已废弃。
5. 不做临时版、简化版、占位实现；不留 TODO；无第一版发布，不做任何兼容性包袱设计。
6. 旧版冻结只读；移除内容一律移入就近 `归档/`，禁止直接删除。
7. 契约先行：实现与文档库不一致即缺陷；同一概念只有一处权威，不复制口径。
8. 发现架构缺口、文档与代码不符、链路未打通等，先在 [`项目日志与笔记/问题工单.md`](./项目日志与笔记/问题工单.md) 登记工单并建独立任务目录，再继续可推进部分。

---

## 五、新贡献者入口顺序

1. [`交接文档/00-总交接说明.md`](./交接文档/00-总交接说明.md) —— 生态全貌、资产全景与接手入口。
2. [`薯片生态文档库/README.md`](./薯片生态文档库/README.md) —— 唯一权威契约库索引（愿景原则、架构设计、开发规范、插件开发、文件格式、接口契约、运维、工程管理、产品交互）。
3. [`重构大计划/00-总纲与路线图.md`](./重构大计划/00-总纲与路线图.md) —— 波次路线、铁律与「当前波次」。

随后按任务域进入：

- 新实现工作区细则：[`chips-ecosystem/README.md`](./chips-ecosystem/README.md) 与 [`chips-ecosystem/CONTRIBUTING.md`](./chips-ecosystem/CONTRIBUTING.md)。
- 并行开发与子智能体规范：[`重构大计划/03-并行开发与子智能体规范.md`](./重构大计划/03-并行开发与子智能体规范.md)。
- 旧仓与新工作区的映射关系：[`重构大计划/02-仓库映射与新工作区.md`](./重构大计划/02-仓库映射与新工作区.md)。
- 在册问题与裁决：[`项目日志与笔记/问题工单.md`](./项目日志与笔记/问题工单.md) 与各 `RFC-*` 目录。

---

## 六、工程纪律速记

- 分支与提交由用户管理；提交信息用中文、全面详细（细则见 `AGENTS.md`）。
- 改动后使用各项目 `package.json` 正式脚本验证，验证范围至少覆盖改动范围。
- 文档随代码同步更新：改代码必须核对并更新对应文档与台账，禁止只依赖 README 或历史任务说明。
