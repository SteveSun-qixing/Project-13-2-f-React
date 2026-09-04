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
  ignorePatterns: ["node_modules/", "dist/", "reports/", "*.d.ts"],
  rules: {
    "no-warning-comments": ["error", { terms: ["TODO", "FIXME"], location: "anywhere" }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
  },
};
