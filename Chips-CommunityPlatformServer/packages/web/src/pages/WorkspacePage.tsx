import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './WorkspacePage.css';

export default function WorkspacePage() {
  const { user } = useAuth();
  const profileHref = useMemo(() => (user ? `/@${user.username}` : '/login'), [user]);

  if (!user) {
    return null;
  }

  return (
    <div className="page-container workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="eyebrow">客户端发布</span>
          <h1>客户端发布</h1>
          <p className="muted">浏览器只负责查看社区内容，卡片上传和完整下载需要在薯片客户端中完成。</p>
        </div>

        <Link to={profileHref}>
          <Button icon={<ArrowLeftOutlined />}>
            返回我的主页
          </Button>
        </Link>
      </header>

      <section className="panel workspace-client-publish">
        <div className="workspace-client-publish__icon" aria-hidden="true">
          <UploadOutlined style={{ fontSize: 28 }} />
        </div>
        <div className="workspace-client-publish__copy">
          <h2>请在薯片客户端中发布卡片</h2>
          <p>网页端不再接收 .card 上传，也不会在浏览器中打包或下载完整卡片。客户端的统一卡片传输模块会负责资源直传、网络资源卡片生成、网页查看缓存和完整卡片下载恢复。</p>
        </div>
        <div className="workspace-client-publish__steps" aria-label="客户端发布步骤">
          <article>
            <strong>制作卡片</strong>
            <span>在电脑或手机客户端中编辑并保存完整 .card。</span>
          </article>
          <article>
            <strong>客户端发布</strong>
            <span>客户端模块把资源上传对象存储，并生成网络资源卡片。</span>
          </article>
          <article>
            <strong>网页查看</strong>
            <span>发布完成后，浏览器只打开社区页面和查看缓存。</span>
          </article>
        </div>
      </section>
    </div>
  );
}
