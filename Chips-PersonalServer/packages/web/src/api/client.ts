/**
 * API 客户端基础封装
 * 负责：统一请求头、token 刷新、错误格式化
 */

const API_BASE = '/api/v1';

/** 内存中持有的 access token */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function tryRefreshToken(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (res.status === 204) {
      accessToken = null;
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      return null;
    }

    if (!res.ok) {
      accessToken = null;
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      return null;
    }

    const data = await res.json();
    const newToken = data.data?.accessToken as string | null;
    accessToken = newToken;
    refreshQueue.forEach((cb) => cb(newToken));
    refreshQueue = [];
    return newToken;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
    throw new ApiRequestError(401, {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Session expired. Please log in again.',
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(res.status, json.error ?? { code: 'UNKNOWN', message: 'Request failed' });
  }

  return json as T;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | number>) => {
    const url = params ? `${path}?${new URLSearchParams(params as Record<string, string>)}` : path;
    return request<T>(url);
  },
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData, onProgress?: (pct: number) => void): Promise<T> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${path}`);

      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      }

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.onload = () => {
        if (xhr.status === 204) {
          resolve(undefined as T);
          return;
        }
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json as T);
        } else {
          reject(new ApiRequestError(xhr.status, json.error ?? { code: 'UNKNOWN', message: 'Upload failed' }));
        }
      };

      xhr.onerror = () => reject(new ApiRequestError(0, { code: 'NETWORK_ERROR', message: 'Network error' }));
      xhr.send(formData);
    });
  },
};
