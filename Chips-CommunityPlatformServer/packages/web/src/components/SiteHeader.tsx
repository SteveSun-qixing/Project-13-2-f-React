import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { useAuth } from '../contexts/AuthContext';

export function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const showCreatorNav = isAuthenticated && user?.role !== 'admin';

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-brand">
          <span className="site-brand__mark" />
          <div>
            <strong>薯片社区</strong>
            <span>欢迎页、社区简介、个人主页、上传工作区与后台管理</span>
          </div>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          <NavLink to="/" end>欢迎</NavLink>
          <NavLink to="/about">社区简介</NavLink>
          {showCreatorNav && user ? <NavLink to={`/@${user.username}`}>我的主页</NavLink> : null}
          {showCreatorNav ? <NavLink to="/workspace">工作区</NavLink> : null}
        </nav>

        <div className="site-actions">
          {isAuthenticated && user ? (
            <>
              <Button onClick={() => navigate(`/@${user.username}`)}>{user.username}</Button>
              <Button onClick={() => void logout()}>退出登录</Button>
            </>
          ) : (
            <>
              <Button type="text" onClick={() => navigate('/login')}>登录</Button>
              <Button type="primary" onClick={() => navigate('/register')}>注册</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
