# 阶段三：Host 模块服务运行时重构

## 1. 阶段目标

在 `Chips-Host` 中建立新的模块注册、解析、调用、任务和生命周期治理体系，形成模块插件的正式运行时主实现。

## 2. 入口条件

- 阶段二完成；
- 新 module 动作、schema、错误和事件基线已冻结。

## 3. 重点仓库

- `Chips-Host`

## 4. 任务拆解

### 4.1 模块注册表

- 设计并实现 provider 注册表；
- 解析 `manifest.yaml` 中 `module.provides` 与 `module.consumes`；
- 处理 enable / disable / uninstall 时的注册与回收；
- 支持 capability 查询、多 provider 并存和 provider 状态视图。

### 4.2 provider 解析与选择

- 实现 `module.listProviders`；
- 实现 `module.resolve`；
- 明确默认 provider 选择策略；
- 明确显式 `pluginId` 或 provider 指定逻辑；
- 处理 provider 缺失、版本不匹配、状态不可用场景。

### 4.3 调用调度

- 实现 `module.invoke`；
- 激活模块 runtime；
- 执行权限校验、schema 校验、超时控制和错误归一；
- 支持同步结果与异步 job 结果两种模式；
- 统一写入调用审计和日志。

### 4.4 Job 生命周期治理

- 建立 job 存储、状态机和取消机制；
- 实现 `module.job.get` 与 `module.job.cancel`；
- 发布进度、完成、失败事件；
- 处理模块禁用、卸载、异常退出时的 job 回收。

### 4.5 模块间调用与上下文注入

- 为模块运行时注入 `ctx.module.invoke(...)`；
- 注入 logger、权限快照、服务门面、job 控制器；
- 保证模块间调用继续走同一套 Host 路由；
- 防止模块绕开 Host 形成直连旁路。

### 4.6 旧链路收口

- 旧页面挂载式模块实现退出正式公开路径；
- 不保留双轨公开实现；
- 需要移除的旧代码按仓库规则移动到就近 `归档/`，但运行时对外只保留新链路。

## 5. 串并行安排

本阶段属于主关键路径，不建议拆为完全并行实施。推荐顺序：

1. 注册表与 Manifest 解析；
2. provider 解析与选择；
3. invoke 调度；
4. job 生命周期；
5. 上下文注入与模块间调用；
6. 旧链路收口。

可局部并行：

- 审计日志和错误归一可与 job 生命周期实现并行；
- Manifest 解析和 provider 查询视图可并行，但必须在 invoke 调度前完成合流。

## 6. 验证门禁

- `Chips-Host`：`npm run build`
- `Chips-Host`：`npm test`
- `Chips-Host`：`npm run test:contract`

重点测试：

- provider 注册、更新、删除；
- 多 provider 解析；
- schema 校验失败；
- timeout / cancel；
- 模块间调用；
- disable / uninstall 回收；
- 异常模块不拖垮 Host。

## 7. 阶段退出标准

- Host 已成为唯一正式模块运行时；
- `module.invoke` 全链路可稳定工作；
- SDK 和脚手架不再需要围绕旧链路做任何特殊处理。
