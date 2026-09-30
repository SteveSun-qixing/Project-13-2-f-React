import React from 'react';
import { Empty, Typography, theme } from '@chips/ui';
import { AssemblyForm } from './AssemblyForm';
import { PLAYER_KEY_HELP_ITEMS } from '../player/usePlayerKeyboard';
import type { TrackPresentation } from '../player/trackSession';

/**
 * 空态装配面（重写件）：本臂无端到端投递（`resource:open` audio 槽位候宿主资源路由，
 * 工单060 关联面），以地址输入承载本臂可用的播放面；键位说明如实呈现。
 */

export interface EmptyStateProps {
  onAppend: (presentation: TrackPresentation) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAppend }) => {
  const { token } = theme.useToken();

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: token.marginMD,
        padding: token.paddingXL,
      }}
    >
      <Empty description={false} />
      <Typography.Title level={4} style={{ margin: 0 }}>
        打开音乐
      </Typography.Title>
      <Typography.Text type="secondary">
        粘贴可直接播放的音频地址加入播放队列；资源路由投递（拖入文件与打开方式）随宿主资源通道落波。
      </Typography.Text>
      <AssemblyForm onAppend={onAppend} submitLabel="加入并播放" />
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        快捷键：
        {PLAYER_KEY_HELP_ITEMS.map((item) => `${item.keys} ${item.label}`).join('，')}
      </Typography.Text>
    </section>
  );
};

export default EmptyState;
