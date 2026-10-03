/**
 * 欢迎页（`pages/` 欢迎页，路由 `/`，《14 设计》§7.2）：
 * 未登录为欢迎页；已登录由根路由分流（普通用户跳个人主页、管理员跳后台）。
 * 不承载发现、搜索、统计与最新内容橱窗（§1.2 明确不做）。
 */

import type { ReactNode } from 'react';

import { useSession } from '../contexts/SessionContext';
import { Link } from '../lib/router';
import './welcome.css';

const FEATURES = [
  { title: '灵感卡片', body: '用卡片承载灵感，自由组合。' },
  { title: '箱子空间', body: '把作品有序收纳进箱子。' },
  { title: '社区分享', body: '以整洁的方式展示与分享创作。' },
] as const;

export default function WelcomePage(): ReactNode {
  const { user } = useSession();
  const primaryHref = user ? `/@${user.username}` : '/register';
  const primaryLabel = user ? '打开个人主页' : '创建主页';

  return (
    <div className="ccw-page ccw-welcome">
      <section className="ccw-welcome__hero" aria-labelledby="ccw-welcome-title">
        <p className="ccw-eyebrow">薯片社区</p>
        <h1 id="ccw-welcome-title">让信息结构脱离程序独立存在</h1>
        <p className="ccw-welcome__subtitle">用卡片记录灵感，用箱子组织作品，安静地创作与分享。</p>
        <div className="ccw-welcome__actions" aria-label="首页主要操作">
          <Link className="ccw-button ccw-button--primary ccw-button--large" to={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="ccw-button ccw-button--secondary ccw-button--large" to="/about">
            了解更多
          </Link>
        </div>
      </section>

      <section className="ccw-welcome__features" aria-label="薯片社区功能">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="ccw-welcome-feature">
            <span className="ccw-welcome-feature__mark" aria-hidden="true" />
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
