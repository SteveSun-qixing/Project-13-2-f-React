# 任务012：SDK 测试 Mock 与 Host 模拟器

## 1. 任务目标

为应用插件、组件库、脚手架和同化工具提供统一测试辅助，模拟 Host Bridge、主题事件、surface context、权限和错误。

## 2. 对应阶段任务

- `05-开发任务方案/任务05-SDK-RuntimeClient与React消费入口.md`
- `05-开发任务方案/任务15-预览组件矩阵主题矩阵与性能工具.md`

## 3. 涉及项目

- `Chips-SDK`
- `Chips-ComponentLibrary/packages/testing`
- `Chips-Scaffold/*`

## 4. 开发内容

1. mock bridge。
2. mock client。
3. mock launch context。
4. mock surface context。
5. mock theme changed。
6. mock permission denied。
7. mock timeout/retry。

## 5. 验收标准

- 应用模板测试可复用 mock。
- 组件库 hooks 测试可复用 mock。
- SDK 测试覆盖异常路径。

## 6. 验证命令

```bash
cd Chips-SDK && npm test
cd ../Chips-ComponentLibrary && npm run verify
```

