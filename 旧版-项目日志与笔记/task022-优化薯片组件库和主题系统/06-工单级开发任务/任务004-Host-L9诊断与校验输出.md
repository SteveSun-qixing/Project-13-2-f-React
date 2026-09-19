# 任务004：Host L9 诊断与校验输出

## 1. 任务目标

让 L9 输出可供 CLI、预览工具、脚手架测试和设置面板消费的结构化诊断。

## 2. 对应阶段任务

- `05-开发任务方案/任务03-Host-L9统一渲染产品化与诊断.md`

## 3. 涉及项目

- `Chips-Host/packages/unified-rendering/src/*`
- `Chips-Host/tests/unit/unified-rendering.test.ts`
- `Chips-SDK`

## 4. 开发内容

1. 定义 diagnostic 数据结构。
2. Validate 阶段输出节点路径、严重级别、错误码、建议。
3. 接入组件 contract、主题 token、a11y、事件 handler 校验。
4. SDK/CLI 可读取诊断。

## 5. 验收标准

- 诊断能定位到具体节点。
- 诊断可 JSON 序列化。
- P0/P1 诊断可阻断质量门禁。

## 6. 验证命令

```bash
cd Chips-Host
npm run build
npm test
npm run test:contract
```

