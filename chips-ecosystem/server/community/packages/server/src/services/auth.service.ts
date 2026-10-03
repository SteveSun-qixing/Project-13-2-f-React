import { AppError } from '../errors/AppError.js';
import { parseExpiresInToSeconds } from '../lib/http-tokens.js';
import { newEntityId } from '../lib/password.js';
import type { AppConfig } from '../config/env.js';
import type { User } from '../db/schema/index.js';
import type { ICommunityTokenPair } from '../dto/community.js';
import type { Repositories } from '../repositories/types.js';
import type { AuthTokenPayload } from '../types/fastify.js';

/**
 * 认证服务：令牌签发与校验、刷新会话生命周期（轮换/吊销）、账号锁定。
 * 契约依据：§3.1 令牌模型、§3.3 刷新、§3.4 登出、§3.2 连续失败锁定。
 * 吊销面以 PostgreSQL refresh_sessions 承载（见 schema 说明）。
 */

/** JWT 签名端口（生产由 @fastify/jwt 适配；测试可注入固定签名器）。 */
export interface TokenSigner {
  sign(payload: AuthTokenPayload, expiresIn: string): string;
  verify(token: string): AuthTokenPayload;
}

export interface AuthServiceDeps {
  signer: TokenSigner;
  config: AppConfig;
  repositories: Repositories;
  now: () => Date;
}

const REFRESH_FALLBACK_SECONDS = 30 * 24 * 3600;

export type VerifyFailure = { kind: 'missing' } | { kind: 'invalid' } | { kind: 'expired' };

export class AuthService {
  private readonly signer: TokenSigner;
  private readonly config: AppConfig;
  private readonly repositories: Repositories;
  private readonly now: () => Date;

  constructor(deps: AuthServiceDeps) {
    this.signer = deps.signer;
    this.config = deps.config;
    this.repositories = deps.repositories;
    this.now = deps.now;
  }

  /**
   * 签发访问令牌并建立刷新会话（注册 / 登录 / 轮换共用）。
   * 令牌对共享同一 `jti`（登录会话标识，即 refresh_sessions 主键）：受保护请求据此
   * 标识所属会话（如改密后「除当前会话外」的吊销口径，契约 §4.3）。
   */
  async issueSession(user: Pick<User, 'id' | 'role'>): Promise<ICommunityTokenPair> {
    const now = this.now();
    const sessionJti = newEntityId();
    const accessToken = this.signer.sign(
      { userId: user.id, role: user.role, jti: sessionJti, typ: 'access' },
      this.config.accessExpiresIn
    );
    const refreshToken = this.signer.sign(
      { userId: user.id, role: user.role, jti: sessionJti, typ: 'refresh' },
      this.config.refreshExpiresIn
    );
    const refreshTtl = parseExpiresInToSeconds(
      this.config.refreshExpiresIn,
      REFRESH_FALLBACK_SECONDS
    );
    await this.repositories.refreshSessions.create({
      jti: sessionJti,
      userId: user.id,
      expiresAt: new Date(now.getTime() + refreshTtl * 1000),
    });
    return { accessToken, refreshToken };
  }

  /**
   * 轮换刷新（契约 §3.3）：存在可恢复会话返回新令牌对（旧 refresh 会话即刻吊销）；
   * 令牌缺失 / 失效 / 已吊销 / 用户不可用一律返回 null（刷新端点据此返回 204）。
   */
  async rotateSession(
    refreshToken: string | null | undefined
  ): Promise<ICommunityTokenPair | null> {
    if (refreshToken === null || refreshToken === undefined || refreshToken.length === 0) {
      return null;
    }
    let payload: AuthTokenPayload;
    try {
      payload = this.signer.verify(refreshToken);
    } catch {
      return null;
    }
    if (payload.typ !== 'refresh' || payload.jti.length === 0) {
      return null;
    }
    const now = this.now();
    const session = await this.repositories.refreshSessions.findByJti(payload.jti);
    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }
    const user = await this.repositories.users.findById(payload.userId);
    if (user === null || !user.isActive) {
      return null;
    }
    // 轮换：旧会话立即失效（一次性刷新令牌）。
    await this.repositories.refreshSessions.revoke(payload.jti, now);
    return this.issueSession(user);
  }

  /** 登出尽力而为：令牌合法时吊销其刷新会话；非法/缺失静默（幂等 204）。 */
  async revokeByToken(refreshToken: string | null | undefined): Promise<void> {
    if (refreshToken === null || refreshToken === undefined || refreshToken.length === 0) {
      return;
    }
    try {
      const payload = this.signer.verify(refreshToken);
      if (payload.typ === 'refresh') {
        await this.repositories.refreshSessions.revoke(payload.jti, this.now());
      }
    } catch {
      // 令牌已失效：登出语义本就幂等，忽略。
    }
  }

  /** 改密后吊销除当前会话外的全部刷新会话（契约 §4.3）。 */
  async revokeOtherSessions(userId: string, exceptJti: string | null): Promise<number> {
    return this.repositories.refreshSessions.revokeAllForUser(userId, exceptJti, this.now());
  }

  /** 解析 Bearer 访问令牌；失败按契约码抛出（缺 token / 过期 / 非法分别可辨）。 */
  verifyAccessToken(authorizationHeader: string | undefined): AuthTokenPayload {
    if (authorizationHeader === undefined || !authorizationHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('COMMUNITY_AUTH_TOKEN_MISSING', '未携带访问令牌');
    }
    const token = authorizationHeader.slice('Bearer '.length).trim();
    let payload: AuthTokenPayload;
    try {
      payload = this.signer.verify(token);
    } catch (error) {
      // 签名器为 @fastify/jwt（fast-jwt 内核）：过期错误码 FAST_JWT_EXPIRED。
      const errorCode = (error as { code?: string }).code;
      if (errorCode === 'FAST_JWT_EXPIRED') {
        throw AppError.unauthorized('COMMUNITY_AUTH_TOKEN_EXPIRED', '访问令牌已过期');
      }
      throw AppError.unauthorized('COMMUNITY_AUTH_TOKEN_INVALID', '访问令牌非法');
    }
    if (payload.typ !== 'access') {
      throw AppError.unauthorized('COMMUNITY_AUTH_TOKEN_INVALID', '访问令牌非法');
    }
    return payload;
  }

  /** 账号是否处于锁定窗口内（契约 §3.2：锁定阈值与时长由服务端配置）。 */
  isLocked(user: Pick<User, 'lockedUntil'>): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > this.now().getTime();
  }

  /** 记录一次登录失败；达到阈值时落锁定截止时刻。返回是否恰好触发锁定。 */
  async recordLoginFailure(user: User): Promise<{ locked: boolean; count: number }> {
    const now = this.now();
    const previous =
      user.lockedUntil !== null && user.lockedUntil.getTime() <= now.getTime()
        ? 0
        : user.failedLoginCount;
    const count = previous + 1;
    const locked = count >= this.config.lockThreshold;
    const lockedUntil = locked
      ? new Date(now.getTime() + this.config.lockDurationSeconds * 1000)
      : user.lockedUntil;
    await this.repositories.users.update(user.id, { failedLoginCount: count, lockedUntil });
    return { locked, count };
  }

  /** 登录成功清零失败计数与锁定窗口。 */
  async clearLoginFailures(userId: string): Promise<void> {
    await this.repositories.users.update(userId, { failedLoginCount: 0, lockedUntil: null });
  }
}
