/**
 * 用户域 API（《社区平台 API 契约》§4.3）：当前用户读取与会话用户口径收敛。
 */

import type { CommunityApiClient } from './client';
import { parseUserMe } from './dto';
import type { ICommunityUserMe, ICommunityUserSession } from './types';

export class CommunityUsersApi {
  private readonly client: CommunityApiClient;

  constructor(client: CommunityApiClient) {
    this.client = client;
  }

  /** 当前用户资料（`GET /users/me`，认证必须）。 */
  async getMe(): Promise<ICommunityUserMe> {
    return parseUserMe(await this.client.get<ICommunityUserMe>('/users/me'));
  }

  /** 把当前用户 DTO 收敛为会话用户口径（公开资料 + role，见契约 §3.2）。 */
  toSessionUser(me: ICommunityUserMe): ICommunityUserSession {
    return {
      id: me.id,
      username: me.username,
      displayName: me.displayName,
      bio: me.bio,
      avatarUrl: me.avatarUrl,
      role: me.role,
      createdAt: me.createdAt,
    };
  }
}
