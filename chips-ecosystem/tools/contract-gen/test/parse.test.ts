import { describe, expect, it } from 'vitest';

import {
  ContractParseError,
  parseCapabilities,
  parseDeclaredCapabilityCount,
  parseErrorCodes,
  parseEventDeclarations,
  parsePermissionCatalog,
  parsePermissionVocabulary,
  parseReservedEventDomains,
} from '../src/parse.js';
import { fixtureDocs, fixtureSources, createMemoryReader } from './fixtures.js';

const reader = createMemoryReader(fixtureDocs);

describe('parseCapabilities', () => {
  it('解析能力列的多 ID 与权限列的组合权限', () => {
    const entries = parseCapabilities(reader, fixtureSources.capability.table);
    expect(entries).toEqual([
      { id: 'file:read', permissions: ['filesystem:read'] },
      { id: 'file:list', permissions: ['filesystem:read'] },
      { id: 'file:copy', permissions: ['filesystem:read', 'filesystem:write'] },
      { id: 'window:create', permissions: ['window:control'] },
      { id: 'window:setTitle', permissions: ['window:control'] },
      { id: 'cli:task-get', permissions: [] },
    ]);
  });

  it('声明计数可解析', () => {
    expect(
      parseDeclaredCapabilityCount(
        reader,
        fixtureSources.capability.declaredCountFile,
        fixtureSources.capability.declaredCountPattern
      )
    ).toBe(6);
  });

  it('能力列无 ID 时抛错', () => {
    const broken = createMemoryReader({
      'capability.md': `### 6.2 内置能力与权限总表

| 能力 ID | 所需权限 ID |
|---|---|
| 无 | \`filesystem:read\` |
`,
    });
    expect(() => parseCapabilities(broken, fixtureSources.capability.table)).toThrow(
      ContractParseError
    );
  });
});

describe('parsePermissionCatalog / parsePermissionVocabulary', () => {
  it('解析权限词表', () => {
    expect(parsePermissionCatalog(reader, fixtureSources.permission.catalog)).toEqual([
      'filesystem:read',
      'filesystem:write',
      'window:control',
      'command:read',
    ]);
  });

  it('解析域-作用域词表与显式权限表', () => {
    const [domainSelector, commandSelector] = fixtureSources.permission.vocabulary;
    if (domainSelector === undefined || commandSelector === undefined) {
      throw new Error('fixture 缺少词表选择器');
    }
    expect(parsePermissionVocabulary(reader, domainSelector)).toEqual([
      'filesystem:read',
      'filesystem:write',
      'window:control',
    ]);
    expect(parsePermissionVocabulary(reader, commandSelector)).toEqual(['command:read']);
  });

  it('权限行格式非法时抛错', () => {
    const broken = createMemoryReader({
      'permission.md': `### 4.1 内置权限清单总表

| 权限 ID | 说明 |
|---|---|
| filesystem:read | 缺少反引号 |
`,
    });
    expect(() => parsePermissionCatalog(broken, fixtureSources.permission.catalog)).toThrow(
      /格式非法/
    );
  });
});

describe('事件解析', () => {
  it('解析保留域与声明计数', () => {
    expect(parseReservedEventDomains(reader, fixtureSources.event.reservedTable)).toEqual([
      { domain: 'plugin', declaredCount: 2 },
      { domain: 'file', declaredCount: 1 },
    ]);
  });

  it('按文件顺序解析事件声明', () => {
    expect(parseEventDeclarations(reader, fixtureSources.event.declarations)).toEqual([
      { id: 'plugin:installed', domain: 'plugin' },
      { id: 'plugin:failed', domain: 'plugin' },
      { id: 'file:changed', domain: 'file' },
    ]);
  });
});

describe('parseErrorCodes', () => {
  it('提取内联码与引号码并排除通配', () => {
    const selector = fixtureSources.errors[0];
    if (selector === undefined) {
      throw new Error('fixture 缺少错误码源');
    }
    expect(parseErrorCodes(reader, selector)).toEqual([
      { code: 'EVENT_ID_INVALID' },
      { code: 'EVENT_PUBLISH_DENIED' },
      { code: 'KERNEL_LOCK_POISONED' },
    ]);
  });

  it('章节没有错误码时抛错', () => {
    const broken = createMemoryReader({
      'error.md': `## 八、错误码

本章没有任何代码。
`,
    });
    const selector = fixtureSources.errors[0];
    if (selector === undefined) {
      throw new Error('fixture 缺少错误码源');
    }
    expect(() => parseErrorCodes(broken, selector)).toThrow(/未解析出任何错误码/);
  });
});
