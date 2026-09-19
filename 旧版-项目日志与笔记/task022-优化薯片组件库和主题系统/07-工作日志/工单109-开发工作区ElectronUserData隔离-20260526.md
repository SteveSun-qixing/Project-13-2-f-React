# 工单109：开发工作区 Electron UserData 隔离日志

日期：2026-05-26

## 背景

任务055安装打包发布链路继续核查开发工作区与用户工作区隔离时，发现 Host 业务工作区已经通过 `--workspace` 或 `CHIPS_HOME` 进入 `.chips-host-dev` / `~/.chips-host`，但 Electron 默认 `userData` 目录没有显式绑定到当前 Host 工作区，存在开发态 Chromium 缓存、LocalStorage、Session、IndexedDB 等运行态数据污染正式 Host 环境的风险。

## 完成内容

1. 登记 `工单109-开发工作区ElectronUserData未随Host工作区隔离`。
2. 新增 Host 启动工具，统一把 Electron `userData` 固定到 `<workspacePath>/electron-user-data`。
3. 在 `app-entry` 请求单实例锁之前绑定 `userData`。
4. 在 `HostMainProcess.start()` 的 Electron ready 之前按 `HostApplication.workspacePath` 幂等绑定 `userData`。
5. 补充 app-entry 与 HostMainProcess 生命周期单元测试。
6. 更新工单总表和独立工单说明，将状态标记为已解决。

## 验证

通过：

```bash
cd Chips-Host
npm test -- --run tests/unit/app-entry.test.ts tests/unit/main-process-lifecycle.test.ts
npm run build
```

结果：

- `tests/unit/app-entry.test.ts` 7 条测试通过。
- `tests/unit/main-process-lifecycle.test.ts` 6 条测试通过。
- `npm run build` TypeScript 构建通过。

## 结论

开发工作区和用户工作区的隔离边界补齐到 Electron 运行态数据层。后续任务055继续执行真实安装器产物与系统级文件关联验收时，可把 `electron-user-data` 作为工作区完整隔离检查项。
