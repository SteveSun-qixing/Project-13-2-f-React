import { z } from 'zod';

/** 用户名格式（3-32位，字母数字下划线连字符） */
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, or hyphens',
  );

/** 密码（最少8位，无最大限制） */
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const RegisterSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  bio: z.string().max(200).optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
