import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import './AboutPage.css';

const sections = [
  {
    title: '产品定位',
    body: '薯片个人服务器是单用户的内容服务器：自己的卡片与箱子统一沉淀在一个清爽、克制、有质感的空间里，随时可以被任何人浏览。',
  },
  {
    title: '内容与渲染',
    body: '服务器保存 .card 与 .box 源文件，并接收薯片客户端渲染好的查看与封面产物。浏览器打开页面时直接加载产物，不依赖服务端渲染。',
  },
  {
    title: '使用路径',
    body: '创作者在薯片客户端中制作内容并发布到个人服务器；访客通过主页浏览作品，进入卡片或箱子页面阅读。',
  },
  {
    title: '插件与生态',
    body: '个人服务器完全遵循薯片生态的文件格式与传输协议，与客户端、SDK 和其他生态软件可以无缝配合。',
  },
] as const;

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container about-page">
      <section className="panel about-hero">
        <span className="eyebrow">关于</span>
        <h1>关于</h1>
        <p className="muted">自己的服务器上，用卡片记录灵感，用箱子组织作品。</p>
        <div>
          <Button onClick={() => navigate('/')}>返回主页</Button>
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
