import { describe, expect, it } from 'vitest';

import {
  CLI_ERROR_MESSAGES,
  ChipsError,
  cliError,
  exitCodeForCode,
  exitCodeForError,
  hasErrorCode,
  normalizeError,
  toErrorObject,
} from '../src/errors.js';
import { redactArgv } from '../src/logging/operations.js';

describe('错误模型与退出码', () => {
  it('CLI 自有错误码映射到文档退出码（§2.5）', () => {
    expect(exitCodeForCode('CLI_ARGUMENT_INVALID')).toBe(2);
    expect(exitCodeForCode('CLI_COMMAND_QUERY_INVALID')).toBe(2);
    expect(exitCodeForCode('CLI_COMMAND_NOT_FOUND')).toBe(3);
    expect(exitCodeForCode('CLI_COMMAND_CONFLICT')).toBe(3);
    expect(exitCodeForCode('CLI_PERMISSION_DENIED')).toBe(4);
    expect(exitCodeForCode('CLI_PATH_NOT_FOUND')).toBe(5);
    expect(exitCodeForCode('CLI_OUTPUT_RENAME_EXHAUSTED')).toBe(5);
    expect(exitCodeForCode('CLI_TARGET_UNAVAILABLE')).toBe(6);
    expect(exitCodeForCode('CLI_TASK_FAILED')).toBe(7);
    expect(exitCodeForCode('CLI_TASK_CANCELLED')).toBe(8);
    expect(exitCodeForCode('CLI_TIMEOUT')).toBe(9);
  });

  it('跨领域错误码按文档映射退出码', () => {
    expect(exitCodeForCode('PLUGIN_PERMISSION_DENIED')).toBe(4);
    expect(exitCodeForCode('BRIDGE_PERMISSION_DENIED')).toBe(4);
    expect(exitCodeForCode('BRIDGE_CAPABILITY_NOT_FOUND')).toBe(6);
    expect(exitCodeForCode('BRIDGE_TIMEOUT')).toBe(9);
    expect(exitCodeForCode('FILE_ASSOCIATION_TARGET_INVALID')).toBe(5);
    expect(exitCodeForCode('CPK_MANIFEST_INVALID')).toBe(1);
    expect(exitCodeForCode('CONFIG_KEY_UNKNOWN')).toBe(1);
    expect(exitCodeForCode('UPDATE_SIGNATURE_INVALID')).toBe(1);
    expect(exitCodeForCode('UNKNOWN_CODE')).toBe(1);
  });

  it('归一化平台边界错误对象与未知异常', () => {
    const normalized = normalizeError({ code: 'CPK_ARCHIVE_INVALID', message: '归档损坏', details: { stage: 'archive' }, retryable: false });
    expect(normalized).toBeInstanceOf(ChipsError);
    expect(normalized.code).toBe('CPK_ARCHIVE_INVALID');
    expect(normalized.retryable).toBe(false);
    expect(exitCodeForError(normalized)).toBe(1);

    const fallback = normalizeError(new Error('boom'));
    expect(fallback.code).toBe('CLI_COMMAND_FAILED');
    expect(fallback.message).toBe('boom');

    const shaped = normalizeError({ code: 'X' });
    expect(shaped.message).toBe(CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED);
  });

  it('错误对象只包含四字段（§2.6）', () => {
    const error = cliError('CLI_OUTPUT_EXISTS', '输出目录已存在：/tmp/out', { path: '/tmp/out' }, false);
    expect(toErrorObject(error)).toEqual({
      code: 'CLI_OUTPUT_EXISTS',
      message: '输出目录已存在：/tmp/out',
      details: { path: '/tmp/out' },
      retryable: false,
    });
    const omitted = new ChipsError({ code: 'CLI_COMMAND_FAILED', message: '失败' });
    expect(toErrorObject(omitted)).toEqual({ code: 'CLI_COMMAND_FAILED', message: '失败' });
    expect(hasErrorCode({ code: 1 })).toBe(false);
    expect(hasErrorCode({ code: 'CLI_COMMAND_FAILED' })).toBe(true);
  });
});

describe('操作日志脱敏', () => {
  it('脱敏键名大小写与 -/_ 变体归一（§2.8）', () => {
    expect(redactArgv(['chips', 'login', '--token=abc', '--Api-Key', 'xyz', '--secret', 's', '--name', 'n'])).toEqual([
      'chips',
      'login',
      '--token=<redacted>',
      '--Api-Key',
      '<redacted>',
      '--secret',
      '<redacted>',
      '--name',
      'n',
    ]);
  });

  it('不修改入参', () => {
    const argv = ['--password', 'p'];
    redactArgv(argv);
    expect(argv).toEqual(['--password', 'p']);
  });
});
