import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { emitYaml, needsQuoting, type YamlValue } from '../src/yaml.js';

describe('emitYaml', () => {
  it('序列化嵌套映射与序列并保持缩进', () => {
    const value: YamlValue = {
      id: 'chips.basecard.markdown',
      version: '0.1.0',
      type: 'basecard',
      name: 'Markdown 卡片',
      runtime: { targets: ['host'] },
      permissions: [],
      capabilities: {
        cardTypes: [
          {
            id: 'base.markdown',
            name: 'Markdown 卡片',
            icon: 'assets/icons/markdown.svg',
            extensions: ['.md'],
          },
        ],
      },
    };

    expect(emitYaml(value)).toBe(
      [
        'id: chips.basecard.markdown',
        'version: 0.1.0',
        'type: basecard',
        'name: Markdown 卡片',
        'runtime:',
        '  targets:',
        '    - host',
        'permissions: []',
        'capabilities:',
        '  cardTypes:',
        '    - id: base.markdown',
        '      name: Markdown 卡片',
        '      icon: assets/icons/markdown.svg',
        '      extensions:',
        '        - .md',
        '',
      ].join('\n')
    );
  });

  it('输出可被 YAML 1.2 解析器读回且与输入等价', () => {
    const value: YamlValue = {
      id: 'chips.service.example',
      runtime: { targets: ['host'], background: true },
      schemaVersions: '>=1.0.0 <2.0.0',
      empty: {},
      list: [],
      flags: [true, false],
    };
    expect(parse(emitYaml(value))).toEqual(value);
  });

  it('按需引用特殊标量', () => {
    expect(needsQuoting('')).toBe(true);
    expect(needsQuoting('>=1.0.0 <2.0.0')).toBe(true);
    expect(needsQuoting('30s')).toBe(false);
    expect(needsQuoting('true')).toBe(true);
    expect(needsQuoting('1.6')).toBe(true);
    expect(needsQuoting('文本: 值')).toBe(true);
    expect(emitYaml({ schemaVersions: '>=1.0.0 <2.0.0' })).toBe(
      'schemaVersions: ">=1.0.0 <2.0.0"\n'
    );
  });

  it('转义双引号与反斜杠', () => {
    expect(emitYaml({ text: 'a"b\\c' })).toBe('text: "a\\"b\\\\c"\n');
  });
});
