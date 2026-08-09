import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getCommandManager } from '../../core/command-manager';
import { formatMessage } from '../../lib/messages';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './HistoryPanel.css';

interface CommandHistory {
  id: string;
  description: string;
  timestamp: number;
}

interface HistoryPanelProps {
  maxItems?: number;
  showTime?: boolean;
  compact?: boolean;
  onGoto?: (historyId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function HistoryPanel({
  maxItems = 50,
  showTime = true,
  compact = false,
  onGoto,
  onUndo,
  onRedo,
}: HistoryPanelProps) {
  const commandManager = getCommandManager();

  const [undoHistory, setUndoHistory] = useState<CommandHistory[]>([]);
  const [redoHistory, setRedoHistory] = useState<CommandHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentIndex = useMemo(() => (undoHistory.length > 0 ? undoHistory.length - 1 : -1), [undoHistory]);

  const canUndo = useMemo(() => undoHistory.length > 0, [undoHistory]);
  const canRedo = useMemo(() => redoHistory.length > 0, [redoHistory]);

  const displayHistory = useMemo(() => {
    const redo = redoHistory.map((h, i) => ({
      ...h,
      type: 'redo' as const,
      index: i,
    }));

    const undo = undoHistory.map((h, i) => ({
      ...h,
      type: 'undo' as const,
      index: i,
    }));

    return [...redo.reverse(), ...undo].slice(0, maxItems);
  }, [redoHistory, undoHistory, maxItems]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return formatMessage('history_panel.just_now');
    } else if (diff < 3600000) {
      return formatMessage('history_panel.minutes_ago', { count: Math.floor(diff / 60000) });
    } else if (diff < 86400000) {
      return formatMessage('history_panel.hours_ago', { count: Math.floor(diff / 3600000) });
    } else {
      return formatTime(timestamp);
    }
  };

  const getDescription = (key: string) => {
    const descriptions: Record<string, string> = {
      'command.add_base_card': 'history_panel.command_add_base_card',
      'command.remove_base_card': 'history_panel.command_remove_base_card',
      'command.move_base_card': 'history_panel.command_move_base_card',
      'command.update_base_card_config': 'history_panel.command_update_base_card_config',
      'command.batch_operation': 'history_panel.command_batch_operation',
      'command.create_window': 'history_panel.command_create_window',
      'command.close_window': 'history_panel.command_close_window',
      'command.move_window': 'history_panel.command_move_window',
      'command.resize_window': 'history_panel.command_resize_window',
      'command.set_window_state': 'history_panel.command_set_window_state',
      'command.batch_window_operation': 'history_panel.command_batch_window_operation',
    };

    const translationKey = descriptions[key];
    return translationKey ? formatMessage(translationKey) : key;
  };

  const updateHistory = useCallback(() => {
    setUndoHistory(commandManager.getHistory(maxItems));
    setRedoHistory(commandManager.getRedoHistory());
  }, [commandManager, maxItems]);

  const handleUndoCommand = useCallback(async () => {
    if (!canUndo || isLoading) return;

    setIsLoading(true);
    try {
      await commandManager.undo();
      if (onUndo) onUndo();
    } finally {
      setIsLoading(false);
      updateHistory();
    }
  }, [canUndo, commandManager, isLoading, onUndo, updateHistory]);

  const handleRedoCommand = useCallback(async () => {
    if (!canRedo || isLoading) return;

    setIsLoading(true);
    try {
      await commandManager.redo();
      if (onRedo) onRedo();
    } finally {
      setIsLoading(false);
      updateHistory();
    }
  }, [canRedo, commandManager, isLoading, onRedo, updateHistory]);

  const handleUndo = async () => {
    await handleUndoCommand();
  };

  const handleRedo = async () => {
    await handleRedoCommand();
  };

  const handleGoto = async (historyId: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await commandManager.goToHistory(historyId);
      if (onGoto) onGoto(historyId);
    } finally {
      setIsLoading(false);
      updateHistory();
    }
  };

  const handleClear = () => {
    commandManager.clear();
    updateHistory();
  };

  useEffect(() => {
    updateHistory();

    const unsubscribe = commandManager.subscribe(() => {
      updateHistory();
    });

    return unsubscribe;
  }, [commandManager, updateHistory]);

  return (
    <div className={`history-panel ${compact ? 'compact' : ''}`}>
      <div className="history-toolbar">
        <button
          className="history-btn"
          disabled={!canUndo || isLoading}
          title={formatMessage('history_panel.undo_title')}
          type="button"
          onClick={handleUndo}
        >
          <span className="history-btn-icon">
            <RuntimeIcon icon={ENGINE_ICONS.undo} />
          </span>
          {!compact && <span className="history-btn-text">{formatMessage('history_panel.undo')}</span>}
        </button>

        <button
          className="history-btn"
          disabled={!canRedo || isLoading}
          title={formatMessage('history_panel.redo_title')}
          type="button"
          onClick={handleRedo}
        >
          <span className="history-btn-icon">
            <RuntimeIcon icon={ENGINE_ICONS.redo} />
          </span>
          {!compact && <span className="history-btn-text">{formatMessage('history_panel.redo')}</span>}
        </button>

        <div className="history-toolbar-spacer"></div>

        <button
          className="history-btn history-btn-clear"
          disabled={displayHistory.length === 0}
          title={formatMessage('history_panel.clear')}
          type="button"
          onClick={handleClear}
        >
          <span className="history-btn-icon">
            <RuntimeIcon icon={ENGINE_ICONS.delete} />
          </span>
        </button>
      </div>

      {displayHistory.length > 0 ? (
        <div className="history-list">
          {displayHistory.map((item) => (
            <div
              key={item.id}
              className={`history-item ${item.type === 'undo' && item.index === currentIndex ? 'history-item--current' : ''} ${item.type === 'redo' ? 'history-item--redo' : 'history-item--undo'}`}
              onClick={() => handleGoto(item.id)}
            >
              <div className="history-item-indicator">
                {item.type === 'undo' && item.index === currentIndex ? (
                  <span className="current-marker">●</span>
                ) : (
                  <span className="history-marker">○</span>
                )}
              </div>

              <div className="history-item-content">
                <div className="history-item-description">
                  {getDescription(item.description)}
                </div>
                {showTime && !compact && (
                  <div className="history-item-time">
                    {formatRelativeTime(item.timestamp)}
                  </div>
                )}
              </div>

              {item.type === 'redo' && (
                <div className="history-item-badge">
                  {formatMessage('history_panel.badge_redo')}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="history-empty">
          <div className="history-empty-icon">
            <RuntimeIcon icon={ENGINE_ICONS.history} />
          </div>
          <div className="history-empty-text">{formatMessage('history_panel.empty')}</div>
        </div>
      )}

      <div className="history-status">
        <span>{formatMessage('history_panel.status_undo')}: {undoHistory.length}</span>
        <span className="history-status-divider">|</span>
        <span>{formatMessage('history_panel.status_redo')}: {redoHistory.length}</span>
      </div>
    </div>
  );
}
