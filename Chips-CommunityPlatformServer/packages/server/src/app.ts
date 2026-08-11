import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { env } from './config/env';
import errorHandlerPlugin from './plugins/error-handler.plugin';
import authenticatePlugin from './plugins/authenticate.plugin';
import healthRoute from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import roomRoutes from './routes/rooms';
import spaceRoutes from './routes/space';
import uploadRoutes from './routes/upload';
import cardTransferRoutes from './routes/card-transfer';
import cardRoutes from './routes/cards';
import boxRoutes from './routes/boxes';
import discoverRoutes from './routes/discover';
import adminRoutes from './routes/admin';
import hostRuntimeRoutes from './routes/host-runtime';

export async function buildApp() {
  const fastify = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss' },
            },
          }
        : true,
    trustProxy: true,
    pluginTimeout: 60000,
  });

  // ─── 核心插件 ───────────────────────────────────────────────────

  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // CSP 由 Nginx 层控制
    // 社区 API 的图片/资源会被 Host 窗口与网页以 <img>/<iframe> 跨源引用（卡片封面、渲染产物等），需允许跨源
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  const extraOrigins = env.CORS_EXTRA_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const isAllowedCorsOrigin = (origin: string): boolean =>
    isClientCorsOriginAllowed(origin, extraOrigins);

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // 生产模式：允许 BASE_URL 同源、薯片 Host 客户端来源与 CORS_EXTRA_ORIGINS 白名单
      // 开发模式：允许 localhost 任意端口
      if (env.NODE_ENV === 'development') {
        cb(null, true);
        return;
      }
      if (!origin || origin === env.BASE_URL || isAllowedCorsOrigin(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  });

  await fastify.register(fastifyCookie, {
    secret: env.JWT_SECRET, // 用于签名 cookie
    parseOptions: {},
  });

  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: env.MAX_BOX_SIZE_MB * 1024 * 1024,
    },
    attachFieldsToBody: false,
  });

  // ─── API 文档 ───────────────────────────────────────────────────

  if (env.ENABLE_SWAGGER) {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: '薯片社区平台 API',
          description: 'Chips Community Platform Server REST API',
          version: '1.0.0',
        },
        servers: [{ url: env.BASE_URL }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: { docExpansion: 'list' },
    });
  }

  // ─── 业务插件 ───────────────────────────────────────────────────

  await errorHandlerPlugin(fastify, {});
  await authenticatePlugin(fastify, {});

  // ─── 路由 ───────────────────────────────────────────────────────

  await fastify.register(healthRoute);
  await fastify.register(authRoutes);
  await fastify.register(userRoutes);
  await fastify.register(roomRoutes);
  await fastify.register(spaceRoutes);
  await fastify.register(uploadRoutes);
  await fastify.register(cardTransferRoutes);
  await fastify.register(cardRoutes);
  await fastify.register(boxRoutes);
  await fastify.register(discoverRoutes);
  await fastify.register(hostRuntimeRoutes);
  await fastify.register(adminRoutes, { prefix: '/admin' });

  // ─── 生命周期 ───────────────────────────────────────────────────

  fastify.addHook('onReady', async () => {
    const { hostIntegration } = await import('./services/host-integration.js');
    await hostIntegration.init();
  });

  fastify.addHook('onClose', async () => {
    const { hostIntegration } = await import('./services/host-integration.js');
    await hostIntegration.stop();
  });

  return fastify;
}

/**
 * 判断客户端来源 Origin 是否允许访问社区 API。
 * - `chips-render:` 前缀：薯片 Host 渲染进程加载的插件页面来源；
 * - `null`：file:// 协议页面加载的客户端来源；
 * - 显式配置在 `CORS_EXTRA_ORIGINS` 白名单中的来源。
 */
export function isClientCorsOriginAllowed(
  origin: string,
  extraOrigins: string[] = [],
): boolean {
  if (origin.startsWith('chips-render:')) {
    return true;
  }
  if (origin === 'null') {
    return true;
  }
  return extraOrigins.includes(origin);
}
