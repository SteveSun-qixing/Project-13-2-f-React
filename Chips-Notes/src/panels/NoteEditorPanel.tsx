import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button, Empty, Spin, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNote } from '../context/NoteContext';
import { BaseCardItem } from '../basecards/BaseCardItem';

interface DragState {
  sourceIndex: number;
  targetIndex: number | null;
}

export function NoteEditorPanel(): React.ReactElement {
  const { currentNote, loading, saving, saveNote, isDirty, updateContent, removeBasecard, reorderBasecards } = useNote();
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ sourceIndex: -1, targetIndex: null });
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const triggerAutoSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (currentNote && isDirty) {
        try {
          setAutoSaveStatus('saving');
          await saveNote();
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } catch (error) {
          console.warn('Auto-save failed:', error);
          setAutoSaveStatus('idle');
        }
      }
    }, 3000);
  }, [currentNote, isDirty, saveNote]);

  const handleSave = async () => {
    try {
      await saveNote();
      message.success('笔记保存成功');
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (error) {
      message.error(`保存失败: ${error}`);
    }
  };

  const handleContentChange = useCallback((contentId: string, config: any) => {
    updateContent(contentId, config);
    triggerAutoSave();
  }, [updateContent, triggerAutoSave]);

  const handleCardEdit = (cardId: string) => {
    setEditingCardId(cardId);
  };

  const handleCardCancelEdit = () => {
    setEditingCardId(null);
  };

  const handleCardSave = async (cardId: string, config: any) => {
    handleContentChange(cardId, config);
    setEditingCardId(null);
    message.success('卡片已更新');
  };

  const handleCardDelete = async (cardId: string) => {
    if (!currentNote) return;
    try {
      await removeBasecard(cardId);
      message.success('卡片已删除');
    } catch (error) {
      message.error(`删除失败: ${error}`);
    }
  };

  const handleDragStart = (index: number) => {
    setDragState({ sourceIndex: index, targetIndex: null });
  };

  const handleDragOver = (index: number) => {
    if (dragState.sourceIndex !== -1 && dragState.sourceIndex !== index) {
      setDragState(prev => ({ ...prev, targetIndex: index }));
    }
  };

  const handleDrop = async () => {
    const { sourceIndex, targetIndex } = dragState;
    if (sourceIndex === -1 || targetIndex === null || sourceIndex === targetIndex) {
      setDragState({ sourceIndex: -1, targetIndex: null });
      return;
    }

    try {
      await reorderBasecards(sourceIndex, targetIndex);
      message.success('卡片顺序已更新');
    } catch (error) {
      message.error(`排序失败: ${error}`);
    } finally {
      setDragState({ sourceIndex: -1, targetIndex: null });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentNote && isDirty) {
          handleSave();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && currentNote) {
        e.preventDefault();
        setEditingCardId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentNote, isDirty]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="加载笔记中..." />
      </div>
    );
  }

  if (!currentNote) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="请从左侧选择或创建笔记" />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, marginBottom: 8 }}>
            {currentNote.name}
          </h1>
          <div style={{ fontSize: 12, color: '#999' }}>
            最后修改: {new Date(currentNote.modifiedAt).toLocaleString('zh-CN')}
          </div>
        </div>

        <div>
          {currentNote.contents.length === 0 ? (
            <Empty description="这是一个空笔记，从右侧卡片库添加第一个内容" />
          ) : (
            currentNote.contents.map((content, index) => (
              <div
                key={content.id}
                style={{
                  opacity: dragState.sourceIndex === index ? 0.5 : 1,
                  transform: dragState.targetIndex === index ? 'translateY(-4px)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <BaseCardItem
                  content={content}
                  index={index}
                  isEditing={editingCardId === content.id}
                  cardPath={currentNote.path}
                  onEdit={() => handleCardEdit(content.id)}
                  onCancelEdit={handleCardCancelEdit}
                  onSave={(config) => handleCardSave(content.id, config)}
                  onDelete={() => handleCardDelete(content.id)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#999' }}>
          {autoSaveStatus === 'saving' && '正在自动保存...'}
          {autoSaveStatus === 'saved' && '✓ 已自动保存'}
          {autoSaveStatus === 'idle' && isDirty && '● 有未保存的更改'}
          {autoSaveStatus === 'idle' && !isDirty && `${currentNote.contents.length} 个内容块`}
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          size="large"
          loading={saving}
          disabled={!isDirty}
        >
          保存笔记 {isDirty && '(⌘S)'}
        </Button>
      </div>
    </div>
  );
}
