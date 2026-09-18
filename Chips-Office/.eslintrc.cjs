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
    // GenOffice 移植代码（Apache-2.0）：上游代码风格与业务空白不参与本仓 lint
    // 治理；类型正确性由 tsc typecheck 保证。桥接层、壳层与测试仍受 lint 治理。
    "vendor/**",
    "src/apps/**",
  ],
  rules: {
    "no-warning-comments": ["error", { terms: ["TODO", "FIXME"], location: "anywhere" }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
  },
};
