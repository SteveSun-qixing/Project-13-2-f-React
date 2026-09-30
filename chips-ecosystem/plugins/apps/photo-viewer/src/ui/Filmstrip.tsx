import { PictureOutlined } from '@chips/ui';
import React, { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { theme } from '@chips/ui';

/**
 * 胶片条（图包队列缩略图导航；语义随《03-查看器设计》§3.1 队列与 §4.4 队列行）。
 * 缩略图命中字节缓存时展示，否则以占位图标呈现；当前项自动滚动居中。
 */

export interface FilmstripItem {
  readonly uri: string;
  readonly fileName: string;
  readonly thumbSrc: string | null;
}

export interface FilmstripProps {
  readonly items: readonly FilmstripItem[];
  readonly currentIndex: number;
  readonly onSelect: (index: number) => void;
  readonly visible: boolean;
}

export function Filmstrip(props: FilmstripProps): ReactElement {
  const { items, currentIndex, onSelect, visible } = props;
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    const currentItem = itemRefs.current.get(currentIndex);
    if (!container || !currentItem || typeof container.scrollTo !== 'function') {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetScrollLeft =
      currentItem.offsetLeft + currentItem.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left: targetScrollLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [currentIndex, items.length]);

  if (!visible || items.length <= 1) {
    return <React.Fragment />;
  }

  return (
    <div
      data-role="filmstrip"
      ref={containerRef}
      aria-label="图片队列"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 76,
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        gap: token.marginXS,
        padding: token.paddingXXS,
        overflowX: 'auto',
        overflowY: 'hidden',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      {items.map((item, index) => {
        const isCurrent = index === currentIndex;
        return (
          <button
            key={item.uri}
            data-role="filmstrip-item"
            ref={(element) => {
              itemRefs.current.set(index, element);
            }}
            type="button"
            aria-label={item.fileName}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() => {
              onSelect(index);
            }}
            style={{
              flex: '0 0 auto',
              width: 64,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              padding: 2,
              cursor: 'pointer',
              borderRadius: token.borderRadiusSM,
              border: `2px solid ${isCurrent ? token.colorPrimary : 'transparent'}`,
              background: token.colorFillQuaternary,
              overflow: 'hidden',
            }}
          >
            {item.thumbSrc !== null ? (
              <img
                src={item.thumbSrc}
                alt=""
                decoding="async"
                draggable={false}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            ) : (
              <span aria-hidden="true" style={{ color: token.colorTextSecondary, display: 'grid' }}>
                <PictureOutlined />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
