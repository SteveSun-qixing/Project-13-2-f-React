/** 薯片生态统一 ESLint preset（组件库阶段二基线）。 */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  ignorePatterns: ["node_modules/", "dist/", "reports/", "*.d.ts"],
  rules: {
    // 不允许在代码中遗留 TODO/FIXME（与现有 lint 脚本口径一致）
    "no-warning-comments": ["error", { terms: ["TODO", "FIXME"], location: "anywhere" }],
    // 统一换行与尾随空格规则（与 run-lint.mjs 保持一致）
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"]
  }
};

