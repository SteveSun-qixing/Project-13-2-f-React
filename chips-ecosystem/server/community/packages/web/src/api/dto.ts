/**
 * DTO 形状校验：对成功响应数据做逐字段类型判定（契约 §2.2/§3.2/§4.3）。
 * 不符合契约的数据一律归一为 `COMMUNITY_RESPONSE_INVALID`（契约 §7.3 末行）。
 */

import { communityResponseInvalidError, CommunityApiError } from './errors';
import type {
  CommunityUserRole,
  ICommunityAuthSession,
  ICommunityTokenPair,
  ICommunityUserMe,
  ICommunityUserPublic,
  ICommunityUserSession,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, field: string, allowEmpty = false): string {
  const value = source[field];
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw dtoFieldError(field);
  }
  return value;
}

function readStringOrNull(source: Record<string, unknown>, field: string): string | null {
  const value = source[field];
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw dtoFieldError(field);
  }
  return value;
}

function readRole(source: Record<string, unknown>): CommunityUserRole {
  const value = source.role;
  if (value !== 'user' && value !== 'admin') {
    throw dtoFieldError('role');
  }
  return value;
}

function dtoFieldError(field: string): CommunityApiError {
  return communityResponseInvalidError({
    httpStatus: 0,
    detail: { reason: '响应字段不符合契约', field },
  });
}

/** 校验公开资料 DTO（契约 §4.3 `ICommunityUserPublic`）。 */
export function parseUserPublic(value: unknown): ICommunityUserPublic {
  if (!isRecord(value)) {
    throw dtoFieldError('user');
  }
  return {
    id: readString(value, 'id'),
    username: readString(value, 'username'),
    displayName: readString(value, 'displayName', true),
    bio: readStringOrNull(value, 'bio'),
    avatarUrl: readStringOrNull(value, 'avatarUrl'),
    createdAt: readString(value, 'createdAt'),
  };
}

/** 校验会话用户 DTO（契约 §3.2）：公开资料 + role。 */
export function parseUserSession(value: unknown): ICommunityUserSession {
  const user = parseUserPublic(value);
  if (!isRecord(value)) {
    throw dtoFieldError('user');
  }
  return { ...user, role: readRole(value) };
}

/** 校验当前用户 DTO（契约 §4.3 `ICommunityUserMe`）。 */
export function parseUserMe(value: unknown): ICommunityUserMe {
  const user = parseUserPublic(value);
  if (!isRecord(value)) {
    throw dtoFieldError('user');
  }
  return {
    ...user,
    email: readString(value, 'email'),
    role: readRole(value),
    updatedAt: readString(value, 'updatedAt'),
  };
}

/** 校验注册 / 登录会话响应（契约 §3.2）。 */
export function parseAuthSession(value: unknown): ICommunityAuthSession {
  if (!isRecord(value)) {
    throw dtoFieldError('data');
  }
  return {
    user: parseUserSession(value.user),
    accessToken: readString(value, 'accessToken'),
    refreshToken: readString(value, 'refreshToken'),
  };
}

/** 校验刷新响应（契约 §3.3）：`refreshToken` 仅在轮换时出现。 */
export function parseTokenPair(value: unknown): ICommunityTokenPair {
  if (!isRecord(value)) {
    throw dtoFieldError('data');
  }
  const pair: ICommunityTokenPair = { accessToken: readString(value, 'accessToken') };
  if (value.refreshToken !== undefined) {
    pair.refreshToken = readString(value, 'refreshToken');
  }
  return pair;
}
