import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../errors/AppError.js';
import type { AuthService } from '../services/auth.service.js';
import type { UserService } from '../services/user.service.js';
import type { AuthTokenPayload, RequestUser } from '../types/fastify.js';

/**
 * 认证插件（契约 §4.2「认证：可选」口径 + 《社区平台设计》§3.4）：
 * - authenticate：必须认证；缺 token / 过期 / 非法分别抛对应 401 码；
 * - optionalAuthenticate：未携带令牌按匿名；携带非法令牌按 401 处理，不静默降级；
 * - requireAdmin：必须认证且 role = "admin"（管理端基线）。
 * 停用账号（isActive=false）的受保护访问一律按不可用处理（403）。
 */

export interface AuthenticatePluginDeps {
  authService: AuthService;
  userService: UserService;
}

async function resolveUser(
  fastify: FastifyInstance,
  request: FastifyRequest
): Promise<{ payload: AuthTokenPayload; role: 'user' | 'admin'; active: boolean }> {
  const payload = fastify.authService.verifyAccessToken(request.headers.authorization);
  let role: 'user' | 'admin';
  let active: boolean;
  try {
    const user = await fastify.userService.getById(payload.userId);
    role = user.role;
    active = user.isActive;
  } catch (error) {
    // 令牌签名有效但账号已不存在：按令牌非法处理（不泄露账号状态差异）。
    if (error instanceof AppError && error.code === 'COMMUNITY_USER_NOT_FOUND') {
      throw AppError.unauthorized('COMMUNITY_AUTH_TOKEN_INVALID', '访问令牌非法');
    }
    throw error;
  }
  return { payload, role, active };
}

function requireActive(resolved: {
  payload: AuthTokenPayload;
  role: 'user' | 'admin';
  active: boolean;
}): RequestUser {
  if (!resolved.active) {
    throw AppError.forbidden('COMMUNITY_USER_ACCOUNT_DISABLED', '账号已被停用');
  }
  // 授权角色取数据库当前值（令牌 claim 仅为签发时快照）：角色变更即时生效。
  return { ...resolved.payload, role: resolved.role };
}

declare module 'fastify' {
  interface FastifyInstance {
    authService: AuthService;
    userService: UserService;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function authenticatePlugin(fastify: FastifyInstance, deps: AuthenticatePluginDeps): void {
  fastify.decorate('authService', deps.authService);
  fastify.decorate('userService', deps.userService);

  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    const resolved = await resolveUser(fastify, request);
    request.user = requireActive(resolved);
  });

  fastify.decorate('optionalAuthenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (header === undefined || !header.startsWith('Bearer ')) {
      request.user = null;
      return;
    }
    const resolved = await resolveUser(fastify, request);
    request.user = requireActive(resolved);
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest) => {
    const resolved = await resolveUser(fastify, request);
    const user = requireActive(resolved);
    if (user.role !== 'admin') {
      throw AppError.forbidden('COMMUNITY_AUTH_INSUFFICIENT_PERMISSION', '需要管理员权限');
    }
  });
}
