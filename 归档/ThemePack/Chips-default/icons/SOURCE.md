# 默认主题图标字体来源说明

- 上游来源：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-task008-图标系统搭建/design-assets/material-symbols/`
- 正式基线：Material Symbols Variable Font
- 复制时间：2026-03-25

## 随主题工程纳入版本控制的文件

- `variablefont/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2`
- `variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2`
- `variablefont/MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2`

## 运行时说明

- 构建脚本会把上述字体复制到 `dist/icons/variablefont/`
- `dist/theme.css` 会注入对应 `@font-face`
- `ChipsIcon` 通过 `data-icon-style` 在 Outlined / Rounded / Sharp 三套字体之间切换
