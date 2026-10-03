import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

/**
 * Fastify 类型扩展：API_TOKEN 鉴权 preHandler。
 * 个人服务器没有账号体系（《15》§5.1）：requireApiToken 由 api-token 插件装配，
 * 供管理读（cards/manage）与写域路由（PATCH/DELETE，内容写域臂接入）复用。
 */

declare module 'fastify' {
  interface FastifyInstance {
    /** 构造管理令牌校验 preHandler（回调式钩子；校验失败统一 401 API_TOKEN_INVALID）。 */
    requireApiToken: () => (
      request: FastifyRequest,
      reply: FastifyReply,
      done: HookHandlerDoneFunction
    ) => void;
  }
}
