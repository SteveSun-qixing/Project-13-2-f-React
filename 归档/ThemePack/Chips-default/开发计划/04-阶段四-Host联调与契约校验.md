# 阶段四：Host 联调与契约校验

> 阶段目标：在默认主题包实现完成后，与 Chips Host 进行联调，确保主题在真实运行时中可以被安装、切换、解析，并通过基础契约与质量门禁。

---

## 1. 阶段范围

- 在本工程中完成：
  - 主题包的构建与打包（生成 `.cpk`）；
  - 在本地 Host 工作空间中安装该主题包；
  - 使用 `theme.list/apply/getCurrent/getAllCss/resolve/contract.get` 等动作进行联调；
  - 确保 `Chips-Host` 与组件库在该主题下运行无明显视觉与功能异常。

---

## 2. 关键任务

### 2.1 主题构建与打包

- 在本项目 `package.json` 中确保存在：
  - `build`：构建 `dist/tokens.json` 与 `dist/theme.css`；
  - 如有需要，新增用于打包的脚本（例如借助 `chipsdev package` 或等价工具）；
- 在本地执行构建与打包，产出 `.cpk` 文件。

### 2.2 Host 安装与切换

- 选择一个工作空间（`Chips-Host` 工作目录），通过：
  - `chips plugin install` 或 Host 的 plugin API 安装默认主题包；
  - `chips theme list` 验证主题已被识别；
  - `chips theme apply <id>` 切换到该默认主题；
- 确保主题切换后：
  - 不报错（尤其是 `THEME_CONTRACT_INVALID`、`THEME_TOKEN_MISSING` 等）；
  - `theme.getAllCss` 能返回正确的 CSS 内容；
  - `theme.resolve` 能返回包含本主题的解析链与 tokens 视图。

### 2.3 组件契约与显示验证

- 在使用组件库的 Demo 或 Host 内部应用中检查：
  - 常用组件（按钮/输入框/对话框/Tabs/菜单/工具窗口等）在本主题下的显示；
  - 组件库提供的测试或 Demo 中是否有因 token 缺失导致的异常；
- 如发现 token 缺失或契约不匹配：
  - 优先修复本主题包中的 token；
  - 若判定为契约定义或组件库实现的问题，则通过工单流程反馈。

---

## 3. 依赖与前置条件

- 阶段二与阶段三已完成，并通过本工程内的测试与验证脚本；
- Host 与 `chipsdev` 版本满足当前主题包需求；
- 相关生态文档中关于 `theme.*` 动作与主题契约的口径已冻结。

---

## 4. 验收标准

- 本工程可产出可安装的 `.cpk` 主题包；
- 在目标 Host 工作空间中：
  - 主题安装、切换、解析过程无错误；
  - 常用组件显示正常，视觉风格符合预期；
- 所有发现的问题已通过工单流程记录，并在必要时进行修复或协调处理。

---

## 5. 联调执行记录（2026-03-07）

- 打包方式：
  - 在 `ThemePack/Chips-default` 内执行 `npm run build` 生成 `dist/tokens.json` 与 `dist/theme.css`；
  - 依据 CPK 规范，当前标准流程应优先使用 `chipsdev package`；若手工打包，需使用系统 `zip -r -0` 或等价 Store 模式，将精简后的发布内容（`manifest.yaml/tokens/dist/contracts/theme.css/icons/preview`）打包为：
    - `ThemePack/Chips-default/chips-default-theme.cpk`。
  - 打包采用 STORE 模式（零压缩），符合《CPK打包格式规范》要求。
- manifest 对齐：
  - 为适配当前 Host 外部 CLI 校验，补充并对齐以下字段：
    - `schemaVersion: "1.0.0"`；
    - `publisher: "薯片官方"`；
    - `entry.tokens: "dist/tokens.json"`（五层 token JSON 入口）；
    - `entry.themeCss: "theme.css"`（聚合 CSS 入口）；
    - 保持 `id: "theme.theme.chips-official-default-theme"`、`type: "theme"` 不变。
- 工作空间：
  - 通过 `chips workspace set` 将工作空间指向本仓内测试目录：
    - `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f/.chips-workspace/theme-default-demo`。
- 安装与启用：
  - 安装（按当前 CLI 口径）：
    - `chips plugin install /Users/.../ThemePack/Chips-default/chips-default-theme.cpk`
    - 返回：`pluginId theme.theme.chips-official-default-theme`；
  - 安装后 `chips plugin list` 中出现新插件记录：
    - `id: "theme.theme.chips-official-default-theme"`、`type: "theme"`、`enabled: true`；
  - `chips theme list` 中新增主题：
    - `{"id":"theme.theme.chips-official-default-theme","name":"薯片官方 · 默认主题","version":"1.0.0"}`。
- 切换与验证：
  - 切换前：`chips theme current` 显示当前主题为 `chips-official.macaron-premium-theme`；
  - 切换命令：
    - `chips theme apply --id theme.theme.chips-official-default-theme` → 输出 `applied true`；
  - 切换后：`chips theme current` 显示：
    - `themeId  theme.theme.chips-official-default-theme`，确认新主题已生效；
  - 当前 CLI 版本尚未暴露 `theme.resolve` / `theme.contract.get` 子命令，运行时契约与 token 解析在本仓通过：
    - `npm run validate:theme`；
    - `npm test` 中的 `tokens.spec.ts` / `contract.spec.ts` 用例进行静态验证。
