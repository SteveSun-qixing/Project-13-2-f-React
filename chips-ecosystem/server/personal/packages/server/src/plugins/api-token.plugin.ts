import type { FastifyInstance, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/AppError.js';

/**
 * API_TOKEN 管理令牌校验插件（《15》§5.2、契约 §三）。
 *
 * 个人服务器没有多用户与账号体系：管理读（cards/manage）、写操作与传输控制面
 * 通过 `Authorization: Bearer <API_TOKEN>` 保护。校验使用常量时间比较（先比较
 * 长度再 timingSafeEqual）防止时序侧信道；缺失、格式错误与不匹配统一返回
 * 401 API_TOKEN_INVALID，不区分原因、不泄露校验细节、不锁定来源（契约 §3.2）。
 */
export function isApiTokenValid(expectedToken: string, authorization: unknown): boolean {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return false;
  }
  const provided = authorization.slice('Bearer '.length).trim();
  if (provided.length === 0) {
    return false;
  }
  const expected = Buffer.from(expectedToken, 'utf-8');
  const actual = Buffer.from(provided, 'utf-8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface ApiTokenPluginOptions {
  /** 部署环境变量 API_TOKEN（§5.2.1：由部署环境提供，长度至少 16 字符）。 */
  apiToken: string;
}

export function apiTokenPlugin(fastify: FastifyInstance, options: ApiTokenPluginOptions): void {
  // 同步纯校验走回调式钩子（arity 3）；done(err) 直接进入统一错误归一。
  fastify.decorate(
    'requireApiToken',
    () =>
      (request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void => {
        const authorization = request.headers.authorization;
        if (!isApiTokenValid(options.apiToken, authorization)) {
          done(AppError.unauthorized('API_TOKEN_INVALID', '管理令牌缺失、格式错误或不匹配'));
          return;
        }
        done();
      }
  );
}
