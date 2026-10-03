/**
 * 认证域 API（《社区平台 API 契约》§3.2/§3.4）：注册、登录、登出。
 * 会话建立后 `accessToken` 仅写入客户端内存；浏览器刷新令牌由服务端 `HttpOnly` Cookie 承载。
 */

import type { CommunityApiClient } from './client';
import { parseAuthSession } from './dto';
import type { ICommunityAuthSession } from './types';

export interface CommunityRegisterInput {
  /** 全小写字母、数字与连字符，3–32 字符，全站唯一（契约 §3.2）。 */
  username: string;
  email: string;
  password: string;
  /** 可缺省，缺省取 `username`。 */
  displayName?: string;
}

export interface CommunityLoginInput {
  /** 接受邮箱或用户名（契约 §3.2）。 */
  identifier: string;
  password: string;
}

export class CommunityAuthApi {
  private readonly client: CommunityApiClient;

  constructor(client: CommunityApiClient) {
    this.client = client;
  }

  /** 注册并直接建立会话（`POST /auth/register`，201）。 */
  async register(input: CommunityRegisterInput): Promise<ICommunityAuthSession> {
    const payload: Record<string, string> = {
      username: input.username,
      email: input.email,
      password: input.password,
    };
    if (input.displayName !== undefined) {
      payload.displayName = input.displayName;
    }
    const session = parseAuthSession(
      await this.client.request<ICommunityAuthSession>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    this.client.setAccessToken(session.accessToken);
    return session;
  }

  /** 登录建立会话（`POST /auth/login`，200）。 */
  async login(input: CommunityLoginInput): Promise<ICommunityAuthSession> {
    const session = parseAuthSession(
      await this.client.request<ICommunityAuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: input.identifier, password: input.password }),
      })
    );
    this.client.setAccessToken(session.accessToken);
    return session;
  }

  /** 登出（`POST /auth/logout`，幂等 204）；本地令牌随之清空。 */
  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
    this.client.clearAccessToken();
  }
}
