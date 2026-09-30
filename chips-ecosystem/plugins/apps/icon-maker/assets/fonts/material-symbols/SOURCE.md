# Material Symbols 字体来源说明

- 上游仓库：`https://github.com/google/material-design-icons.git`
- 锁定提交：`caeba1e66925218b1fd1464171f93e2656f9a0b9`
- 上游提交时间（UTC）：`2026-02-20T03:12:50Z`
- 生态单一母本目录：`design-assets/material-symbols/`（阶段04任务09冻结，轴映射与文件清单见其 `SOURCE.md`）
- 本包复制母本子目录：`design-assets/material-symbols/variablefont/`
- 复制时间：2026-10-01（W5 图标工坊业务迁移，第三段）
- 授权：Apache-2.0，见 `design-assets/material-symbols/LICENSE`

## 纳入本包的文件

- `variablefont/MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2`
- `variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2`
- `variablefont/MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2`
- `variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].codepoints`

## 使用边界

- 这组三套字体用于图标工坊「图标字体」来源的内置 Material Symbols 字体源；
- `.codepoints` 文件用于字体模式中解析完整 Material Symbols 码位集合（`src/domain/default-fonts.ts` 的 `parseMaterialSymbolsCodepoints`）；
- 视觉样式统一走 `@chips/ui` 与 antd 主题定制，本包不实现独立主题解析器，也不将本组字体用于界面文案渲染；
- 字体资产更新必须先更新生态母本目录，再同步本包并更新本文件。
