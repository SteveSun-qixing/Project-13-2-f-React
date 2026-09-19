# 任务008：Host 主题运行时与 Contract 联动

## 1. 任务目标

让 Host Theme Runtime 与组件库 contract、主题包 contract、L9 theme resolve、设置面板诊断形成闭环。

## 2. 对应阶段任务

- `05-开发任务方案/任务14-主题系统与组件Contract治理.md`

## 3. 涉及项目

- `Chips-Host/src/main/theme-runtime`
- `Chips-ComponentLibrary/packages/theme-contracts`
- `ThemePack/*`

## 4. 开发内容

1. `theme.contract.get` 返回完整 contract view。
2. `theme.apply` 前执行 contract guard。
3. `theme.resolve` 输出 token 诊断。
4. 主题变化事件携带版本和诊断摘要。
5. CLI 和设置面板可消费主题诊断。

## 4.1 前置勘察补充

任务007并行前置勘察确认任务008正式开发前必须处理以下阻断：

1. 暗色主题包缺少布局原语 required tokens，完整 contract guard 接入后会阻断应用。
2. 组件库 theme-contracts 文档/导出与实际 42 个 contract 存在漂移。
3. 普通组件 contract 中出现 iframe 字段，与公共组件契约标准“只有高级 iframe 组件声明 iframe 附加契约”的口径冲突。
4. 公共主题接口规范尚未定义完整 contract view、diagnostics、coverage、事件诊断摘要 schema。

这些前置项已拆分为 `任务008.1` 与 `任务008.2`，任务008正式实现时必须先核对并纳入同一闭环。

## 5. 验收标准

- 无效主题无法应用。
- 缺失 token 可定位到组件 part/state。
- 默认主题和暗色主题都通过。

## 6. 验证命令

```bash
cd Chips-Host && npm run build && npm test && npm run test:contract
cd ../Chips-ComponentLibrary && npm run test:contracts
```
