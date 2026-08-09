# 图标资源规范

本目录存放默认主题正式随包交付的运行时图标字体资源。

- Material Symbols Variable Font 作为基线图标库；
- 构建阶段会把 `icons/variablefont/*.woff2` 复制到 `dist/icons/variablefont/`；
- `dist/theme.css` 通过 `@font-face` 正式声明这些字体；
- 图标颜色、大小与变量轴参数统一走主题 token；
- 资源来源追溯见同目录 `SOURCE.md`。

主题包运行时 UI 图标只消费这套字体资源；应用启动图标、品牌图形和操作系统入口图标不放在这里。
