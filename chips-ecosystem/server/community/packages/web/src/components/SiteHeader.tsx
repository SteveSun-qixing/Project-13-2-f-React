/**
 * 站点页头（`components/` 页头，《14 设计》§7.2）：品牌、主导航与会话操作区。
 * 创作者入口（我的主页 / 工作区）仅对非管理员登录用户展示；管理员经后台中转进入后台。
 */

import type { ReactNode } from 'react';

import { Link, useRouterLocation } from '../lib/router';
import { useSession } from '../contexts/SessionContext';
import './site-header.css';

export function SiteHeader(): ReactNode {
  const { user, isAuthenticated, logout } = useSession();
  const { pathname } = useRouterLocation();
  const showCreatorNav = isAuthenticated && user !== null && user.role !== 'admin';

  const handleLogout = (): void => {
    void logout();
  };

  return (
    <header className="ccw-header">
      <div className="ccw-header__inner">
        <Link to="/" className="ccw-header__brand" aria-label="薯片社区首页">
          <span className="ccw-header__brand-mark" aria-hidden="true" />
          <span className="ccw-header__brand-name">薯片社区</span>
        </Link>

        <nav className="ccw-header__nav" aria-label="主导航">
          <Link to="/" aria-current={pathname === '/' ? 'page' : undefined}>
            欢迎
          </Link>
          <Link to="/about" aria-current={pathname === '/about' ? 'page' : undefined}>
            社区简介
          </Link>
          {showCreatorNav && user ? (
            <Link
              to={`/@${user.username}`}
              aria-current={pathname === `/@${user.username}` ? 'page' : undefined}
            >
              我的主页
            </Link>
          ) : null}
          {showCreatorNav ? (
            <Link to="/workspace" aria-current={pathname === '/workspace' ? 'page' : undefined}>
              工作区
            </Link>
          ) : null}
        </nav>

        <div className="ccw-header__actions">
          {isAuthenticated && user ? (
            <>
              <Link className="ccw-header__username" to={`/@${user.username}`}>
                {user.displayName.length > 0 ? user.displayName : user.username}
              </Link>
              <button type="button" className="ccw-button ccw-button--text" onClick={handleLogout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              <Link className="ccw-button ccw-button--text" to="/login">
                登录
              </Link>
              <Link className="ccw-button ccw-button--primary" to="/register">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
