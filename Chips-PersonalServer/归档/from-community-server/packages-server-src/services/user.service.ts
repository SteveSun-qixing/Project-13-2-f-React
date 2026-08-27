import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User, type NewUser } from '../db/schema/users';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

const BCRYPT_ROUNDS = 12;

/** 用户名格式校验正则（3-32位字母数字下划线连字符） */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

export const UserService = {
  /**
   * 创建新用户
   */
  async create(username: string, password: string): Promise<User> {
    if (!USERNAME_REGEX.test(username)) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Username must be 3-32 characters and contain only letters, numbers, underscores, or hyphens',
      );
    }

    // 检查用户名是否已存在（大小写不敏感）
    const existing = await db.query.users.findFirst({
      where: eq(users.usernameLower, username.toLowerCase()),
    });
    if (existing) {
      throw AppError.conflict(ErrorCode.AUTH_USER_EXISTS, 'Username is already taken');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({
        username,
        usernameLower: username.toLowerCase(),
        passwordHash,
        displayName: username,
      } satisfies Partial<NewUser> as NewUser)
      .returning();

    return user;
  },

  /**
   * 通过用户名查找用户（大小写不敏感）
   */
  async findByUsername(username: string): Promise<User | undefined> {
    return db.query.users.findFirst({
      where: eq(users.usernameLower, username.toLowerCase()),
    });
  },

  /**
   * 通过 ID 查找用户
   */
  async findById(id: string): Promise<User | undefined> {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  /**
   * 验证密码是否正确
   */
  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  },

  /**
   * 更新用户基本信息
   */
  async update(
    id: string,
    patch: { displayName?: string; bio?: string; avatarUrl?: string },
  ): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    }
    return updated;
  },

  /**
   * 修改密码（需验证旧密码）
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw AppError.notFound(ErrorCode.USER_NOT_FOUND, 'User not found');
    }

    const valid = await this.validatePassword(user, oldPassword);
    if (!valid) {
      throw AppError.unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Incorrect current password');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  /**
   * 返回用户公开信息（去除敏感字段）
   */
  toPublicProfile(user: User) {
    return {
      username: user.username,
      displayName: user.displayName ?? user.username,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  },

  /**
   * 返回用户私有信息（含 email 等，但去除密码哈希）
   */
  toPrivateProfile(user: User) {
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  },
};
