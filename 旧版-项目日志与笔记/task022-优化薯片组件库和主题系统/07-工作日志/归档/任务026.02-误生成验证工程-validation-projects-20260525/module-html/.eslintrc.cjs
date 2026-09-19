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
  ignorePatterns: ["node_modules/", "dist/", "*.d.ts"],
  rules: {
    "no-warning-comments": ["error", { terms: ["todo", "fixme"], location: "anywhere" }],
    "no-trailing-spaces": "error",
    "eol-last": ["error", "always"],
  },
};
