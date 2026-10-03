import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

import { SiteFooter } from '../src/components/SiteFooter';
import { SiteHeader } from '../src/components/SiteHeader';
import { WorkGrid } from '../src/components/WorkGrid';
import { WorkTile } from '../src/components/WorkTile';
import {
  RouterProvider,
  Link,
  Navigate,
  matchRoutePath,
  useRouterLocation,
} from '../src/lib/router';
import type { CommunityWorkItem } from '../src/api/types';
import { createClient, jsonResponse, loginSuccessBody } from './helpers';

/** 组件测试：页头、页脚、作品网格与磁贴、路由（匹配器与客户端导航）。 */

function workItem(overrides: Partial<CommunityWorkItem> = {}): CommunityWorkItem {
  return {
    id: 'card-1',
    type: 'card',
    title: '示例卡片',
    coverUrl: null,
    coverRatio: '3:4',
    href: '/cards/card-1',
    createdAt: '2026-09-19T08:00:00.000Z',
    ...overrides,
  };
}

/** 会话态组件测试：直接以 SessionProvider 包裹被测组件，按需经探针登录。 */

describe('路由匹配器', () => {
  it('静态段与通配', () => {
    expect(matchRoutePath('/', '/')).toEqual({});
    expect(matchRoutePath('/', '/about')).toBeNull();
    expect(matchRoutePath('/about', '/about')).toEqual({});
    expect(matchRoutePath('*', '/任何/路径')).toEqual({});
    expect(matchRoutePath('/login', '/login/extra')).toBeNull();
  });

  it('参数段：/@:username 与 /cards/:cardId', () => {
    expect(matchRoutePath('/@:username', '/@alice')).toEqual({ username: 'alice' });
    expect(matchRoutePath('/@:username', '/alice')).toBeNull();
    expect(matchRoutePath('/cards/:cardId', '/cards/abc')).toEqual({ cardId: 'abc' });
    expect(matchRoutePath('/boxes/:boxId', '/boxes/x')).toEqual({ boxId: 'x' });
  });

  it('Link 渲染锚点并在点击后客户端导航，浏览器后退可回退', async () => {
    function PathProbe(): ReactNode {
      const location = useRouterLocation();
      return <span data-testid="pathname">{location.pathname}</span>;
    }

    render(
      <RouterProvider>
        <PathProbe />
        <Link to="/about" className="probe-link">
          前往简介
        </Link>
      </RouterProvider>
    );

    expect(screen.getByTestId('pathname')).toHaveTextContent('/');
    const anchor = screen.getByRole('link', { name: '前往简介' });
    expect(anchor).toHaveAttribute('href', '/about');

    fireEvent.click(anchor);
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/about'));
    expect(window.location.pathname).toBe('/about');

    await act(async () => {
      window.history.back();
      // jsdom 经宏任务派发 popstate：等待一个宏任务确保导航与状态更新收敛
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/'));
  });

  it('Navigate 挂载即重定向（默认 replace）', async () => {
    function PathProbe(): ReactNode {
      const location = useRouterLocation();
      return <span data-testid="pathname">{location.pathname}</span>;
    }

    window.history.replaceState(null, '', '/start');
    render(
      <RouterProvider>
        <PathProbe />
        <Navigate to="/next" />
      </RouterProvider>
    );

    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/next'));
    expect(window.location.pathname).toBe('/next');
  });
});

describe('页头', () => {
  it('访客：导航欢迎与社区简介，操作区为登录与注册', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const { SessionProvider } = await import('../src/contexts/SessionContext');
    render(
      <RouterProvider>
        <SessionProvider client={client}>
          <SiteHeader />
        </SessionProvider>
      </RouterProvider>
    );

    await waitFor(() => expect(screen.getByRole('link', { name: '登录' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: '社区简介' })).toHaveAttribute('href', '/about');
    expect(screen.queryByRole('link', { name: '我的主页' })).not.toBeInTheDocument();
  });

  it('普通用户：显示我的主页与工作区入口，用户名链接与退出登录', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const { SessionProvider, useSession } = await import('../src/contexts/SessionContext');
    function LoginProbe(): ReactNode {
      const session = useSession();
      return (
        <button
          type="button"
          data-testid="probe-login"
          onClick={() => void session.login('alice', 'password-123')}
        >
          探针登录
        </button>
      );
    }

    render(
      <RouterProvider>
        <SessionProvider client={client}>
          <LoginProbe />
          <SiteHeader />
        </SessionProvider>
      </RouterProvider>
    );
    await waitFor(() => expect(screen.getByTestId('probe-login')).toBeInTheDocument());

    enqueue(jsonResponse(200, loginSuccessBody('token-header')));
    fireEvent.click(screen.getByTestId('probe-login'));

    const profileLink = await screen.findByRole('link', { name: '我的主页' });
    expect(profileLink).toHaveAttribute('href', '/@alice');
    expect(screen.getByRole('link', { name: '工作区' })).toHaveAttribute('href', '/workspace');
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/@alice');
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument();
  });

  it('管理员：不显示创作者入口', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const { SessionProvider, useSession } = await import('../src/contexts/SessionContext');
    function LoginProbe(): ReactNode {
      const session = useSession();
      return (
        <button
          type="button"
          data-testid="probe-login-admin"
          onClick={() => {
            void session.login('root', 'password-123');
          }}
        >
          探针登录
        </button>
      );
    }

    render(
      <RouterProvider>
        <SessionProvider client={client}>
          <LoginProbe />
          <SiteHeader />
        </SessionProvider>
      </RouterProvider>
    );
    await waitFor(() => expect(screen.getByTestId('probe-login-admin')).toBeInTheDocument());

    enqueue(
      jsonResponse(200, {
        data: {
          user: {
            id: '0b6f9c2e-6d5a-4a2f-9c1e-2f3a4b5c6d7e',
            username: 'root',
            displayName: 'root',
            bio: null,
            avatarUrl: null,
            role: 'admin',
            createdAt: '2026-09-19T08:00:00.000Z',
          },
          accessToken: 'token-admin',
          refreshToken: 'refresh-admin',
        },
      })
    );
    fireEvent.click(screen.getByTestId('probe-login-admin'));

    await screen.findByRole('button', { name: '退出登录' });
    expect(screen.queryByRole('link', { name: '我的主页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '工作区' })).not.toBeInTheDocument();
  });
});

describe('页脚', () => {
  it('访客：社区简介、登录与注册链接', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const { SessionProvider } = await import('../src/contexts/SessionContext');
    render(
      <RouterProvider>
        <SessionProvider client={client}>
          <SiteFooter />
        </SessionProvider>
      </RouterProvider>
    );

    await waitFor(() => expect(screen.getByRole('link', { name: '登录' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: '社区简介' })).toHaveAttribute('href', '/about');
  });

  it('普通用户：我的主页与工作区，不再显示登录注册', async () => {
    const { client, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const { SessionProvider, useSession } = await import('../src/contexts/SessionContext');
    function LoginProbe(): ReactNode {
      const session = useSession();
      return (
        <button
          type="button"
          data-testid="probe-login-footer"
          onClick={() => {
            void session.login('alice', 'password-123');
          }}
        >
          探针登录
        </button>
      );
    }

    render(
      <RouterProvider>
        <SessionProvider client={client}>
          <LoginProbe />
          <SiteFooter />
        </SessionProvider>
      </RouterProvider>
    );
    await waitFor(() => expect(screen.getByTestId('probe-login-footer')).toBeInTheDocument());

    enqueue(jsonResponse(200, loginSuccessBody('token-footer')));
    fireEvent.click(screen.getByTestId('probe-login-footer'));

    const profileLink = await screen.findByRole('link', { name: '我的主页' });
    expect(profileLink).toHaveAttribute('href', '/@alice');
    expect(screen.getByRole('link', { name: '工作区' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument();
  });
});

describe('作品磁贴', () => {
  it('卡片磁贴：链接指向 href，无封面时显示首字占位', () => {
    render(
      <RouterProvider>
        <WorkTile item={workItem({ coverUrl: null })} />
      </RouterProvider>
    );

    const tile = screen.getByRole('link', { name: '示例卡片 · 卡片' });
    expect(tile).toHaveAttribute('href', '/cards/card-1');
    expect(screen.getByText('示')).toBeInTheDocument();
  });

  it('箱子磁贴：封面图片以标题为替代文本', () => {
    render(
      <RouterProvider>
        <WorkTile
          item={workItem({
            id: 'box-1',
            type: 'box',
            title: '示例箱子',
            coverUrl: 'https://cdn.example.test/box.png',
            href: '/boxes/box-1',
          })}
        />
      </RouterProvider>
    );

    expect(screen.getByRole('img', { name: '示例箱子' })).toHaveAttribute(
      'src',
      'https://cdn.example.test/box.png'
    );
  });

  it('管理模式：磁贴变为可勾选按钮并回调选择', () => {
    const onToggle = vi.fn();
    const item = workItem();
    render(
      <RouterProvider>
        <WorkTile item={item} manageMode selected={false} onToggleSelection={onToggle} />
      </RouterProvider>
    );

    const tile = screen.getByRole('button', { name: '选择卡片 示例卡片' });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(tile);
    expect(onToggle).toHaveBeenCalledWith(item);
  });

  it('管理模式选中态 aria-pressed 为 true', () => {
    render(
      <RouterProvider>
        <WorkTile item={workItem()} manageMode selected onToggleSelection={() => undefined} />
      </RouterProvider>
    );
    expect(screen.getByRole('button', { name: '选择卡片 示例卡片' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

describe('作品网格', () => {
  it('渲染全部作品磁贴', () => {
    render(
      <RouterProvider>
        <WorkGrid
          items={[
            workItem(),
            workItem({ id: 'box-1', type: 'box', title: '示例箱子', href: '/boxes/box-1' }),
          ]}
        />
      </RouterProvider>
    );

    expect(screen.getByRole('link', { name: '示例卡片 · 卡片' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '示例箱子 · 箱子' })).toBeInTheDocument();
  });

  it('空作品：展示空态文案', () => {
    render(
      <RouterProvider>
        <WorkGrid items={[]} />
      </RouterProvider>
    );
    expect(screen.getByText('这里还没有对外展示的内容。')).toBeInTheDocument();
  });

  it('本人视角：发布入口与管理模式切换', () => {
    const onToggleManageMode = vi.fn();
    render(
      <RouterProvider>
        <WorkGrid items={[workItem()]} isOwner onToggleManageMode={onToggleManageMode} />
      </RouterProvider>
    );

    // 发布入口指向客户端发布说明页（工作区）
    expect(screen.getByRole('link', { name: '进入工作区' })).toHaveAttribute('href', '/workspace');
    fireEvent.click(screen.getByRole('button', { name: '管理作品' }));
    expect(onToggleManageMode).toHaveBeenCalledTimes(1);
  });

  it('管理模式：统计已选数量，删除按钮按选择态启停', () => {
    const onDelete = vi.fn();
    const item = workItem();
    const selected = new Set([`card:${item.id}`]);
    const { rerender } = render(
      <RouterProvider>
        <WorkGrid
          items={[item]}
          isOwner
          manageMode
          selectedKeys={selected}
          onToggleWorkSelection={() => undefined}
          onDeleteSelectedWorks={onDelete}
        />
      </RouterProvider>
    );

    expect(screen.getByText('已选择 1 个作品')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除所选作品' }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <RouterProvider>
        <WorkGrid
          items={[item]}
          isOwner
          manageMode
          selectedKeys={new Set()}
          onToggleWorkSelection={() => undefined}
          onDeleteSelectedWorks={onDelete}
        />
      </RouterProvider>
    );
    expect(screen.getByText('已选择 0 个作品')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除所选作品' })).toBeDisabled();
  });

  it('管理模式失败提示透出', () => {
    render(
      <RouterProvider>
        <WorkGrid items={[]} isOwner manageMode manageError="1 个作品删除失败" />
      </RouterProvider>
    );
    expect(screen.getByText('1 个作品删除失败')).toBeInTheDocument();
  });
});
