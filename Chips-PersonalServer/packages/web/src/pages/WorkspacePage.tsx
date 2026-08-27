import { Link } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import './WorkspacePage.css';

export default function WorkspacePage() {
  return (
    <div className="page-container workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="eyebrow">客户端发布</span>
          <h1>客户端发布</h1>
          <p className="muted">浏览器只负责查看个人服务器上的内容，卡片与箱子的发布和渲染在薯片客户端中完成。</p>
        </div>

        <Link to="/">
          <Button icon={<ArrowLeftOutlined />}>
            返回主页
          </Button>
        </Link>
      </header>

      <section className="panel workspace-client-publish">
        <div className="workspace-client-publish__icon" aria-hidden="true">
          <UploadOutlined style={{ fontSize: 28 }} />
        </div>
        <div className="workspace-client-publish__copy">
          <h2>请在薯片客户端中发布卡片与箱子</h2>
          <p>网页端不接收 .card / .box 上传，也不会在浏览器中打包或下载完整文件。客户端的统一卡片传输模块负责资源直传、网络资源卡片生成、卡片与箱子的渲染产物上传，以及完整文件下载恢复。</p>
        </div>
        <div className="workspace-client-publish__steps" aria-label="客户端发布步骤">
          <article>
            <strong>制作内容</strong>
            <span>在电脑或手机客户端中编辑并保存完整 .card 与 .box。</span>
          </article>
          <article>
            <strong>客户端发布</strong>
            <span>客户端模块把资源上传对象存储，生成网络资源卡片，并渲染查看与封面产物一并上传。</span>
          </article>
          <article>
            <strong>网页查看</strong>
            <span>发布完成后，浏览器直接打开个人服务器上由客户端渲染的产物页面。</span>
          </article>
        </div>
      </section>
    </div>
  );
}
