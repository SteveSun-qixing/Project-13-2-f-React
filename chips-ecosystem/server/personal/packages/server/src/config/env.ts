import { z } from 'zod';
import { loadEnvFile } from './env-file.js';

/**
 * 环境变量 schema 校验与加载（《个人服务器设计》§2.2 config/ 职责；校验失败拒绝启动）。
 *
 * 键名口径（后续臂追加键时在本文件扩展 schema 并同步部署工件臂登记）：
 * - 本臂（内容只读域 + API_TOKEN 鉴权 + 错误归一）：NODE_ENV / PORT / HOST / BASE_URL /
 *   DATABASE_URL / API_TOKEN / ENABLE_SWAGGER / CORS_EXTRA_ORIGINS；
 * - 对象存储臂追加：S3_ENDPOINT / S3_PUBLIC_URL / S3_BUCKET_NAME / S3_ACCESS_KEY /
 *   S3_SECRET_KEY / S3_REGION / S3_FORCE_PATH_STYLE（《15》§六）；
 * - 传输控制面臂追加：MAX_CARD_SIZE_MB / MAX_BOX_SIZE_MB / UPLOAD_SESSION_TTL_MINUTES
 *   （契约 §6.4）。
 *
 * CORS 来源（《15》§5.4、契约 §3.6）：开发模式放行全部来源；生产模式放行 BASE_URL 同源、
 * `chips-render:` 前缀、`file://` 产生的 `null` 来源与 CORS_EXTRA_ORIGINS 显式白名单。
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

  /** 管理令牌（§5.2）：保护全部写接口与传输控制面的唯一凭证，长度至少 16 字符。 */
  API_TOKEN: z.string().min(16, 'API_TOKEN 至少 16 字符'),

  ENABLE_SWAGGER: BooleanFromEnv.default(true),

  CORS_EXTRA_ORIGINS: commaList,
});

export type AppConfig = {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  host: string;
  baseUrl: string;
  databaseUrl: string;
  apiToken: string;
  enableSwagger: boolean;
  corsExtraOrigins: string[];
};

/**
 * 解析并校验环境变量（默认读 process.env；校验失败抛错，由进程入口统一拒绝启动）。
 * 首次调用显式加载 deploy/.env（只补齐进程环境缺失键；测试环境不加载）。
 * 测试直接构造 AppConfig 字面量，不经过本函数（真实凭据零入库）。
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadEnvFile();
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`环境变量校验失败，拒绝启动：${summary}`);
  }
  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    host: result.data.HOST,
    baseUrl: result.data.BASE_URL,
    databaseUrl: result.data.DATABASE_URL,
    apiToken: result.data.API_TOKEN,
    enableSwagger: result.data.ENABLE_SWAGGER,
    corsExtraOrigins: result.data.CORS_EXTRA_ORIGINS,
  };
}
