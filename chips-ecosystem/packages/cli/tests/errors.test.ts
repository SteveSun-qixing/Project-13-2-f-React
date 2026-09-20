import { describe, expect, it } from 'vitest';

import { ChipsError as BridgeChipsError, isChipsError as bridgeIsChipsError } from '@chips/bridge';

import {
  CLI_ERROR_MESSAGES,
  ChipsError,
  cliError,
  cliErrorWithExitCode,
  exitCodeForCode,
  exitCodeForError,
  isChipsError,
  registerExitCodeHint,
  toCliError,
} from '../src/errors.js';
import { renderError } from '../src/output/result.js';
import type { IOutputSink } from '../src/output/io.js';
import { redactArgv } from '../src/logging/operations.js';

/** 捕获 stdout/stderr 的最小出口（错误信封形状断言用）。 */
function createSink(): { sink: IOutputSink; stdout: () => string } {
  let out = '';
  return {
    sink: {
      isTTY: false,
      writeOut: (text: string): void => {
        out += text;
      },
      writeErr: (): void => undefined,
    },
    stdout: (): string => out,
  };
}

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

  it('CLI 消费的 `ChipsError` 与守卫与 `@chips/bridge` 同源（工单024 唯一实现）', () => {
    expect(ChipsError).toBe(BridgeChipsError);
    expect(isChipsError).toBe(bridgeIsChipsError);
    const local = new ChipsError({ code: 'CLI_COMMAND_FAILED', message: '命令执行失败' });
    expect(local).toBeInstanceOf(BridgeChipsError);
  });

  it('统一结构守卫按三条合取判定（入口宽、出口严）', () => {
    expect(isChipsError({ code: 'CLI_TASK_FAILED', message: '任务执行失败' })).toBe(true);
    expect(
      isChipsError({ code: 'CLI_TASK_FAILED', message: '任务执行失败', retryable: true })
    ).toBe(true);
    expect(isChipsError(new ChipsError({ code: 'X_Y', message: '失败' }))).toBe(true);
    expect(isChipsError({ code: '', message: '缺少错误码' })).toBe(false);
    expect(isChipsError({ code: 'X_Y' })).toBe(false);
    expect(isChipsError({ code: 'X_Y', message: 7 })).toBe(false);
    expect(isChipsError({ code: 'X_Y', message: '失败', retryable: 'false' })).toBe(false);
    expect(isChipsError(null)).toBe(false);
    expect(isChipsError('CLI_TASK_FAILED')).toBe(false);
  });

  it('归一化平台边界错误对象与未知异常（§4.5 脱敏）', () => {
    const normalized = toCliError({
      code: 'CPK_ARCHIVE_INVALID',
      message: '归档损坏',
      details: { stage: 'archive' },
      retryable: false,
    });
    expect(normalized).toBeInstanceOf(ChipsError);
    expect(normalized.code).toBe('CPK_ARCHIVE_INVALID');
    expect(normalized.retryable).toBe(false);
    expect(exitCodeForError(normalized)).toBe(1);

    // 缺少 `message` 的同构值不再被守卫放行：整体落到域兜底码。
    const incomplete = toCliError({ code: 'X' });
    expect(incomplete.code).toBe('CLI_COMMAND_FAILED');
    expect(incomplete.message).toBe(CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED);
    expect(incomplete.retryable).toBe(false);
  });

  it('未识别异常：原始文本与堆栈不进 `message`，原文只落 `details.cause`', () => {
    const raw = new Error('ENOENT: no such file or directory, open /internal/path/key.pem');
    raw.stack = 'Error: 内部堆栈\n    at signContentHash (file:///internal/build/cpk-pack.ts)';
    const fallback = toCliError(raw);
    expect(fallback.code).toBe('CLI_COMMAND_FAILED');
    expect(fallback.message).toBe(CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED);
    expect(fallback.details).toEqual({ name: 'Error', cause: raw.message });
    expect(JSON.stringify(fallback.toPlain())).not.toContain('内部堆栈');
    expect(JSON.stringify(fallback.toPlain())).not.toContain('/internal/build');

    const nonError = toCliError('plain failure text');
    expect(nonError.code).toBe('CLI_COMMAND_FAILED');
    expect(nonError.message).toBe(CLI_ERROR_MESSAGES.CLI_COMMAND_FAILED);
    expect(nonError.details).toEqual({ cause: 'plain failure text' });
  });

  it('归一保持实例身份：本类实例原样返回，旁表提示不丢失', () => {
    const original = cliErrorWithExitCode('DOCUMENT_VERSION_UNSUPPORTED', 7, '文档版本过高');
    expect(toCliError(original)).toBe(original);
    expect(exitCodeForError(toCliError(original))).toBe(7);
  });

  it('退出码旁表：提示优先于码值映射，`exitCode` 不是错误对象成员（§4.6）', () => {
    const hinted = new ChipsError({ code: 'UNKNOWN_PLUGIN_CODE', message: '插件报告失败' });
    expect(exitCodeForError(hinted)).toBe(1);
    registerExitCodeHint(hinted, 7);
    expect(exitCodeForError(hinted)).toBe(7);

    const mapped = cliError('CLI_PERMISSION_DENIED');
    expect(exitCodeForError(mapped)).toBe(4);

    expect('exitCode' in hinted).toBe(false);
    expect(Object.keys(hinted)).not.toContain('exitCode');
    expect(hinted.toPlain()).not.toHaveProperty('exitCode');
    expect((hinted as { exitCode?: unknown }).exitCode).toBeUndefined();
  });

  it('跨边界携带的 `exitCode` 字段不采信（永不跨进程）', () => {
    const carried = toCliError({
      code: 'CLI_PERMISSION_DENIED',
      message: '权限不足，命令被拒绝',
      exitCode: 0,
    });
    expect(carried.code).toBe('CLI_PERMISSION_DENIED');
    expect(exitCodeForError(carried)).toBe(4);
    expect(carried.toPlain()).not.toHaveProperty('exitCode');
  });

  it('stdout 错误信封：`toPlain()` 形状 + 键名映射，`retryable` 恒带、无退出码成员（§2.6）', () => {
    const first = createSink();
    renderError(
      first.sink,
      cliErrorWithExitCode('CLI_OUTPUT_EXISTS', 5, '输出目录已存在：/tmp/out', { path: '/tmp/out' })
    );
    expect(JSON.parse(first.stdout()) as unknown).toEqual({
      error: '输出目录已存在：/tmp/out',
      code: 'CLI_OUTPUT_EXISTS',
      details: { path: '/tmp/out' },
      retryable: false,
    });
    expect(first.stdout()).not.toContain('exitCode');

    // 缺省 `retryable` 归一为 `false` 并恒带出信封（废弃「未指定即省略」的旧行为）。
    const second = createSink();
    const plain = new ChipsError({ code: 'CLI_COMMAND_FAILED', message: '命令执行失败' });
    expect(plain.retryable).toBe(false);
    renderError(second.sink, plain);
    expect(JSON.parse(second.stdout()) as unknown).toEqual({
      error: '命令执行失败',
      code: 'CLI_COMMAND_FAILED',
      retryable: false,
    });
  });
});

describe('操作日志脱敏', () => {
  it('脱敏键名大小写与 -/_ 变体归一（§2.8）', () => {
    expect(
      redactArgv([
        'chips',
        'login',
        '--token=abc',
        '--Api-Key',
        'xyz',
        '--secret',
        's',
        '--name',
        'n',
      ])
    ).toEqual([
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
