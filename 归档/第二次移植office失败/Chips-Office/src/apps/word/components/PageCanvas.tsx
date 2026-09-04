import React, { useCallback, useMemo, useRef } from 'react';
import { Spin } from 'antd';
import { BlockRenderer } from './BlockRenderer';
import type { Block, SectionSettings } from '../../../engine/docx-engine/src/types';
import type { PageDimensions } from '../types';
import { formatMessage } from '../lib/messages';

interface PageCanvasProps {
  blocks: Block[];
  sectionSettings: SectionSettings;
  zoom: number;
  currentPage: number;
  totalPages: number;
  selectedBlockId: string | null;
  readOnly: boolean;
  isLoading?: boolean;
  isEmpty?: boolean;
  onBlockClick: (blockId: string) => void;
  onBlockSelect?: (blockId: string, selection: { start: number; end: number }) => void;
  onScroll?: (scrollTop: number) => void;
}

const TWIPS_PER_INCH = 1440;
const DEFAULT_DPI = 96;

export function PageCanvas({
  blocks,
  sectionSettings,
  zoom,
  currentPage,
  totalPages,
  selectedBlockId,
  readOnly,
  isLoading = false,
  isEmpty = false,
  onBlockClick,
  onBlockSelect,
  onScroll,
}: PageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const pageDimensions = useMemo<PageDimensions>(() => {
    const { pageWidth, pageHeight, marginTop, marginBottom, marginLeft, marginRight } = sectionSettings;
    const dpiFactor = DEFAULT_DPI / TWIPS_PER_INCH;

    return {
      widthTwips: pageWidth || 12240,
      heightTwips: pageHeight || 15840,
      marginTop: marginTop || 1440,
      marginBottom: marginBottom || 1440,
      marginLeft: marginLeft || 1440,
      marginRight: marginRight || 1440,
      dpiFactor,
    };
  }, [sectionSettings]);

  const pageStyle = useMemo(() => {
    const scale = zoom / 100;
    const dpiFactor = pageDimensions.dpiFactor;

    const widthPx = pageDimensions.widthTwips * dpiFactor * scale;
    const heightPx = pageDimensions.heightTwips * dpiFactor * scale;
    const paddingTopPx = pageDimensions.marginTop * dpiFactor * scale;
    const paddingRightPx = pageDimensions.marginRight * dpiFactor * scale;
    const paddingBottomPx = pageDimensions.marginBottom * dpiFactor * scale;
    const paddingLeftPx = pageDimensions.marginLeft * dpiFactor * scale;

    return {
      width: `${widthPx}px`,
      minHeight: `${heightPx}px`,
      paddingTop: `${paddingTopPx}px`,
      paddingRight: `${paddingRightPx}px`,
      paddingBottom: `${paddingBottomPx}px`,
      paddingLeft: `${paddingLeftPx}px`,
    };
  }, [pageDimensions, zoom]);

  const handleScroll = useCallback(() => {
    if (containerRef.current && onScroll) {
      onScroll(containerRef.current.scrollTop);
    }
  }, [onScroll]);

  const handleBlockClick = useCallback(
    (blockId: string) => {
      onBlockClick(blockId);
    },
    [onBlockClick]
  );

  const handleBlockSelect = useCallback(
    (blockId: string, selection: { start: number; end: number }) => {
      if (onBlockSelect) {
        onBlockSelect(blockId, selection);
      }
    },
    [onBlockSelect]
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="word-canvas__loading">
          <Spin size="large" />
          <p>{formatMessage('word.editor.loading')}</p>
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div className="word-canvas__empty">
          <p>{formatMessage('word.editor.empty')}</p>
        </div>
      );
    }

    return (
      <div className="word-canvas__page">
        <div className="word-canvas__blocks">
          {blocks.map((block) => (
            <BlockRenderer
              key={block.id}
              block={block}
              pageDimensions={pageDimensions}
              zoom={zoom}
              isSelected={block.id === selectedBlockId}
              readOnly={readOnly}
              onBlockClick={handleBlockClick}
              onTextSelect={handleBlockSelect}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="word-canvas"
      onScroll={handleScroll}
      role="region"
      aria-label="文档页面"
    >
      <div className="word-canvas__container">
        <div className="word-canvas__background" style={pageStyle}>
          {renderContent()}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="word-canvas__pagination">
          <span className="word-canvas__page-indicator">
            {formatMessage('word.statusBar.page', {
              current: currentPage,
              total: totalPages,
            })}
          </span>
        </div>
      )}
    </div>
  );
}

export default PageCanvas;
