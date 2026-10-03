import { AppError } from '../errors/AppError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toRfc3339 } from '../lib/pagination.js';
import type { User } from '../db/schema/index.js';
import type {
  ICommunityUserMe,
  ICommunityUserPublic,
  ICommunityUserSession,
} from '../dto/community.js';
import type { Repositories } from '../repositories/types.js';

/**
 * 账号域服务：注册、登录、资料、改密（《社区平台设计》§3.1；《11 契约》§3.2、§4.3）。
 * DTO 边界：公开面不返回 email、role、口令哈希与内部字段（契约 §10.2）。
 */

export interface UserServiceDeps {
  repositories: Repositories;
}

export class UserService {
  private readonly repositories: Repositories;

  constructor(deps: UserServiceDeps) {
    this.repositories = deps.repositories;
  }

  toPublicProfile(user: User): ICommunityUserPublic {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: toRfc3339(user.createdAt),
    };
  }

  /** 会话用户（《11 契约》§3.2 示例：公开资料 + role）。 */
  toSessionProfile(user: User): ICommunityUserSession {
    return { ...this.toPublicProfile(user), role: user.role };
  }

  /** 当前用户（契约 §4.3 ICommunityUserMe：公开资料 + email + role + updatedAt）。 */
  toMeProfile(user: User): ICommunityUserMe {
    return {
      ...this.toPublicProfile(user),
      email: user.email,
      role: user.role,
      updatedAt: toRfc3339(user.updatedAt),
    };
  }

  async getById(id: string): Promise<User> {
    const user = await this.repositories.users.findById(id);
    if (user === null) {
      throw AppError.notFound('COMMUNITY_USER_NOT_FOUND', '用户不存在');
    }
    return user;
  }

  async getByUsername(username: string): Promise<User> {
    const user = await this.repositories.users.findByUsernameLower(username.toLowerCase());
    if (user === null || !user.isActive) {
      // 不暴露停用账号的存在性（契约 §10.2：公开 DTO 边界）。
      throw AppError.notFound('COMMUNITY_USER_NOT_FOUND', '用户不存在');
    }
    return user;
  }

  /** 判定请求者对目标用户的 owner/admin 视角（可见性口径，契约 §4.1）。 */
  static canViewAll(
    target: Pick<User, 'id'>,
    requester: { userId: string; role: string } | null
  ): boolean {
    if (requester === null) {
      return false;
    }
    return requester.userId === target.id || requester.role === 'admin';
  }

  /** 注册并建立会话前置账号（唯一性冲突按契约 §7.3 返回 409）。 */
  async register(input: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<User> {
    const usernameLower = input.username.toLowerCase();
    const email = input.email.toLowerCase();
    const existingUsername = await this.repositories.users.findByUsernameLower(usernameLower);
    if (existingUsername !== null) {
      throw AppError.conflict('COMMUNITY_AUTH_USER_EXISTS', '用户名已被注册');
    }
    const existingEmail = await this.repositories.users.findByEmail(email);
    if (existingEmail !== null) {
      throw AppError.conflict('COMMUNITY_AUTH_USER_EXISTS', '邮箱已被注册');
    }
    return this.repositories.users.create({
      username: input.username,
      usernameLower,
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName ?? input.username,
      bio: null,
      avatarUrl: null,
    });
  }

  /**
   * 登录校验：标识（邮箱或用户名）+ 口令；停用账号按 403 处理；
   * 锁定优先判定（连续失败触发，契约 §3.2）；失败计数与锁定由调用方在口令校验后落账。
   */
  async findByLoginIdentifier(identifier: string): Promise<User | null> {
    return this.repositories.users.findByLoginIdentifier(identifier);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return verifyPassword(password, user.passwordHash);
  }

  async updateProfile(
    userId: string,
    patch: { displayName?: string; bio?: string | null }
  ): Promise<User> {
    return this.repositories.users.update(userId, patch);
  }

  /** 改密：校验当前口令；成功后由调用方吊销其他刷新会话（契约 §4.3）。 */
  async changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    const valid = await this.validatePassword(user, currentPassword);
    if (!valid) {
      throw AppError.unauthorized('COMMUNITY_AUTH_INVALID_CREDENTIALS', '账号或口令错误');
    }
    await this.repositories.users.update(user.id, {
      passwordHash: await hashPassword(newPassword),
    });
  }
}
