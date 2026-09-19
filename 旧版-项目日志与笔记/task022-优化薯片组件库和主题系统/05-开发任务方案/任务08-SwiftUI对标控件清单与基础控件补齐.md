# 任务08：SwiftUI 对标控件清单与基础控件补齐

## 1. 任务目标

建立薯片组件库与 SwiftUI 控件能力的对标清单，并补齐基础控件，使最低要求达到：

SwiftUI 有的常用控件类别，薯片组件库也必须有对应能力。

这里强调“能力类别对齐”，不是照抄 Apple API 命名。薯片仍使用 Web 技术栈、React、Host、SDK、组件库、主题系统。

## 2. 当前基础

已核对：

- `项目日志与笔记/task022-优化薯片组件库和主题系统/02-SwiftUI能力模型调研/06-控件与样式系统.md`
- `项目日志与笔记/task022-优化薯片组件库和主题系统/03-薯片前端框架对标SwiftUI差距分析/05-控件与样式系统差距.md`
- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-ComponentLibrary/packages/components/src/index.d.ts`
- `ThemePack/*/tokens/comp/*`

当前已有按钮、输入、选择、Dialog、Popover、Tabs、Menu、DataGrid、Tree、Toast、Skeleton、EmptyState、ErrorBoundary 等部分基础，但还需要系统补齐和分类治理。

## 3. 涉及项目

- `Chips-ComponentLibrary`
- `ThemePack/*`
- `Chips-Scaffold/chips-scaffold-app`
- `Chips-EcoSettingsPanel`
- `生态共用技术文档/组件库/*`

## 4. 开发内容

1. 建立控件能力矩阵。
   - 文本与图像：Text、Label、Image、Icon、Media。
   - 按钮与命令：Button、IconButton、ToggleButton、MenuButton。
   - 输入控件：TextField、TextArea、SearchField、SecureField。
   - 选择控件：Checkbox、RadioGroup、Switch、SegmentedControl、Select、ComboBox。
   - 数值控件：Slider、Stepper、NumberInput、Rating。
   - 日期时间：DatePicker、TimePicker、DateRangePicker。
   - 展示控件：Badge、Tag、Avatar、Tooltip、Popover。
   - 反馈控件：Toast、Notification、Progress、Spinner、Skeleton、EmptyState、ErrorState。
   - 容器控件：CardShell、Panel、Inspector、SplitPane、DockPanel。
   - 数据控件：List、Table、DataGrid、Tree、VirtualList。
   - 表单控件：Form、FormSection、FormField、ValidationMessage。
   - 导航控件：Tabs、Breadcrumb、NavigationSplitView、Sidebar。
   - 覆盖层：Dialog、Sheet、Drawer、ContextMenu、CommandPalette。

2. 对已有组件做能力审查。
   - 是否无头。
   - 是否有完整 `data-scope/data-part/data-state`。
   - 是否有 ARIA 和键盘交互。
   - 是否走主题 token。
   - 是否有 TypeScript 类型。
   - 是否有测试。

3. 补齐缺失基础控件。
   - 优先补齐低风险、高复用控件。
   - 每个控件必须一次性交付结构、状态、a11y、contract、测试、文档。

4. 建立组件命名规范。
   - 统一 `ChipsXxx`。
   - 复合组件采用 compound API。
   - 基础控件保留简单 API，但避免 boolean 模式膨胀。

5. 更新主题契约。
   - 每个新增组件必须补 token contract。
   - 默认主题和暗色主题都要提供 token。

## 5. 建议文件范围

- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-ComponentLibrary/packages/components/src/index.d.ts`
- `Chips-ComponentLibrary/packages/components/tests/*`
- `Chips-ComponentLibrary/packages/theme-contracts/*`
- `Chips-ComponentLibrary/packages/testing/*`
- `ThemePack/*/tokens/comp/*.json`
- `ThemePack/*/styles/components/*.css`
- `生态共用技术文档/组件库/00-组件库文档索引.md`
- `生态共用技术文档/组件库/02-组件契约标准.md`

## 6. 验收标准

- 形成 SwiftUI 对标控件能力矩阵。
- 每个控件有 owner、状态、contract、测试状态。
- 新增控件通过组件库 verify。
- 新增控件在默认主题和暗色主题都有 contract。
- 生态设置面板或组件矩阵能展示新增控件。

## 7. 验证命令

```bash
cd Chips-ComponentLibrary && npm run verify && npm run quality:gate
cd ThemePack/Chips-default && npm test
cd ThemePack/Chips-theme-default-dark && npm test
```

## 8. 依赖任务

- 依赖：[任务07-统一布局系统与页面结构原语.md](./任务07-统一布局系统与页面结构原语.md)

## 9. 风险与注意事项

- 不要一次性只加空壳组件。
- 不要为了数量牺牲 a11y、键盘交互和主题 contract。
- 不要引入未确认的新第三方库。

