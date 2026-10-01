import { Button, theme } from '@chips/ui';
import { FileAddOutlined } from '@chips/ui';

export interface ViewerEmptyStateProps {
  onOpenFile: () => void;
}

/** 空态：未打开任何文件时的引导页（不伪造任何查看内容）。 */
export function ViewerEmptyState({ onOpenFile }: ViewerEmptyStateProps): React.ReactElement {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: token.marginSM,
        padding: token.paddingXL,
        color: token.colorTextSecondary,
      }}
    >
      <FileAddOutlined
        style={{ fontSize: 44, color: token.colorTextQuaternary }}
        aria-hidden="true"
      />
      <span data-role="viewer-empty-title" style={{ fontSize: token.fontSizeLG, color: token.colorText }}>
        未打开文件
      </span>
      <span style={{ fontSize: token.fontSizeSM }}>
        选择一个文件开始预览；文本、Office、PDF、压缩包、图纸等格式由本查看器广谱兜底。
      </span>
      <Button type="primary" data-role="empty-open" onClick={onOpenFile}>
        打开文件
      </Button>
    </div>
  );
}
