import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import './HomePage.css';

const ideaCards = [
  { title: '慢一点', body: '不追信息流，只给作品留出呼吸感。', tone: 'mint' },
  { title: '拆开来', body: '卡片、箱子、插件各自独立，又能自然组合。', tone: 'peach' },
  { title: '好看地连接', body: '分享不是喧闹的广场，而是漂亮的入口。', tone: 'sky' },
] as const;

const floatingCards = [
  { label: '个人主页', className: 'home-card-cloud__card--profile' },
  { label: '箱子空间', className: 'home-card-cloud__card--box' },
  { label: '灵感卡片', className: 'home-card-cloud__card--card' },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const primaryHref = user ? `/@${user.username}` : '/register';

  return (
    <div className="home-simple">
      <section className="home-simple__hero" aria-labelledby="home-title">
        <div className="home-simple__copy">
          <p className="home-simple__eyebrow">薯片社区</p>
          <h1 id="home-title">让想法像薯片一样轻轻展开</h1>
          <p className="home-simple__lead">卡片承载灵感，箱子收纳关系，社区只做一件事：给创作一个清爽、安静、好看的入口。</p>
          <p className="home-simple__belief">我们相信工具应该柔软、模块应该自由、内容应该被温柔地看见。</p>

          <nav className="home-simple__actions" aria-label="首页主要操作">
            <Button type="primary" size="large" onClick={() => navigate(primaryHref)}>
              {user ? '打开个人主页' : '创建主页'}
            </Button>
            <Button size="large" onClick={() => navigate('/about')}>
              了解一下
            </Button>
            {!user ? (
              <Button type="text" size="large" onClick={() => navigate('/login')}>
                登录账号
              </Button>
            ) : null}
          </nav>
        </div>

        <div className="home-card-cloud" aria-label="薯片社区卡片视觉">
          {floatingCards.map((card) => (
            <div key={card.label} className={`home-card-cloud__card ${card.className}`}>
              <span>{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-simple__ideas" aria-label="薯片生态理念">
        {ideaCards.map((card) => (
          <article key={card.title} className={`home-idea-card home-idea-card--${card.tone}`}>
            <span className="home-idea-card__spark" />
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
