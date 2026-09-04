import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest 工程配置：
 * - konva 的 package.json `main` 指向 node 入口（lib/index-node.js，依赖原生 canvas），
 *   测试环境统一别名到浏览器入口 lib/index.js（构建链路由 `browser` 字段自动解析，不受影响）。
 * - 测试范围仅限本工程 tests/ 目录，避免把 vendor/ 下引擎自带测试卷入应用质量门禁。
 */
export default defineConfig({
  resolve: {
    alias: [{ find: /^konva$/, replacement: "konva/lib/index.js" }],
  },
  test: {
    include: [
      fileURLToPath(new URL("./tests/**/*.test.{ts,tsx}", import.meta.url)),
    ],
  },
});
