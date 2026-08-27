import { useEffect } from 'react';
import { Button } from 'antd';
import { getAdminHref } from '../lib/ui';

export default function AdminRedirectPage() {
  const adminHref = getAdminHref();

  useEffect(() => {
    window.location.assign(adminHref);
  }, [adminHref]);

  return (
    <div className="page-container">
      <section className="panel error-panel">
        <h1>正在前往管理员后台</h1>
        <p className="muted">管理员后台是独立的前端入口。当前会自动跳转；如果没有自动打开，可以点击下方按钮。</p>
        <a href={adminHref}>
          <Button type="primary">打开管理员后台</Button>
        </a>
      </section>
    </div>
  );
}
