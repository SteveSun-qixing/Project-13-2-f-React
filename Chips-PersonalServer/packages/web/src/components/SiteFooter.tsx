import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function SiteFooter() {
  const { user, isAuthenticated } = useAuth();
  const creatorUser = isAuthenticated && user?.role !== 'admin' ? user : null;

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__brand">薯片社区</span>

        <nav className="site-footer__links" aria-label="页脚相关链接">
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
