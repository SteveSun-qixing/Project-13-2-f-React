import { Button, theme } from '@chips/ui';
import { FileUnknownOutlined } from '@chips/ui';

export interface UnsupportedCardProps {
  /** 识别出的格式（扩展名大写；无扩展名时回退 MIME）。 */
  format: string;
  /** 平台归一的 MIME（可能为「未声明」）。 */
  mimeType: string;
  fileName: string;
  onRetry: () => void;
}

/**
 * 兜底信息卡（《03-查看器设计》§8.4）：格式被识别但没有可用的预览插件时如实呈现
 * 识别结果与恢复入口，不静默失败、不抛出原始错误、不伪造预览。
 */
export function UnsupportedCard({
  format,
  mimeType,
  fileName,
  onRetry,
}: UnsupportedCardProps): React.ReactElement {
  const { token } = theme.useToken();

  return (
    <div
      data-role="viewer-unsupported"
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
      <FileUnknownOutlined style={{ fontSize: 44, color: token.colorTextQuaternary }} aria-hidden="true" />
      <span style={{ fontSize: token.fontSizeLG, color: token.colorText }}>当前文件暂不支持在线预览</span>
      <span
        data-role="unsupported-format"
        style={{
          fontVariantNumeric: 'tabular-nums',
          padding: `${token.paddingXXS}px ${token.paddingSM}px`,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          color: token.colorText,
        }}
      >
        格式 {format} · MIME {mimeType}
      </span>
      <span style={{ fontSize: token.fontSizeSM, textAlign: 'center' }}>
        已识别「{fileName}」，但没有可用的预览路径；可在「设置 → 文件打开方式」中为该格式选择其他处理器。
      </span>
      <Button data-role="unsupported-retry" onClick={onRetry}>
        重新尝试打开
      </Button>
    </div>
  );
}
