/**
 * chips.config.mjs
 *
 * 基础卡片插件构建与打包配置。
 * 配置字段需与 `chips dev` 工具的最终规范保持一致，当前仅提供最小可用结构。
 */

const config = {
  type: "card",
  entry: "./src/index.ts",
  outDir: "./dist",
  testsDir: "./tests",
  manifest: "./manifest.yaml"
};

export default config;
