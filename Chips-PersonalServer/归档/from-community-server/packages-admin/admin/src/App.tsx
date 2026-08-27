import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './admin.css';

type Locale = 'zh-CN' | 'en-US';
type ThemeId = 'chips-admin.midnight' | 'chips-admin.paper';
type TranslationDictionary = Record<string, string>;
type AdminContentType = 'card' | 'box';

interface PrivateUserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AdminStats {
  userCount: number;
  cardCount: number;
  boxCount: number;
  totalStorageBytes: number;
  today: {
    userCount: number;
    cardCount: number;
    boxCount: number;
  };
}

interface AdminUserSummary {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  storageBytes: number;
  createdAt: string;
}

interface AdminContentItem {
  id: string;
  userId: string;
  roomId: string | null;
  title: string;
  visibility: 'public' | 'private';
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  status?: 'pending' | 'processing' | 'ready' | 'error';
  layoutPlugin?: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

const LOCALE_STORAGE_KEY = 'ccps.admin.locale';
const THEME_STORAGE_KEY = 'ccps.admin.theme';
const API_BASE = '/api/v1';
const ADMIN_API_BASE = '/admin/api/v1';
const PAGE_SIZE = 20;

const dictionaries: Record<Locale, TranslationDictionary> = {
  'zh-CN': {
    'app.title': '薯片社区平台后台',
    'app.subtitle': '统一查看平台运行态、用户状态与社区内容治理。',
    'brand.name': 'Chips Community Admin',
    'brand.tagline': '平台运营后台',
    'common.loading': '加载中…',
    'common.refresh': '刷新',
    'common.search': '搜索',
    'common.language': '语言',
    'common.theme': '主题',
    'common.localeChinese': '中文',
    'common.localeEnglish': '英文',
    'common.paperTheme': '纸页主题',
    'common.midnightTheme': '夜幕主题',
    'common.logout': '退出登录',
    'common.login': '登录',
    'common.username': '用户名',
    'common.password': '密码',
    'common.users': '用户',
    'common.cards': '卡片',
    'common.boxes': '箱子',
    'common.storage': '存储',
    'common.createdAt': '创建时间',
    'common.updatedAt': '更新时间',
    'common.status': '状态',
    'common.visibility': '可见性',
    'common.fileSize': '文件大小',
    'common.owner': '用户 ID',
    'common.role': '角色',
    'common.actions': '操作',
    'common.public': '公开',
    'common.private': '私密',
    'common.active': '启用',
    'common.disabled': '禁用',
    'common.enable': '启用用户',
    'common.disable': '禁用用户',
    'common.delete': '删除',
    'common.confirm': '确认',
    'common.empty': '暂无数据',
    'common.previous': '上一页',
    'common.next': '下一页',
    'common.page': '第 {page} / {total} 页',
    'auth.title': '管理员登录',
    'auth.subtitle': '使用管理员账号进入平台后台。',
    'auth.submit': '登录后台',
    'auth.required': '请输入用户名和密码',
    'auth.notAdmin': '当前账号不是管理员，无法访问平台后台。',
    'auth.sessionExpired': '登录状态已失效，请重新登录。',
    'panel.overview': '平台总览',
    'panel.users': '用户管理',
    'panel.content': '内容治理',
    'stats.users': '总用户数',
    'stats.cards': '总卡片数',
    'stats.boxes': '总箱子数',
    'stats.storage': '总存储量',
    'stats.todayUsers': '今日新增用户',
    'stats.todayCards': '今日新增卡片',
    'stats.todayBoxes': '今日新增箱子',
    'users.searchPlaceholder': '搜索用户名或显示名称',
    'users.empty': '暂无匹配用户',
    'content.cards': '卡片内容',
    'content.boxes': '箱子内容',
    'content.searchPlaceholder': '搜索标题',
    'content.detail': '内容细节',
    'content.empty': '暂无匹配内容',
    'content.deleteWarn': '再次点击即可确认删除当前内容。',
    'content.cardStatus': '卡片状态',
    'content.boxLayout': '布局插件',
    'notice.loginSuccess': '管理员身份验证成功。',
    'notice.userUpdated': '用户状态已更新。',
    'notice.contentDeleted': '内容已删除。',
  },
  'en-US': {
    'app.title': 'Chips Community Admin',
    'app.subtitle': 'Monitor platform health, user status, and content moderation in one place.',
    'brand.name': 'Chips Community Admin',
    'brand.tagline': 'Platform operations console',
    'common.loading': 'Loading…',
    'common.refresh': 'Refresh',
    'common.search': 'Search',
    'common.language': 'Language',
    'common.theme': 'Theme',
    'common.localeChinese': 'Chinese',
    'common.localeEnglish': 'English',
    'common.paperTheme': 'Paper Theme',
    'common.midnightTheme': 'Midnight Theme',
    'common.logout': 'Log out',
    'common.login': 'Log in',
    'common.username': 'Username',
    'common.password': 'Password',
    'common.users': 'Users',
    'common.cards': 'Cards',
    'common.boxes': 'Boxes',
    'common.storage': 'Storage',
    'common.createdAt': 'Created',
    'common.updatedAt': 'Updated',
    'common.status': 'Status',
    'common.visibility': 'Visibility',
    'common.fileSize': 'File size',
    'common.owner': 'User ID',
    'common.role': 'Role',
    'common.actions': 'Actions',
    'common.public': 'Public',
    'common.private': 'Private',
    'common.active': 'Active',
    'common.disabled': 'Disabled',
    'common.enable': 'Enable user',
    'common.disable': 'Disable user',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.empty': 'No data yet',
    'common.previous': 'Previous',
    'common.next': 'Next',
    'common.page': 'Page {page} / {total}',
    'auth.title': 'Administrator sign in',
    'auth.subtitle': 'Use an administrator account to access platform operations.',
    'auth.submit': 'Enter admin console',
    'auth.required': 'Enter both username and password',
    'auth.notAdmin': 'This account is not an administrator.',
    'auth.sessionExpired': 'Your session expired. Please sign in again.',
    'panel.overview': 'Overview',
    'panel.users': 'User management',
    'panel.content': 'Content moderation',
    'stats.users': 'Total users',
    'stats.cards': 'Total cards',
    'stats.boxes': 'Total boxes',
    'stats.storage': 'Total storage',
    'stats.todayUsers': 'New users today',
    'stats.todayCards': 'New cards today',
    'stats.todayBoxes': 'New boxes today',
    'users.searchPlaceholder': 'Search username or display name',
    'users.empty': 'No matching users',
    'content.cards': 'Card content',
    'content.boxes': 'Box content',
    'content.searchPlaceholder': 'Search by title',
    'content.detail': 'Content detail',
    'content.empty': 'No matching content',
    'content.deleteWarn': 'Click the action again to confirm content deletion.',
    'content.cardStatus': 'Card status',
    'content.boxLayout': 'Layout plugin',
    'notice.loginSuccess': 'Administrator session restored.',
    'notice.userUpdated': 'User status updated.',
    'notice.contentDeleted': 'Content deleted.',
  },
};

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function detectLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en-US';
  }
  return 'zh-CN';
}

function detectTheme(): ThemeId {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'chips-admin.paper';
  }
  return 'chips-admin.midnight';
}

function formatBytes(value: number | null | undefined, locale: Locale): string {
  if (!value || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount)} ${units[index]}`;
}

class ApiRequestError extends Error {
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

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

async function request<T>(
  base: string,
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
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && path !== '/auth/refresh') {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return request<T>(base, path, options, false);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { error?: ApiError }) : ({} as T & { error?: ApiError });

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload.error ?? { code: 'UNKNOWN', message: 'Request failed' },
    );
  }

  return payload as T;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null;
          return null;
        }

        const payload = (await response.json()) as { data?: { accessToken?: string } };
        accessToken = payload.data?.accessToken ?? null;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

const authApi = {
  async login(username: string, password: string) {
    const response = await request<{ data: { user: PrivateUserProfile; accessToken: string } }>(
      API_BASE,
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      false,
    );

    accessToken = response.data.accessToken;
    return response.data.user;
  },

  async logout() {
    await request(API_BASE, '/auth/logout', { method: 'POST' }, false);
    accessToken = null;
  },

  async getMe() {
    const response = await request<{ data: PrivateUserProfile }>(API_BASE, '/users/me');
    return response.data;
  },
};

const adminApi = {
  async getStats() {
    return request<{ data: AdminStats }>(ADMIN_API_BASE, '/stats');
  },

  async getUsers(params: { page: number; pageSize: number; q?: string }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('pageSize', String(params.pageSize));
    if (params.q) {
      query.set('q', params.q);
    }

    return request<{ data: AdminUserSummary[]; pagination: Pagination }>(
      ADMIN_API_BASE,
      `/users?${query.toString()}`,
    );
  },

  async updateUser(userId: string, patch: { isActive: boolean }) {
    return request<{ data: { id: string; isActive: boolean } }>(ADMIN_API_BASE, `/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  async getContent(params: { page: number; pageSize: number; type: AdminContentType; q?: string }) {
    const query = new URLSearchParams();
    query.set('page', String(params.page));
    query.set('pageSize', String(params.pageSize));
    query.set('type', params.type);
    if (params.q) {
      query.set('q', params.q);
    }

    return request<{ data: AdminContentItem[]; pagination: Pagination }>(
      ADMIN_API_BASE,
      `/content?${query.toString()}`,
    );
  },

  async deleteContent(type: AdminContentType, id: string) {
    await request(ADMIN_API_BASE, `/content/${type}/${id}`, { method: 'DELETE' });
  },
};

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') {
      return 'zh-CN';
    }

    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === 'en-US' || stored === 'zh-CN' ? stored : detectLocale();
  });
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') {
      return 'chips-admin.midnight';
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'chips-admin.paper' || stored === 'chips-admin.midnight'
      ? stored
      : detectTheme();
  });
  const [currentUser, setCurrentUser] = useState<PrivateUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersPagination, setUsersPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [contentPagination, setContentPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [userQuery, setUserQuery] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [contentType, setContentType] = useState<AdminContentType>('card');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [pendingDelete, setPendingDelete] = useState<{ type: AdminContentType; id: string } | null>(null);

  const dictionary = dictionaries[locale];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => interpolate(dictionary[key] ?? key, params),
    [dictionary],
  );

  const formatDate = useCallback(
    (value: string | number | Date) =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(value)),
    [locale],
  );

  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  );

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.title = t('app.title');
  }, [locale, t]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    document.documentElement.dataset.adminThemeId = themeId;
  }, [themeId]);

  const refreshDashboard = useCallback(
    async (options?: {
      nextUserPage?: number;
      nextUserQuery?: string;
      nextContentPage?: number;
      nextContentQuery?: string;
      nextContentType?: AdminContentType;
    }) => {
      if (!currentUser || currentUser.role !== 'admin') {
        return;
      }

      const nextUserPage = options?.nextUserPage ?? usersPagination.page;
      const nextUserQuery = options?.nextUserQuery ?? userQuery;
      const nextContentPage = options?.nextContentPage ?? contentPagination.page;
      const nextContentQuery = options?.nextContentQuery ?? contentQuery;
      const nextContentType = options?.nextContentType ?? contentType;

      setLoading(true);
      setError('');

      try {
        const [statsResponse, usersResponse, contentResponse] = await Promise.all([
          adminApi.getStats(),
          adminApi.getUsers({
            page: nextUserPage,
            pageSize: PAGE_SIZE,
            q: nextUserQuery.trim() || undefined,
          }),
          adminApi.getContent({
            page: nextContentPage,
            pageSize: PAGE_SIZE,
            type: nextContentType,
            q: nextContentQuery.trim() || undefined,
          }),
        ]);

        setStats(statsResponse.data);
        setUsers(usersResponse.data);
        setUsersPagination(usersResponse.pagination);
        setContent(contentResponse.data);
        setContentPagination(contentResponse.pagination);
        setPendingDelete(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : t('common.loading'));
      } finally {
        setLoading(false);
      }
    },
    [contentPagination.page, contentQuery, contentType, currentUser, t, userQuery, usersPagination.page],
  );

  const restoreSession = useCallback(async () => {
    setAuthLoading(true);

    try {
      const token = await refreshAccessToken();
      if (!token) {
        setCurrentUser(null);
        return;
      }

      const profile = await authApi.getMe();
      setCurrentUser(profile);

      if (profile.role === 'admin') {
        setNotice(t('notice.loginSuccess'));
      } else {
        setError(t('auth.notAdmin'));
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('auth.sessionExpired'));
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (currentUser?.role === 'admin' && !stats) {
      void refreshDashboard();
    }
  }, [currentUser, refreshDashboard, stats]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!loginForm.username || !loginForm.password) {
      setError(t('auth.required'));
      return;
    }

    setError('');
    setNotice('');
    setAuthLoading(true);

    try {
      const profile = await authApi.login(loginForm.username, loginForm.password);
      setCurrentUser(profile);

      if (profile.role !== 'admin') {
        setError(t('auth.notAdmin'));
        return;
      }

      setNotice(t('notice.loginSuccess'));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('auth.sessionExpired'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentUser(null);
      setStats(null);
      setUsers([]);
      setContent([]);
      setUsersPagination({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setContentPagination({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
      setUserQuery('');
      setContentQuery('');
      setContentType('card');
      setError('');
      setNotice('');
      setPendingDelete(null);
      setLoginForm({ username: '', password: '' });
    }
  };

  const handleUserSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await refreshDashboard({ nextUserPage: 1 });
  };

  const handleContentSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    await refreshDashboard({ nextContentPage: 1 });
  };

  const handleUserToggle = async (user: AdminUserSummary) => {
    try {
      setLoading(true);
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      setNotice(t('notice.userUpdated'));
      await refreshDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('common.loading'));
      setLoading(false);
    }
  };

  const handleDeleteContent = async (type: AdminContentType, id: string) => {
    if (!pendingDelete || pendingDelete.type !== type || pendingDelete.id !== id) {
      setPendingDelete({ type, id });
      return;
    }

    try {
      setLoading(true);
      await adminApi.deleteContent(type, id);
      setNotice(t('notice.contentDeleted'));
      await refreshDashboard();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('common.loading'));
      setLoading(false);
    }
  };

  const adminStatus = useMemo(() => {
    if (!currentUser) {
      return 'signed-out';
    }

    return currentUser.role === 'admin' ? 'admin' : 'forbidden';
  }, [currentUser]);

  const renderPagination = (
    pagination: Pagination,
    onChange: (page: number) => Promise<void>,
  ) => (
    <div className="admin-pagination">
      <button
        type="button"
        className="admin-button admin-button--ghost"
        onClick={() => void onChange(Math.max(1, pagination.page - 1))}
        disabled={pagination.page <= 1 || loading}
      >
        {t('common.previous')}
      </button>
      <span>{t('common.page', { page: pagination.page, total: pagination.totalPages || 1 })}</span>
      <button
        type="button"
        className="admin-button admin-button--ghost"
        onClick={() => void onChange(Math.min(pagination.totalPages || 1, pagination.page + 1))}
        disabled={pagination.page >= (pagination.totalPages || 1) || loading}
      >
        {t('common.next')}
      </button>
    </div>
  );

  if (authLoading && adminStatus === 'signed-out') {
    return <div className="admin-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span className="admin-brand__badge">CC</span>
          <div>
            <strong>{t('brand.name')}</strong>
            <span>{t('brand.tagline')}</span>
          </div>
        </div>

        <div className="admin-topbar__controls">
          <label className="admin-control">
            <span>{t('common.language')}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="zh-CN">{t('common.localeChinese')}</option>
              <option value="en-US">{t('common.localeEnglish')}</option>
            </select>
          </label>

          <label className="admin-control">
            <span>{t('common.theme')}</span>
            <select value={themeId} onChange={(event) => setThemeId(event.target.value as ThemeId)}>
              <option value="chips-admin.midnight">{t('common.midnightTheme')}</option>
              <option value="chips-admin.paper">{t('common.paperTheme')}</option>
            </select>
          </label>

          {adminStatus !== 'signed-out' ? (
            <button type="button" className="admin-button admin-button--ghost" onClick={() => void handleLogout()}>
              {t('common.logout')}
            </button>
          ) : null}
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-hero admin-panel">
          <span className="admin-eyebrow">{t('app.title')}</span>
          <h1>{t('app.title')}</h1>
          <p>{t('app.subtitle')}</p>
        </section>

        {error ? <div className="admin-notice admin-notice--danger">{error}</div> : null}
        {notice ? <div className="admin-notice admin-notice--success">{notice}</div> : null}

        {adminStatus === 'signed-out' ? (
          <section className="admin-auth admin-panel">
            <div className="admin-auth__copy">
              <span className="admin-eyebrow">{t('auth.title')}</span>
              <h2>{t('auth.title')}</h2>
              <p>{t('auth.subtitle')}</p>
            </div>

            <form className="admin-auth__form" onSubmit={handleLogin}>
              <label className="admin-field">
                <span>{t('common.username')}</span>
                <input
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, username: event.target.value }))
                  }
                  autoComplete="username"
                />
              </label>

              <label className="admin-field">
                <span>{t('common.password')}</span>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  autoComplete="current-password"
                />
              </label>

              <button type="submit" className="admin-button admin-button--primary" disabled={authLoading}>
                {authLoading ? t('common.loading') : t('auth.submit')}
              </button>
            </form>
          </section>
        ) : null}

        {adminStatus === 'forbidden' ? (
          <section className="admin-panel admin-empty">
            <h2>{t('auth.notAdmin')}</h2>
            <p>{currentUser?.username}</p>
          </section>
        ) : null}

        {adminStatus === 'admin' ? (
          <div className="admin-dashboard">
            <section className="admin-metrics">
              <article className="admin-panel admin-metric">
                <span>{t('stats.users')}</span>
                <strong>{formatNumber(stats?.userCount ?? 0)}</strong>
                <small>{t('stats.todayUsers')}: {formatNumber(stats?.today.userCount ?? 0)}</small>
              </article>
              <article className="admin-panel admin-metric">
                <span>{t('stats.cards')}</span>
                <strong>{formatNumber(stats?.cardCount ?? 0)}</strong>
                <small>{t('stats.todayCards')}: {formatNumber(stats?.today.cardCount ?? 0)}</small>
              </article>
              <article className="admin-panel admin-metric">
                <span>{t('stats.boxes')}</span>
                <strong>{formatNumber(stats?.boxCount ?? 0)}</strong>
                <small>{t('stats.todayBoxes')}: {formatNumber(stats?.today.boxCount ?? 0)}</small>
              </article>
              <article className="admin-panel admin-metric">
                <span>{t('stats.storage')}</span>
                <strong>{formatBytes(stats?.totalStorageBytes ?? 0, locale)}</strong>
                <small>{t('common.updatedAt')}</small>
              </article>
            </section>

            <section className="admin-section admin-panel">
              <div className="admin-section__header">
                <div>
                  <span className="admin-eyebrow">{t('panel.users')}</span>
                  <h2>{t('panel.users')}</h2>
                </div>

                <form className="admin-search" onSubmit={handleUserSearch}>
                  <input
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    placeholder={t('users.searchPlaceholder')}
                  />
                  <button type="submit" className="admin-button admin-button--ghost" disabled={loading}>
                    {t('common.search')}
                  </button>
                </form>
              </div>

              {loading && users.length === 0 ? (
                <div className="admin-empty">{t('common.loading')}</div>
              ) : users.length === 0 ? (
                <div className="admin-empty">{t('users.empty')}</div>
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{t('common.users')}</th>
                          <th>{t('common.role')}</th>
                          <th>{t('common.status')}</th>
                          <th>{t('common.storage')}</th>
                          <th>{t('common.createdAt')}</th>
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <strong>{user.displayName || user.username}</strong>
                              <span>@{user.username}</span>
                            </td>
                            <td>{user.role}</td>
                            <td>
                              <span className={user.isActive ? 'admin-pill admin-pill--success' : 'admin-pill admin-pill--danger'}>
                                {user.isActive ? t('common.active') : t('common.disabled')}
                              </span>
                            </td>
                            <td>{formatBytes(user.storageBytes, locale)}</td>
                            <td>{formatDate(user.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-button admin-button--ghost"
                                onClick={() => void handleUserToggle(user)}
                                disabled={loading}
                              >
                                {user.isActive ? t('common.disable') : t('common.enable')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {renderPagination(usersPagination, async (page) => {
                    await refreshDashboard({ nextUserPage: page });
                  })}
                </>
              )}
            </section>

            <section className="admin-section admin-panel">
              <div className="admin-section__header admin-section__header--stack">
                <div>
                  <span className="admin-eyebrow">{t('panel.content')}</span>
                  <h2>{t('panel.content')}</h2>
                </div>

                <div className="admin-toolbar">
                  <div className="admin-tabs">
                    <button
                      type="button"
                      className={contentType === 'card' ? 'admin-tab is-active' : 'admin-tab'}
                      onClick={() => {
                        setContentType('card');
                        void refreshDashboard({ nextContentType: 'card', nextContentPage: 1 });
                      }}
                    >
                      {t('content.cards')}
                    </button>
                    <button
                      type="button"
                      className={contentType === 'box' ? 'admin-tab is-active' : 'admin-tab'}
                      onClick={() => {
                        setContentType('box');
                        void refreshDashboard({ nextContentType: 'box', nextContentPage: 1 });
                      }}
                    >
                      {t('content.boxes')}
                    </button>
                  </div>

                  <form className="admin-search" onSubmit={handleContentSearch}>
                    <input
                      value={contentQuery}
                      onChange={(event) => setContentQuery(event.target.value)}
                      placeholder={t('content.searchPlaceholder')}
                    />
                    <button type="submit" className="admin-button admin-button--ghost" disabled={loading}>
                      {t('common.search')}
                    </button>
                  </form>

                  <button
                    type="button"
                    className="admin-button admin-button--secondary"
                    onClick={() => void refreshDashboard()}
                    disabled={loading}
                  >
                    {t('common.refresh')}
                  </button>
                </div>
              </div>

              {loading && content.length === 0 ? (
                <div className="admin-empty">{t('common.loading')}</div>
              ) : content.length === 0 ? (
                <div className="admin-empty">{t('content.empty')}</div>
              ) : (
                <>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{contentType === 'card' ? t('common.cards') : t('common.boxes')}</th>
                          <th>{t('common.owner')}</th>
                          <th>{contentType === 'card' ? t('content.cardStatus') : t('content.boxLayout')}</th>
                          <th>{t('common.visibility')}</th>
                          <th>{t('common.fileSize')}</th>
                          <th>{t('common.createdAt')}</th>
                          <th>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.title}</strong>
                              <span>{item.id}</span>
                            </td>
                            <td>{item.userId}</td>
                            <td>
                              {contentType === 'card' ? (
                                <span className={`admin-pill admin-pill--${item.status ?? 'neutral'}`}>
                                  {item.status ?? '-'}
                                </span>
                              ) : (
                                item.layoutPlugin || '-'
                              )}
                            </td>
                            <td>{item.visibility === 'public' ? t('common.public') : t('common.private')}</td>
                            <td>{formatBytes(item.fileSizeBytes, locale)}</td>
                            <td>{formatDate(item.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-button admin-button--danger"
                                onClick={() => void handleDeleteContent(contentType, item.id)}
                                disabled={loading}
                              >
                                {pendingDelete?.type === contentType && pendingDelete.id === item.id
                                  ? t('common.confirm')
                                  : t('common.delete')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {pendingDelete ? <p className="admin-hint">{t('content.deleteWarn')}</p> : null}

                  {renderPagination(contentPagination, async (page) => {
                    await refreshDashboard({ nextContentPage: page });
                  })}
                </>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
