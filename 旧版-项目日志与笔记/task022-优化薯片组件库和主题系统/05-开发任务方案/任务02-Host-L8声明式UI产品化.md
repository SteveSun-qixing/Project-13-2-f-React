# 任务02：Host L8 声明式 UI 产品化

## 1. 任务目标

把 Host 已有 L8 Declarative UI 从“内部实现基础”推进为应用开发可消费、可验证、可被脚手架默认使用的声明式 UI 语义层。

目标不是在应用层重新造一套 UI 框架，而是让 Host 的 L8 成为统一语义源，SDK、组件库、脚手架都围绕它接入。

## 2. 当前基础

已核对：

- `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md`
- `Chips-Host/技术文档/11-L8声明式UI实现说明.md`
- `Chips-Host/技术文档/10-声明式UI组合模式规范.md`
- `Chips-Host/src/renderer/declarative-ui/types.ts`
- `Chips-Host/src/renderer/declarative-ui/primitives.ts`
- `Chips-Host/src/renderer/declarative-ui/node-model.ts`
- `Chips-Host/src/renderer/declarative-ui/composition.ts`
- `Chips-Host/src/renderer/declarative-ui/events.ts`
- `Chips-Host/tests/unit/declarative-ui.test.ts`

当前已有 `UINode`、`View/Stack/Grid/Form/List`、组合模式、事件与副作用模型，但它还没有成为应用插件默认开发入口。

## 3. 涉及项目

- `Chips-Host`
- `Chips-SDK`
- `Chips-ComponentLibrary`
- `Chips-Scaffold/chips-scaffold-app`
- `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md`

## 4. 开发内容

1. 补齐 L8 标准原语。
   - 已有：`View`、`Stack`、`Grid`、`Form`、`List`。
   - 新增或规范：`Section`、`ScrollView`、`Text`、`Image`、`Media`、`Table`、`Navigation`、`Toolbar`、`Command`、`Slot`。
   - 所有原语只表达语义、结构、行为，不包含颜色、圆角、阴影、字体大小等视觉值。

2. 建立 Modifier 语义模型。
   - `themeScope`
   - `i18nKey`
   - `layout`
   - `accessibility`
   - `focusScope`
   - `shortcut`
   - `permission`
   - `presentation`
   - `motion`
   - `testId`

3. 扩展节点校验。
   - `id/type` 必填。
   - `props` 禁止视觉硬编码字段。
   - `events` 只能引用 handler id，不能内嵌可执行函数。
   - `bindings` 只能描述数据绑定路径，不能持有业务对象实例。
   - `children` 必须符合 slot/compound 规则。

4. 建立 L8 诊断输出。
   - 错误码沿用 `DECLARATIVE_UI_*`。
   - 诊断项需要包含 node id、type、path、severity、message、suggestion。
   - 诊断结果供 L9、SDK CLI、脚手架测试和预览工具使用。

5. 对接 SDK 类型。
   - SDK 暴露 L8 相关类型定义或生成物。
   - 不能把 Host 运行时实现搬进 SDK。
   - SDK 只做类型、helper、测试辅助和调用封装。

6. 对接组件库 contract。
   - L8 节点 `type` 与组件库 `data-scope/data-part/data-state` 建立映射表。
   - 复杂组件的 slot 规则必须能被 L8 校验。

## 5. 建议文件范围

Host：

- `Chips-Host/src/renderer/declarative-ui/*`
- `Chips-Host/tests/unit/declarative-ui.test.ts`
- `Chips-Host/技术文档/11-L8声明式UI实现说明.md`

SDK：

- `Chips-SDK/src/types/*`
- `Chips-SDK/src/tooling/*`
- `Chips-SDK/tests/*`

组件库：

- `Chips-ComponentLibrary/packages/components/src/index.d.ts`
- `Chips-ComponentLibrary/packages/theme-contracts/*`
- `Chips-ComponentLibrary/packages/testing/*`

共享文档：

- `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md`

## 6. 验收标准

- L8 能描述应用界面和普通网页式页面结构。
- L8 不引入独立页面应用分类。
- L8 节点能被校验，并输出可读诊断。
- L8 原语与组件库 contract 有可追踪映射。
- SDK 和脚手架能引用同一套类型和语义，不各自定义。
- 单测覆盖原语创建、modifier 校验、slot 校验、事件绑定、副作用约束。

## 7. 验证命令

```bash
cd Chips-Host && npm run build && npm test
cd Chips-Host && npm run test:contract
cd Chips-SDK && npm test
cd Chips-ComponentLibrary && npm run verify
```

## 8. 依赖任务

- 依赖：[任务01-公共契约冻结与任务基线.md](./任务01-公共契约冻结与任务基线.md)

## 9. 风险与注意事项

- 不要让 L8 直接访问 Host 服务细节。
- 不要在 L8 节点中塞视觉 token 的解析结果。
- 不要把 JSX 和 UINode 混为一谈；日常开发可以用 JSX，但可序列化声明树必须有清晰边界。

