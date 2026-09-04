import React from 'react';
import { Alert, Spin } from 'antd';
import { PageCanvas } from './components/PageCanvas';
import type { Block, SectionSettings } from '../../engine/docx-engine/src/types';
import { DEFAULT_SECTION } from '../../engine/docx-engine/src/section';
import { formatMessage } from './lib/messages';

interface WordViewerProps {
  /** 解析后的文档块列表 */
  blocks: Block[];
  /** 文档评论列表 */
  comments?: Block[];
  /** 页面设置 */
  sectionSettings?: SectionSettings;
  /** 加载状态 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 缩放比例 */
  zoom?: number;
  /** 当前页码 */
  currentPage?: number;
  /** 总页数 */
  totalPages?: number;
  /** 选中块 ID */
  selectedBlockId?: string | null;
  /** 选中评论 ID */
  selectedCommentId?: string | null;
  /** 块点击回调 */
  onBlockClick?: (blockId: string) => void;
  /** 评论点击回调 */
  onCommentClick?: (commentId: string) => void;
}

export function WordViewer({
  blocks,
  comments = [],
  sectionSettings = DEFAULT_SECTION,
  isLoading = false,
  error = null,
  zoom = 100,
  currentPage = 1,
  totalPages = 1,
  selectedBlockId = null,
  selectedCommentId = null,
  onBlockClick,
  onCommentClick,
}: WordViewerProps) {
  if (error) {
    return (
      <div className="word-viewer word-viewer--error">
        <Alert
          message={formatMessage('word.editor.error')}
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="word-viewer word-viewer--loading">
        <Spin size="large" />
        <p>{formatMessage('word.editor.loading')}</p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="word-viewer word-viewer--empty">
        <p>{formatMessage('word.editor.empty')}</p>
      </div>
    );
  }

  return (
    <div className="word-viewer">
      <PageCanvas
        blocks={blocks}
        sectionSettings={sectionSettings}
        zoom={zoom}
        currentPage={currentPage}
        totalPages={totalPages}
        selectedBlockId={selectedBlockId}
        readOnly={true}
        isLoading={false}
        isEmpty={false}
        onBlockClick={(blockId) => onBlockClick?.(blockId)}
      />

      <div className="word-viewer__statusbar">
        <span className="word-viewer__page">
          {formatMessage('word.statusBar.page', {
            current: currentPage,
            total: totalPages,
          })}
        </span>
        <span className="word-viewer__mode">
          {formatMessage('word.statusBar.readOnly')}
        </span>
        <span className="word-viewer__zoom">
          {formatMessage('word.statusBar.zoom', { percent: zoom })}
        </span>
      </div>
    </div>
  );
}

export default WordViewer;
