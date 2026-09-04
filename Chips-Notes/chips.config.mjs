/**
 * Chips Dev 配置文件
 * 参考：生态共用技术文档《Chips Dev 开发者命令行手册》
 */

/** @type {import('chips-dev-tools').ChipsConfig | Record<string, unknown>} */
const config = {
  srcDir: "src",
  outDir: "dist",
  entry: "index.html",
  testsDir: "tests"
};

export default config;

