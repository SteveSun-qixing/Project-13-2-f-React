# Host组合根接管-开发计划（任务 #27 · W2 波次六接管路）

- 接管对象：前一路 `host-root-takeover` 智能体（最后活动 18:57，判定死路）；产物以防丢快照
  `24605d61` 与其前序提交（`358f895e`、`604b5863`）入库，工作树无未提交残差。
- 文件面（owner 唯一）：`chips-ecosystem/packages/host/src/main/**`；新增组合根接线测试套件。
- 禁区：`src/capabilities/document/**`、`tests/document-*`、`tests/helpers/document-fake-ports.ts`
  （并行路 R28 在修，其 14 条 tsc 命名漂移不代改、不放宽任何断言）。
- 目标口径（#49 验收段）：PAL 形状闸已打通（`electron-api` `hasFunctions` 接受 class 静态面、
  `main.ts stageOf` 归因 `pal-host`）；本单收口**组合根接线面**：`createRuntime` 完成
  PAL 自举 → Bridge 接线 → 能力注册表 → document 服务挂载声明，并以真 Electron self-check 承载实证。

## 阶段

1. **审计在途产物**（逐文件读 `src/main/**`）
   - 判据：组合根链 `self-check.ts → createProductionAssembly → startHostMain(main.ts) →
     createPalHost(PAL 自举) → createRuntime(生产运行时) → HostApplication(启动/收口)` 完整、
     无 TODO/占位/空壳；`reserved.ts` 挂载声明与 `04-能力契约规范` §6.2/§7.3 逐项一致。
   - 证据：读码记录 + `git diff 358f895e~1..24605d61 -- chips-ecosystem/packages/host`。
2. **基线闸门实跑**
   - `npm run build:main`；`npx vitest run tests/main.test.ts tests/contract-matrix.test.ts
     tests/electron-api-shape.test.ts`；`npx eslint src/main`。全部重定向取真实退出码。
3. **补齐组合根接线套件**（`tests/composition-root.test.ts`）
   - 锁全链：壳启动上下文逐段传递（PalHostContext / HostRuntimeContext 与 app.getPath 一致）；
     真实注册表经壳端口路由（`system:info` 真实响应、经 `ipcMain` 通道端到端）；
     document 挂载声明四项 wired=false 与权限映射；提供方注入后 wired=true 且真实处理；
     注册冲突 → 启动终止 exit(1)；收口 → state stopped。
4. **真 Electron 承载实测**（验收 3）
   - `npm run build:main && npm run build:preload && npm run build:renderer` 后
     `node ./node_modules/.bin/electron ./dist/main/self-check.js`（node 包装器方式），
     `pgrep -fl self-check` 取真实 Electron 子进程，存活 ≥14 秒、运行期 stderr 0 字节、
     无 HOST_STARTUP_FAILED，收尾 `pkill -f self-check`（SIGTERM 提示良性）。
5. **日志落档**
   - 每阶段追加 `项目日志与笔记/Host组合根接管-开发日志.md`；收口时在
     `packages/host/开发日志.md` 末尾追加接管段；返回 ≤5 行汇报。

## 验收命令（全部 `> log 2>&1; echo EXIT=$?`，禁管道判绿）

1. `npm run build:main` → 0
2. `npx vitest run tests/main.test.ts tests/contract-matrix.test.ts tests/electron-api-shape.test.ts tests/composition-root.test.ts` → 0
3. 真 Electron 承载（pgrep 口径，见阶段 4）
4. `npx eslint src/main tests/composition-root.test.ts` → 0

包级全量 `npm test` 归 R28 收口，不是本单闸。
