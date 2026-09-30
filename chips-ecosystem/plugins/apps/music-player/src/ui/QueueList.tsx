import React from 'react';
import { Button, Empty, Typography, theme } from '@chips/ui';
import { DeleteOutlined, PlayCircleOutlined } from '@chips/ui';
import type { TrackPresentation } from '../player/trackSession';
import { resolveTrackFormatLabel } from '../player/trackSession';

/**
 * 播放队列面板（重写件）：当前曲目高亮、点选切歌、移除与清空。
 * 队列数据以迁移件 `PlaylistEngine` 为唯一事实源（见 usePlayerQueue）。
 * 行渲染用令牌化自绘列（antd 6 已废弃 `List`，`Listy` 未进 @chips/ui 白名单）。
 */

export interface QueueListProps {
  presentations: readonly TrackPresentation[];
  currentIndex: number;
  onPlayAt: (index: number) => void;
  onRemoveAt: (index: number) => void;
  onClear: () => void;
}

export const QueueList: React.FC<QueueListProps> = ({
  presentations,
  currentIndex,
  onPlayAt,
  onRemoveAt,
  onClear,
}) => {
  const { token } = theme.useToken();

  return (
    <section
      aria-label="播放队列"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXXS,
        padding: `0 ${token.paddingLG}px ${token.paddingSM}px`,
        minHeight: 0,
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Text strong>{`播放队列（${presentations.length}）`}</Typography.Text>
        <Button
          type="text"
          size="small"
          aria-label="清空播放队列"
          disabled={presentations.length === 0}
          onClick={onClear}
        >
          清空
        </Button>
      </div>
      {presentations.length === 0 ? (
        <Empty description="队列已清空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div role="list" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: token.paddingXXS }}>
          {presentations.map((item, index) => {
            const isCurrent = index === currentIndex;
            const formatLabel = resolveTrackFormatLabel(item);
            return (
              <div
                key={`${item.source.sourceId}#${index}`}
                role="listitem"
                aria-current={isCurrent ? 'true' : undefined}
                onClick={() => onPlayAt(index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: token.marginSM,
                  cursor: 'pointer',
                  padding: `${token.paddingXXS}px ${token.paddingSM}px`,
                  borderRadius: token.borderRadiusLG,
                  background: isCurrent ? token.colorPrimaryBg : undefined,
                }}
              >
                {isCurrent ? (
                  <PlayCircleOutlined style={{ color: token.colorPrimary, fontSize: 20 }} aria-label="正在播放" />
                ) : (
                  <Typography.Text type="secondary" style={{ minWidth: 20, textAlign: 'center' }}>
                    {`${index + 1}.`}
                  </Typography.Text>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <Typography.Text strong={isCurrent} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </Typography.Text>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: token.fontSizeSM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {item.artist || '未知歌手'}
                    {formatLabel ? ` · ${formatLabel}` : ''}
                  </Typography.Text>
                </div>
                <Button
                  type="text"
                  size="small"
                  aria-label={`移除 ${item.title}`}
                  icon={<DeleteOutlined />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveAt(index);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default QueueList;
