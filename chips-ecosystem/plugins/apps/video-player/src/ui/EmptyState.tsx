import React from 'react';
import { Button, Input, Typography, theme } from '@chips/ui';
import { SUPPORTED_VIDEO_EXTENSION_LABEL, createVideoSourceFromUri, isDirectPlayableUri } from '../player/videoPlayer';
import type { VideoSource } from '../player/videoPlayer';

/**
 * 空态装配面（重写件）。
 *
 * 本臂的会话装配入口：直接播放地址（`file:` / `http(s):` / `blob:` / `data:`）。
 * `resource:open` video 槽位端到端随宿主资源打开路由落波（工单065 关联面），届时
 * 启动投递复用同一 `VideoSource` 会话形状；文件选择等系统能力经 `dialog:*` 域，
 * 宿主处理器同样未就绪，本界面不自建旁路，如实以地址输入承载本臂可用的播放面。
 */

export interface EmptyStateProps {
  onOpen: (source: VideoSource) => void;
}

/** 由输入构造会话来源；返回简体中文错误文案表示不可打开。 */
export function openVideoInput(value: string): { source?: VideoSource; error?: string } {
  const normalized = value.trim();
  if (!normalized) {
    return { error: '请输入视频地址。' };
  }
  if (!isDirectPlayableUri(normalized)) {
    return { error: '暂不支持该地址形式：请使用 file://、http(s)://、blob: 或 data: 地址。' };
  }
  const source = createVideoSourceFromUri(normalized);
  if (!source) {
    return { error: '无法识别的视频地址。' };
  }
  const extension = source.extension ?? '';
  if (!source.isRemote && extension && !SUPPORTED_VIDEO_EXTENSION_LABEL.split(' ').includes(extension)) {
    // 远端地址交由宿主媒体栈判定解码能力；本地文件按扩展名先给出如实提示。
    return { error: `暂不支持 .${extension.slice(1)} 格式，支持：${SUPPORTED_VIDEO_EXTENSION_LABEL}` };
  }
  return { source };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onOpen }) => {
  const { token } = theme.useToken();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const handleOpen = (): void => {
    const result = openVideoInput(value);
    if (result.error !== undefined || result.source === undefined) {
      setError(result.error ?? '无法识别的视频地址。');
      return;
    }
    setError(null);
    onOpen(result.source);
  };

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
      <Typography.Title level={4} style={{ margin: 0 }}>
        打开视频
      </Typography.Title>
      <Typography.Text type="secondary">
        粘贴可直接播放的视频地址开始会话；也支持拖入文件与资源路由投递（随宿主资源通道落波）。
      </Typography.Text>
      <div style={{ display: 'flex', width: 'min(560px, 100%)', gap: token.marginXS }}>
        <Input
          value={value}
          placeholder="视频地址（file://、https://、blob:）"
          aria-label="视频地址"
          onChange={(event) => {
            setValue(event.target.value);
            if (error !== null) {
              setError(null);
            }
          }}
          onPressEnter={handleOpen}
          allowClear
        />
        <Button type="primary" aria-label="打开" onClick={handleOpen}>
          打开
        </Button>
      </div>
      {error === null ? null : (
        <Typography.Text type="danger" role="alert">
          {error}
        </Typography.Text>
      )}
      <Typography.Text type="secondary">支持格式：{SUPPORTED_VIDEO_EXTENSION_LABEL}</Typography.Text>
      <Typography.Text type="secondary">
        快捷键：空格播放或暂停，←→ 跳转，↑↓ 音量，F 全屏，M 静音，? 查看全部键位
      </Typography.Text>
    </section>
  );
};

export default EmptyState;
