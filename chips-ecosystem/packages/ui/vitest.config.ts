import { defineChipsProject } from '@chips/testing/vitest';

export default defineChipsProject({
  name: '@chips/ui',
  environment: 'jsdom',
  tier: 'shared',
  setupFiles: ['./tests/setup.ts'],
});
