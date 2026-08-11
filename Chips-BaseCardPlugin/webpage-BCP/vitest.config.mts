import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const reactAliases = [
  "react/jsx-dev-runtime",
  "react/jsx-runtime",
  "react-dom/client",
  "react-dom/server",
  "react-dom",
  "react",
].map((specifier) => ({
  find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
  replacement: require.resolve(specifier),
}));

export default defineConfig({
  resolve: {
    alias: reactAliases,
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules/**", "dist/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
