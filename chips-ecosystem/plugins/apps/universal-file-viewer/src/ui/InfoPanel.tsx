import { Descriptions, Drawer, theme } from '@chips/ui';
import { formatFileSize } from '../domain/file-kind';

export interface InfoPanelProps {
  open: boolean;
  fileName: string | null;
  /** 引擎识别的格式（扩展名大写或「未知」）。 */
  format: string | null;
  mimeType: string | null;
  byteSize: number | null;
  /** 来源描述（受管资源引用或远程 URL）。 */
  sourceLabel: string | null;
  /** 队列位置（多文件时展示，如「2 / 3」）。 */
  position: string | null;
  onClose: () => void;
}

/**
 * 格式信息面板（命令族 toggle-info 的界面承载）：展示引擎识别结果与资源来源，
 * 全部为只读事实呈现，不承载打开方式治理（治理入口在生态设置面板）。
 */
export function InfoPanel({
  open,
  fileName,
  format,
  mimeType,
  byteSize,
  sourceLabel,
  position,
  onClose,
}: InfoPanelProps): React.ReactElement {
  const { token } = theme.useToken();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="格式信息"
      placement="right"
      size="default"
      styles={{ body: { paddingTop: token.marginXS } }}
      destroyOnClose
    >
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="文件名">
          <span data-role="info-file-name">{fileName ?? '—'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="格式">
          <span data-role="info-format">{format ?? '未知'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="MIME">
          <span data-role="info-mime">{mimeType ?? '未声明'}</span>
        </Descriptions.Item>
        <Descriptions.Item label="大小">
          <span data-role="info-size">{byteSize === null ? '—' : (formatFileSize(byteSize) ?? '—')}</span>
        </Descriptions.Item>
        <Descriptions.Item label="来源">
          <span data-role="info-source" style={{ wordBreak: 'break-all' }}>
            {sourceLabel ?? '—'}
          </span>
        </Descriptions.Item>
        {position !== null ? (
          <Descriptions.Item label="队列位置">
            <span data-role="info-position">{position}</span>
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </Drawer>
  );
}

