import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import './AboutPage.css';

const sections = [
  {
    title: '产品定位',
    body: '薯片社区不是传统信息流，而是以个人为单位的作品主页集合。每个用户都有自己的社区门面，卡片和箱子统一沉淀在一个清爽、克制、有质感的空间里。',
  },
  {
    title: '系统边界',
    body: '社区服务器与 Host 同根同源，但互不依赖。服务器侧拥有自己的 Web 主题、图标和多语言运行时，更适合浏览器环境与高并发服务。',
  },
  {
    title: '使用路径',
    body: '访客从欢迎页了解社区，再进入个人主页浏览作品。作者登录后从主页右上角进入工作区上传内容。管理员则通过独立后台完成治理工作。',
  },
  {
    title: '插件与生态',
    body: '插件能力尽量复用同一套生态哲学，但社区站点不会要求普通用户安装 Host。公共能力在服务器架构中复制并二次优化，以适配 Web。 ',
  },
] as const;

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container about-page">
      <section className="panel about-hero">
        <span className="eyebrow">社区简介</span>
        <h1>社区简介</h1>
        <p className="muted">欢迎页负责讲清楚社区，个人页负责承载创作，后台负责平台治理。</p>
        <div>
          <Button onClick={() => navigate('/')}>返回欢迎页</Button>
        </div>
      </section>

      <section className="about-grid">
        {sections.map((section) => (
          <article key={section.title} className="panel about-card">
            <span className="eyebrow">{section.title}</span>
            <h2>{section.title}</h2>
            <p className="muted">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
