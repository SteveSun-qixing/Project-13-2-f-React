import { apiClient, setAccessToken } from './client';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface PublicUserProfile {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export const authApi = {
  async register(username: string, password: string) {
    const res = await apiClient.post<{ data: { user: UserProfile; accessToken: string } }>(
      '/auth/register',
      { username, password },
    );
    setAccessToken(res.data.accessToken);
    return res.data;
  },

  async login(username: string, password: string) {
    const res = await apiClient.post<{ data: { user: UserProfile; accessToken: string } }>(
      '/auth/login',
      { username, password },
    );
    setAccessToken(res.data.accessToken);
    return res.data;
  },

  async logout() {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
  },

  async getMe() {
    const res = await apiClient.get<{ data: UserProfile }>('/users/me');
    return res.data;
  },

  async updateMe(patch: { displayName?: string; bio?: string }) {
    const res = await apiClient.patch<{ data: UserProfile }>('/users/me', patch);
    return res.data;
  },

  async changePassword(oldPassword: string, newPassword: string) {
    await apiClient.put('/users/me/password', { oldPassword, newPassword });
  },

  async uploadAvatar(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.upload<{ data: { avatarUrl: string } }>('/users/me/avatar', fd);
  },

  async getUserProfile(username: string) {
    const res = await apiClient.get<{ data: PublicUserProfile }>(`/users/${username}`);
    return res.data;
  },
};
