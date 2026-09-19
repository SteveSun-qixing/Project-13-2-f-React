# 任务013：SDK CLI 预览、质量与同化命令

## 1. 任务目标

扩展 `chipsdev`，提供预览、组件矩阵、主题检查、质量门禁、Web 项目同化报告等开发者命令。

## 2. 对应阶段任务

- `05-开发任务方案/任务15-预览组件矩阵主题矩阵与性能工具.md`
- `05-开发任务方案/任务16-Web项目同化CLI与迁移报告.md`

## 3. 涉及项目

- `Chips-SDK/cli/index.js`
- `Chips-SDK/src/tooling/*`
- `Chips-SDK/tests/*`

## 4. 开发内容

1. `chipsdev preview`。
2. `chipsdev component gallery`。
3. `chipsdev theme inspect`。
4. `chipsdev quality gate`。
5. `chipsdev assimilate scan/report`。
6. JSON 报告输出。

## 5. 验收标准

- CLI 命令可被测试覆盖。
- 输出既适合人读，也适合机器消费。
- 不绕开 Host/SDK 正式能力。

## 6. 验证命令

```bash
cd Chips-SDK
npm test
```

