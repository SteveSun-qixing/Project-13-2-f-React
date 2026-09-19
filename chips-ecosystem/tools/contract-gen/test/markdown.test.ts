import { describe, expect, it } from 'vitest';

import {
  findSection,
  findTable,
  headingTokens,
  inlineCodeSpans,
  parseTables,
  quotedUpperTokens,
} from '../src/markdown.js';

const DOC = `# 标题

## 一、章节

### 1.1 子节

正文一。

### 1.2 另一节

正文二。

## 二、章节

正文三。
`;

describe('findSection', () => {
  it('按层级与标题包含串定位章节', () => {
    expect(findSection(DOC, 3, '1.1 子节')).toContain('正文一');
    expect(findSection(DOC, 3, '1.1 子节')).not.toContain('正文二');
    expect(findSection(DOC, 2, '一、章节')).toContain('正文二');
    expect(findSection(DOC, 2, '一、章节')).not.toContain('正文三');
  });

  it('找不到时返回 null', () => {
    expect(findSection(DOC, 2, '九、不存在')).toBeNull();
  });
});

describe('parseTables', () => {
  it('解析表格并跳过分隔行', () => {
    const body = `| 能力 ID | 所需权限 ID |
|---|---|
| \`file:read\` | \`filesystem:read\` |
| \`file:copy\` | \`filesystem:read\` + \`filesystem:write\` |
`;
    const [table] = parseTables(body);
    expect(table?.header).toEqual(['能力 ID', '所需权限 ID']);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]).toEqual(['`file:read`', '`filesystem:read`']);
  });

  it('支持转义竖线', () => {
    const body = `| 类型 | 说明 |
|---|---|
| \`'card' \\| 'box'\` | 文档类型 |
`;
    const [table] = parseTables(body);
    expect(table?.rows[0]?.[0]).toBe("`'card' | 'box'`");
  });

  it('findTable 按表头锚点定位', () => {
    const tables = parseTables(`| 域 | 发布方 |\n|---|---|\n| \`plugin\` | 运行时 |\n`);
    expect(() => findTable(tables, '不存在')).toThrow(/未找到表头/);
    expect(findTable(tables, '发布方').rows).toHaveLength(1);
  });
});

describe('token 提取', () => {
  it('提取内联码与引号全大写码', () => {
    expect(inlineCodeSpans('使用 `file:read` 与 `window:setTitle`')).toEqual([
      'file:read',
      'window:setTitle',
    ]);
    expect(quotedUpperTokens('"KERNEL_LOCK_POISONED", "timeoutMs"')).toEqual([
      'KERNEL_LOCK_POISONED',
    ]);
  });

  it('提取标题 ID', () => {
    const text = `#### plugin:installed\n\n#### command:invoked\n\n### 其他\n`;
    expect(headingTokens(text, 4)).toEqual(['plugin:installed', 'command:invoked']);
  });
});
