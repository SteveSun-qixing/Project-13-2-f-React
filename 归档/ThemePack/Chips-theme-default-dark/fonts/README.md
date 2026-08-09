# 字体资源规范

本目录用于存放主题自带 UI 文本字体资源。当前暗夜主题未随包发布 UI 文本字体文件，`dist/theme.css` 只使用系统字体回退链：

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", "Noto Sans SC", sans-serif
```

Material Symbols 图标字体不放在本目录，正式位置为 `icons/variablefont/`，构建时复制到 `dist/icons/variablefont/`。

后续如需发布 UI 文本字体，必须先把真实字体文件放入 `fonts/`，再在 `dist/theme.css` 中通过 `@font-face` 声明，并同步更新来源说明与测试。
