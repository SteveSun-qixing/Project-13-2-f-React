# 任务006：Host surface 与 Scene 上下文

## 1. 任务目标

补齐 Host surface 与 scene context，让应用插件能以 App/Scene 心智运行，同时保持 `surface` 作为跨平台主语义。

## 2. 对应阶段任务

- `05-开发任务方案/任务04-App-Scene-surface-commands应用结构能力.md`

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK/src/api/surface.ts`
- `生态共用技术文档/插件开发/02-应用插件开发.md`

## 4. 开发内容

1. surface context 增加 sceneId/sessionId/pluginId/kind/presentation。
2. 启动上下文携带 scene 信息。
3. surface 生命周期事件标准化。
4. SDK 类型同步。
5. 应用插件 manifest 校验增强。

## 5. 验收标准

- 应用可通过 surface.open 启动并获得 scene context。
- Desktop 下窗口只是 surface 的平台映射。
- 应用不直接依赖 BrowserWindow。

## 6. 验证命令

```bash
cd Chips-Host && npm run build && npm test && npm run test:contract
cd ../Chips-SDK && npm test
```

