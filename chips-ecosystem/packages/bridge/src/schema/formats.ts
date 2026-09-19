/**
 * format 白名单的强制语义实现（04-能力契约规范 §5.3）。
 */

import { normalizeResourceInput } from '../protocol/resource-uri.js';

const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

const ABSOLUTE_URI_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/;

const CREDENTIAL_PATTERN = /^credential:\/\/[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9._-]+$/;

function isValidDateTime(value: string): boolean {
  if (!DATE_TIME_PATTERN.test(value)) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function isValidAbsoluteUri(value: string): boolean {
  return ABSOLUTE_URI_PATTERN.test(value);
}

function isValidResourceUri(value: string): boolean {
  try {
    normalizeResourceInput(value);
    return true;
  } catch {
    return false;
  }
}

function isValidCredentialReference(value: string): boolean {
  return CREDENTIAL_PATTERN.test(value);
}

/** 按白名单 format 执行强制校验；未在白名单内的 format 不校验（返回 true）。 */
export function checkFormat(format: string, value: string): boolean {
  switch (format) {
    case 'date-time':
      return isValidDateTime(value);
    case 'uri':
      return isValidAbsoluteUri(value);
    case 'chips-resource-uri':
      return isValidResourceUri(value);
    case 'chips-credential':
      return isValidCredentialReference(value);
    default:
      return true;
  }
}
