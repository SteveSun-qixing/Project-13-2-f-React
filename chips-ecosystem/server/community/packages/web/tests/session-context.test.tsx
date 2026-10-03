import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

import { CommunityApiClient } from '../src/api/client';
import { SessionProvider, useSession } from '../src/contexts/SessionContext';
import {
  createClient,
  jsonResponse,
  loginSuccessBody,
  meSuccessBody,
  type FetchCall,
} from './helpers';

/**
 * 会话上下文测试（`《14 设计》§1.3/§3.3`）：accessToken 仅内存、启动恢复按刷新接口
 * 204 口径、登出尽力而为、401 自动刷新失败联动清空会话。
 */

function SessionProbe({ onCaught }: { onCaught?: (message: string) => void }): ReactNode {
  const session = useSession();
  return (
    <div>
      <span data-testid="status">{session.status}</span>
      <span data-testid="user">{session.user ? session.user.username : '无用户'}</span>
      <span data-testid="authed">{String(session.isAuthenticated)}</span>
      <button
        type="button"
        data-testid="login"
        onClick={() => {
          session.login('alice', 'password-123').catch((error: unknown) => {
            onCaught?.(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        登录
      </button>
      <button
        type="button"
        data-testid="register"
        onClick={() => {
          session
            .register({ username: 'alice', email: 'alice@example.com', password: 'password-123' })
            .catch((error: unknown) => {
              onCaught?.(error instanceof Error ? error.message : String(error));
            });
        }}
      >
        注册
      </button>
      <button type="button" data-testid="logout" onClick={() => void session.logout()}>
        退出登录
      </button>
    </div>
  );
}

function renderSession(
  client: CommunityApiClient,
  onCaught?: (message: string) => void
): ReturnType<typeof render> {
  return render(
    <SessionProvider client={client}>
      <SessionProbe {...(onCaught ? { onCaught } : {})} />
    </SessionProvider>
  );
}

describe('会话上下文', () => {
  it('启动恢复：刷新成功后拉取当前用户，进入已认证态，令牌仅内存持有', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(jsonResponse(200, { data: { accessToken: 'access-restore' } }));
    enqueue(jsonResponse(200, meSuccessBody()));

    renderSession(client);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
    expect(client.getAccessToken()).toBe('access-restore');
    const refreshCall = calls.find((call: FetchCall) => call.url === '/api/v1/auth/refresh');
    expect(refreshCall?.init.method).toBe('POST');
    expect(refreshCall?.init.credentials).toBe('include');
  });

  it('启动刷新返回 204：无可恢复登录态，进入未登录态', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    renderSession(client);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('无用户');
    expect(client.getAccessToken()).toBeNull();
  });

  it('恢复期间处于 restoring 状态', async () => {
    let resolveRestore!: (response: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRestore = resolve;
        })
    );
    const client = new CommunityApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    renderSession(client);
    expect(screen.getByTestId('status')).toHaveTextContent('restoring');

    await waitFor(() => expect(resolveRestore).toBeDefined());
    resolveRestore(new Response(null, { status: 204 }));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
  });

  it('登录失败：展示服务端简体中文错误并保持未登录；登录成功：写入内存令牌与用户', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));
    const caught: string[] = [];
    renderSession(client, (message) => caught.push(message));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    enqueue(
      jsonResponse(401, {
        error: { code: 'COMMUNITY_AUTH_INVALID_CREDENTIALS', message: '账号或口令错误' },
      })
    );
    fireEvent.click(screen.getByTestId('login'));
    await waitFor(() => expect(caught).toContain('账号或口令错误'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('无用户');
    expect(client.getAccessToken()).toBeNull();

    enqueue(jsonResponse(200, loginSuccessBody('token-login', 'refresh-login')));
    fireEvent.click(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(client.getAccessToken()).toBe('token-login');
  });

  it('注册成功：注册即建立会话，进入已认证态', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));
    renderSession(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    enqueue(jsonResponse(201, loginSuccessBody('token-register', 'refresh-register')));
    fireEvent.click(screen.getByTestId('register'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('alice');
    expect(client.getAccessToken()).toBe('token-register');
  });

  it('登出：服务端 204 后清空本地会话', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));
    renderSession(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    enqueue(jsonResponse(200, loginSuccessBody('token-login')));
    fireEvent.click(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    enqueue(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByTestId('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('无用户');
    expect(client.getAccessToken()).toBeNull();
  });

  it('登出尽力而为：服务端不可达同样清空本地令牌与用户', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));
    renderSession(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    enqueue(jsonResponse(200, loginSuccessBody('token-login')));
    fireEvent.click(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    enqueue(new TypeError('fetch failed'));
    fireEvent.click(screen.getByTestId('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(client.getAccessToken()).toBeNull();
  });

  it('受保护请求 401 且刷新 204：会话上下文联动清空用户进入未登录态', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));
    renderSession(client);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    enqueue(jsonResponse(200, loginSuccessBody('token-login')));
    fireEvent.click(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    enqueue(
      jsonResponse(401, {
        error: { code: 'COMMUNITY_AUTH_TOKEN_EXPIRED', message: '登录状态已过期' },
      })
    );
    enqueue(new Response(null, { status: 204 }));

    await act(async () => {
      await client.get('/users/me').catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('user')).toHaveTextContent('无用户');
    expect(client.getAccessToken()).toBeNull();
  });

  it('Provider 外使用 useSession 抛出明确错误', () => {
    const probe = (): ReturnType<typeof render> => render(<SessionProbe />);
    expect(probe).toThrow(/SessionProvider/);
  });
});
