# 任务010：SDK Domain API 文件/卡片/平台 Wrapper 补齐

时间：2026-05-24 00:25 CST

## 本次范围

- 继续执行 `任务010-SDK-DomainAPI补齐与类型同步`。
- 本阶段只处理 Host route manifest 已存在、且适合作为 SDK 公共 Domain API 的文件、卡片与平台系统能力 wrapper。
- 未展开主题包升级；主题包 Token 与 Contract 升级仍属于后续任务 020/021/022/027。

## 核对依据

- `项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务010-SDK-DomainAPI补齐与类型同步.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`
- `生态设计原稿/19-SDK与协议.md`
- `生态共用技术文档/架构设计/14-Host服务域设计.md`
- `生态共用技术文档/协议与接口标准/05-系统接口标准.md`
- `Chips-Host/src/main/services/register-host-services.ts`
- `Chips-SDK/src/api/*`

## 完成内容

1. `Chips-SDK/src/api/file.ts`
   - 新增 `FileWatchOptions`、`FileWatchEvent`。
   - 新增 `client.file.watch(path, options?)`，映射 Host `file.watch`，将 `{ event }` 解包为 `FileWatchEvent | null`。
   - 修正 `client.file.write(...)`，对调用方保持 `Promise<void>`，不泄漏 Host `{ ack: true }`。

2. `Chips-SDK/src/api/card.ts`
   - 新增 `client.card.resolveDocumentPath(documentUrl)`。
   - 映射 Host `card.resolveDocumentPath`，将 `{ path }` 解包为路径字符串。

3. `Chips-SDK/src/api/platform.ts`
   - 补齐 Host 已正式注册的系统能力封装：
     - `clipboardRead/clipboardWrite`
     - `shellOpenPath/shellOpenExternal/shellShowItemInFolder`
     - `notificationShow`
     - `traySet/trayClear/trayGetState`
     - `shortcutRegister/shortcutUnregister/shortcutIsRegistered/shortcutList/shortcutClear`
     - `ipcCreateChannel/ipcSend/ipcReceive/ipcCloseChannel/ipcListChannels`
   - 所有写入或副作用类动作丢弃 `{ ack: true }`，对调用方保持 void 或明确结果类型。
   - 补齐平台剪贴板、通知、托盘、快捷键、IPC 的 TypeScript 类型。

4. `Chips-SDK/src/index.ts`
   - 导出新增 file/platform 类型。

5. 测试
   - `Chips-SDK/tests/client.test.ts`
     - 覆盖 `file.watch` 解包、`file.write` void 语义。
     - 覆盖 platform 系统 UI 与 IPC wrapper 的 payload 与返回解包。
   - `Chips-SDK/tests/card.test.ts`
     - 覆盖 `card.resolveDocumentPath` payload 与 `{ path }` 解包。

6. 文档
   - `生态共用技术文档/插件开发/08-SDK使用指南.md`
   - `Chips-SDK/技术文档/04-文件与资源能力封装设计.md`
   - `Chips-SDK/技术文档/06-主题与插件能力封装设计.md`
   - `Chips-SDK/需求文档/02-薯片 SDK 功能需求规格.md`

## 验证

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts tests/card.test.ts tests/tooling/contract-drift.test.ts
```

结果：3 个测试文件通过，53 个测试通过。

## 后续

- 任务010 后续继续补齐 `log`、`credential`、`serializer`、`control-plane` 等独立 Domain API。
- `plugin.init` 与 `plugin.handshake.complete` 暂按 Host 插件运行时内部握手链路处理，不在本阶段暴露为普通 SDK 公共 API。
