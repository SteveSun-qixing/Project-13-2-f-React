import { useEffect, useMemo, useState } from 'react';
import { EmbeddedDocumentFrame } from '@chips/ui';
import { getChipsClient } from '../../services/bridge-client';
import { toDisplayErrorMessage } from '../../utils/error';

interface BoxCoverViewState {
  title: string;
  coverUrl: string;
  ratio?: string;
}

export interface BoxCoverSurfaceProps {
  boxPath: string;
  title: string;
  ratio?: string;
  className?: string;
  onActivate?: () => void;
}

export function BoxCoverSurface({
  boxPath,
  title,
  ratio,
  className,
  onActivate,
}: BoxCoverSurfaceProps) {
  const client = useMemo(() => getChipsClient(), []);
  const [view, setView] = useState<BoxCoverViewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boxPath) {
      setView(null);
      setError(null);
      return;
    }

    let disposed = false;
    setError(null);

    void client.box.renderCover(boxPath).then((nextView) => {
      if (disposed) {
        return;
      }

      setView({
        title: nextView.title || title,
        coverUrl: nextView.coverUrl,
        ratio: nextView.ratio,
      });
    }).catch((reason) => {
      if (disposed) {
        return;
      }

      setView(null);
      setError(toDisplayErrorMessage(reason, '箱子封面加载失败'));
    });

    return () => {
      disposed = true;
    };
  }, [boxPath, client, title]);

  if (error) {
    return (
      <div className={className}>
        <div className="box-cover-surface__error">{error}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <EmbeddedDocumentFrame
        surfaceId={boxPath}
        title={view?.title || title}
        src={view?.coverUrl}
        ratio={view?.ratio ?? ratio ?? '3:4'}
        scope="box-cover-frame"
        onActivate={onActivate ? () => onActivate() : undefined}
      />
    </div>
  );
}
