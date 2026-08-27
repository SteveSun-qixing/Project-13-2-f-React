import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Result } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { CardOpenView } from '../api/content';
import { prefetchCardOpenView, readPrefetchedCardOpenView } from '../lib/card-open-view-prefetch';
import { getErrorMessage } from '../lib/ui';

export default function CardDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardOpenView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cardId) {
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    (readPrefetchedCardOpenView(cardId) ?? prefetchCardOpenView(cardId))
      .then((response) => {
        if (active) {
          setCard(response);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(getErrorMessage(nextError, '没有找到目标内容。'));
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
  }, [cardId]);

  const isReady = card?.viewState === 'ready' && Boolean(card.viewUrl);
  const isPending = Boolean(card && !isReady && card.status !== 'error');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="document-viewer">
        <div className="page-loader">加载中…</div>
      </div>
    );
  }

  if (!card || error) {
    return (
      <div className="document-viewer">
        <Result
          status="404"
          title="404"
          subTitle={error || '没有找到目标内容。'}
          extra={<Button onClick={handleBack}>返回</Button>}
        />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="document-viewer">
        <Button className="document-viewer__back" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>
        <Result
          status="info"
          title="卡片尚未渲染"
          subTitle="这张卡片还没有上传查看产物。请使用薯片客户端重新发布并上传渲染结果。"
          extra={<Button onClick={handleBack}>返回</Button>}
        />
      </div>
    );
  }

  return (
    <div className="document-viewer">
      <Button className="document-viewer__back" icon={<ArrowLeftOutlined />} onClick={handleBack}>
        返回
      </Button>
      <div className="document-viewer__info">
        <strong>{card.title}</strong>
        <span>{new Date(card.createdAt).toLocaleDateString('zh-CN')}</span>
      </div>
      <iframe
        className="document-viewer__frame"
        src={card.viewUrl}
        title={card.title}
        allow="fullscreen"
      />
    </div>
  );
}
