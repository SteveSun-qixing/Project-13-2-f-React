import { Button, Descriptions, theme } from '@chips/ui';
import React from 'react';
import type { ReactElement } from 'react';
import { formatFileSize, type ImageDimensions } from '../viewer/image-viewer';

/**
 * 信息侧栏（《03-查看器设计》§3.2：右侧、可折叠、内容区自适应不覆压）。
 * 展示名称、类型、大小、尺寸与队列位置；空数据项不渲染，不留空白行。
 */

export interface InfoPanelProps {
  readonly open: boolean;
  readonly title: string | null;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly byteSize: number | null;
  readonly dimensions: ImageDimensions | null;
  readonly position: string | null;
  readonly onClose: () => void;
}

export function InfoPanel(props: InfoPanelProps): ReactElement | null {
  const { open, title, fileName, mimeType, byteSize, dimensions, position, onClose } = props;
  const { token } = theme.useToken();

  if (!open) {
    return null;
  }

  const sizeLabel = byteSize !== null ? formatFileSize(byteSize) : null;
  const dimensionsLabel =
    dimensions !== null && dimensions.width > 0 && dimensions.height > 0
      ? `${dimensions.width} × ${dimensions.height} 像素`
      : null;

  const items: Array<{ key: string; label: string; children: React.ReactNode }> = [];
  if (fileName !== null && fileName.length > 0) {
    items.push({ key: 'name', label: '名称', children: fileName });
  }
  if (title !== null && title.length > 0) {
    items.push({ key: 'title', label: '标题', children: title });
  }
  if (mimeType !== null && mimeType.length > 0) {
    items.push({ key: 'mime', label: '类型', children: mimeType });
  }
  if (sizeLabel !== null) {
    items.push({ key: 'size', label: '大小', children: sizeLabel });
  }
  if (dimensionsLabel !== null) {
    items.push({ key: 'dimensions', label: '尺寸', children: dimensionsLabel });
  }
  if (position !== null) {
    items.push({ key: 'position', label: '队列位置', children: position });
  }

  return (
    <aside
      data-role="info-panel"
      aria-label="图片信息"
      style={{
        flex: '0 0 264px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
        padding: token.padding,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: token.fontSizeLG }}>图片信息</span>
        <Button size="small" type="text" aria-label="收起信息面板" onClick={onClose}>
          收起
        </Button>
      </div>
      <Descriptions column={1} size="small" items={items} />
    </aside>
  );
}
