# 任务13：动画动效与 Motion Token

## 1. 任务目标

建立统一 Motion System，让所有应用、组件、surface 转场、弹层、列表变化、状态反馈都使用同一套动效语义和主题 token。

目标不是做花哨动画，而是形成稳定、克制、可关闭、可测试的专业动效体系。

## 2. 当前基础

已核对：

- `ThemePack/*/tokens/motion.json`
- `ThemePack/*/styles/motions.css`
- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-Host/packages/unified-rendering/src/effect-dispatch.ts`

当前主题包已有 motion token 基础，但组件、L8 modifier、L9 effect 和应用模板还未形成完整闭环。

## 3. 涉及项目

- `ThemePack/*`
- `Chips-ComponentLibrary`
- `Chips-Host`
- `Chips-SDK`
- `Chips-Scaffold/chips-scaffold-app`

## 4. 开发内容

1. Motion token 分层。
   - duration：instant/fast/normal/slow。
   - easing：standard/entrance/exit/emphasized。
   - distance：small/medium/large。
   - opacity：enter/exit。
   - spring 预留语义。
   - reduced motion 覆盖。

2. 组件动效语义。
   - Dialog enter/exit。
   - Popover/Menu/Tooltip enter/exit。
   - Tabs panel transition。
   - Toast/Notification transition。
   - Skeleton shimmer。
   - Progress motion。
   - List insert/remove 预留。

3. L8 motion modifier。
   - `motion`
   - `transition`
   - `animation`
   - `reducedMotionBehavior`

4. L9 effect dispatch。
   - UI effect 中调度 motion。
   - reduced motion 下自动降级。
   - 生成诊断和性能指标。

5. 主题包实现。
   - 默认主题和暗色主题 motion token 一致。
   - CSS 变量完整输出。
   - 不把动效写死在组件。

6. 测试。
   - token 完整性。
   - reduced motion。
   - class/data-state 切换。
   - 不触发布局抖动的基础性能测试。

## 5. 建议文件范围

- `ThemePack/*/tokens/motion.json`
- `ThemePack/*/styles/motions.css`
- `ThemePack/*/tests/*`
- `Chips-ComponentLibrary/packages/components/src/index.js`
- `Chips-ComponentLibrary/packages/components/tests/*`
- `Chips-Host/packages/unified-rendering/src/effect-dispatch.ts`
- `Chips-Host/src/renderer/declarative-ui/types.ts`

## 6. 验收标准

- 组件动效全部来自 motion token。
- 用户 reduced motion 设置可被尊重。
- L8/L9 能描述和调度 motion。
- 默认主题和暗色主题都通过 motion token 校验。
- 动效不造成明显性能退化。

## 7. 验证命令

```bash
cd ThemePack/Chips-default && npm test
cd ThemePack/Chips-theme-default-dark && npm test
cd Chips-ComponentLibrary && npm run verify && npm run test:perf
cd Chips-Host && npm run build && npm test
```

## 8. 依赖任务

- 依赖：[任务03-Host-L9统一渲染产品化与诊断.md](./任务03-Host-L9统一渲染产品化与诊断.md)
- 依赖：[任务08-SwiftUI对标控件清单与基础控件补齐.md](./任务08-SwiftUI对标控件清单与基础控件补齐.md)

## 9. 风险与注意事项

- 不要在组件 CSS 中写死 duration/easing。
- 不要忽视 reduced motion。
- 不要让动画成为性能门禁盲区。

