import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { AppstoreOutlined, FileOutlined, HomeOutlined } from '@ant-design/icons';
import { boxesApi, cardsApi, type BoxSummary, type CardSummary } from '../api/content';
import { WorkGrid } from '../components/WorkGrid';
import { getErrorMessage } from '../lib/ui';
import type { CommunityWorkItem } from '../types/community';
import './HomePage.css';

const features = [
  { icon: <FileOutlined />, title: '灵感卡片', body: '用卡片承载灵感，自由组合。' },
  { icon: <AppstoreOutlined />, title: '箱子空间', body: '把作品有序收纳进箱子。' },
  { icon: <HomeOutlined />, title: '个人空间', body: '自己的服务器，自己的作品集。' },
] as const;

function toCommunityWorks(cards: CardSummary[], boxes: BoxSummary[]): CommunityWorkItem[] {
  const cardItems = cards
    .filter((card) => card.visibility === 'public' && card.status === 'ready')
    .map<CommunityWorkItem>((card) => ({
      id: card.id,
      type: 'card',
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      href: `/cards/${card.id}`,
      createdAt: card.createdAt,
    }));

  const boxItems = boxes
    .filter((box) => box.visibility === 'public')
    .map<CommunityWorkItem>((box) => ({
      id: box.id,
      type: 'box',
      title: box.title,
      coverUrl: box.coverUrl,
      coverRatio: box.coverRatio,
      href: `/boxes/${box.id}`,
      createdAt: box.createdAt,
    }));

  return [...cardItems, ...boxItems].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export default function HomePage() {
  const [items, setItems] = useState<CommunityWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    void Promise.all([cardsApi.getAllCards(), boxesApi.getAllBoxes()])
      .then(([cards, boxes]) => {
        if (active) {
          setItems(toCommunityWorks(cards, boxes));
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(getErrorMessage(nextError, '作品加载失败，请稍后重试。'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const pageBody = useMemo<ReactNode>(() => {
    if (loading) {
      return (
        <div className="work-grid">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="panel skeleton-tile" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <section className="panel error-panel profile-state">
          <h1>{error}</h1>
          <Button onClick={() => setReloadKey((value) => value + 1)}>重试</Button>
        </section>
      );
    }

    return <WorkGrid items={items} />;
  }, [error, items, loading]);

  return (
    <div className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <p className="home__eyebrow">薯片个人服务器</p>
        <h1 id="home-title">让信息结构脱离程序独立存在</h1>
        <p className="home__subtitle">自己的服务器上，用卡片记录灵感，用箱子组织作品。</p>
      </section>

      <section className="home__features" aria-label="薯片个人服务器">
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

      <div className="page-container">
        {error ? <Alert type="error" message={error} showIcon /> : null}
        {pageBody}
      </div>
    </div>
  );
}
