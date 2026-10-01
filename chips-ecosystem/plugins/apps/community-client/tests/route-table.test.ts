import { describe, expect, it } from 'vitest';
import {
  formatCommunityRoute,
  formatProfileRoute,
  parseCommunityRoute,
  resolveGuardedRoute,
} from '../src/domain/community/routeTable';

describe('路由表解析（16-CC §3.2 逐行）', () => {
  it('登记路由逐行解析（空根归欢迎页）', () => {
    expect(parseCommunityRoute('#/')).toEqual({ name: 'welcome' });
    expect(parseCommunityRoute('')).toEqual({ name: 'welcome' });
    expect(parseCommunityRoute('#/about')).toEqual({ name: 'about' });
    expect(parseCommunityRoute('#/login')).toEqual({ name: 'login' });
    expect(parseCommunityRoute('#/register')).toEqual({ name: 'register' });
    expect(parseCommunityRoute('#/workspace')).toEqual({ name: 'workspace' });
    expect(parseCommunityRoute('#/admin')).toEqual({ name: 'admin' });
    expect(parseCommunityRoute('#/settings')).toEqual({ name: 'settings' });
    expect(parseCommunityRoute('#/cards/1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d')).toEqual({
      name: 'cardDetail',
      cardId: '1a2b3c4d-5e6f-4a8b-9c0d-2e3f4a5b6c7d',
    });
    expect(parseCommunityRoute('#/boxes/k1L2m3N4o5')).toEqual({ name: 'boxDetail', boxId: 'k1L2m3N4o5' });
    expect(parseCommunityRoute('#/@tokyo_traveler')).toEqual({ name: 'profile', username: 'tokyo_traveler' });
  });

  it('带查询串与尾斜杠的路由取路径段', () => {
    expect(parseCommunityRoute('#/workspace?from=cli')).toEqual({ name: 'workspace' });
    expect(parseCommunityRoute('#/settings/')).toEqual({ name: 'settings' });
  });

  it('参数非法或缺失归 404 并保留原始路径（含尾斜杠原样）', () => {
    expect(parseCommunityRoute('#/cards/')).toEqual({ name: 'notFound', path: '/cards/' });
    expect(parseCommunityRoute('#/cards/a%zz')).toEqual({ name: 'notFound', path: '/cards/a%zz' });
    expect(parseCommunityRoute('#/cards/a b')).toEqual({ name: 'notFound', path: '/cards/a b' });
    expect(parseCommunityRoute('#/nowhere')).toEqual({ name: 'notFound', path: '/nowhere' });
  });
});

describe('路由序列化（描述符 → hash，往返一致）', () => {
  it('各路由序列化形态', () => {
    expect(formatCommunityRoute({ name: 'welcome' })).toBe('#/');
    expect(formatCommunityRoute({ name: 'about' })).toBe('#/about');
    expect(formatCommunityRoute({ name: 'profile', username: 'tokyo_traveler' })).toBe('#/@tokyo_traveler');
    expect(formatCommunityRoute({ name: 'cardDetail', cardId: 'a1B2c3D4e5' })).toBe('#/cards/a1B2c3D4e5');
    expect(formatCommunityRoute({ name: 'boxDetail', boxId: 'k1L2m3N4o5' })).toBe('#/boxes/k1L2m3N4o5');
    expect(formatCommunityRoute({ name: 'notFound', path: '/nowhere' })).toBe('#/nowhere');
  });

  it('解析 → 序列化 → 解析往返稳定（含需转义参数）', () => {
    const route = { name: 'profile' as const, username: '东京/旅人' };
    const hash = formatCommunityRoute(route);
    expect(parseCommunityRoute(hash)).toEqual(route);
    const cardRoute = { name: 'cardDetail' as const, cardId: 'a1B2c3D4e5' };
    expect(parseCommunityRoute(formatCommunityRoute(cardRoute))).toEqual(cardRoute);
  });

  it('个人主页路由便捷构造', () => {
    expect(formatProfileRoute('tokyo_traveler')).toBe('#/@tokyo_traveler');
  });
});

describe('路由守卫（16-CC §3.2 访问规则 + §3.3）', () => {
  const anonymous = { loggedIn: false, username: null };
  const loggedIn = { loggedIn: true, username: 'tokyo_traveler' };

  it('未登录访问工作区重定向登录页', () => {
    expect(resolveGuardedRoute({ name: 'workspace' }, anonymous)).toEqual({ name: 'login' });
  });

  it('已登录访问登录/注册重定向个人主页', () => {
    expect(resolveGuardedRoute({ name: 'login' }, loggedIn)).toEqual({
      name: 'profile',
      username: 'tokyo_traveler',
    });
    expect(resolveGuardedRoute({ name: 'register' }, loggedIn)).toEqual({
      name: 'profile',
      username: 'tokyo_traveler',
    });
  });

  it('公开路由原样放行', () => {
    expect(resolveGuardedRoute({ name: 'welcome' }, anonymous)).toEqual({ name: 'welcome' });
    expect(resolveGuardedRoute({ name: 'about' }, loggedIn)).toEqual({ name: 'about' });
    expect(resolveGuardedRoute({ name: 'settings' }, anonymous)).toEqual({ name: 'settings' });
    expect(resolveGuardedRoute({ name: 'cardDetail', cardId: 'a1B2c3D4e5' }, anonymous)).toEqual({
      name: 'cardDetail',
      cardId: 'a1B2c3D4e5',
    });
  });
});
