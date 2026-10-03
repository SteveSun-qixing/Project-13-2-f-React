import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { PersonalErrorCode, isRegisteredErrorCode } from '../errors/codes.js';

/**
 * 统一错误归一（契约 §2.2 信封、§7.2 错误码登记表、§7.4 处理规则）：
 * 信封四字段 code/message/details/retryable；message 一律简体中文、面向用户，
 * 不携带堆栈、对象键以外的内部标识、真实路径与存储地址；
 * details.traceId 为服务端日志关联标识；未归一异常统一转换为 INTERNAL_ERROR。
 */

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
}

function envelope(
  code: string,
  message: string,
  traceId: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  const registeredRetryable = isRegisteredErrorCode(code)
    ? PersonalErrorCode[code].retryable
    : false;
  return {
    error: {
      code,
      message,
      details: { ...(details ?? {}), traceId },
      retryable: registeredRetryable,
    },
  };
}

function flattenZod(error: ZodError): Record<string, unknown> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    const bucket = fieldErrors[key] ?? [];
    bucket.push(issue.message);
    fieldErrors[key] = bucket;
  }
  return { fieldErrors };
}

export function errorHandlerPlugin(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, request, reply) => {
    const traceId = request.id;

    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(envelope(error.code, error.message, traceId, error.details));
    }

    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send(envelope('VALIDATION_ERROR', '请求参数或请求体不合法', traceId, flattenZod(error)));
    }

    // Fastify 内建传输层错误归一（JSON 解析、媒体类型、体积上限）。
    const fastifyCode = (error as { code?: string }).code;
    if (
      fastifyCode === 'FST_ERR_CTP_EMPTY_JSON_BODY' ||
      fastifyCode === 'FST_ERR_CTP_INVALID_JSON'
    ) {
      return reply.status(400).send(envelope('VALIDATION_ERROR', '请求体不是合法 JSON', traceId));
    }
    if (fastifyCode === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || error.statusCode === 415) {
      return reply.status(415).send(envelope('FILE_TYPE_INVALID', '不支持的媒体类型', traceId));
    }
    if (error.statusCode === 413 || fastifyCode === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send(envelope('FILE_TOO_LARGE', '请求体超过大小上限', traceId));
    }

    // 未归一异常：内部细节只进日志，响应一律 INTERNAL_ERROR（契约 §7.4）。
    request.log.error({ err: error }, '未归一服务端异常');
    return reply.status(500).send(envelope('INTERNAL_ERROR', '服务端内部错误', traceId));
  });

  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(
      envelope('NOT_FOUND', '请求的资源不存在', request.id, {
        method: request.method,
      })
    );
  });
}
