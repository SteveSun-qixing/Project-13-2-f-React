import { useEffect, useMemo, useState } from "react";
import {
  CompressOutlined,
  DownloadOutlined,
  DownOutlined,
  FullscreenOutlined,
  MinusOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SearchOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { Button, Input, InputNumber, Tooltip, type TooltipProps } from "antd";
import type { PreviewCommand, PreviewToolbarRenderContext } from "../viewer-engine";
import { formatMessage } from "../lib/messages";

export interface ViewerToolbarProps {
  context: PreviewToolbarRenderContext | null;
  onOpenFile: () => void;
  onReload: () => void;
  onSaveCopy: () => void;
}

interface ToolbarActionSpec {
  key: string;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

function supportsCommand(context: PreviewToolbarRenderContext | null, command: PreviewCommand): boolean {
  if (!context) {
    return false;
  }
  return context.canCommand(command) !== false;
}

/**
 * antd 查看器工具栏：消费引擎 PreviewToolbarRenderContext 暴露的能力。
 */
export function ViewerToolbar({ context, onOpenFile, onReload, onSaveCopy }: ViewerToolbarProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [pageInput, setPageInput] = useState<number | null>(null);

  const zoomLabel = context?.zoomLabel ?? "100%";
  const hasQueue = Boolean(context && context.length > 1);

  useEffect(() => {
    setSearchCount(null);
    setSearchQuery("");
  }, [context?.file]);

  const commandActions = useMemo<ToolbarActionSpec[]>(() => {
    if (!context) {
      return [];
    }
    const actions: ToolbarActionSpec[] = [];
    if (supportsCommand(context, "zoom-in")) {
      actions.push({
        key: "zoom-in",
        title: formatMessage("universal-viewer.commands.zoomIn.title"),
        icon: <PlusOutlined />,
        onSelect: () => context.command("zoom-in"),
      });
    }
    if (supportsCommand(context, "zoom-out")) {
      actions.push({
        key: "zoom-out",
        title: formatMessage("universal-viewer.commands.zoomOut.title"),
        icon: <MinusOutlined />,
        onSelect: () => context.command("zoom-out"),
      });
    }
    if (supportsCommand(context, "zoom-reset")) {
      actions.push({
        key: "zoom-reset",
        title: `${formatMessage("universal-viewer.commands.zoomFit.title")} · ${zoomLabel}`,
        icon: <CompressOutlined />,
        onSelect: () => context.command("zoom-reset"),
      });
    }
    if (supportsCommand(context, "rotate-left")) {
      actions.push({
        key: "rotate-left",
        title: formatMessage("universal-viewer.commands.rotateLeft.title"),
        icon: <RotateLeftOutlined />,
        onSelect: () => context.command("rotate-left"),
      });
    }
    if (supportsCommand(context, "rotate-right")) {
      actions.push({
        key: "rotate-right",
        title: formatMessage("universal-viewer.commands.rotateRight.title"),
        icon: <RotateRightOutlined />,
        onSelect: () => context.command("rotate-right"),
      });
    }
    return actions;
  }, [context, zoomLabel]);

  const renderAction = (action: ToolbarActionSpec): React.ReactElement => {
    const tooltip: Omit<TooltipProps, "children"> = { title: action.title };
    return (
      <Tooltip key={action.key} {...tooltip}>
        <Button
          type="text"
          size="small"
          icon={action.icon}
          disabled={action.disabled}
          aria-label={action.title}
          onClick={action.onSelect}
        />
      </Tooltip>
    );
  };

  const handleSearch = (query: string): void => {
    if (!context) {
      return;
    }
    if (query.trim().length === 0) {
      context.clearSearch();
      setSearchCount(null);
      return;
    }
    setSearchCount(context.search(query));
  };

  return (
    <div className="universal-viewer-toolbar" role="toolbar" aria-label={formatMessage("universal-viewer.stage.toolbarLabel")}>
      <div className="universal-viewer-toolbar__group">
        <Tooltip title={formatMessage("universal-viewer.commands.openFile.title")}>
          <Button size="small" type="text" onClick={onOpenFile}>
            {formatMessage("universal-viewer.commands.openFile.title")}
          </Button>
        </Tooltip>
        <Tooltip title={formatMessage("universal-viewer.commands.refresh.title")}>
          <Button size="small" type="text" icon={<ReloadOutlined />} aria-label={formatMessage("universal-viewer.commands.refresh.title")} onClick={onReload} />
        </Tooltip>
      </div>

      <div className="universal-viewer-toolbar__group">
        {commandActions.map(renderAction)}
        {supportsCommand(context, "zoom-reset") || context?.zoom !== undefined ? (
          <span className="universal-viewer-toolbar__zoom" aria-label={formatMessage("universal-viewer.stage.zoomLabel")}>{zoomLabel}</span>
        ) : null}
      </div>

      {hasQueue ? (
        <div className="universal-viewer-toolbar__group">
          <Tooltip title={formatMessage("universal-viewer.commands.previousFile.title")}>
            <Button size="small" type="text" icon={<UpOutlined />} disabled={!context?.canPrevious} aria-label={formatMessage("universal-viewer.commands.previousFile.title")} onClick={() => void context?.previous()} />
          </Tooltip>
          <span className="universal-viewer-toolbar__queue">
            {formatMessage("universal-viewer.stage.queueLabel")} {(context?.index ?? 0) + 1} / {context?.length ?? 0}
          </span>
          <Tooltip title={formatMessage("universal-viewer.commands.nextFile.title")}>
            <Button size="small" type="text" icon={<DownOutlined />} disabled={!context?.canNext} aria-label={formatMessage("universal-viewer.commands.nextFile.title")} onClick={() => void context?.next()} />
          </Tooltip>
        </div>
      ) : null}

      {context?.goToPage ? (
        <div className="universal-viewer-toolbar__group">
          <InputNumber
            size="small"
            min={1}
            value={pageInput ?? context.index + 1}
            aria-label={formatMessage("universal-viewer.stage.pageLabel")}
            onChange={(value) => {
              setPageInput(typeof value === "number" ? value : null);
              if (typeof value === "number") {
                context.goToPage(value);
              }
            }}
          />
        </div>
      ) : null}

      <div className="universal-viewer-toolbar__group universal-viewer-toolbar__group--search">
        <Input
          size="small"
          allowClear
          value={searchQuery}
          placeholder={formatMessage("universal-viewer.stage.searchPlaceholder")}
          aria-label={formatMessage("universal-viewer.commands.search.title")}
          prefix={<SearchOutlined />}
          data-universal-viewer-search-input="true"
          onChange={(event) => {
            setSearchQuery(event.target.value);
            handleSearch(event.target.value);
          }}
        />
        {searchCount !== null ? (
          <span className="universal-viewer-toolbar__search-count">
            {formatMessage("universal-viewer.stage.searchResult", { count: searchCount })}
          </span>
        ) : null}
      </div>

      <div className="universal-viewer-toolbar__group">
        <Tooltip title={formatMessage("universal-viewer.commands.saveCopy.title")}>
          <Button size="small" type="text" icon={<DownloadOutlined />} aria-label={formatMessage("universal-viewer.commands.saveCopy.title")} onClick={onSaveCopy} />
        </Tooltip>
        <Tooltip title={formatMessage("universal-viewer.commands.print.title")}>
          <Button size="small" type="text" icon={<PrinterOutlined />} aria-label={formatMessage("universal-viewer.commands.print.title")} onClick={() => context?.print()} />
        </Tooltip>
        <Tooltip title={formatMessage("universal-viewer.commands.fullscreen.title")}>
          <Button size="small" type="text" icon={<FullscreenOutlined />} aria-label={formatMessage("universal-viewer.commands.fullscreen.title")} onClick={() => context?.fullscreen()} />
        </Tooltip>
      </div>
    </div>
  );
}
