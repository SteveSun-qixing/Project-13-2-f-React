/**
 * 社区简介页（`pages/` 简介页，路由 `/about`，《14 设计》§7.1）：
 * 面向临时访客讲清社区定位、系统边界、使用路径与发布方式。
 */

import type { ReactNode } from 'react';

import { Link } from '../lib/router';
import './about.css';

const SECTIONS = [
  {
    title: '产品定位',
    body: '薯片社区不是传统信息流，而是以个人为单位的作品主页集合。每个用户都有自己的社区门面，卡片和箱子统一沉淀在一个清爽、克制、有质感的空间里。',
  },
  {
    title: '系统边界',
    body: '社区服务器是独立部署的服务端产品，与薯片桌面平台互不依赖：平台内创作，社区内分享，两端只通过开放契约对接。',
  },
  {
    title: '使用路径',
    body: '访客从欢迎页了解社区，再进入个人主页浏览作品。作者登录后把作品发布到社区，浏览器端只负责浏览；管理员通过独立后台完成治理工作。',
  },
  {
    title: '发布方式',
    body: '作品发布由薯片客户端的统一传输链路完成，网页端不提供上传与完整下载入口；内容直达页承载服务端渲染的查看与封面产物。',
  },
] as const;

export default function AboutPage(): ReactNode {
  return (
    <div className="ccw-page ccw-about">
      <section className="ccw-panel ccw-about__hero">
        <span className="ccw-eyebrow">社区简介</span>
        <h1>社区简介</h1>
        <p className="ccw-muted">欢迎页负责讲清楚社区，个人页负责承载创作，后台负责平台治理。</p>
        <div className="ccw-about__hero-actions">
          <Link className="ccw-button ccw-button--secondary" to="/">
            返回欢迎页
          </Link>
        </div>
      </section>

      <section className="ccw-about__grid" aria-label="社区简介内容">
        {SECTIONS.map((section) => (
          <article key={section.title} className="ccw-panel ccw-about-card">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
