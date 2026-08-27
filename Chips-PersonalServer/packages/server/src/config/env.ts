import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 优先加载 deploy/.env，允许通过环境变量覆盖
dotenv.config({ path: path.resolve(__dirname, '../../../../deploy/.env') });

const BooleanFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean());

const EnvSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.string().url('BASE_URL must be a valid URL'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // S3 / MinIO
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL'),
  S3_PUBLIC_URL: z.string().url('S3_PUBLIC_URL must be a valid URL').optional(),
  S3_BUCKET_NAME: z.string().min(1, 'S3_BUCKET_NAME must not be empty').optional(),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: BooleanFromEnv.default(true),

  // 管理令牌：个人服务器的写接口（上传/删除/更新）都要求携带该令牌
  API_TOKEN: z.string().min(16, 'API_TOKEN must be at least 16 characters'),

  // Upload limits
  MAX_CARD_SIZE_MB: z.coerce.number().int().positive().default(500),
  MAX_BOX_SIZE_MB: z.coerce.number().int().positive().default(100),
  UPLOAD_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(60),

  // Swagger UI (可在生产环境关闭)
  ENABLE_SWAGGER: BooleanFromEnv.default(true),

  // CORS 额外允许的 Origin（逗号分隔，生产模式下生效，用于桌面客户端等非浏览器来源）
  CORS_EXTRA_ORIGINS: z.string().default(''),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env: Env = loadEnv();
