/**
 * `document:*` 错误模型单测（`02-Bridge三层设计` §9.1/§9.2、`11-文档服务设计` §十、`04-能力契约规范` §11.1）。
 *
 * 覆盖：登记码集合与 `retryable` / 文案口径、`ChipsError` 同构形态、端口错误归一与透传规则。
 */

import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_BUSINESS_ERROR_CODES,
  DOCUMENT_CHANNEL_ERROR_CODES,
  DOCUMENT_ERROR_MESSAGES,
  DOCUMENT_ERROR_RETRYABLE,
  DOCUMENT_PARSER_ERROR_CODES,
  DocumentCapabilityError,
  asDocumentCapabilityError,
  documentError,
  isDocumentCapabilityErrorCode,
} from '../src/capabilities/document/errors.js';
import type { DocumentCapabilityErrorCode } from '../src/capabilities/document/errors.js';

/** 全部登记码（通道级 + 业务 + 解析域复用）。 */
const ALL_CODES: readonly DocumentCapabilityErrorCode[] = [
  ...Object.values(DOCUMENT_CHANNEL_ERROR_CODES),
  ...Object.values(DOCUMENT_BUSINESS_ERROR_CODES),
  ...Object.values(DOCUMENT_PARSER_ERROR_CODES),
];

/** 已登记错误码词法：`<DOMAIN>_<REASON>` 全大写下划线。 */
const CODE_PATTERN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** 简体中文文案判定：至少含一个 CJK 字符且无 ASCII 提示语形态。 */
function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

describe('登记码表', () => {
  it('通道级码取值与 Bridge 码表逐字一致', () => {
    expect(DOCUMENT_CHANNEL_ERROR_CODES).toEqual({
      invalidInput: 'BRIDGE_INVALID_INPUT',
      permissionDenied: 'BRIDGE_PERMISSION_DENIED',
      sessionUnknown: 'BRIDGE_SESSION_UNKNOWN',
      timeout: 'BRIDGE_TIMEOUT',
      cancelled: 'BRIDGE_CANCELLED',
      internal: 'BRIDGE_INTERNAL',
    });
  });

  it('业务码取值与文档服务设计 §10.2 登记一致', () => {
    expect(DOCUMENT_BUSINESS_ERROR_CODES).toEqual({
      notOpen: 'DOCUMENT_NOT_OPEN',
      partUnsupported: 'DOCUMENT_PART_UNSUPPORTED',
      writeConflict: 'DOCUMENT_WRITE_CONFLICT',
      sourceChanged: 'DOCUMENT_SOURCE_CHANGED',
      saveFailed: 'DOCUMENT_SAVE_FAILED',
      idConflict: 'DOCUMENT_ID_CONFLICT',
      metadataInvalid: 'DOCUMENT_METADATA_INVALID',
      structureInvalid: 'DOCUMENT_STRUCTURE_INVALID',
    });
  });

  it('解析域复用码取自解析器错误表（同场景不另立新码，§10.3）', () => {
    expect(DOCUMENT_PARSER_ERROR_CODES.formatUnknown).toBe('DOCUMENT_FORMAT_UNKNOWN');
  });

  it('全部登记码符合词法且互不重复', () => {
    const seen = new Set<string>();
    for (const code of ALL_CODES) {
      expect(code).toMatch(CODE_PATTERN);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });

  it('每个登记码都有中文文案与 retryable 口径，且无多余条目', () => {
    expect(Object.keys(DOCUMENT_ERROR_MESSAGES).sort()).toEqual([...ALL_CODES].sort());
    expect(Object.keys(DOCUMENT_ERROR_RETRYABLE).sort()).toEqual([...ALL_CODES].sort());
    for (const code of ALL_CODES) {
      expect(isChineseText(DOCUMENT_ERROR_MESSAGES[code])).toBe(true);
      expect(typeof DOCUMENT_ERROR_RETRYABLE[code]).toBe('boolean');
    }
  });

  it('retryable 口径：超时 / 写冲突 / 保存失败可重试，其余不可', () => {
    const retryable = ALL_CODES.filter((code) => DOCUMENT_ERROR_RETRYABLE[code]);
    expect(retryable.sort()).toEqual(['BRIDGE_TIMEOUT', 'DOCUMENT_SAVE_FAILED', 'DOCUMENT_WRITE_CONFLICT'].sort());
  });

  it('isDocumentCapabilityErrorCode 只认登记码', () => {
    expect(isDocumentCapabilityErrorCode('DOCUMENT_NOT_OPEN')).toBe(true);
    expect(isDocumentCapabilityErrorCode('RESOURCE_NOT_FOUND')).toBe(false);
    expect(isDocumentCapabilityErrorCode('')).toBe(false);
    expect(isDocumentCapabilityErrorCode('toString')).toBe(false);
  });
});

describe('DocumentCapabilityError 形态', () => {
  it('默认取登记文案与 retryable 口径', () => {
    const error = documentError(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict, {
      details: { documentId: 'Ab3dEf6Gh8' },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ChipsError');
    expect(error.code).toBe('DOCUMENT_WRITE_CONFLICT');
    expect(error.message).toBe('文档正被其他会话写入，请稍后重试');
    expect(error.retryable).toBe(true);
    expect(error.details).toEqual({ documentId: 'Ab3dEf6Gh8' });
  });

  it('允许覆盖文案与 retryable（端口携带自定义诊断时使用）', () => {
    const error = documentError(DOCUMENT_CHANNEL_ERROR_CODES.internal, { message: '自定义', retryable: true });
    expect(error.message).toBe('自定义');
    expect(error.retryable).toBe(true);
    expect(error.details).toBeUndefined();
  });

  it('toPlain 输出结构化克隆形态且缺省省略 details', () => {
    const withDetails = documentError(DOCUMENT_BUSINESS_ERROR_CODES.notOpen, { details: { documentId: 'x' } });
    expect(withDetails.toPlain()).toEqual({
      code: 'DOCUMENT_NOT_OPEN',
      message: '文档会话不存在，请重新打开文档',
      retryable: false,
      details: { documentId: 'x' },
    });
    const bare = documentError(DOCUMENT_CHANNEL_ERROR_CODES.cancelled);
    expect(Object.keys(bare.toPlain()).sort()).toEqual(['code', 'message', 'retryable']);
  });

  it('details 为只读载荷，不参与错误消息拼接（不泄漏输入原文）', () => {
    const error = documentError(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput, {
      details: { capabilityId: 'document:open', reason: 'source 必须是非空字符串' },
    });
    expect(error.message).not.toContain('document:open');
    expect(error.stack ?? '').not.toContain('source 必须是');
  });
});

describe('asDocumentCapabilityError 归一', () => {
  it('文档能力错误原样返回（不重建、不丢详情）', () => {
    const original = documentError(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged, { details: { documentId: 'x' } });
    expect(asDocumentCapabilityError(original)).toBe(original);
  });

  it('携带登记码的端口错误同构透传（资源管理器 RESOURCE_*）', () => {
    const portError = Object.assign(new Error('资源不存在'), {
      code: 'RESOURCE_NOT_FOUND',
      details: { uri: 'chips-resource://a' },
      retryable: true,
    });
    const normalized = asDocumentCapabilityError(portError);
    expect(normalized.code).toBe('RESOURCE_NOT_FOUND');
    expect(normalized.message).toBe('资源不存在');
    expect(normalized.details).toEqual({ uri: 'chips-resource://a' });
    expect(normalized.retryable).toBe(true);
  });

  it('透传端口缺少消息与详情时使用兜底文案与默认口径', () => {
    const normalized = asDocumentCapabilityError({ code: 'DOCUMENT_IO' });
    expect(normalized.code).toBe('DOCUMENT_IO');
    expect(normalized.message).toBe('文档操作失败');
    expect(normalized.retryable).toBe(false);
    expect(normalized.details).toBeUndefined();
  });

  it('透传详情形态非对象时忽略（不带入畸形结构）', () => {
    const normalized = asDocumentCapabilityError({ code: 'DOCUMENT_IO', details: 'oops' });
    expect(normalized.details).toBeUndefined();
  });

  it('AbortError 归一为 BRIDGE_CANCELLED', () => {
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const normalized = asDocumentCapabilityError(abort);
    expect(normalized.code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.cancelled);
    expect(normalized.retryable).toBe(false);
  });

  it('未识别异常归一为 BRIDGE_INTERNAL 且不泄漏原始消息', () => {
    for (const value of [new Error('/Users/private/path 读取失败'), 'plain string', 42, null, undefined, {}]) {
      const normalized = asDocumentCapabilityError(value);
      expect(normalized.code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
      expect(normalized.message).toBe('平台内部错误');
      expect(normalized.message).not.toContain('Users');
      expect(normalized.retryable).toBe(false);
    }
  });

  it('code 字段不合登记码词法时不透传（与 Bridge normalizeError 同口径归一）', () => {
    for (const value of [
      { code: 'lower_case_code', message: 'secret' },
      { code: 'NOCODE', message: 'secret' },
      { code: 42, message: 'secret' },
      { message: 'secret' },
    ]) {
      const normalized = asDocumentCapabilityError(value);
      expect(normalized.code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.internal);
      expect(normalized.message).toBe('平台内部错误');
    }
  });

  it('构造错误本身即真 Error 实例（满足 only-throw-error 抛出约束）', () => {
    expect(() => {
      throw documentError(DOCUMENT_BUSINESS_ERROR_CODES.saveFailed);
    }).toThrowError(DocumentCapabilityError);
  });
});
