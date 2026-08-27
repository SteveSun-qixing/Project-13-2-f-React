import { Link, NavLink } from 'react-router-dom';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-brand">
          <span className="site-brand__mark" />
          <div>
            <strong>薯片个人服务器</strong>
            <span>个人作品展示与分享</span>
          </div>
        </Link>

        <nav className="site-nav" aria-label="主导航">
          <NavLink to="/" end>主页</NavLink>
          <NavLink to="/about">关于</NavLink>
          <NavLink to="/workspace">发布</NavLink>
        </nav>
      </div>
    </header>
  );
}
