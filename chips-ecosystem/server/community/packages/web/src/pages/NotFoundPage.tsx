/**
 * 404 页（`pages/` 404，路由 `*`，《14 设计》§7.2）：未知路径的兜底页面。
 */

import type { ReactNode } from 'react';

import { Link } from '../lib/router';
import './not-found.css';

export default function NotFoundPage(): ReactNode {
  return (
    <div className="ccw-page ccw-not-found">
      <section className="ccw-panel ccw-not-found__card">
        <p className="ccw-not-found__code">404</p>
        <h1>页面不存在或尚未开放</h1>
        <p className="ccw-muted">内容可能已被删除、转为私有，或尚未随当前版本开放。</p>
        <div className="ccw-not-found__actions">
          <Link className="ccw-button ccw-button--secondary" to="/">
            返回欢迎页
          </Link>
        </div>
      </section>
    </div>
  );
}
