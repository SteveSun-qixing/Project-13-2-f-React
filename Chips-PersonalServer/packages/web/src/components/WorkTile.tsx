import { useEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { CheckOutlined } from '@ant-design/icons';
import { getInitial, getWorkCoverStyle } from '../lib/ui';
import { prefetchCardOpenView } from '../lib/card-open-view-prefetch';
import { prefetchBoxDetail } from '../lib/box-detail-prefetch';
import type { CommunityWorkItem } from '../types/community';

interface WorkTileProps {
  item: CommunityWorkItem;
  manageMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (item: CommunityWorkItem) => void;
}

export function WorkTile({ item, manageMode = false, selected = false, onToggleSelection }: WorkTileProps) {
  const isCard = item.type === 'card';
  const coverStyle = getWorkCoverStyle(item.coverRatio) as CSSProperties;
  const rootRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const setRootRef = (node: HTMLAnchorElement | HTMLButtonElement | null) => {
    rootRef.current = node;
  };

  const prefetchWork = () => {
    if (manageMode) {
      return;
    }
    if (item.type === 'card') {
      void prefetchCardOpenView(item.id).catch(() => undefined);
    } else {
      void prefetchBoxDetail(item.id).catch(() => undefined);
    }
  };

  useEffect(() => {
    if (manageMode || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const element = rootRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          prefetchWork();
          observer.disconnect();
        }
      },
      { rootMargin: '360px 0px' },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [item.id, item.type, manageMode]);

  const content = (
    <article className="work-tile__surface">
      <div className="work-tile__cover-stage">
        <div className="work-tile__cover-shell">
          <div className="work-tile__cover-clip">
            {item.coverUrl && isCard ? (
              <iframe
                className="work-tile__cover-frame"
                src={item.coverUrl}
                title={item.title}
                loading="lazy"
                sandbox="allow-scripts"
                scrolling="no"
              />
            ) : item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} loading="lazy" />
            ) : (
              <div className="work-tile__placeholder">
                <span>{getInitial(item.title)}</span>
              </div>
            )}
          </div>

          {manageMode ? (
            <span
              className={`work-tile__selection-badge${selected ? ' is-selected' : ''}`}
              aria-hidden="true"
            >
              {selected ? <CheckOutlined /> : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="work-tile__label">
        <h2>{item.title}</h2>
      </div>
    </article>
  );

  if (manageMode) {
    return (
      <button
        ref={setRootRef}
        type="button"
        className={`work-tile work-tile--${item.type} work-tile--manage${selected ? ' is-selected' : ''}`}
        style={coverStyle}
        onClick={() => onToggleSelection?.(item)}
        aria-pressed={selected}
        aria-label={`选择${item.type === 'card' ? '卡片' : '箱子'} ${item.title}`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      ref={setRootRef}
      to={item.href}
      className={`work-tile work-tile--${item.type}`}
      style={coverStyle}
      aria-label={`${item.title} · ${item.type === 'card' ? '卡片' : '箱子'}`}
      onMouseEnter={prefetchWork}
      onFocus={prefetchWork}
    >
      {content}
    </Link>
  );
}
