# 阶段二：Host 路由契约与 Schema 基线重构

## 1. 阶段目标

在 `Chips-Host` 中先完成模块能力公开动作面的路由、schema、错误、事件和契约测试基线重构，为后续运行时实现和外部调用方接入提供稳定边界。

## 2. 入口条件

- 阶段一已完成；
- 共享文档中 module 动作面、Manifest 字段和治理职责已冻结。

## 3. 重点仓库

- `Chips-Host`
- `Chips-SDK` 中 route manifest 或契约同步相关文件
- 生态共用技术文档中的接口基线文档

## 4. 任务拆解

### 4.1 命名与边界清理

- 识别 Host 内部 `kernel module loader` 与 `module plugin service` 的命名冲突；
- 冻结新的内部命名，避免后续实现和文档混淆；
- 明确旧 `module.mount/unmount/query/list` 不再进入未来正式公开动作面。

### 4.2 路由动作与 payload 结构

- 在 Host 路由层定义新的模块动作；
- 为每个动作补齐输入输出 schema；
- 冻结 provider 视图、resolve 结果、invoke 结果、job 快照结构；
- 冻结 caller 元信息、超时、provider 指定方式、错误输出结构。

### 4.3 错误与事件基线

- 定义模块服务错误码；
- 定义 job 进度、完成、失败与 provider 变更事件；
- 冻结审计字段：caller、provider、capability、method、duration、status、errorCode；
- 统一写入 Host 对外接口基线与 Bridge 文档。

### 4.4 Host schema 注册与契约测试

- 将新 module 动作纳入 Host schema 注册；
- 更新 Host route manifest；
- 增加 Host contract tests；
- 增加 Host unit tests，验证 schema 白名单与错误返回。

### 4.5 SDK 契约同步检查点

- 同步更新 SDK route manifest 引用；
- 建立 Host route schema 与 SDK 类型的漂移检查点；
- 明确 SDK 在阶段四之前不得自行扩展未冻结字段。

## 5. 串并行安排

关键路径必须顺序推进：

1. 命名与路由动作面冻结；
2. payload / schema 冻结；
3. 错误与事件冻结；
4. Host contract tests 与 route manifest 收口。

可并行部分：

- 路由 schema 编写与公共文档补充可并行；
- SDK 契约同步检查可与 Host contract tests 并行，但不能先于 schema 冻结完成。

## 6. 验证门禁

- `Chips-Host`：`npm run build`
- `Chips-Host`：`npm test`
- `Chips-Host`：`npm run test:contract`

重点验证项：

- 新 module 动作全部完成 schema 注册；
- 旧模块公开动作不再出现在正式 route manifest 中；
- 非法 capability / method / payload 请求能稳定返回标准错误。

## 7. 阶段退出标准

- Host 公开动作面已经稳定；
- SDK 和脚手架可以把这些动作作为唯一正式依赖；
- 若 route/schema/error 仍然变化频繁，则不得进入阶段三到阶段五的实装。
