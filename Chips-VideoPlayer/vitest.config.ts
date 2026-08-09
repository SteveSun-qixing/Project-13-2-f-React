import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["归档/**", "node_modules/**", "dist/**"],
  },
});
