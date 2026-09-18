# task041 技术选型 — Sheet xlsx 引擎（Rust sidecar）承载方案

> 日期：2026-09-04
> 结论：**Rust sidecar 保持原生二进制、按平台分别编译、由 Chips-Host 承载并通过 SDK 正式路由供插件调用**。
> 用户已明确：只需保证"能编译成不同平台"，不要求同一二进制跨平台通用。

## 1. 问题背景

GenOffice 的 Sheet 应用（apps/sheets）通过 stdio JSON 行协议驱动一个 Rust sidecar（`apps/sheets/native/xlsx-engine`）完成 xlsx 的打开、懒加载区间读取、公式重算与 zip 重组保存。Electron 主进程 spawn 该二进制；薯片生态的插件运行在浏览器上下文，无法 spawn 进程，必须为它找到正式承载位置。

## 2. sidecar 的实际职责面（实测源码结论）

| 命令 | 功能 | 浏览器替代难度 |
| --- | --- | --- |
| `open` | calamine 解析 xlsx + ironcalc 初始重算 → workbook 元数据 + 会话 | 高（2 个 Rust 库） |
| `readRange` | 按区间懒加载单元格（值/公式/富文本/样式索引，含共享公式展开） | 高 |
| `readFormulaCells` / `recalc` | ironcalc 公式引擎重算 | 高 |
| `readMedia` | 读取视觉对象媒体字节 | 低（zip 读） |
| `archiveManifest` / `readEntries` / `scanEntries` | zip 清单/条目抽取/文本扫描 | 低 |
| `saveArchive` | zip 重组保存（未触碰条目原始压缩字节直拷 + CRC 校验） | 中（JSZip 重压缩语义等价但失去直拷优化） |
| `convertWorkbook` | 旧版 .xls → .xlsx 转换（calamine 读 BIFF） | 高 |

关键事实：**保存链路的 OOXML 生成（gateway/，23 文件约 8.6k 行）本来就是纯 JS**（fast-xml-parser + jszip），sidecar 在保存中只承担 zip 重组。但打开/重算链路（calamine 解析 + ironcalc 引擎 + 共享公式 + 视觉对象，Rust 约 13k 行）没有等价 JS 实现，纯 JS 重写等于重新开发，违反"完美移植"要求。

## 3. 候选方案对比

| 方案 | 保真度 | 工程量 | 多平台 | 生态侵入 |
| --- | --- | --- | --- | --- |
| A. 纯 JS 重写 open/recalc | 低（行为漂移风险大） | 极大（≈13k 行 Rust → TS） | 好 | 无 |
| B. Rust 编译 WASM 进插件 | 高 | 中（wasm-bindgen + 全链路字节化 IO 改造 + wasm 兼容性排雷） | 单产物 | 零（插件内自含） |
| C. 原生二进制 + Host 承载 | **100%（二进制原样）** | 小（Rust 零改动；Host 新增服务包 + SDK API + 各平台构建脚本） | 按平台分别编译 | Host/SDK 新增正式契约 |

## 4. 决策与依据

选择 **方案 C**，依据：

1. **用户决策**（2026-09-04）：保证能编译成不同平台即可，不要求单一二进制跨平台 —— 直接解除方案 B 相对方案 C 的唯一架构优势；
2. **完美移植**：sidecar 二进制原样使用，calamine/ironcalc 行为零偏差，与 GenOffice 发布产物完全等价；
3. **架构对位**：GenOffice 中 sidecar 由应用主进程 spawn；薯片生态中"主进程"的架构对应物就是 Chips-Host。工单165 期望行为早已明确："为 XLSX sidecar 与 PDFium/OCR 等主进程能力设计 Host module/service 正式契约，插件只调用 SDK"；
4. **架构红线兼容**：进程 spawn 与磁盘 zip 重组属于系统能力，必须位于 Host 层；插件只经 SDK 路由调用；
5. **保存链路零重写**：gateway 纯 JS 计划器随插件移植（renderer 上下文可运行），仅 zip 重组/条目读取走 Host 路由 —— 插件内格式逻辑与 Host 系统能力边界清晰。

## 5. 实施要点

1. Host 新增引擎服务包（如 `Chips-Host/packages/xlsx-engine-service/`），内含：
   - sidecar 二进制的 spawn 与 JSON 行协议转发（移植 `xlsx-sidecar-client.ts` 语义）；
   - 按平台解析二进制路径（`xlsx-sidecar` / `xlsx-sidecar.exe`），二进制随 Host 发布产物分发；
   - 路由建议挂入 SDK 正式契约（与 file.session 并列的引擎域，命名在架构方案中定稿）。
2. sidecar 二进制随任务入库构建产物：本任务先落地 macOS arm64/x64 构建脚本与产物，Windows/Linux 交叉编译脚本随包提供（cargo 交叉目标 + CI 可执行），包内 `SOURCE.md` 说明来源与许可证（Apache-2.0）。
3. 插件侧 `window.desktopApi` 适配层：open/readRange/readFormulaCells/recalc/readMedia/archiveManifest/readEntries/scanEntries/saveArchive/convertWorkbook 全部转发 SDK 路由；gateway 计划器（纯 JS）在插件内运行。
4. 构建验证门禁：`cargo build --release` 产物 + 协议往返测试（Host 侧单测用 fixture xlsx 走真实二进制）。

## 6. 关联事实记录

- 本机 Rust 工具链：cargo 1.93.0；已装目标 aarch64-apple-darwin、x86_64-apple-darwin；
- 全局 `~/.cargo/config.toml` 的 USTC git 镜像已失效（`https://mirrors.ustc.edu.cn/crates.io-index` 404），构建时需以 `--config` 覆盖为可用 sparse 源（不动用户全局配置）；
- Cargo.toml 依赖（calamine 0.36 / ironcalc 0.7 / quick-xml 0.38 / roxmltree 0.21 / zip 4 / serde / uuid / base64）全部为纯 Rust，无 C 依赖，按平台编译无障碍。
