import { Button, Divider, theme } from '@chips/ui';
import {
  AimOutlined,
  CheckOutlined,
  ColumnWidthOutlined,
  ExpandOutlined,
  FileImageOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SaveOutlined,
} from '@chips/ui';
import React from 'react';
import type { MutableRefObject, ReactElement } from 'react';
import type { PhotoViewerCameraActions } from './usePhotoSession';

/**
 * 底部浮动 dock 工具栏（《03-查看器设计》§3.1：图片查看器默认形态；分组左 → 右：
 * 导航 / 打开 / 标题 / 模式 / 工具 / 分享）。溢出收口的「更多」折叠随窄窗波次，
 * 关键操作（打开）不折叠；禁用态一律给原因说明（原生 title），不隐藏入口。
 */

export interface ViewerDockProps {
  readonly fileName: string | null;
  readonly position: string | null;
  readonly hasCurrent: boolean;
  readonly isImageLoaded: boolean;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly hasQueue: boolean;
  readonly filmstripVisible: boolean;
  readonly infoPanelOpen: boolean;
  readonly immersive: boolean;
  readonly cameraActionsRef: MutableRefObject<PhotoViewerCameraActions | null>;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onOpenRequest: () => void;
  readonly onSaveCopy: () => void;
  readonly onToggleFilmstrip: () => void;
  readonly onToggleInfoPanel: () => void;
  readonly onToggleImmersive: () => void;
}

export function ViewerDock(props: ViewerDockProps): ReactElement {
  const {
    fileName,
    position,
    hasCurrent,
    canPrevious,
    canNext,
    hasQueue,
    filmstripVisible,
    infoPanelOpen,
    immersive,
    cameraActionsRef,
    onPrevious,
    onNext,
    onOpenRequest,
    onSaveCopy,
    onToggleFilmstrip,
    onToggleInfoPanel,
    onToggleImmersive,
  } = props;
  const { token } = theme.useToken();

  const noImageReason = hasCurrent ? null : '当前没有已加载图片';

  const iconButton = (
    ariaLabel: string,
    title: string,
    disabledReason: string | null,
    onClick: () => void,
    icon: React.ReactNode,
  ): ReactElement => (
    <Button
      aria-label={ariaLabel}
      title={disabledReason ?? title}
      type="text"
      disabled={disabledReason !== null}
      onClick={onClick}
      icon={icon}
    />
  );

  return (
    <div
      data-role="viewer-dock"
      role="toolbar"
      aria-label="图片查看器工具栏"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        zIndex: 3,
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: token.marginXXS,
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        overflowX: 'auto',
        overflowY: 'hidden',
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgElevated,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      {iconButton(
        '上一张',
        '上一张',
        hasQueue ? (canPrevious ? null : '当前已经是第一张图片') : '没有图片队列',
        onPrevious,
        <LeftOutlined />,
      )}
      {iconButton(
        '下一张',
        '下一张',
        hasQueue ? (canNext ? null : '当前已经是最后一张图片') : '没有图片队列',
        onNext,
        <RightOutlined />,
      )}

      <Divider type="vertical" style={{ height: 20 }} />

      <Button aria-label="打开图片" title="打开图片（Ctrl / ⌘ + O）" type="text" onClick={onOpenRequest} icon={<FileImageOutlined />} />

      <Divider type="vertical" style={{ height: 20 }} />

      <span
        data-role="dock-title"
        title={fileName ?? undefined}
        style={{
          maxWidth: 220,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: token.colorText,
          fontSize: token.fontSizeSM,
        }}
      >
        {fileName ?? '未打开图片'}
      </span>
      {position !== null ? (
        <span
          data-role="dock-position"
          style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM, whiteSpace: 'nowrap' }}
        >
          {position}
        </span>
      ) : null}

      <Divider type="vertical" style={{ height: 20 }} />

      {iconButton('适应窗口', '适应窗口（0）', noImageReason, () => cameraActionsRef.current?.fitToWindow(), <AimOutlined />)}
      {iconButton('实际大小', '实际大小（1）', noImageReason, () => cameraActionsRef.current?.actualSize(), <CheckOutlined />)}
      {iconButton('逆时针旋转', '逆时针旋转', noImageReason, () => cameraActionsRef.current?.rotateCounterclockwise(), <RotateLeftOutlined />)}
      {iconButton('顺时针旋转', '顺时针旋转', noImageReason, () => cameraActionsRef.current?.rotateClockwise(), <RotateRightOutlined />)}

      <Divider type="vertical" style={{ height: 20 }} />

      {iconButton('放大', '放大（+）', noImageReason, () => cameraActionsRef.current?.zoomIn(), <PlusOutlined />)}
      {iconButton('缩小', '缩小（-）', noImageReason, () => cameraActionsRef.current?.zoomOut(), <MinusOutlined />)}
      {iconButton(
        '胶片条',
        filmstripVisible ? '隐藏胶片条' : '显示胶片条',
        hasQueue ? null : '没有图片队列',
        onToggleFilmstrip,
        <ColumnWidthOutlined />,
      )}
      {iconButton('信息面板', infoPanelOpen ? '收起信息面板' : '查看图片信息', noImageReason, onToggleInfoPanel, <InfoCircleOutlined />)}
      {iconButton('沉浸模式', immersive ? '退出沉浸模式（F）' : '进入沉浸模式（F）', noImageReason, onToggleImmersive, <ExpandOutlined />)}

      <Divider type="vertical" style={{ height: 20 }} />

      {iconButton('保存副本', '保存副本（Ctrl / ⌘ + S）', noImageReason, onSaveCopy, <SaveOutlined />)}
    </div>
  );
}
