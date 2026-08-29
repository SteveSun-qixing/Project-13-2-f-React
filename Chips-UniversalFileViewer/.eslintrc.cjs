module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "reports/",
    "*.d.ts",
    // 开源引擎移植代码（open-file-viewer core，MIT）：模板字符串内含业务空白，
    // 不参与本仓 lint 规则治理；类型正确性由 tsc typecheck 保证。
    "src/viewer-engine/**",
  ],
  rules: {
    "no-warning-comments": ["error", { terms: ["TODO", "FIXME"], location: "anywhere" }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
  },
};
