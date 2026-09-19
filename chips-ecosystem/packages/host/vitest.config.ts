import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // 覆盖率统计范围为平台抽象层（PAL，本任务交付范围）；main / protocol / runtime 由所属
      // 任务补齐测试后扩展 include，避免未交付测试的目录拉低本层门禁。
      include: ['src/platform/**/*.ts'],
      exclude: ['src/platform/**/*.test.ts'],
      // 权威口径：R18 总体 >= 80%，核心/共享层 >= 90%（《架构原则》§4.2、05-测试规范 §10）。
      // PAL 是壳内部共享基础设施，本层按 90% 门禁执行（见 src/platform/开发计划.md）。
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
});
