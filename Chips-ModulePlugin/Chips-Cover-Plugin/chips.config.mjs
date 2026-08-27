/**
 * chips.config.mjs
 *
 * 封面共享模块（chips.module.cover）构建与打包配置。
 */

const config = {
  type: "module",
  entry: "./src/index.ts",
  outDir: "./dist",
  testsDir: "./tests",
  manifest: "./manifest.yaml"
};

export default config;
