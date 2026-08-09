# 薯片官方 · 默认主题

这是基于 Chips 官方脚手架生成的主题插件工程。该主题遵循薯片生态的主题系统设计与插件规范，可以通过 `.cpk` 打包后安装到 Chips Host 中使用。

## 基本信息

- 插件 ID：`theme.theme.chips-official-default-theme`
- 主题 ID：`chips-official.default-theme`
- 版本：`1.0.0`
- 描述：`Chips 官方默认内置主题`

## 目录结构

```text
.
├─ manifest.yaml          # 插件与主题配置
├─ package.json           # NPM 配置与脚本
├─ tsconfig.json          # TypeScript 配置
├─ chips.config.mjs       # Chips Dev 配置
├─ tokens/                # 设计 Token 源文件（五层结构输入）
├─ src/                   # 构建与校验脚本
├─ styles/                # 主题 CSS 文件
├─ 视觉设计语言/          # 默认主题外观与样式设计语言
├─ icons/                 # 图标资源规范说明
├─ fonts/                 # 字体资源规范说明
├─ contracts/             # 主题契约与最小功能集声明
├─ preview/               # 预览资源
└─ tests/                 # 本地测试与校验用例
```

## 常用命令

- `npm run build`：构建主题 Token 与 CSS，输出到 `dist/`。
- `npm run validate:theme`：对构建结果进行主题契约校验，覆盖组件库当前正式 contract 基线。
- `npm test`：运行本地单元测试。

## 后续集成

- 开发态使用 `chipsdev package` 打包为 `.cpk` 后，通过 `chipsdev plugin install`、`chipsdev plugin enable` 安装并启用到开发工作区；
- 开发态使用 `chipsdev theme list` / `chipsdev theme apply` / `chipsdev theme validate` 进行运行时级联动校验；
- 需要真实用户工作区抽样时，再使用 `chips plugin install` / `chips plugin enable` / `chips theme apply` / `chips theme validate`；
- 主题包 `.cpk` 需要保持包根 `manifest.yaml` + `dist/` 运行产物结构，并采用 ZIP Store 模式输出。
