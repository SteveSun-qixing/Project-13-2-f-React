/**
 * chips.config.mjs
 *
 * 标准模块插件构建与打包配置。
 */

const config = {
  type: "module",
  entry: "./src/index.ts",
  outDir: "./dist",
  testsDir: "./tests",
  manifest: "./manifest.yaml"
};

export default config;
