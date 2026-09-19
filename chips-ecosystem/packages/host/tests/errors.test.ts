import { describe, expect, it } from 'vitest';

import {
  PAL_ERROR_CODES,
  PAL_ERROR_MESSAGES,
  PAL_ERROR_RETRYABLE,
  PalBootstrapError,
  PalPortError,
  isPalBootstrapError,
  isPalErrorCode,
  isPalPortError,
  toPalPortError,
} from '../src/platform/errors.js';

describe('PAL error registry', () => {
  it('should provide a message and retryable flag for every registered code', () => {
    for (const code of Object.values(PAL_ERROR_CODES)) {
      expect(PAL_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      expect(typeof PAL_ERROR_RETRYABLE[code]).toBe('boolean');
    }
  });

  it('should recognize only registered codes', () => {
    expect(isPalErrorCode(PAL_ERROR_CODES.FILE_NOT_FOUND)).toBe(true);
    expect(isPalErrorCode('NOT_A_REGISTERED_CODE')).toBe(false);
  });
});

describe('PalPortError', () => {
  it('should derive message and retryable from the code table', () => {
    const error = new PalPortError(PAL_ERROR_CODES.WINDOW_NOT_FOUND);
    expect(error.name).toBe('PalPortError');
    expect(error.message).toBe(PAL_ERROR_MESSAGES.WINDOW_NOT_FOUND);
    expect(error.retryable).toBe(false);
    expect(error.details).toBeUndefined();
  });

  it('should allow overriding message, details, retryable and cause', () => {
    const cause = new Error('cause');
    const error = new PalPortError(PAL_ERROR_CODES.FILE_IO_FAILED, '自定义消息', {
      details: { path: 'x' },
      retryable: false,
      cause,
    });
    expect(error.message).toBe('自定义消息');
    expect(error.details).toEqual({ path: 'x' });
    expect(error.retryable).toBe(false);
    expect(error.cause).toBe(cause);
  });

  it('should serialize to a structured-clone compatible payload', () => {
    const withDetails = new PalPortError(PAL_ERROR_CODES.DIALOG_FAILED, undefined, {
      details: { reason: 'x' },
    });
    expect(withDetails.toJSON()).toEqual({
      code: PAL_ERROR_CODES.DIALOG_FAILED,
      message: PAL_ERROR_MESSAGES.DIALOG_FAILED,
      retryable: true,
      details: { reason: 'x' },
    });

    const withoutDetails = new PalPortError(PAL_ERROR_CODES.FILE_NOT_FOUND);
    expect(withoutDetails.toJSON()).toEqual({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
      message: PAL_ERROR_MESSAGES.FILE_NOT_FOUND,
      retryable: false,
    });
  });

  it('should be detected by the type guard', () => {
    expect(isPalPortError(new PalPortError(PAL_ERROR_CODES.BRIDGE_INTERNAL))).toBe(true);
    expect(isPalPortError(new Error('plain'))).toBe(false);
    expect(isPalPortError(null)).toBe(false);
  });
});

describe('toPalPortError', () => {
  it('should return PalPortError instances unchanged', () => {
    const original = new PalPortError(PAL_ERROR_CODES.BRIDGE_CANCELLED);
    expect(toPalPortError(original)).toBe(original);
  });

  it('should map Error objects with registered codes', () => {
    const nodeError = Object.assign(new Error('fs failed'), { code: PAL_ERROR_CODES.FILE_NOT_FOUND });
    const mapped = toPalPortError(nodeError);
    expect(mapped.code).toBe(PAL_ERROR_CODES.FILE_NOT_FOUND);
    expect(mapped.cause).toBe(nodeError);
  });

  it('should normalize unknown errors to the fallback code', () => {
    const mapped = toPalPortError(new Error('boom'));
    expect(mapped.code).toBe(PAL_ERROR_CODES.BRIDGE_INTERNAL);
    expect(mapped.retryable).toBe(false);

    const custom = toPalPortError('not an error', PAL_ERROR_CODES.FILE_IO_FAILED, '文件读写失败');
    expect(custom.code).toBe(PAL_ERROR_CODES.FILE_IO_FAILED);
    expect(custom.message).toBe('文件读写失败');
  });
});

describe('PalBootstrapError', () => {
  it('should expose the shell-internal code and details', () => {
    const error = new PalBootstrapError('壳启动失败', { facet: 'window' });
    expect(error.name).toBe('PalBootstrapError');
    expect(error.code).toBe('PAL_BOOTSTRAP_INVALID');
    expect(error.details).toEqual({ facet: 'window' });
    expect(isPalBootstrapError(error)).toBe(true);
    expect(isPalBootstrapError(new Error('x'))).toBe(false);
  });
});
