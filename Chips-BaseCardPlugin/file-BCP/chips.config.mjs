/**
 * chips.config.mjs
 *
 * 基础卡片插件构建与打包配置。
 * 配置字段遵循生态共用技术文档中的 chipsdev-r 正式工程命令契约。
 */

const config = {
  type: "card",
  entry: "./src/index.ts",
  outDir: "./dist",
  testsDir: "./tests",
  manifest: "./manifest.yaml"
};

export default config;
