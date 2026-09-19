# @chips/host

薯片生态桌面壳（Electron）包：主进程、preload、壳窗口渲染进程与平台抽象层（PAL）。

> 权威：`薯片生态文档库/01-架构设计/01-子系统设计/17-跨端Shell与平台抽象设计.md`、
> `薯片生态文档库/01-架构设计/ADR/ADR-002-Electron作为桌面端壳.md`。

## 目录

```
src/
├── index.ts        # 包公开入口：PAL 契约、Mac 工厂、错误模型、目录变量
├── platform/       # 平台抽象层（PAL）：端口契约与 macOS 实现
├── main/           # Electron 主进程装配（壳生命周期、IPC、协议）
├── protocol/       # IPC 线协议与 chips-resource:// URI 解析
├── runtime/        # 平台运行时端口与壳自检运行时
└── shared/         # 壳内部诊断与错误
```

## PAL 用法

```typescript
import { createMacPalHost, loadElectronModule } from '@chips/host';

const electron = loadElectronModule();
if (electron === null) {
  throw new Error('必须在 Electron 主进程中运行');
}

const pal = createMacPalHost(electron, {
  windowOptions: () => ({ webPreferences: { preload: '/path/to/preload.js' } }),
});

// 壳自检已完成：matrix 与 ports 严格一致；分面缺失不注册、不伪造成功。
await platformRuntime.start(pal);
```

## 边界

- PAL 是平台内部类型：不经 `@chips/sdk` 导出，不出现在 `window.chips`（SL-5）。
- 平台差异只在 `src/platform/mac/**` 收敛；平台核心与插件零平台特判（SB-1）。
- 端口不做权限判定、schema 校验与业务事件发布；不可用返回正式域错误码（SB-5/SB-7）。
- 真实 Electron 由壳入口注入；测试通过 `tests/helpers/electron-mock.ts` 注入替身，mock 不进入 `src/`。

## 命令

```bash
pnpm --filter @chips/host typecheck
pnpm --filter @chips/host lint
pnpm --filter @chips/host test
pnpm --filter @chips/host test:coverage
pnpm --filter @chips/host build
```

## 文档

- 开发计划：`src/platform/开发计划.md`
- 开发日志：`src/platform/开发日志.md`
