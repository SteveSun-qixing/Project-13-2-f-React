# 阶段四：SDK 模块调用入口重构

## 1. 阶段目标

让 `Chips-SDK` 成为模块能力调用的唯一正式开发者入口，并确保其类型系统、错误模型和契约同步能力与 Host 新链路完全一致。

## 2. 入口条件

- 阶段二完成；
- 阶段三至少完成 module 动作面和核心 payload 的实现冻结检查点。

## 3. 重点仓库

- `Chips-SDK`
- 必要时联动 `Chips-Host` 的 route manifest / contract 输出

## 4. 任务拆解

### 4.1 模块 API 重写

- 重写 `src/api/module.ts`；
- 删除旧 `mount/unmount/query/list` 外部正式 API；
- 新增 `listProviders / resolve / invoke / job.get / job.cancel` 封装；
- 增加 caller 常用请求类型和结果类型。

### 4.2 类型系统与错误模型

- 定义 provider 视图、invoke 请求、sync / job 结果联合类型；
- 补齐标准错误映射；
- 补齐 capability / method / job 相关辅助类型；
- 确保 SDK 类型源于正式契约而不是私有 README。

### 4.3 契约同步与漂移校验

- 更新 route manifest；
- 增加 Host route schema 与 SDK 类型漂移检查；
- 保证 SDK 示例、类型、测试与共享文档一致。

### 4.4 测试与使用示例

- 增加同步方法调用测试；
- 增加异步 job 管理测试；
- 增加错误归一测试；
- 更新模块调用示例与使用文档。

## 5. 串并行安排

- 本阶段可与阶段五并行；
- 但所有最终导出类型和方法名必须等待阶段三接口冻结检查点；
- 若阶段三在 payload 或错误模型上继续漂移，本阶段只允许做准备工作，不允许最终发布。

## 6. 验证门禁

- `Chips-SDK`：`npm test`

重点验证项：

- `client.module.*` API 稳定可用；
- SDK 不再暴露旧 UI 插槽式模块 API；
- 与 Host 联调时，同一错误场景返回一致错误结构。

## 7. 阶段退出标准

- 应用插件、其他模块插件和工具链都可以仅通过 SDK 使用模块能力；
- 生态内部不再需要散落手写 `invoke("module.*")` 调用；
- `chipsdev` 相关工具后续可直接依赖此正式接口。
