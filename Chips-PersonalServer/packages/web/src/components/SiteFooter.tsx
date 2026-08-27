import { Link } from 'react-router-dom';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__brand">薯片个人服务器</span>

        <nav className="site-footer__links" aria-label="页脚相关链接">
          <Link to="/about">关于</Link>
          <Link to="/workspace">发布</Link>
        </nav>
      </div>
    </footer>
  );
}
