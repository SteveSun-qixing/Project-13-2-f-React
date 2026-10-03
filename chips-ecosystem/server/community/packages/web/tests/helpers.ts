import { expect, vi } from 'vitest';

import { CommunityApiClient } from '../src/api/client';

/** 测试夹具：契约固定的会话用户字段（《11 契约》§3.2 示例口径）。 */
export const SESSION_USER = {
  id: '0b6f9c2e-6d5a-4a2f-9c1e-2f3a4b5c6d7e',
  username: 'alice',
  displayName: 'Alice',
  bio: null,
  avatarUrl: null,
  role: 'user',
  createdAt: '2026-09-19T08:00:00.000Z',
} as const;

export function jsonResponse(status: number, body: unknown): Response {
  const init: ResponseInit = { status };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json; charset=utf-8' };
  }
  return new Response(body === undefined ? null : JSON.stringify(body), init);
}

export function loginSuccessBody(
  accessToken = 'access-token-a',
  refreshToken = 'refresh-token-a'
): unknown {
  return {
    data: {
      user: { ...SESSION_USER },
      accessToken,
      refreshToken,
    },
  };
}

export function meSuccessBody(): unknown {
  return {
    data: {
      id: SESSION_USER.id,
      username: 'alice',
      displayName: 'Alice',
      bio: null,
      avatarUrl: null,
      createdAt: '2026-09-19T08:00:00.000Z',
      email: 'alice@example.com',
      role: 'user',
      updatedAt: '2026-09-20T08:00:00.000Z',
    },
  };
}

export type FetchCall = { url: string; init: RequestInit };
export type QueuedReply = Response | Error;

export interface ClientMock {
  client: CommunityApiClient;
  calls: FetchCall[];
  enqueue: (reply: QueuedReply) => void;
}

/** 从 fetch 入参提取请求地址（避免对 Request 做 `[object Object]` 字符串化）。 */
export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

/** 构造注入 mock fetch 的客户端：响应/异常按入队顺序消费。 */
export function createClient(): ClientMock {
  const calls: FetchCall[] = [];
  const queue: QueuedReply[] = [];
  const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: requestUrl(input), init: init ?? {} });
    const next = queue.shift();
    if (!next) {
      return Promise.reject(new Error('fetch mock 队列为空'));
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  });
  return {
    client: new CommunityApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    calls,
    enqueue: (reply) => queue.push(reply),
  };
}

export function lastCall(calls: FetchCall[]): FetchCall {
  const call = calls.at(-1);
  if (!call) {
    throw new Error('没有已记录的请求');
  }
  return call;
}

export function parseJsonBody(init: RequestInit): Record<string, unknown> {
  expect(typeof init.body).toBe('string');
  return JSON.parse(init.body as string) as Record<string, unknown>;
}
