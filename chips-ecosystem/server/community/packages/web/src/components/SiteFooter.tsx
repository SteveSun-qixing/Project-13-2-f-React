/**
 * 站点页脚（`components/` 页脚，《14 设计》§7.2）：品牌与相关链接。
 * 个人主页路由不渲染站点页脚（由路由壳判定）；内容直达页不渲染社区页脚。
 */

import type { ReactNode } from 'react';

import { Link } from '../lib/router';
import { useSession } from '../contexts/SessionContext';
import './site-footer.css';

export function SiteFooter(): ReactNode {
  const { user, isAuthenticated } = useSession();
  const creatorUser = isAuthenticated && user !== null && user.role !== 'admin' ? user : null;

  return (
    <footer className="ccw-footer">
      <div className="ccw-footer__inner">
        <span className="ccw-footer__brand">薯片社区</span>
        <nav className="ccw-footer__links" aria-label="页脚相关链接">
          <Link to="/about">社区简介</Link>
          {creatorUser ? (
            <>
              <Link to={`/@${creatorUser.username}`}>我的主页</Link>
              <Link to="/workspace">工作区</Link>
            </>
          ) : null}
          {!isAuthenticated ? (
            <>
              <Link to="/login">登录</Link>
              <Link to="/register">注册</Link>
            </>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
