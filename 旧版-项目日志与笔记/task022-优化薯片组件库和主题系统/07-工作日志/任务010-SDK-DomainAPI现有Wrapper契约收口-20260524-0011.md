# 任务010：SDK Domain API 现有 Wrapper 契约收口

时间：2026-05-24 00:11 CST

## 开工文档核对

本阶段执行前已按要求重新核对：

- `06-工单级开发任务/任务010-SDK-DomainAPI补齐与类型同步.md`
- `02-SwiftUI能力模型调研`
- `03-薯片前端框架对标SwiftUI差距分析`
- `04-薯片前端框架开发重构方案`
- `05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`
- `生态设计原稿/02-极致模块化架构.md`
- `生态设计原稿/05-公共基础层设计.md`
- `生态设计原稿/薯片生态-架构设计手册.md`
- `生态共用技术文档/架构设计/14-Host服务域设计.md`
- `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
- `生态共用技术文档/协议与接口标准/05-系统接口标准.md`
- `生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md`
- `生态共用技术文档/协议与契约/02-服务协议标准.md`
- `生态共用技术文档/协议与契约/04-数据交换协议.md`
- `生态共用技术文档/协议与契约/13-命令系统契约.md`
- `生态共用技术文档/插件开发/08-SDK使用指南.md`

本阶段边界：只处理任务010中已公开 SDK wrapper 与 Host route 契约不一致的 P0 问题，不提前展开任务011 React hooks、任务012 mock/模拟器，也不继续推进任务020/021/022/027 的主题包完整升级。

## 本次完成

1. SDK wrapper 与 Host 响应 envelope 收口：
   - `file.stat` 解包 `{ meta }` 为 `FileStat`。
   - `file.list` 解包 `{ entries }` 为 `FileEntry[]`。
   - `resource.readMetadata` 解包 `{ metadata }` 为 `ResourceMeta`。
   - `config.get` 解包 `{ value }`。
   - `config.set/batchSet/reset` 丢弃 `{ ack: true }`，对调用方保持 `Promise<void>`。
   - `theme.apply` 丢弃 `{ success, themeId }`，对调用方保持 `Promise<void>`。
   - `i18n.setCurrent` 丢弃 `{ ack: true }`，并新增 `i18n.onChanged` 订阅 `language.changed`。

2. SDK payload 与类型收口：
   - `config.batchSet` 改为 Host 正式契约的 `entries: Record<string, unknown>`。
   - `config.set/batchSet/reset` 增加 `scope?: "user" | "workspace" | "system"` 类型。
   - `card.parse` 解包 Host `{ ast }`。
   - `card.validate` 改为 `validate(cardFile: string)`，发送 `{ cardFile }`。
   - `ValidationResult.errors` 同步为 Host 返回的 `string[]`。
   - `CommandView.diagnostic` 与 `CommandInvokeResult.command / invocationId` 按 Host 和命令系统契约设为正式字段。

3. 测试补齐：
   - `Chips-SDK/tests/client.test.ts` 增加 file/config/i18n/theme/command wrapper 断言。
   - `Chips-SDK/tests/card.test.ts` 增加 `card.parse` 解包与 `card.validate` payload 断言。
   - `Chips-SDK/tests/resource.test.ts` 增加 `resource.readMetadata` 解包断言。
   - 应用脚手架命令测试 fixture 同步 command invoke 结果中的 `command.diagnostic`。

4. 文档同步：
   - `生态共用技术文档/插件开发/08-SDK使用指南.md`
   - `生态共用技术文档/协议与接口标准/05-系统接口标准.md`
   - `Chips-SDK/需求文档/02-薯片 SDK 功能需求规格.md`
   - `Chips-SDK/技术文档/04-文件与资源能力封装设计.md`
   - `Chips-SDK/技术文档/06-主题与插件能力封装设计.md`

5. 工单闭环：
   - 已将 `项目日志与笔记/问题工单.md` 中 `工单081-卡片校验接口文档与SDK实现漂移阻断箱子卡片统一链路审查` 标记为已解决。
   - 已更新 `项目日志与笔记/已解决或废弃工单/工单081-卡片校验接口文档与SDK实现漂移/任务说明.md`。

6. 任务011前置准备：
   - 已使用子代理完成只读勘察报告：
     `08-草稿笔记/任务011-SDK-ReactHooks与Environment入口前置勘察报告.md`

## 验证结果

已通过：

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts tests/card.test.ts tests/resource.test.ts tests/tooling/contract-drift.test.ts
```

结果：4 个测试文件、58 个用例通过。

```bash
cd Chips-Host
npm run test:contract
```

结果：1 个测试文件、3 个用例通过。

```bash
cd Chips-Scaffold/chips-scaffold-app
npm test
```

结果：构建通过，2 个模板测试通过。

```bash
cd Chips-SDK
npm test
```

结果：CLI smoke、开发工作区、应用/卡片/布局/模块脚手架生成、模块 invoke、package compatibility 全部通过。

备注：`npm test` 输出包含 npm 版本提示和若干既有依赖 deprecation warning，不影响测试退出码。

## 后续继续

任务010下一阶段应继续处理 manifest 中尚未有 SDK public wrapper 的服务域：

- `platform.clipboard/shell/notification/tray/shortcut/ipc`
- `log.*`
- `credential.*`
- `serializer.*`
- `control-plane.*`
- `file.watch`
- `card.resolveDocumentPath`

`plugin.init` 与 `plugin.handshake.complete` 仍应先判定为内部握手动作，不应贸然暴露为 public SDK wrapper。
