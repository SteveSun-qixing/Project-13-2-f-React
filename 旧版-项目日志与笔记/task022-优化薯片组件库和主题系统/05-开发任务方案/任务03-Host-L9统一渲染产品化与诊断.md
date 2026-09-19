# 任务03：Host L9 统一渲染产品化与诊断

## 1. 任务目标

把 Host 已有 L9 Unified Rendering 从内部渲染流水线推进为前端框架的统一校验、主题解析、布局计算、提交和诊断底座。

完成后，应用插件、卡片、箱子布局、动态配置页面、预览工具都应能通过同一套 L9 规则获得一致的质量门禁。

## 2. 当前基础

已核对：

- `Chips-Host/packages/unified-rendering/src/*`
- `Chips-Host/tests/unit/unified-rendering.test.ts`
- `Chips-Host/技术文档/12-L9统一渲染层实现说明.md`
- `Chips-Host/技术文档/13-L9渲染性能基线报告.md`
- `Chips-Host/技术文档/14-L9阶段验收与发布说明.md`
- `Chips-Host/技术文档/15-主题运行时实现说明.md`

当前 L9 已有 Normalize、Validate、Theme Resolve、Layout Compute、Commit、Effect Dispatch、性能基线，但还需要与 SDK、组件库、脚手架和预览工具形成开发体验闭环。

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `ThemePack/*`
- `Chips-Scaffold/chips-scaffold-app`

## 4. 开发内容

1. 完善 L9 输入/输出契约。
   - 输入：L8 UINode、组件 contract、主题 snapshot、环境信息、surface context。
   - 输出：标准 render result、diagnostics、layout result、effect plan、performance metrics。

2. 补齐 Normalize 阶段。
   - 节点 id/path 标准化。
   - 默认 props 归一。
   - children/slot 归一。
   - i18n、themeScope、accessibility、motion、permission 字段归一。

3. 补齐 Validate 阶段。
   - L8 语义校验。
   - 组件 contract 校验。
   - 主题 token 缺失校验。
   - a11y 必填项校验。
   - 事件 handler id 校验。
   - runtime-effect 禁止在 render 阶段触发。

4. 打通 Theme Resolve。
   - 继续使用 Host L11 Theme Runtime，不在 L9 重新实现主题解析器。
   - L9 只消费 `ResolvedTheme` / `ThemeSnapshot`。
   - 主题链路错误必须输出结构化诊断。

5. 补齐 Layout Compute。
   - 支持 Stack/Grid/Form/List/Section/ScrollView/Table/Navigation 的语义布局信息。
   - 只输出布局语义和约束，不写视觉值。
   - 为普通页面结构和应用工具界面提供同一计算模型。

6. 补齐 Effect Dispatch。
   - `ui-effect`：聚焦、滚动、过渡。
   - `runtime-effect`：通过 Runtime Client 调 Host 能力。
   - `telemetry-effect`：日志、性能、诊断。
   - 所有效果必须可追踪、可测试。

7. 建立诊断与性能指标。
   - 每次渲染输出节点数、校验耗时、主题解析耗时、布局耗时、提交耗时。
   - 性能阈值纳入质量门禁。
   - 诊断结果可被 SDK CLI 和预览工具读取。

## 5. 建议文件范围

- `Chips-Host/packages/unified-rendering/src/*`
- `Chips-Host/tests/unit/unified-rendering.test.ts`
- `Chips-Host/scripts/benchmark-unified-rendering.ts`
- `Chips-Host/技术文档/12-L9统一渲染层实现说明.md`
- `Chips-Host/技术文档/13-L9渲染性能基线报告.md`
- `Chips-ComponentLibrary/packages/theme-contracts/*`
- `Chips-ComponentLibrary/packages/testing/*`

## 6. 验收标准

- L9 可以消费任务02产出的 L8 节点。
- L9 诊断能定位到具体节点和 contract。
- 主题解析结果来自 Host Theme Runtime。
- 渲染性能脚本通过严格阈值。
- SDK/Scaffold 可以在测试或预览中调用 L9 校验能力。

## 7. 验证命令

```bash
cd Chips-Host && npm run build && npm test
cd Chips-Host && npm run test:contract
cd Chips-Host && npm run test:perf:l9
cd Chips-ComponentLibrary && npm run test:contracts
```

## 8. 依赖任务

- 依赖：[任务01-公共契约冻结与任务基线.md](./任务01-公共契约冻结与任务基线.md)
- 并行关联：[任务02-Host-L8声明式UI产品化.md](./任务02-Host-L8声明式UI产品化.md)

## 9. 风险与注意事项

- L9 不应成为新的主题解析实现。
- L9 不应绕开组件库 contract。
- 性能指标不能只靠手工观察，必须纳入脚本。

