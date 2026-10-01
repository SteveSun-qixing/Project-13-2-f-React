import { useEffect, useState } from 'react';
import { Button, Input, Tooltip, theme } from '@chips/ui';
import {
  CompressOutlined,
  DownOutlined,
  FileAddOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  MinusOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SearchOutlined,
  UpOutlined,
} from '@chips/ui';
import type { PreviewCommand, PreviewToolbarRenderContext } from '../engine';

export interface ViewerToolbarProps {
  /** 引擎工具栏上下文（未挂载引擎时为 null，文件级按钮全部禁用）。 */
  context: PreviewToolbarRenderContext | null;
  /** 当前展示文件名（队列标题回退）。 */
  fileName: string | null;
  /** 是否已装载文件（控制文件级按钮可用性）。 */
  hasFile: boolean;
  onOpenFile: () => void;
  onReload: () => void;
  onToggleInfo: () => void;
}

function supportsCommand(context: PreviewToolbarRenderContext | null, command: PreviewCommand): boolean {
  if (!context) {
    return false;
  }
  return context.canCommand(command) !== false;
}

/**
 * 壳层查看工具栏：消费引擎 PreviewToolbarRenderContext 暴露的能力
 * （《03-查看器设计》§3 工具栏形态；文件级操作 / 队列导航 / 视图命令 / 页码与搜索 / 信息与输出）。
 */
export function ViewerToolbar({
  context,
  fileName,
  hasFile,
  onOpenFile,
  onReload,
  onToggleInfo,
}: ViewerToolbarProps): React.ReactElement {
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [pageInput, setPageInput] = useState('');

  const zoomLabel = context?.zoomLabel ?? '100%';
  const hasQueue = Boolean(context && context.length > 1);
  const isPaginated = Boolean(context && typeof context.goToPage === 'function');

  useEffect(() => {
    setSearchCount(null);
    setSearchText('');
    setPageInput('');
  }, [context?.file]);

  const runSearch = (next: string): void => {
    setSearchText(next);
    if (!context) {
      return;
    }
    if (next.trim().length === 0) {
      context.clearSearch();
      setSearchCount(null);
      return;
    }
    setSearchCount(context.search(next));
  };

  const submitPage = (): void => {
    if (!context) {
      return;
    }
    const page = Number.parseInt(pageInput, 10);
    if (Number.isFinite(page) && page > 0) {
      context.goToPage(page);
    }
  };

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginXXS,
    minWidth: 0,
  };

  const iconButton = (
    key: string,
    title: string,
    icon: React.ReactNode,
    onSelect: () => void,
    disabled: boolean
  ): React.ReactElement => (
    <Tooltip key={key} title={title}>
      <Button
        type="text"
        size="small"
        icon={icon}
        disabled={disabled}
        aria-label={title}
        onClick={onSelect}
      />
    </Tooltip>
  );

  return (
    <div
      data-role="viewer-toolbar"
      role="toolbar"
      aria-label="查看器工具栏"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: token.marginSM,
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        color: token.colorText,
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div style={groupStyle}>
        <Button size="small" type="text" icon={<FileAddOutlined />} onClick={onOpenFile}>
          打开文件
        </Button>
        {iconButton('reload', '重新加载', <ReloadOutlined />, onReload, !hasFile)}
      </div>

      <div style={groupStyle}>
        {iconButton(
          'zoom-in',
          '放大',
          <PlusOutlined />,
          () => context?.command('zoom-in'),
          !hasFile || !supportsCommand(context, 'zoom-in'),
        )}
        {iconButton(
          'zoom-out',
          '缩小',
          <MinusOutlined />,
          () => context?.command('zoom-out'),
          !hasFile || !supportsCommand(context, 'zoom-out'),
        )}
        {iconButton(
          'zoom-reset',
          '重置缩放',
          <CompressOutlined />,
          () => context?.command('zoom-reset'),
          !hasFile || !supportsCommand(context, 'zoom-reset'),
        )}
        {supportsCommand(context, 'zoom-reset') || context?.zoom !== undefined ? (
          <span
            data-role="zoom-badge"
            aria-label="当前缩放"
            style={{ fontVariantNumeric: 'tabular-nums', fontSize: token.fontSizeSM, color: token.colorTextSecondary }}
          >
            {zoomLabel}
          </span>
        ) : null}
        {iconButton(
          'rotate-left',
          '向左旋转',
          <RotateLeftOutlined />,
          () => context?.command('rotate-left'),
          !hasFile || !supportsCommand(context, 'rotate-left'),
        )}
        {iconButton(
          'rotate-right',
          '向右旋转',
          <RotateRightOutlined />,
          () => context?.command('rotate-right'),
          !hasFile || !supportsCommand(context, 'rotate-right'),
        )}
      </div>

      {hasQueue ? (
        <div style={groupStyle}>
          {iconButton(
            'previous',
            '上一个文件',
            <UpOutlined />,
            () => void context?.previous(),
            !context?.canPrevious,
          )}
          <span
            data-role="dock-position"
            style={{ fontVariantNumeric: 'tabular-nums', fontSize: token.fontSizeSM, color: token.colorTextSecondary }}
          >
            {(context?.index ?? 0) + 1} / {context?.length ?? 0}
          </span>
          {iconButton(
            'next',
            '下一个文件',
            <DownOutlined />,
            () => void context?.next(),
            !context?.canNext,
          )}
        </div>
      ) : null}

      {isPaginated ? (
        <div style={groupStyle}>
          <Input
            size="small"
            value={pageInput || String((context?.index ?? 0) + 1)}
            aria-label="页码跳转"
            style={{ width: 64, textAlign: 'center' }}
            onChange={(event) => setPageInput(event.target.value)}
            onPressEnter={submitPage}
            onBlur={submitPage}
          />
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>页</span>
        </div>
      ) : null}

      {hasFile ? (
        <div style={groupStyle}>
          <SearchOutlined style={{ color: token.colorTextQuaternary }} aria-hidden="true" />
          <Input
            size="small"
            allowClear
            value={searchText}
            placeholder="搜索文本"
            aria-label="搜索文本"
            style={{ width: 160 }}
            onChange={(event) => runSearch(event.target.value)}
          />
          {searchCount !== null ? (
            <span data-role="search-count" style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
              {searchCount} 处
            </span>
          ) : null}
        </div>
      ) : null}

      <div style={{ ...groupStyle, marginLeft: 'auto' }}>
        <span
          data-role="dock-title"
          title={fileName ?? undefined}
          style={{
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
          }}
        >
          {fileName ?? ''}
        </span>
        {iconButton('info', '格式信息', <InfoCircleOutlined />, onToggleInfo, !hasFile)}
        {iconButton(
          'print',
          '打印',
          <PrinterOutlined />,
          () => context?.print(),
          !hasFile,
        )}
        {iconButton(
          'fullscreen',
          '全屏',
          <FullscreenOutlined />,
          () => context?.fullscreen(),
          !hasFile,
        )}
      </div>
    </div>
  );
}
