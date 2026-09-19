import { describe, expect, it } from 'vitest';

import { parseGlobalOptions } from '../src/args/global-options.js';
import { parseParameters } from '../src/args/parse.js';
import type { IParameterSet } from '../src/args/types.js';
import type { CliErrorCode } from '../src/errors.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error('expected failure');
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
  }
}

describe('全局选项（§2.1、§2.2）', () => {
  it('剥离任意位置的全局选项且不进入命令 token', () => {
    const parsed = parseGlobalOptions(['--json', 'plugin', 'install', 'x.cpk', '--yes'], 'user');
    expect(parsed.options.json).toBe(true);
    expect(parsed.options.yes).toBe(true);
    expect(parsed.rest).toEqual(['plugin', 'install', 'x.cpk']);
  });

  it('支持 --name=value、--name value 与布尔显式置假', () => {
    const parsed = parseGlobalOptions(['--plugin=chips.a', '--json=false', 'status'], 'user');
    expect(parsed.options.pluginId).toBe('chips.a');
    expect(parsed.options.json).toBe(false);
    expect(parsed.rest).toEqual(['status']);
  });

  it('-- 之后一律按位置参数处理', () => {
    const parsed = parseGlobalOptions(['--', '--json', 'x'], 'user');
    expect(parsed.options.json).toBe(false);
    expect(parsed.rest).toEqual(['--json', 'x']);
  });

  it('重复单值选项与缺失取值返回 CLI_ARGUMENT_INVALID', () => {
    expectCode(() => parseGlobalOptions(['--plugin', 'a', '--plugin', 'b'], 'user'), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parseGlobalOptions(['--plugin'], 'user'), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parseGlobalOptions(['--json=1'], 'user'), 'CLI_ARGUMENT_INVALID');
  });

  it('用户侧拒绝 --workspace 并给出提示，开发侧接受', () => {
    expectCode(() => parseGlobalOptions(['--workspace', '/tmp/ws'], 'user'), 'CLI_ARGUMENT_INVALID');
    const dev = parseGlobalOptions(['--workspace=/tmp/ws', 'status'], 'dev');
    expect(dev.options.workspace).toBe('/tmp/ws');
  });
});

function parse(argv: readonly string[], declarations: IParameterSet, fileSystem = new MemoryFileSystem()) {
  return parseParameters({ argv, declarations, cwd: '/work', fileSystem });
}

describe('参数模型（§5.2）', () => {
  it('11 种类型的解析与 payload 映射', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/list.txt', 'a\n\nb\n');
    fileSystem.writeText('/work/items.json', '["x","y"]');
    const result = parse(
      [
        'text-value',
        '--n',
        '1.5',
        '--i',
        '3',
        '--flag',
        '--mode',
        'fast',
        '--tags',
        'a,b',
        '--tags',
        'c',
        '--raw',
        '{"a":1}',
        '--batch',
        '/work/list.txt',
        '--array',
        '/work/items.json',
      ],
      {
        arguments: [{ name: 'text', position: 0, type: 'string', required: true, mapsTo: 'inputs.text' }],
        options: [
          { name: 'n', type: 'number' },
          { name: 'i', type: 'integer' },
          { name: 'flag', type: 'boolean' },
          { name: 'mode', type: 'enum', choices: ['fast', 'slow'] },
          { name: 'tags', type: 'stringList' },
          { name: 'raw', type: 'json' },
          { name: 'batch', type: 'textFile', batch: { format: 'lines', itemType: 'value' } },
          { name: 'array', type: 'jsonFile', batch: { format: 'json-array', itemType: 'value' } },
        ],
      },
      fileSystem,
    );
    expect(result.payload).toEqual({
      inputs: { text: 'text-value' },
      n: 1.5,
      i: 3,
      flag: true,
      mode: 'fast',
      tags: ['a', 'b', 'c'],
      raw: { a: 1 },
      batch: ['a', 'b'],
      array: ['x', 'y'],
    });
  });

  it('默认值、必填缺失与未知选项', () => {
    const result = parse(['--level', 'info'], {
      options: [{ name: 'level', type: 'string' }, { name: 'lines', type: 'integer', default: 100 }],
    });
    expect(result.payload).toEqual({ level: 'info', lines: 100 });

    expectCode(() => parse([], { options: [{ name: 'role', type: 'string', required: true }] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['--unknown', 'x'], { options: [] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['extra'], { arguments: [] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['--mode', 'nope'], { options: [{ name: 'mode', type: 'enum', choices: ['a'] }] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['--n', 'NaN'], { options: [{ name: 'n', type: 'number' }] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['--n', '1.5'], { options: [{ name: 'n', type: 'integer' }] }), 'CLI_ARGUMENT_INVALID');
    expectCode(() => parse(['--i', '1', '--i', '2'], { options: [{ name: 'i', type: 'integer' }] }), 'CLI_ARGUMENT_INVALID');
  });

  it('路径规则：kind/exists/extensions 与相对路径解析', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/doc.md', 'x');
    const result = parse(['--input', 'doc.md'], {
      options: [
        {
          name: 'input',
          type: 'path',
          path: { kind: 'file', role: 'input', exists: true, extensions: ['md'] },
        },
      ],
    }, fileSystem);
    expect(result.values.get('input')).toBe('/work/doc.md');

    expectCode(
      () => parse(['--input', 'missing.md'], { options: [{ name: 'input', type: 'path', path: { exists: true } }] }, fileSystem),
      'CLI_PATH_NOT_FOUND',
    );
    expectCode(
      () => parse(['--input', 'doc.md'], { options: [{ name: 'input', type: 'path', path: { extensions: ['txt'] } }] }, fileSystem),
      'CLI_PATH_INVALID',
    );
  });

  it('输出冲突四策略与 --overwrite 覆盖', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/out.txt', 'old');

    expectCode(
      () => parse(['--out', '/work/out.txt'], { options: [{ name: 'out', type: 'path', path: { role: 'output' } }] }, fileSystem),
      'CLI_OUTPUT_EXISTS',
    );

    const rename = parse(
      ['--out', '/work/out.txt'],
      { options: [{ name: 'out', type: 'path', path: { role: 'output', overwrite: 'rename' } }] },
      fileSystem,
    );
    expect(rename.values.get('out')).toBe('/work/out-1.txt');

    const skip = parse(
      ['--out', '/work/out.txt'],
      { options: [{ name: 'out', type: 'path', path: { role: 'output', overwrite: 'skip' } }] },
      fileSystem,
    );
    expect(skip.skipped).toBe(true);

    const overwrite = parseParameters({
      argv: ['--out', '/work/out.txt'],
      declarations: { options: [{ name: 'out', type: 'path', path: { role: 'output' } }] },
      cwd: '/work',
      fileSystem,
      overwriteOverride: true,
    });
    expect(overwrite.skipped).toBe(false);
    expect(overwrite.values.get('out')).toBe('/work/out.txt');
  });

  it('输出目录按需创建，批量格式非法返回 CLI_BATCH_INVALID', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/work/items.txt', 'a\nb');
    const result = parse(
      ['--out', '/work/new/file.txt'],
      {
        options: [
          { name: 'out', type: 'path', path: { role: 'output', create: true } },
          { name: 'batch', type: 'textFile', batch: { format: 'json-array' } },
        ],
      },
      fileSystem,
    );
    expect(result.values.get('out')).toBe('/work/new/file.txt');
    expect(fileSystem.kind('/work/new')).toBe('directory');

    expectCode(
      () => parse(['--batch', '/work/items.txt'], { options: [{ name: 'batch', type: 'textFile', batch: { format: 'json-array' } }] }, fileSystem),
      'CLI_BATCH_INVALID',
    );
  });

  it('-- 之后的 token 按位置参数处理', () => {
    const result = parse(['--', '--weird'], { arguments: [{ name: 'value', position: 0, type: 'string' }] });
    expect(result.values.get('value')).toBe('--weird');
  });

  it('声明非法（重复名、非法 mapsTo、enum 缺 choices）返回 CLI_COMMAND_FAILED', () => {
    expectCode(
      () =>
        parse([], {
          options: [
            { name: 'a', type: 'string' },
            { name: 'a', type: 'string' },
          ],
        }),
      'CLI_COMMAND_FAILED',
    );
    expectCode(() => parse([], { options: [{ name: 'a', type: 'string', mapsTo: '1bad' }] }), 'CLI_COMMAND_FAILED');
    expectCode(() => parse([], { options: [{ name: 'a', type: 'enum' }] }), 'CLI_COMMAND_FAILED');
  });
});

describe('错误码类型', () => {
  it('CliErrorCode 可用于类型断言', () => {
    const code: CliErrorCode = 'CLI_ARGUMENT_INVALID';
    expect(code).toBe('CLI_ARGUMENT_INVALID');
  });
});
