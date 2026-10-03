import { z } from 'zod';
import { loadEnvFile } from './env-file.js';

/**
 * 环境变量 schema 校验与加载（《社区平台设计》§2.2 config/ 职责；校验失败拒绝启动）。
 *
 * 键名权威：
 * - 共享与产品专属 canonical 键（《服务端部署与运维》§6.2）：NODE_ENV / BASE_URL / PORT / HOST /
 *   DATABASE_URL / JWT_SECRET / JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN /
 *   ADMIN_USERNAME / ADMIN_PASSWORD / ENABLE_SWAGGER；
 * - CORS 来源白名单：契约 §9.2 的 `CORS_ALLOWED_ORIGINS`（开发调试显式白名单）与部署
 *   §6.2 的 `CORS_EXTRA_ORIGINS`（追加来源）并集生效，两者均不做通配放行（§9.2 禁止 `*`）；
 * - 本臂新增的运行策略键（限流/锁定/幂等保留/渲染入口回退），部署工件臂落 `.env.example`
 *   时须一并登记（见开发日志「新增部署配置键」节）。
 */

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

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  BASE_URL: z.url('BASE_URL 必须是合法 URL'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 字符'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  CORS_ALLOWED_ORIGINS: commaList,
  CORS_EXTRA_ORIGINS: commaList,

  ENABLE_SWAGGER: BooleanFromEnv.default(true),

  // 账号锁定策略（契约 §3.2：阈值与时长由服务端配置）
  AUTH_LOCK_THRESHOLD: z.coerce.number().int().min(1).default(5),
  AUTH_LOCK_DURATION_SECONDS: z.coerce.number().int().min(1).default(900),

  // 口令策略（契约 §3.2：长度由服务端策略配置）
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(8),

  // 限流档位（契约 §6.3：认证类与传输控制面比浏览接口更严格；阈值由服务端配置）
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_BROWSE_MAX: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
  RATE_LIMIT_TRANSFER_MAX: z.coerce.number().int().min(1).default(30),

  // 幂等记录保留（契约 §6.2：不得低于上传会话有效期；上传会话默认 60 分钟）
  IDEMPOTENCY_RECORD_TTL_MINUTES: z.coerce.number().int().min(60).default(1440),

  // 查看入口处理中的 Retry-After（秒）
  RENDER_RETRY_AFTER_SECONDS: z.coerce.number().int().min(1).default(3),

  // 封面入口失败回退的默认封面（契约 §6.4：失败回退默认封面）
  DEFAULT_COVER_URL: z.string().optional(),

  // 首次启动管理员初始化（《社区平台设计》§8.3.4；初始化完成后从环境移除或轮换）
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** 服务端运行配置（由 env 装配；测试直接构造，不经环境变量）。 */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  baseUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  /** 并集去重后的 CORS 允许来源（不含通配；生产仅 BASE_URL 同源 + 显式白名单）。 */
  corsAllowedOrigins: string[];
  enableSwagger: boolean;
  lockThreshold: number;
  lockDurationSeconds: number;
  passwordMinLength: number;
  rateLimitWindowSeconds: number;
  rateLimitBrowseMax: number;
  rateLimitAuthMax: number;
  rateLimitTransferMax: number;
  idempotencyRecordTtlMinutes: number;
  renderRetryAfterSeconds: number;
  defaultCoverUrl: string;
  adminBootstrap: { username: string; password: string } | null;
}

function buildDefaultCoverUrl(baseUrl: string, explicit: string | undefined): string {
  if (explicit !== undefined && explicit.length > 0) {
    return explicit;
  }
  return new URL('default-cover.svg', baseUrl).toString();
}

export function toAppConfig(env: Env): AppConfig {
  const corsAllowedOrigins = [...new Set([...env.CORS_ALLOWED_ORIGINS, ...env.CORS_EXTRA_ORIGINS])];
  const adminBootstrap =
    env.ADMIN_USERNAME !== undefined && env.ADMIN_PASSWORD !== undefined
      ? { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }
      : null;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    baseUrl: env.BASE_URL,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    corsAllowedOrigins,
    enableSwagger: env.ENABLE_SWAGGER,
    lockThreshold: env.AUTH_LOCK_THRESHOLD,
    lockDurationSeconds: env.AUTH_LOCK_DURATION_SECONDS,
    passwordMinLength: env.PASSWORD_MIN_LENGTH,
    rateLimitWindowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    rateLimitBrowseMax: env.RATE_LIMIT_BROWSE_MAX,
    rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
    rateLimitTransferMax: env.RATE_LIMIT_TRANSFER_MAX,
    idempotencyRecordTtlMinutes: env.IDEMPOTENCY_RECORD_TTL_MINUTES,
    renderRetryAfterSeconds: env.RENDER_RETRY_AFTER_SECONDS,
    defaultCoverUrl: buildDefaultCoverUrl(env.BASE_URL, env.DEFAULT_COVER_URL),
    adminBootstrap,
  };
}

function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败，拒绝启动：${issues}`);
  }
  return result.data;
}

/** 读取环境并装配运行配置（校验失败抛错，进程拒绝启动）。 */
export function loadAppConfig(): AppConfig {
  loadEnvFile();
  return toAppConfig(loadEnv());
}
