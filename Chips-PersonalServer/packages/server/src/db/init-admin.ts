import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema/users';
import { env } from '../config/env';

/**
 * 服务启动时检查并创建管理员账号
 * 仅当 ADMIN_USERNAME 和 ADMIN_PASSWORD 均已配置时执行
 * 若管理员账号已存在，则跳过（不覆盖密码）
 */
export async function initAdminAccount(): Promise<void> {
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return; // 未配置则跳过
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.usernameLower, ADMIN_USERNAME.toLowerCase()),
  });

  if (existing) {
    return; // 已存在，跳过
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await db.insert(users).values({
    username: ADMIN_USERNAME,
    usernameLower: ADMIN_USERNAME.toLowerCase(),
    passwordHash,
    displayName: ADMIN_USERNAME,
    role: 'admin',
    isActive: true,
  });

  console.info(`Admin account created: ${ADMIN_USERNAME}`);
}
