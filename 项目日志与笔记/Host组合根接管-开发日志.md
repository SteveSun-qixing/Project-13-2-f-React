# Host组合根接管-开发日志（任务 #27 · W2 波次六接管路）

接管自死路路线 `host-root-takeover`（最后活动 18:57）。工作目录
`chips-ecosystem/packages/host`，`PATH` 含 `~/.volta/bin`。所有命令以
`> log 2>&1; echo EXIT=$?` 取真实退出码。

## 阶段 1 · 在途产物逐文件审计（2026-09-20 20:15–20:20）

- 取证范围：`git diff 2655ad78~1..24605d61 -- src/main`（前路与 #49 在途面共 4 个文件：
  `main.ts` +19（`stageOf` 归因 `PalBootstrapError→pal-host`，#49 已验收口径，正确）、
  `production-assembly.ts` 新增 106 行（生产清单/运行时/装配三出口）、
  `runtime-provider.ts`（`HostAssembly<TRuntime>` 泛型化，壳链仍按 `IPlatformRuntime` 消费）、
  `self-check.ts`（改经 `createProductionAssembly` + `createMacPalHost` 装配）。
- `src/main/**` 16 文件逐一读头部与关键接线点：启动链
  `self-check → startHostMain → createPalHost（PAL 自举）→ createRuntime（生产运行时）→
  HostApplication.start（注册表 registerAll → IPC 通道 → 窗口/协议/事件）` 完整；
  无 TODO、无占位、无空壳回退混入生产路径（`self-check-runtime.ts` 仅保留为“核心缺位”诚实回退，
  未被入口引用）。document 挂载声明面在 `runtime/capabilities/reserved.ts`（四项
  `document:open|read|write|save` 与 `04-能力契约规范` §6.2/§7.3 权限映射逐项一致），
  `createHostRuntime.report().reserved` 与注册表实态比对呈现 `wired`。
- 审计结论：组合根接线语义已在位，本接管单收口为“补锁定套件 + 全闸实测”。
- 证据：`git diff --stat` 输出（4 files changed, 142 insertions, 16 deletions）；读码记录如上。

## 阶段 2 · 基线闸门实跑（2026-09-20 20:20）

| 命令 | 退出码 | 备注 |
| --- | --- | --- |
| `npm run build:main` | 0 | `dist/main/self-check.js` 103.11 kB |
| `npx vitest run tests/main.test.ts tests/contract-matrix.test.ts tests/electron-api-shape.test.ts` | 0 | 46 用例 |
| `npx eslint src/main` | 0 | 前路零残差 |

## 阶段 3 · 新增组合根接线全链套件（2026-09-20 20:26）

- 新增 `tests/composition-root.test.ts`（7 用例，锁定 #27 接线面）：
  1. PalHostContext / HostRuntimeContext 与壳输入（`app.getPath('userData')`、preload、platformRoot）逐段一致；
  2. 真实注册表：`system:info` 经壳端口返回 PAL 真实快照（`report().capabilities.active === 1`）；
  3. Bridge 接线端到端：`bridge:request` 通道经 `ipcMain` 穿透到注册表；死亡窗口来源拒 `BRIDGE_SESSION_UNKNOWN`；
  4. document 挂载声明：四项 `reserved` 与契约逐字一致、未接线 `wired=false`、调用得真实 `BRIDGE_CAPABILITY_NOT_FOUND`；
  5. 提供方注入形态（R28 接线单契约形状）：通道调用穿透真实 handler、槽位 `wired=true`、`byDomain` 同步；
  6. 注册冲突终止：与内置同 ID 提供方 → `createRuntime` 抛 `HostStartupError`、`app.exit(1)`、诊断 `stage:"core-start"`；
  7. 收口：`quit()` 后 `report().state === 'stopped'`。
- 未触碰禁区：`src/capabilities/document/**`、`tests/document-*`、`tests/helpers/document-fake-ports.ts`。
- `npx prettier --write` 单文件收口格式；eslint（`src/main` + 新套件）退出码 0。

## 阶段 4 · 验收闸与真 Electron 承载实测（2026-09-20 20:27–20:29）

| 闸 | 命令 | 真实退出码 |
| --- | --- | --- |
| 1 | `npm run build:main > /tmp/r27_build.log 2>&1` | **0** |
| 2 | `npx vitest run tests/main.test.ts tests/contract-matrix.test.ts tests/electron-api-shape.test.ts tests/composition-root.test.ts > /tmp/r27_vitest.log 2>&1` | **0**（4 文件 / 53 用例） |
| 3 | 真 Electron 承载（见下） | 通过 |
| 4 | `npx eslint src/main tests/composition-root.test.ts > /tmp/r27_eslint_final.log 2>&1` | **0** |

真 Electron 承载（macOS Aqua 会话）：

- 前置：`npm run build:preload` / `build:renderer` 各 EXIT=0（自检入口解析
  `dist/preload/index.js` 与 `dist/renderer`）。
- 命令口径修正（重要）：`node ./node_modules/.bin/electron …` **不可用**——pnpm 布局下
  `.bin/electron` 是 POSIX shell 包装脚本（首行 `basedir=$(dirname …)`），node 直接加载必然
  `SyntaxError: missing ) after argument list`（实测 stderr 837 字节、进程秒退）。
  node 方式的正确事实源是 `node ./node_modules/electron/cli.js ./dist/main/self-check.js`。
- 存活证据：起进程后 `pgrep -fl self-check`（排除 node 包装器 pid 口径）实测真实子进程
  `27235 …/electron@40.8.0/…/Electron.app/Contents/MacOS/Electron ./dist/main/self-check.js`
  在 t≈3s 与 t≈15s 两次探测均在位（存活 ≥14 秒达标）。
- 运行期 stderr：0 字节（`wc -c` 实测），全程无 `HOST_STARTUP_FAILED`（grep 无命中）。
- 收尾：`pkill -f self-check.js`（EXIT=0），随后 stderr 追加 209 字节
  `Electron … exited with signal SIGTERM` —— 良性外部终止提示（任务口径明示），非壳诊断。

## 阶段 5 · 参考性全量与遗留（2026-09-20 20:29）

- 参考性（非本单闸，R28 收口闸）：`npx tsc --noEmit -p tsconfig.json` EXIT=**0**（R28 已将
  document 面 14 条命名漂移清零，编译阻塞解除）；`npm test` EXIT=**0**（48 文件 / 609 用例全绿）。
- 遗留：无。#49 遗留项 3（README 目录树漂移）与项 7（lint 脚本口径）仍归主智能体派单，不在本单文件面。
