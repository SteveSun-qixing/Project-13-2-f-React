# 05 组件库稳定化与 `@chips/ui` 方案

## 1. 方向调整

第一阶段已经将旧 `Chips-ComponentLibrary` 归档并采用 antd。第二阶段不再把“重新做一个覆盖 100 个控件的自研组件库”作为目标，而把 `@chips/ui` 定义为：

```text
antd 成熟行为底座
  + Chips 生态运行时接线
  + 统一视觉策略
  + 应用壳与命令组合
  + 卡片/布局等生态特有组件
  + 适配器和质量门禁
```

这样可以把社区已经长期验证的 Dialog、Select、Form、Table、DatePicker、Tooltip、Dropdown、Tabs、Notification、Skeleton 等行为交给 antd；薯片只维护真正属于生态的协议、组合和 Host 边界。

## 2. `@chips/ui` 分层

```text
Chips-Ui/src/
├── app/                 # mountChipsApp、defineAppConfig、场景加载
├── runtime/             # ChipsProvider、capabilities、command/theme adapter
├── theme/               # appleTheme、CSS、Recipe 产物消费
├── components/          # AppChrome、StateBoundary、PanelHeader 等生态组合
├── adapters/            # antd/Host/document/table 等适配器
├── icons/               # 生态图标语义到 @ant-design/icons 的映射
├── contracts/           # UI 公共 props、错误、运行时和主题类型
└── testing/             # renderWithChips、mock runtime、a11y helpers
```

出口规则：

- `@chips/ui` 根入口只导出稳定公共能力；
- 重型功能使用显式子路径，例如 `@chips/ui/app`、`@chips/ui/document`、`@chips/ui/testing`；
- 不让应用依赖 `src/*` 内部路径；
- 不建立无限 barrel re-export，避免初始化副作用和 bundle 膨胀；
- 组件和工具分开导出，React 组件不把 Host client 作为隐式全局变量。

## 3. 组件归类规则

### 3.1 直接使用 antd

以下能力优先直接消费 antd，并由 `ConfigProvider` 统一主题：

`Button、Input、InputNumber、Select、Checkbox、Radio、Switch、Slider、DatePicker、Form、Table、List、Tree、Tabs、Segmented、Card、Modal、Drawer、Popover、Tooltip、Dropdown、Menu、Pagination、Progress、Rate、Tag、Badge、Alert、Empty、Result、Spin、Skeleton、Typography、Flex、Grid`。

直接使用仍须满足：

- 版本由根工作区精确锁定；
- 只使用官方文档中的公开 API；
- 不在应用中修改全局 token；
- 需要统一行为时经 `@chips/ui` 提供 typed wrapper 或 lint 规则，而不是每个应用各自包一层。

### 3.2 `@chips/ui` 负责组合

以下能力是生态特有或跨多个应用重复出现，应由共享层实现：

- `AppChrome`、`MenuBar`、`Toolbar`、`CommandPalette`；
- `StateBoundary`、`PanelHeader`、统一页面空/错/加载态；
- `EmbeddedDocumentFrame`、卡片/布局 iframe 的安全与主题注入容器；
- Host resource URL 生命周期、surface diagnostics、environment status；
- 以 command schema 驱动的 `CommandButton/CommandMenuItem`；
- 经过业务验证的 `DocumentList`、`InspectorPanel`、`NavigationSplitView` 等工作台组合。

共享层只输出组合语义，不把某个应用的数据结构、路由或业务流程放进来。

### 3.3 适配器

适配器是唯一允许封装第三方特殊行为的地方：

```text
@chips/ui/adapters/antd
@chips/ui/adapters/document
@chips/ui/adapters/command
@chips/ui/adapters/theme
@chips/ui/adapters/table
```

适配器必须：

1. 有明确输入输出类型；
2. 不改变 Host 正式错误和权限语义；
3. 有独立单元测试和至少一个浏览器级消费测试；
4. 不暴露第三方内部对象作为 Chips 公共协议；
5. 只在实际存在重复或高风险行为时建立，不能为了“看起来分层”增加空壳。

## 4. 组件 API 规范

沿用组合模式和 React 18 约束：

### 4.1 组合优先

```tsx
<Panel.Root>
  <Panel.Header>
    <Panel.Title titleKey="settings.title" />
    <Panel.Actions>...</Panel.Actions>
  </Panel.Header>
  <Panel.Body>...</Panel.Body>
</Panel.Root>
```

禁止把同一组件扩展成大量互斥 boolean：

```tsx
// 禁止继续扩张
<Panel compact glass bordered dense withToolbar />
```

应使用显式 `variant="inspector"`、`density="compact"` 或 compound slot，并让 token 决定视觉。

### 4.2 Provider 只管理共享状态

Provider 的上下文应具备 `state/actions/meta` 三类字段：

```ts
interface DocumentScopeValue<T> {
  state: { selectedId: string | null; status: "idle" | "loading" | "ready" | "error" };
  actions: { select(id: string): void; reload(): Promise<void> };
  meta: { scopeId: string; capabilities: ReadonlySet<string> };
}
```

Provider 不直接渲染页面、不读取 DOM 布局、不写业务文案；组件通过 context 消费状态并保持可组合。

### 4.3 数据和状态契约

所有公共组合组件必须明确：

- controlled/uncontrolled 语义；
- `value/defaultValue/onChange` 的类型和触发时机；
- loading、disabled、readOnly、error、empty；
- keyboard/focus/portal 行为；
- `data-scope/data-part/data-state` 或 antd 对应 DOM 语义；
- 无 Host、权限拒绝和资源失败时的状态。

不允许只在 README 写“支持”而没有测试证明。

## 5. 稳定性质量矩阵

每个共享组合和高风险 antd 适配器建立一行质量矩阵：

| 维度 | 必测内容 |
|---|---|
| DOM | 语义元素、稳定 role、label、disabled/readOnly 属性 |
| 键盘 | Tab、Enter/Space、Arrow、Escape、Home/End、IME 输入 |
| 焦点 | 初始焦点、焦点圈、关闭后恢复、卸载清理 |
| 弹层 | Portal 容器、滚动、窗口边界、遮罩点击、Escape |
| 状态 | idle/loading/empty/error/disabled/selected/drag-over |
| 生命周期 | 监听器、计时器、资源 URL、command 注册注销 |
| 主题 | 默认 token、主题包 token、异常回退、字体和图标 |
| 跨端 | Desktop Host、普通 Browser preview、iframe/document |
| 性能 | 首次渲染、列表滚动、弹层打开、重渲染次数 |

高风险组件至少覆盖真实浏览器，不能用浅层 React element props 代替行为验证。

## 6. 组件开发流程

1. 先确认 antd 是否已有公开能力；有则优先使用或配置，不重新实现。
2. 若多个应用出现相同缺口，先记录证据和 API 草案，登记工单或在共享层任务中收口。
3. 设计组合 API、状态、a11y 和主题接口；不先写 CSS。
4. 在 `@chips/ui` 实现 typed adapter/compound component。
5. 添加单元、浏览器、a11y、主题和性能测试。
6. 用 PhotoViewer 或 EcoSettingsPanel 的真实场景消费。
7. 通过 `typecheck/lint/test/build/validate` 后才加入脚手架示例和公共文档。

## 7. 组件稳定性出口

一个组件/组合只有在以下条件同时满足时才可列为“稳定公共能力”：

- API、导出路径和文档已冻结；
- 不包含应用业务逻辑和私有视觉值；
- 有受控/非受控、错误和卸载测试；
- 有至少一个 Playwright 场景和 axe 结果；
- 主题/字体/图标在 Host 与 iframe 中都能显示；
- 未引入未经评估的长期运行时依赖；
- 生成的 `.d.ts` 和源码类型一致；
- 版本变更由用户确认后管理，不由本任务自动提交。

