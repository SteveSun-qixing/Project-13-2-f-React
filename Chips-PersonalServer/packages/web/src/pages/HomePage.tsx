import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { AppstoreOutlined, FileOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import './HomePage.css';

const features = [
  { icon: <FileOutlined />, title: '灵感卡片', body: '用卡片承载灵感，自由组合。' },
  { icon: <AppstoreOutlined />, title: '箱子空间', body: '把作品有序收纳进箱子。' },
  { icon: <TeamOutlined />, title: '社区分享', body: '以整洁的方式展示与分享创作。' },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const primaryHref = user ? `/@${user.username}` : '/register';

  return (
    <div className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <p className="home__eyebrow">薯片社区</p>
        <h1 id="home-title">让信息结构脱离程序独立存在</h1>
        <p className="home__subtitle">用卡片记录灵感，用箱子组织作品，安静地创作与分享。</p>
        <div className="home__actions" aria-label="首页主要操作">
          <Button type="primary" size="large" onClick={() => navigate(primaryHref)}>
            {user ? '打开个人主页' : '创建主页'}
          </Button>
          <Button size="large" onClick={() => navigate('/about')}>
            了解更多
          </Button>
        </div>
      </section>

      <section className="home__features" aria-label="薯片社区">
        {features.map((feature) => (
          <article key={feature.title} className="home-feature">
            <span className="home-feature__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
