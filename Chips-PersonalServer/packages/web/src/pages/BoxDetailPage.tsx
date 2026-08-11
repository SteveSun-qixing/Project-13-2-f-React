import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { BoxDetail } from '../api/content';
import { DocumentPluginRoutePage, type DocumentRouteSource } from './DocumentPluginRoutePage';
import { prefetchBoxDetail, readPrefetchedBoxDetail } from '../lib/box-detail-prefetch';
import { getErrorMessage } from '../lib/ui';

export default function BoxDetailPage() {
  const { boxId } = useParams<{ boxId: string }>();
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

  const source: DocumentRouteSource | null =
    boxId && box?.documentUrl
      ? {
          kind: 'community-box',
          boxId,
          title: box.title,
          createdAt: box.createdAt,
          documentUrl: box.documentUrl,
          canonicalUrl: `/boxes/${boxId}`,
          ...(box.coverUrl ? { coverUrl: box.coverUrl } : undefined),
          ...(box.coverFragmentUrl ? { coverFragmentUrl: box.coverFragmentUrl } : undefined),
          ...(box.coverRenderMode ? { coverRenderMode: box.coverRenderMode } : undefined),
          ...(box.coverRatio ? { coverRatio: box.coverRatio } : undefined),
        }
      : null;

  return (
    <DocumentPluginRoutePage
      source={source}
      loading={loading}
      pending={Boolean(box && !box.documentUrl && !error)}
      error={error}
      pendingLabel="箱子查看文档正在准备中，请稍后刷新。"
      trigger="community-box-route"
    />
  );
}
