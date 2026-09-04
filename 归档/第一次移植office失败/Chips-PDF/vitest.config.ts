import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["归档/**", "node_modules/**", "dist/**", "reports/**", "test-results/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
