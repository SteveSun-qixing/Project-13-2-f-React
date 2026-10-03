import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import App from '../src/App';
import {
  createClient,
  jsonResponse,
  loginSuccessBody,
  meSuccessBody,
  type QueuedReply,
} from './helpers';

/**
 * 五页冒烟（欢迎、社区简介、登录、注册、404）：《14 设计》§7.2 路由与访问规则——
 * 根路由按会话分流、已登录访问登录注册重定向、未知路径 404、关键简体中文文案。
 */

function renderAppAt(
  path: string,
  replies: QueuedReply[] = []
): {
  client: ReturnType<typeof createClient>['client'];
  calls: ReturnType<typeof createClient>['calls'];
  enqueue: ReturnType<typeof createClient>['enqueue'];
  view: ReturnType<typeof render>;
} {
  const mock = createClient();
  window.history.replaceState(null, '', path);
  for (const reply of replies) {
    mock.enqueue(reply);
  }
  const view = render(<App client={mock.client} />);
  return { ...mock, view };
}

function fillInput(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function anonymousReply(): QueuedReply {
  return new Response(null, { status: 204 });
}

function authedReplies(): QueuedReply[] {
  return [
    jsonResponse(200, { data: { accessToken: 'access-restore' } }),
    jsonResponse(200, meSuccessBody()),
  ];
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('欢迎页（/）', () => {
  it('未登录：渲染欢迎页主文案与页头页脚', async () => {
    renderAppAt('/', [anonymousReply()]);

    expect(
      await screen.findByRole('heading', { level: 1, name: '让信息结构脱离程序独立存在' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '创建主页' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: '了解更多' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('未登录：点击社区简介进入简介页', async () => {
    renderAppAt('/', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '让信息结构脱离程序独立存在' });

    fireEvent.click(screen.getByRole('link', { name: '了解更多' }));

    expect(await screen.findByRole('heading', { level: 1, name: '社区简介' })).toBeInTheDocument();
    expect(screen.getByText('产品定位')).toBeInTheDocument();
  });

  it('已登录普通用户：根路由跳转个人主页地址（个人主页页随后续臂交付）', async () => {
    renderAppAt('/', authedReplies());

    await waitFor(() => expect(window.location.pathname).toBe('/@alice'));
    expect(await screen.findByText('页面不存在或尚未开放')).toBeInTheDocument();
  });

  it('已登录管理员：根路由跳转后台地址', async () => {
    renderAppAt('/', [
      jsonResponse(200, { data: { accessToken: 'access-admin-root' } }),
      jsonResponse(200, {
        data: {
          id: '0b6f9c2e-6d5a-4a2f-9c1e-2f3a4b5c6d7e',
          username: 'root',
          displayName: 'root',
          bio: null,
          avatarUrl: null,
          createdAt: '2026-09-19T08:00:00.000Z',
          email: 'root@example.com',
          role: 'admin',
          updatedAt: '2026-09-20T08:00:00.000Z',
        },
      }),
    ]);

    await waitFor(() => expect(window.location.pathname).toBe('/admin'));
  });
});

describe('登录页（/login）', () => {
  it('渲染登录表单与注册引导', async () => {
    renderAppAt('/login', [anonymousReply()]);

    expect(await screen.findByRole('heading', { level: 1, name: '欢迎回来' })).toBeInTheDocument();
    expect(screen.getByLabelText('登录标识')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去注册' })).toHaveAttribute('href', '/register');
  });

  it('空表单提交展示客户端校验错误，不发起请求', async () => {
    const { calls } = renderAppAt('/login', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '欢迎回来' });

    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请输入登录标识与密码');
    expect(calls.filter((call) => call.url.includes('/auth/'))).toHaveLength(1); // 仅启动恢复的 refresh
  });

  it('提交成功：建立会话并按账号身份跳转个人主页地址', async () => {
    const { enqueue } = renderAppAt('/login', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '欢迎回来' });

    enqueue(jsonResponse(200, loginSuccessBody('token-smoke-login', 'refresh-smoke')));
    fillInput('登录标识', 'alice');
    fillInput('密码', 'password-123');
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(window.location.pathname).toBe('/@alice'));
  });

  it('服务端错误：展示简体中文错误消息', async () => {
    const { enqueue } = renderAppAt('/login', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '欢迎回来' });

    enqueue(
      jsonResponse(401, {
        error: { code: 'COMMUNITY_AUTH_INVALID_CREDENTIALS', message: '账号或口令错误' },
      })
    );
    fillInput('登录标识', 'alice');
    fillInput('密码', 'wrong-pass');
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('账号或口令错误');
  });

  it('已登录访问登录页：重定向离开', async () => {
    renderAppAt('/login', authedReplies());

    await waitFor(() => expect(window.location.pathname).toBe('/@alice'));
  });
});

describe('注册页（/register）', () => {
  it('渲染注册表单与登录引导', async () => {
    renderAppAt('/register', [anonymousReply()]);

    expect(
      await screen.findByRole('heading', { level: 1, name: '创建社区账号' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByLabelText('确认密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '注册' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute('href', '/login');
  });

  it('用户名不符合契约口径：客户端校验报错且不发起注册请求', async () => {
    const { calls } = renderAppAt('/register', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '创建社区账号' });
    const authCallsBefore = calls.filter((call) => call.url.includes('/auth/register')).length;

    fillInput('用户名', 'Alice!');
    fillInput('邮箱', 'alice@example.com');
    fillInput('密码', 'password-123');
    fillInput('确认密码', 'password-123');
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '用户名只能包含小写字母、数字与连字符，长度 3 到 32 个字符'
    );
    expect(calls.filter((call) => call.url.includes('/auth/register'))).toHaveLength(
      authCallsBefore
    );
  });

  it('两次密码不一致：客户端校验报错', async () => {
    renderAppAt('/register', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '创建社区账号' });

    fillInput('用户名', 'alice');
    fillInput('邮箱', 'alice@example.com');
    fillInput('密码', 'password-123');
    fillInput('确认密码', 'password-456');
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('两次输入的密码不一致');
  });

  it('提交成功：注册即建立会话并跳转个人主页地址', async () => {
    const { enqueue } = renderAppAt('/register', [anonymousReply()]);
    await screen.findByRole('heading', { level: 1, name: '创建社区账号' });

    enqueue(jsonResponse(201, loginSuccessBody('token-smoke-register', 'refresh-smoke')));
    fillInput('用户名', 'alice');
    fillInput('邮箱', 'alice@example.com');
    fillInput('密码', 'password-123');
    fillInput('确认密码', 'password-123');
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => expect(window.location.pathname).toBe('/@alice'));
  });
});

describe('404（未知路径）', () => {
  it('渲染 404 页与返回欢迎页链接', async () => {
    renderAppAt('/no-such-page', [anonymousReply()]);

    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.getByText('页面不存在或尚未开放')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回欢迎页' })).toBeInTheDocument();
  });

  it('返回欢迎页链接可导航回根路由', async () => {
    renderAppAt('/no-such-page', [anonymousReply()]);
    await screen.findByText('404');

    fireEvent.click(screen.getByRole('link', { name: '返回欢迎页' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: '让信息结构脱离程序独立存在' })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
