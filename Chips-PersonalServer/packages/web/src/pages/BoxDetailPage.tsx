import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Result } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { BoxDetail } from '../api/content';
import { prefetchBoxDetail, readPrefetchedBoxDetail } from '../lib/box-detail-prefetch';
import { getErrorMessage } from '../lib/ui';

export default function BoxDetailPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const navigate = useNavigate();
  const [box, setBox] = useState<BoxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!boxId) {
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    (readPrefetchedBoxDetail(boxId) ?? prefetchBoxDetail(boxId))
      .then((response) => {
        if (active) {
          setBox(response);
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
  }, [boxId]);

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

  if (!box || error) {
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

  if (!box.documentUrl) {
    return (
      <div className="document-viewer">
        <Button className="document-viewer__back" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>
        <Result
          status="info"
          title="箱子文档尚未发布"
          subTitle="这个箱子还没有可查看的文档页面。"
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
        <strong>{box.title}</strong>
        <span>{new Date(box.createdAt).toLocaleDateString('zh-CN')}</span>
      </div>
      <iframe
        className="document-viewer__frame"
        src={box.documentUrl}
        title={box.title}
        allow="fullscreen"
      />
    </div>
  );
}
