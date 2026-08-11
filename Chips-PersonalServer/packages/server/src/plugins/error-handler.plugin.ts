import type { FastifyPluginAsync } from 'fastify';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { ZodError } from 'zod';

/**
 * 统一错误处理插件
 * 将 AppError、ZodError 和未知错误转化为标准 JSON 响应
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, _request, reply) => {
    // AppError（业务错误）
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    // ZodError（请求体校验失败，由路由 schema 校验之外的 zod.parse 触发）
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          details: error.flatten(),
        },
      });
    }

    // Fastify 自身的校验错误（JSON schema 校验）
    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          details: error.validation,
        },
      });
    }

    // Multipart 文件过大 或 空 JSON Body
    if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413 || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
      return reply.status(error.statusCode || 400).send({
        error: {
          code: error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' ? ErrorCode.VALIDATION_ERROR : ErrorCode.FILE_TOO_LARGE,
          message: error.message,
        },
      });
    }

    // 不支持的内容类型（如向 JSON 控制面发送 octet-stream 卡字节）
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || error.statusCode === 415) {
      return reply.status(415).send({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Unsupported media type',
        },
      });
    }

    // JWT 错误
    if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID' ||
        error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      return reply.status(401).send({
        error: {
          code: ErrorCode.AUTH_TOKEN_INVALID,
          message: 'Invalid or expired authentication token',
        },
      });
    }

    // 未知错误 - 记录并返回 500
    fastify.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    });
  });

  // 404 处理
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: {
        code: ErrorCode.NOT_FOUND,
        message: 'The requested resource was not found',
      },
    });
  });
};

export default errorHandlerPlugin;
