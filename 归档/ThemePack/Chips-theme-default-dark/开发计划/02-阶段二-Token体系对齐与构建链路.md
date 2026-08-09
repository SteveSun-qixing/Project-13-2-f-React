# 阶段二：Token 体系对齐与构建链路

> 阶段目标：将暗夜主题包的 Token 定义与生态统一 Token 体系（@chips/tokens）完全对齐，构建出符合 Theme Runtime 预期的 `ref/sys/comp/motion/layout` 五层 token，并形成稳定的构建流水线。

---

## 1. 阶段范围

- 在本工程中对 `tokens/` 目录进行重构：
  - 将脚手架模板时代的 `global/semantic/typography/motion/layout/components` 结构归档；
  - 引入与 `Chips-ComponentLibrary/packages/tokens/tokens` 一致的五层 token 源文件：
    - `tokens/ref.json`
    - `tokens/sys.json`
    - `tokens/motion.json`
    - `tokens/layout.json`
    - `tokens/comp/*.json`（覆盖所有组件）
- 重写 `src/build-tokens.ts`：
  - 直接消费上述五类 JSON；
  - 合并所有 `comp/*.json` 为完整组件层；
  - 输出符合 Theme Runtime 预期的 `dist/tokens.json`。
- 更新 `tests/` 中的相关用例，确保构建后的 token 结构完整且可被组件库与 Theme Runtime 解析。

---

## 2. 关键任务

### 2.1 归档脚手架初始 Token 模板

- 在 `ThemePack/Chips-theme-default-dark/归档/` 下创建：
  - `归档/tokens-template/`，将当前 `tokens/global.json`、`tokens/semantic.json`、`tokens/typography.json`、`tokens/motion.json`、`tokens/layout.json` 与 `tokens/components/*` 移入其中；
- 更新文档记录：
  - 说明这些文件属于脚手架初始化阶段的临时结构，当前暗夜主题已统一改用 @chips/tokens 五层结构；
  - 保留归档用于追溯，不再在构建流程中使用。

### 2.2 引入官方 Token 源

- 从 `Chips-ComponentLibrary/packages/tokens/tokens` 引入以下文件的内容（以复制方式，不修改源仓）：
  - `ref.json` → `ThemePack/Chips-theme-default-dark/tokens/ref.json`
  - `sys.json` → `ThemePack/Chips-theme-default-dark/tokens/sys.json`
  - `motion.json` → `ThemePack/Chips-theme-default-dark/tokens/motion.json`
  - `layout.json` → `ThemePack/Chips-theme-default-dark/tokens/layout.json`
  - `comp/*.json` → `ThemePack/Chips-theme-default-dark/tokens/comp/*.json`
- 确保文件结构与 original 一致，保持键名层次：

```json
{
  "chips": {
    "ref": { ... }
  }
}
```

等，以便后续 flatten 时得到形如 `chips.ref.*` / `chips.sys.*` / `chips.comp.*` 的扁平键名。

### 2.3 重写 build-tokens.ts

- 将 `src/build-tokens.ts` 重写为：
  - 读取 `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`；
  - 读取 `tokens/comp/*.json` 并通过深度合并构造完整的 `comp` 层；
  - 输出结构：

```ts
const themeTokens = {
  ref,    // 来自 ref.json
  sys,    // 来自 sys.json
  comp,   // merge 所有 comp/*.json
  motion, // 来自 motion.json
  layout  // 来自 layout.json
};
```

- 确保输出结果可通过 Host 侧 `asThemeTokenLayers` 校验（五个字段都为 object）。

### 2.4 更新验证脚本与测试

- 复用现有 `tests/tokens.spec.ts` 验证五层结构；
- 扩展 `tests/contract.spec.ts`：
  - 仍然检查按钮相关 token 存在；
  - 可增加对 1–2 个其它关键组件（例如 `input`、`dialog`）的 token 存在性检查，确保组件层合并没有遗漏；
- 保持 `src/validate-theme.ts` 的逻辑简单、稳定：
  - 读取 `dist/tokens.json`；
  - flatten 后检查至少覆盖若干核心 `chips.comp.*` token；
  - 如发现缺失，给出清晰错误信息并返回非零 exit code。

---

## 3. 依赖与前置条件

- 阶段一文档与视觉风格基线已确定；
- `Chips-ComponentLibrary/packages/tokens/tokens` 文件结构稳定；
- 如在对齐过程中发现：
  - tokens 中的值与《Token 与主题对接标准》不一致；
  - 或不同层级之间存在循环引用/冲突；
  则需首先通过问题工单流程确认后再继续。

---

## 4. 验收标准

- `ThemePack/Chips-theme-default-dark/tokens/` 中：
  - 存在 `ref.json/sys.json/motion.json/layout.json`；
  - `tokens/comp/` 下包含标准组件列表的 JSON 文件；
  - 原脚手架初始 Token 文件已移入 `归档/`。
- `npm run build` 能够在本工程中成功运行，并生成结构正确的 `dist/tokens.json`；
- `npm test` 中与 Token 相关的用例全部通过。

