import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { AppConfig } from './config/env.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { conditionalGetPlugin } from './plugins/conditional-get.plugin.js';
import { requestIdPlugin } from './plugins/request-id.plugin.js';
import { authenticatePlugin } from './plugins/authenticate.plugin.js';
import {
  InMemoryRateLimitStore,
  rateLimitPlugin,
  type RateLimitStore,
} from './plugins/rate-limit.plugin.js';
import { idempotencyPlugin } from './plugins/idempotency.plugin.js';
import { buildAuthSchemas } from './schemas/auth.schemas.js';
import { AuthService, type TokenSigner } from './services/auth.service.js';
import { UserService } from './services/user.service.js';
import { CardService } from './services/card.service.js';
import { BoxService } from './services/box.service.js';
import { RoomService } from './services/room.service.js';
import type { Repositories } from './repositories/types.js';
import { HealthRegistry, healthRoute, type ComponentChecker } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { cardRoutes } from './routes/cards.js';
import { boxRoutes } from './routes/boxes.js';
import { roomRoutes } from './routes/rooms.js';
import { discoverRoutes } from './routes/discover.js';
import { generateRequestId, isValidRequestId } from './lib/http-tokens.js';
import type { AuthTokenPayload } from './types/fastify.js';

/**
 * Fastify 组装（《社区平台设计》§2.2 app.ts）：Helmet、CORS、JWT、Cookie、Swagger（可关）、
 * 错误处理、认证插件、限流/幂等/条件请求中间件与全部路由。
 * 依赖经 ServerDeps 注入：测试以内存仓库与固定配置装配（真实 PG 不进测试）。
 */

export interface ServerDeps {
  config: AppConfig;
  repositories: Repositories;
  healthRegistry: HealthRegistry;
  version: string;
  /** 数据库健康检查器（server 入口注入真实 pool 探测；测试可省略）。 */
  databaseChecker?: ComponentChecker;
  rateLimitStore?: RateLimitStore;
}

export async function buildApp(deps: ServerDeps): Promise<FastifyInstance> {
  const { config, repositories } = deps;

  const fastify = Fastify({
    logger: config.nodeEnv === 'test' ? false : true,
    trustProxy: true,
    pluginTimeout: 60_000,
    // X-Request-Id（契约 §2.4）：合法则原样采用，否则服务端生成。
    genReqId: (request) => {
      const raw = request.headers['x-request-id'];
      return typeof raw === 'string' && isValidRequestId(raw) ? raw : generateRequestId();
    },
  });

  if (deps.databaseChecker !== undefined) {
    deps.healthRegistry.register('database', deps.databaseChecker);
  }

  // ─── 核心插件 ───────────────────────────────────────────────────

  await fastify.register(fastifyHelmet, {
    // CSP 与安全响应头由 Nginx 层控制（《社区平台设计》§7.4；部署权威《08》§三）。
    contentSecurityPolicy: false,
    // 卡片封面与渲染产物会被网页/客户端以 <img>/<iframe> 跨源引用。
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await fastify.register(fastifyCors, {
    // 契约 §9.2：禁止通配；同源（无 Origin 头）放行，跨源仅 BASE_URL 与显式白名单。
    origin: (origin, cb) => {
      if (
        origin === undefined ||
        origin === config.baseUrl ||
        config.corsAllowedOrigins.includes(origin)
      ) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
  });

  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { algorithm: 'HS256' },
  });

  await fastify.register(fastifyCookie, {
    parseOptions: {},
  });

  if (config.enableSwagger) {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: '薯片社区平台 API',
          description: '薯片社区平台服务器控制面（契约见《社区平台 API 契约》）',
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

  await errorHandlerPlugin(fastify);
  await requestIdPlugin(fastify);
  await conditionalGetPlugin(fastify);

  const tokenSigner: TokenSigner = {
    sign: (payload: AuthTokenPayload, expiresIn: string) =>
      fastify.jwt.sign(payload, { expiresIn }),
    verify: (token: string) => fastify.jwt.verify<AuthTokenPayload>(token),
  };

  const userService = new UserService({ repositories });
  const authService = new AuthService({
    signer: tokenSigner,
    config,
    repositories,
    now: () => new Date(),
  });
  const cardService = new CardService({ userService, config });
  const boxService = new BoxService({ userService });
  const roomService = new RoomService({ repositories });

  await authenticatePlugin(fastify, { authService, userService });
  await rateLimitPlugin(fastify, {
    config,
    store: deps.rateLimitStore ?? new InMemoryRateLimitStore(),
  });
  await idempotencyPlugin(fastify, { config });
  fastify.decorate('repositories', repositories);

  // ─── 路由 ───────────────────────────────────────────────────────

  await healthRoute(fastify, {
    registry: deps.healthRegistry,
    version: deps.version,
    apiVersion: 'v1',
  });
  await authRoutes(fastify, {
    config,
    schemas: buildAuthSchemas(config.passwordMinLength),
    authService,
    userService,
  });
  await userRoutes(fastify, {
    schemas: buildAuthSchemas(config.passwordMinLength),
    userService,
    cardService,
    boxService,
    roomService,
    repositories,
  });
  await cardRoutes(fastify, { repositories, cardService, userService });
  await boxRoutes(fastify, { repositories, boxService, userService });
  await roomRoutes(fastify, { repositories, roomService, cardService, boxService });
  await discoverRoutes(fastify, { repositories, cardService, boxService, userService });

  return fastify;
}
