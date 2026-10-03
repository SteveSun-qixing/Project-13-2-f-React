import type { AppConfig } from '../config/env.js';
import type { Repositories } from '../repositories/types.js';

/**
 * 首次启动管理员初始化（《社区平台设计》§8.3.4）：由环境变量 ADMIN_USERNAME /
 * ADMIN_PASSWORD 装配（config.adminBootstrap）；账号已存在时为无操作；
 * 初始化完成后部署侧必须从环境移除或轮换口令（部署权威《08》§6.2）。
 * 管理员账号的邮箱以 `<username>@admin.internal` 占位（仅内部标识，不对外公开；
 * 公开 DTO 不返回 email）。口令哈希与普通账号同链路（scrypt），真值不入库不入 Git。
 */

const USERNAME_PATTERN = /^[a-z0-9-]{3,32}$/;

export async function ensureInitialAdmin(deps: {
  config: Pick<AppConfig, 'adminBootstrap' | 'passwordMinLength'>;
  repositories: Repositories;
  hashPassword: (password: string) => Promise<string>;
}): Promise<void> {
  const bootstrap = deps.config.adminBootstrap;
  if (bootstrap === null) {
    return;
  }
  const usernameLower = bootstrap.username.toLowerCase();
  if (!USERNAME_PATTERN.test(usernameLower)) {
    throw new Error('ADMIN_USERNAME 必须为全小写字母、数字与连字符，长度 3 到 32 个字符');
  }
  if (bootstrap.password.length < deps.config.passwordMinLength) {
    throw new Error(`ADMIN_PASSWORD 长度至少 ${deps.config.passwordMinLength} 个字符`);
  }
  const existing = await deps.repositories.users.findByUsernameLower(usernameLower);
  if (existing !== null) {
    return;
  }
  await deps.repositories.users.create({
    username: usernameLower,
    usernameLower,
    email: `${usernameLower}@admin.internal`,
    passwordHash: await deps.hashPassword(bootstrap.password),
    displayName: usernameLower,
    bio: null,
    avatarUrl: null,
    role: 'admin',
  });
}
