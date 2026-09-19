# 任务022：主题包图标字体与 Motion 升级

## 1. 任务目标

统一默认主题与暗色主题的运行时图标字体、图标 token、motion token 和动效 CSS，使新框架在按钮、工具栏、菜单、导航、编辑器与媒体控件中拥有一致的图标与动效体验。

## 2. 对应阶段任务

- `05-开发任务方案/任务13-动画动效与Motion-Token.md`
- `05-开发任务方案/任务14-主题系统与组件Contract治理.md`
- `05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`

## 3. 涉及项目

- `ThemePack/Chips-default`
- `ThemePack/Chips-theme-default-dark`
- `Chips-ComponentLibrary/packages/tokens`
- `Chips-ComponentLibrary/packages/components`
- `Chips-Host`

## 4. 开发内容

1. 重新核对两个主题包 `icons/`、`src/build-css.ts`、`styles/motions.css` 和构建输出。
2. 确认 Material Symbols variable font 的正式运行时产物路径、字体族名称、fallback 与 CSS 注入方式。
3. 补齐图标 token：尺寸、线宽、填充轴、光学尺寸、强调态、禁用态、危险态、工具栏密度。
4. 补齐 motion token：duration、easing、delay、stagger、reduced-motion、页面切换、弹层、菜单、列表重排、拖拽反馈。
5. 为组件库公开的 Icon/IconButton/Toolbar/Menu/Navigation/MediaControls 等组件建立图标与 motion contract。
6. 增加 `prefers-reduced-motion` 行为：关闭非必要动效，保留焦点、状态变化和可理解反馈。
7. 在主题矩阵中验证浅色/暗色、普通/高密度、正常动效/减少动效四类组合。

## 5. 验收标准

- 两个主题包的图标字体路径、CSS 输出和 token 命名一致。
- 所有官方组件图标都通过主题 token 和标准图标接口呈现。
- motion token 可被 Host、组件库和应用插件统一消费。
- 减少动效模式下无眩晕风险和不可理解的跳变。

## 6. 验证命令

```bash
cd ThemePack/Chips-default
npm run build
npm test

cd ../Chips-theme-default-dark
npm run build
npm test

cd ../../Chips-ComponentLibrary
npm run quality:gate
```

## 7. 注意事项

- 图标系统只负责运行时 UI 图标，不接管应用启动图标。
- 不允许组件直接写死 SVG 视觉；组件只声明语义图标或消费主题图标接口。
- 本任务开发前必须重新核对主题系统图标规范、组件库 Icon contract 和 Host CSS 注入实现。
