import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const reporterPath = path.join(packageRoot, 'src/reporter.ts');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default', reporterPath],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
