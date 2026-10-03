import { z } from 'zod';

/**
 * 请求校验 schema（schemas/ 职责，契约字段逐字对齐）。
 * 文案面向用户（简体中文）；错误经 error-handler 归一为 COMMUNITY_VALIDATION_ERROR 信封。
 */

const usernameSchema = z
  .string()
  .regex(/^[a-z0-9-]{3,32}$/, '用户名只能包含小写字母、数字与连字符，长度 3 到 32 个字符');

const passwordSchema = (minLength: number): z.ZodString =>
  z.string().min(minLength, `口令长度至少 ${minLength} 个字符`).max(128, '口令长度至多 128 个字符');

export interface AuthSchemas {
  register: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
  }>;
  login: z.ZodObject<{ identifier: z.ZodString; password: z.ZodString }>;
  refresh: z.ZodOptional<z.ZodObject<{ refreshToken: z.ZodOptional<z.ZodString> }>>;
  updateProfile: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  }>;
  changePassword: z.ZodObject<{ currentPassword: z.ZodString; newPassword: z.ZodString }>;
}

export function buildAuthSchemas(minPasswordLength: number): AuthSchemas {
  const password = passwordSchema(minPasswordLength);
  return {
    // 契约 §3.2：username 全小写字母数字连字符 3–32；displayName 可缺省，缺省取 username。
    register: z.object({
      username: usernameSchema,
      email: z.string().max(254, '邮箱过长').email('邮箱格式不合法'),
      password,
      displayName: z.string().min(1, '昵称不能为空').max(100, '昵称过长').optional(),
    }),
    // 契约 §3.2：identifier 接受邮箱或用户名。
    login: z.object({
      identifier: z.string().min(1, '请输入用户名或邮箱').max(254, '登录标识过长'),
      password: z.string().min(1, '请输入口令').max(128, '口令过长'),
    }),
    // 契约 §3.3：非浏览器客户端经请求体提交 refreshToken；请求体字段类型错误返回 400。
    refresh: z
      .object({
        refreshToken: z.string().min(1, 'refreshToken 不能为空').optional(),
      })
      .optional(),
    // 契约 §4.3：PATCH /users/me 只允许修改 displayName 与 bio。
    updateProfile: z.object({
      displayName: z.string().min(1, '昵称不能为空').max(100, '昵称过长').optional(),
      bio: z.string().max(200, '简介过长').nullable().optional(),
    }),
    // 契约 §4.3：PUT /users/me/password。
    changePassword: z.object({
      currentPassword: z.string().min(1, '请输入当前口令').max(128, '口令过长'),
      newPassword: passwordSchema(minPasswordLength),
    }),
  };
}
