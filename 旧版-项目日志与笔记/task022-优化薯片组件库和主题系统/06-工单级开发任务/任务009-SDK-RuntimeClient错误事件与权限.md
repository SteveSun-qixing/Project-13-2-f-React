# 任务009：SDK Runtime Client 错误、事件与权限

## 1. 任务目标

完善 SDK Runtime Client 的错误归一、事件订阅、权限诊断、超时和重试能力。

## 2. 对应阶段任务

- `05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`

## 3. 涉及项目

- `Chips-SDK/src/core/*`
- `Chips-SDK/src/types/*`
- `Chips-SDK/tests/*`

## 4. 开发内容

1. 标准错误结构。
2. requestId 和日志记录。
3. retryable 错误处理。
4. Bridge unavailable 诊断。
5. 权限不足错误归一。
6. events on/once/emit 语义一致。

## 5. 验收标准

- SDK 调用失败输出标准错误。
- 事件订阅可取消。
- 权限错误可被应用和设置面板识别。

## 6. 验证命令

```bash
cd Chips-SDK
npm test
```

