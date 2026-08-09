import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

function resolveAlias(specifier: string) {
  return {
    find: new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    replacement: require.resolve(specifier),
  };
}

export default defineConfig({
  resolve: {
    alias: [
      resolveAlias("react/jsx-dev-runtime"),
      resolveAlias("react/jsx-runtime"),
      resolveAlias("react-dom/client"),
      resolveAlias("react-dom/server"),
      resolveAlias("react-dom"),
      resolveAlias("react"),
    ],
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["归档/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
