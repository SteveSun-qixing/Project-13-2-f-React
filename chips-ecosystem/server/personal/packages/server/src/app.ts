import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { AppConfig } from './config/env.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { apiTokenPlugin } from './plugins/api-token.plugin.js';
import type { Repositories } from './repositories/types.js';
import { CardService } from './services/card.service.js';
import { BoxService } from './services/box.service.js';
import { healthRoute } from './routes/health.js';
import { cardRoutes } from './routes/cards.js';
import { boxRoutes } from './routes/boxes.js';

/**
 * Fastify 组装（《个人服务器设计》§2.2 app.ts）：Helmet、CORS、Swagger（可关）、
 * 错误处理、API_TOKEN 令牌插件与内容只读路由组。
 * 依赖经 ServerDeps 注入：测试以内存仓库与固定配置装配（真实 PG/S3 不进测试）。
 *
 * 路由组按《12 契约》§4.1 排序：health → cards → boxes；
 * card-transfer 控制面、受控代理与写域路由归后续臂（见包 README 臂序登记）。
 */

export interface ServerDeps {
  config: AppConfig;
  repositories: Repositories;
  version: string;
}

export async function buildApp(deps: ServerDeps): Promise<FastifyInstance> {
  const { config, repositories } = deps;

  const fastify = Fastify({
    logger: config.nodeEnv === 'test' ? false : true,
    trustProxy: true,
    pluginTimeout: 60_000,
    // details.traceId（契约 §2.2）：服务端日志关联标识。
    genReqId: () => randomUUID(),
  });

  // ─── 核心插件 ───────────────────────────────────────────────────

  await fastify.register(fastifyHelmet, {
    // CSP 由 Nginx 层控制（《个人服务器设计》§5.4.3；部署权威《08》§三）。
    contentSecurityPolicy: false,
    // 卡片封面与渲染产物会被 Host 窗口与网页以 <img>/<iframe> 跨源引用（§5.4.2）。
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await fastify.register(fastifyCors, {
    // 契约 §3.6：开发模式放行全部来源；生产放行 BASE_URL 同源、chips-render: 前缀、
    // file:// 产生的 null 来源与 CORS_EXTRA_ORIGINS 白名单。允许携带凭据。
    origin: (origin, cb) => {
      if (config.nodeEnv === 'development') {
        cb(null, true);
        return;
      }
      if (
        origin === undefined ||
        origin === config.baseUrl ||
        isClientCorsOriginAllowed(origin, config.corsExtraOrigins)
      ) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ─── API 文档（生产建议关闭，§5.2.5）────────────────────────────

  if (config.enableSwagger) {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: '薯片个人服务器 API',
          description: '薯片个人服务器控制面（契约见《个人服务器 API 契约》）',
          version: deps.version,
        },
        servers: [{ url: config.baseUrl }],
      },
    });
    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: { docExpansion: 'list' },
    });
  }

  // ─── 中间件与业务装配 ───────────────────────────────────────────

  errorHandlerPlugin(fastify);
  apiTokenPlugin(fastify, { apiToken: config.apiToken });

  const cardService = new CardService({ cardRepository: repositories.cards });
  const boxService = new BoxService({
    boxRepository: repositories.boxes,
    cardRepository: repositories.cards,
  });

  // ─── 路由 ───────────────────────────────────────────────────────

  healthRoute(fastify, { version: deps.version });
  cardRoutes(fastify, { cardService });
  boxRoutes(fastify, { boxService });

  return fastify;
}

/**
 * 判断客户端来源 Origin 是否允许访问个人服务器 API（§5.4、契约 §3.6）。
 * - `chips-render:` 前缀：薯片 Host 渲染进程加载的插件页面来源；
 * - `null`：file:// 协议页面加载的客户端来源；
 * - 显式配置在 CORS_EXTRA_ORIGINS 白名单中的来源。
 */
export function isClientCorsOriginAllowed(origin: string, extraOrigins: string[]): boolean {
  if (origin.startsWith('chips-render:')) {
    return true;
  }
  if (origin === 'null') {
    return true;
  }
  return extraOrigins.includes(origin);
}
