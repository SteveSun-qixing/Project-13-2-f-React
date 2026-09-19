# 重构方案：Web 技术栈、统一页面结构与生态同化

## 1. 目标

建立薯片 Web Application Framework，让薯片能够：

- 用 Web 技术栈统一开发所有应用插件。
- 用同一套 `View/Stack/Grid/Form/List` 模型表达应用界面和网页式页面结构。
- 快速吸收外部 Web 项目，并逐步同化为薯片生态应用。
- 将常用系统能力沉淀在 Host 大底座，上层应用只写少量业务组合代码。
- 让所有应用插件拥有统一交互、统一前端风格、统一质量标准。

这套框架的目标不是组件库，也不只是开发体验，而是软件生态级应用框架。网页式普通页面结构统一纳入 `View/Stack/Grid/Form/List` 模型。

## 2. Web 技术栈边界

正式底层技术栈：

- HTML / CSS / JavaScript。
- TypeScript。
- React。
- Chromium / Electron Desktop。
- 未来 Web Host Shell。
- 未来 Mobile WebView / Capacitor 方向。
- CSS variables + token。
- Bridge / Runtime Client / SDK。

不建议把薯片前端框架设计成依赖原生 UI 技术栈的系统。未来跨端也应优先围绕 Web runtime、surface 语义和 Host 能力映射展开。

## 3. 统一页面结构

网页式结构应由统一原语和常规组件组合：

- `ChipsView`
- `ChipsStack`
- `ChipsGrid`
- `ChipsForm`
- `ChipsList`
- `ChipsSection`
- `ChipsScrollView`
- `ChipsText`
- `ChipsImage`
- `ChipsMedia`
- 常规导航、命令、状态、主题、i18n、a11y 能力

同一套组件既服务工具界面，也服务市场、文档、教程、展示、社区等页面结构。

## 4. 外部 Web 项目同化工具链

建议建设外部 Web 项目同化能力，但当前优先作为 SDK/Scaffold 的 CLI 工具链和报告能力落地，不默认创建独立项目。

职责：

1. 扫描外部 Web 项目。
2. 识别框架：React、Vite、静态 HTML、传统 SPA 等。
3. 生成或补齐 `manifest.yaml`。
4. 生成 `runtime.targets` 和 `ui.surface`。
5. 推断所需 Host 权限。
6. 替换或包装系统能力调用为 SDK/Bridge。
7. 扫描硬编码样式并生成 token 迁移报告。
8. 抽取用户可见文案为 i18n key。
9. 识别基础控件并给出 Chips 组件替换建议。
10. 生成 preview、测试和质量门禁配置。
11. 输出同化评分和剩余问题清单。

## 5. 同化阶段

### 5.1 包装阶段

目标：能作为 app 插件运行。

- 补 manifest。
- 接入 surface。
- 确保入口可由 Host 加载。
- 禁止直接 Node/Electron API。
- 接入 launch context。

### 5.2 接线阶段

目标：系统能力走正式链路。

- 文件、资源、配置、主题、多语言、窗口、插件等能力改为 SDK/Bridge。
- 路由和打开行为接入 surface/transfer/association。
- 错误处理接入标准错误模型。

### 5.3 风格同化阶段

目标：视觉与交互进入生态统一风格。

- 硬编码色彩、圆角、阴影、字体迁移到 token。
- 常见控件替换为 Chips 组件。
- 文案接入 i18n。
- 焦点、快捷键、a11y 接入组件契约。

### 5.4 框架同化阶段

目标：代码结构变成薯片应用。

- 页面迁移到 `ChipsView`。
- 布局迁移到 `Stack/Grid/Form/List/Section/ScrollView/Text/Image/Media` 等统一原语。
- 命令迁移到 command registry。
- 状态接入 Chips Environment / Binding。
- 质量门禁全量通过。

## 6. 底层厚、上层薄的模块沉淀策略

常用能力应优先沉淀到底层：

Host 服务域：

- 文件、资源、配置、主题、多语言、插件、模块、卡片、箱子、压缩、序列化、日志、凭证、surface、transfer、association、control-plane。

前端框架：

- App/Scene。
- View/Modifier。
- 布局。
- 状态与环境。
- 导航与呈现。
- 命令与工具栏。
- 表单。
- 列表/表格/树。
- 资源选择。
- 文件导入导出。
- 错误、加载、空态。
- 预览与质量门禁。

上层应用：

- 业务模型。
- 页面组合。
- 特有流程。
- 少量特殊组件。

## 7. 能力域落点建议

后续正式实施时，优先按现有生态心智落地：

| 能力 | 优先落点 |
|---|---|
| App/Scene/surface/commands | Host surface/plugin runtime + SDK 封装 + `chips-scaffold-app` 模板 |
| View/Modifier/layout/state/navigation | Host L8/L9 + SDK React helper + 组件库 + 应用脚手架 |
| 外部 Web 项目同化 | SDK/Scaffold CLI 工具链 |
| 预览、组件矩阵、主题矩阵、性能面板 | SDK `chipsdev` + 组件库质量脚本 + 生态设置面板应用插件 |
| 主题、token、组件 contract 可视化治理 | Host theme service + ThemePack + 组件库主题契约 + 生态设置面板 |

这些名称表示能力域，不表示当前必须新增独立项目。只有当某个能力域无法再被现有项目清晰承载，并且需要独立发布、独立版本、独立测试时，才开工单评估是否拆分。

## 8. 关键任务

1. 定义 `ChipsView` 对应用界面和普通页面结构的统一语义。
2. 补齐统一页面结构原语和组合规范。
3. 扩展 App Scaffold：标准应用、外部 Web 包装两类主模板；外部 Web 包装仍产出标准 app 插件结构。
4. 在 SDK 中补齐 Host 常用服务的高层 hooks/API 封装。
5. 建立 Web 项目扫描和同化报告工具。
6. 建立样式 token 迁移扫描。
7. 建立 i18n 文案抽取工具。
8. 建立组件替换建议工具。
9. 建立 Host mock + 真实 Host 的预览环境。
10. 建立同化质量门禁。

## 9. 验收标准

- 网页式页面结构不需要自写整套页面 CSS 结构，也不需要独立应用类型。
- 外部 React/Vite/Web 项目可以生成薯片插件包装报告。
- 同化后项目不直接依赖 Electron/Node。
- 主题、i18n、surface、Bridge、SDK 接入完整。
- 常用能力通过 Host/SDK/框架调用，上层代码显著减少。
- 所有应用插件可使用统一交互、统一风格和统一质量门禁。
