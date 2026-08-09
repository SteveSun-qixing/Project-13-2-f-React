# Token 落地口径

## 总原则

默认主题的视觉语言必须通过主题 token 与 CSS 落地，不在业务页面、应用结构或组件实现中散落硬编码样式。

主题源码使用 `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json` 和 `tokens/comp/*.json` 五层结构。构建后输出 `dist/tokens.json` 与 `dist/theme.css`，由 Host Theme Runtime 统一消费。

## Token 分层

- `ref`：原始色板、圆角、基础空间等无语义值；
- `sys`：表面、文字、主色、状态色、图标语义等系统级语义；
- `motion`：时长、缓动、位移、缩放、reduced motion 等动效语义；
- `layout`：密度、间距、焦点线宽等视觉节奏基线；
- `comp`：组件公开 part 和 state 对应的最终视觉值。

`comp` token 可以引用 `sys`、`ref`、`motion` 和 `layout`，但不得绑定业务名或应用页面结构。

## CSS 落地

主题 CSS 通过组件公开挂点落地：

```css
[data-scope="<component>"][data-part="<part>"][data-state="<state>"] {
  /* 使用 --chips-* CSS variables 表达视觉 */
}
```

主题包不得依赖组件私有 DOM 层级，也不得为某个业务页面定制私有选择器。外观必须绑定公开 `data-scope`、`data-part`、`data-state`、`data-selected`、`data-highlighted`、`aria-disabled` 等稳定状态。

## 派生变量

当前 `styles/base.css` 中的 `--chips-base-*` 是默认主题内部便捷派生变量，用于组织阴影、表面、焦点、控件高度和状态过渡。

这些变量服务默认主题 CSS 实现，不是新的跨生态公共契约。跨主题公共 key 必须以生态共用技术文档和组件库 token / contract 为准。

## 数值与单位

默认主题可以在布局密度和间距 token 中使用 `cpx`，由 Host Theme Runtime 在浏览器普通 CSS 环境注入前按正式规则转换。主题文档只描述视觉密度和外观节奏，不把 `cpx` 用来规定应用页面结构。

## 文档与实现同步

修改本目录文档前，应重新核对：

- `manifest.yaml` 中的 `themeId`、`entry.tokens`、`entry.themeCss` 与契约路径；
- `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`；
- 相关 `tokens/comp/*.json`；
- `styles/base.css` 与 `styles/components/*.css`；
- `contracts/`、`tests/` 和正式构建校验脚本。

文档不得承诺当前主题包尚未发布的字体、图标或视觉资产。
