# 任务09：复杂组件 Compound API 与样式契约

## 1. 任务目标

把复杂组件从“单体 props 堆叠”升级为可组合、可校验、可主题化、可扩展的 Compound Components API。

目标是让复杂组件既能满足大型软件应用需求，又不让 API 被大量 boolean props 撑爆。

## 2. 当前基础

已核对：

- `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md`
- `Chips-Host/技术文档/10-声明式UI组合模式规范.md`
- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-ComponentLibrary/packages/theme-contracts/src/validator.js`
- `ThemePack/*/tokens/comp/*`

当前多个复杂组件已有功能，但还需要统一 Root/Trigger/Content/Item/Slot 等组合 API，以及与 L8 slot 校验对齐。

## 3. 涉及项目

- `Chips-ComponentLibrary`
- `Chips-Host`
- `ThemePack/*`
- `Chips-Scaffold/chips-scaffold-app`

## 4. 开发内容

1. 定义复杂组件组合规范。
   - `Dialog.Root/Trigger/Content/Header/Body/Footer/Actions/Close`
   - `Popover.Root/Trigger/Content/Arrow`
   - `Tabs.Root/List/Trigger/Panel`
   - `Menu.Root/Trigger/Content/Item/Group/Separator`
   - `Select.Root/Trigger/Content/Option/Value`
   - `Form.Root/Section/Field/Label/Control/Error/Hint`
   - `DataGrid.Root/Toolbar/Header/Row/Cell/Pagination`
   - `Tree.Root/Item/Branch/Leaf/Disclosure`
   - `CommandPalette.Root/Input/List/Item/Group`
   - `NavigationSplitView.Root/Sidebar/Content/Detail`

2. 建立 slot contract。
   - 哪些 slot 必填。
   - 哪些 slot 单例。
   - 哪些 slot 可重复。
   - slot 对应 DOM role 和 ARIA 关系。
   - slot 对应 `data-part`。

3. 减少 boolean 模式。
   - 把 `showFooter/isCompact/hasIcon/withActions` 等模式改为显式 slot 或子组件组合。
   - 仍可保留少量基础状态布尔值：`disabled`、`loading`、`open`、`checked`。

4. 对接 L8 组合校验。
   - Host L8 能验证 slot 是否存在、类型是否正确、重复是否允许。
   - L9 能输出诊断。

5. 对接主题契约。
   - 每个 slot 对应 `data-part`。
   - 每个状态对应 `data-state`。
   - token 命名稳定。

6. 迁移现有组件。
   - 先保留简单组件 API。
   - 复杂组件逐步提供 Compound API。
   - 在当前未发布第一版的前提下，不需要保留兼容性包袱；但任务内要一次性收口，不能留下半套 API。

## 5. 建议文件范围

- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-ComponentLibrary/packages/components/src/index.d.ts`
- `Chips-ComponentLibrary/packages/components/tests/*`
- `Chips-ComponentLibrary/packages/theme-contracts/tests/*`
- `ThemePack/*/tokens/comp/*.json`
- `ThemePack/*/styles/components/*.css`
- `Chips-Host/src/renderer/declarative-ui/composition.ts`
- `Chips-Host/tests/unit/declarative-ui.test.ts`

## 6. 验收标准

- 复杂组件具备清晰 Compound API。
- slot 规则可以被 L8/L9 校验。
- 组件 contract 覆盖每个 part/state。
- a11y 和键盘交互测试覆盖复杂组件主流程。
- 文档示例不再鼓励 boolean 模式组合爆炸。

## 7. 验证命令

```bash
cd Chips-ComponentLibrary && npm run verify && npm run quality:gate
cd Chips-Host && npm run build && npm test
cd ThemePack/Chips-default && npm test
cd ThemePack/Chips-theme-default-dark && npm test
```

## 8. 依赖任务

- 依赖：[任务08-SwiftUI对标控件清单与基础控件补齐.md](./任务08-SwiftUI对标控件清单与基础控件补齐.md)

## 9. 风险与注意事项

- 不要把 slot 做成随意 children 注入。
- 不要在组件库中沉淀应用业务逻辑。
- 不要只改类型不改运行时和测试。

