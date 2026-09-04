import React, { useCallback, useMemo } from 'react';
import { List, Button, Input, Empty, Popconfirm } from 'antd';
import { CommentOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import type { CommentInfo } from '../../../engine/docx-engine/src/types';
import { formatMessage } from '../lib/messages';

interface CommentPanelProps {
  comments: CommentInfo[];
  selectedCommentId: string | null;
  onSelectComment: (commentId: string | null) => void;
  onAddComment: (content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onResolveComment: (commentId: string) => void;
  onReplyComment?: (commentId: string, content: string) => void;
}

export function CommentPanel({
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  onDeleteComment,
  onResolveComment,
  onReplyComment,
}: CommentPanelProps) {
  const [newCommentText, setNewCommentText] = React.useState('');

  const handleAddComment = useCallback(() => {
    if (newCommentText.trim()) {
      onAddComment(newCommentText.trim());
      setNewCommentText('');
    }
  }, [newCommentText, onAddComment]);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderCommentItem = (comment: CommentInfo) => {
    const isSelected = comment.id === selectedCommentId;
    const isResolved = (comment as unknown as { done?: boolean }).done;

    return (
      <div
        className={`comment-item${isSelected ? ' comment-item--selected' : ''}${isResolved ? ' comment-item--resolved' : ''}`}
        onClick={() => onSelectComment(comment.id)}
      >
        <div className="comment-item__header">
          <span className="comment-item__author">{comment.author || '匿名'}</span>
          <span className="comment-item__date">{formatDate(comment.date)}</span>
        </div>
        <div className="comment-item__content">
          {comment.text.split('\n').map((line, index) => (
            <p key={index}>{line || '\u00A0'}</p>
          ))}
        </div>
        <div className="comment-item__actions">
          <Button
            type="text"
            size="small"
            icon={<CheckOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onResolveComment(comment.id);
            }}
            title={formatMessage('word.comment.resolve')}
          />
          <Popconfirm
            title={formatMessage('word.comment.delete')}
            onConfirm={(e) => {
              e?.stopPropagation();
              onDeleteComment(comment.id);
            }}
            okText={formatMessage('word.dialog.confirm')}
            cancelText={formatMessage('word.dialog.cancel')}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
              title={formatMessage('word.comment.delete')}
            />
          </Popconfirm>
        </div>
        {isResolved && <div className="comment-item__resolved-badge">已解决</div>}
      </div>
    );
  };

  return (
    <div className="comment-panel">
      <div className="comment-panel__header">
        <CommentOutlined />
        <span>{formatMessage('word.comment.title')}</span>
        <span className="comment-panel__count">({comments.length})</span>
      </div>

      <div className="comment-panel__add">
        <Input.TextArea
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder={formatMessage('word.comment.placeholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
        <Button
          type="primary"
          size="small"
          onClick={handleAddComment}
          disabled={!newCommentText.trim()}
          style={{ marginTop: 8 }}
        >
          {formatMessage('word.comment.add')}
        </Button>
      </div>

      <div className="comment-panel__list">
        {comments.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={formatMessage('word.comment.empty')}
          />
        ) : (
          comments.map((comment) => (
            <div key={comment.id}>{renderCommentItem(comment)}</div>
          ))
        )}
      </div>
    </div>
  );
}

export default CommentPanel;
