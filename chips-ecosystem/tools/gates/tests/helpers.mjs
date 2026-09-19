import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const testsDir = path.dirname(fileURLToPath(import.meta.url));
export const gatesDir = path.resolve(testsDir, '..');
export const fixturesRoot = path.join(testsDir, 'fixtures');

export function fixture(name) {
  return path.join(fixturesRoot, name);
}

export const noFlags = new Map();

export function violationCodes(report) {
  return [...new Set(report.violations.map((item) => item.code))].sort();
}

export function warningCodes(report) {
  return [...new Set(report.warnings.map((item) => item.code))].sort();
}

export function docsConfig() {
  return { docs: { root: 'docs', index: 'README.md' } };
}

export function contractsConfig(generatedDir) {
  return {
    contracts: {
      generated: {
        dir: generatedDir,
        capabilities: 'capability-ids.ts',
        permissions: 'permission-ids.ts',
        events: 'event-ids.ts',
        mapping: 'capability-permissions.ts',
      },
      sources: {
        capabilities: {
          file: 'docs/capability.md',
          section: '^###\\s+6\\.2',
          declaredCount: '本表的\\s*(\\d+)\\s*项计数',
        },
        permissions: { file: 'docs/permission.md', section: '^###\\s+4\\.1' },
        events: { dir: 'docs/events', files: 'events.md', excludedDomains: ['internal'] },
      },
    },
  };
}

export function boundariesConfig({ allowAnyInternal = false } = {}) {
  return {
    boundaries: {
      internalScope: '@chips/',
      sourceExtensions: ['.ts'],
      ignoredDirs: ['node_modules', 'dist', 'fixtures'],
      testFilePatterns: ['\\.test\\.'],
      workspaceProtocol: 'workspace:',
      forbiddenProtocolPrefixes: ['file:', 'link:'],
      rules: [
        { id: 'root', match: '.', kind: 'root' },
        {
          id: 'packages/a',
          match: 'packages/a',
          allowedInternal: ['@chips/b'],
          forbiddenModules: ['electron'],
          forbidNodeBuiltins: true,
        },
        { id: 'packages/b', match: 'packages/b', allowedInternal: [] },
        { id: 'packages/d', match: 'packages/d', allowedInternal: ['@chips/e'] },
        { id: 'packages/e', match: 'packages/e', allowedInternal: ['@chips/d'] },
        {
          id: 'packages/sdk',
          match: 'packages/sdk',
          allowedInternal: ['@chips/bridge'],
          typeOnlyInternal: ['@chips/bridge'],
        },
      ],
      rust: {
        workspaceManifest: 'Cargo.toml',
        internalPrefix: 'chips-',
        allowedDeps: {
          'chips-core': [],
          'chips-cordis': ['chips-core'],
          'chips-parser': ['chips-core'],
          'chips-x': ['chips-y'],
          'chips-y': ['chips-x'],
        },
      },
      allowAnyInternal,
    },
  };
}

export function coverageConfig({ rustRequired = true, rustSurface = false } = {}) {
  return {
    coverage: {
      inputs: {
        ts: { path: 'coverage/coverage-summary.json', required: true },
        rust: { path: 'coverage/tarpaulin.xml', required: rustRequired },
      },
      metrics: ['lines', 'functions', 'branches', 'statements'],
      defaultThreshold: 80,
      groups: [
        {
          id: 'shared',
          threshold: 90,
          match: ['packages/ui/', 'packages/bridge/'],
          required: true,
        },
      ],
      // rustSurface 为真时按核心面路径前缀逐文件聚合行数据（R18 口径）；
      // 默认关闭以保持既有用例走「工作区总量即核心面」的退化路径。
      ...(rustSurface
        ? {
            rust: {
              coreThreshold: 90,
              coreMatch: ['packages/core-rust/crates/chips-', 'packages/native/'],
            },
          }
        : {}),
    },
  };
}
