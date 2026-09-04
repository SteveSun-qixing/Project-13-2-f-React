import { useCallback, useRef } from "react";
import { Tooltip, Button, InputNumber, Segmented, Space, Divider, Dropdown, Badge } from "antd";
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  FullscreenOutlined,
  PrinterOutlined,
  SearchOutlined,
  AppstoreOutlined,
  LeftOutlined,
  RightOutlined,
  HighlightOutlined,
  UnderlineOutlined,
  CommentOutlined,
  CloseOutlined,
  DownOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { usePdf } from "../hooks/usePdf";
import type { ZoomMode } from "../types";

interface ToolbarProps {
  onOpenFile?: () => void;
}

export function Toolbar({ onOpenFile }: ToolbarProps) {
  const {
    status,
    fileName,
    numPages,
    currentPage,
    zoom,
    showThumbnails,
    showSearch,
    goToPage,
    nextPage,
    prevPage,
    setZoom,
    rotateAll,
    toggleThumbnails,
    toggleSearch,
    print,
  } = usePdf();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleZoomIn = useCallback(() => {
    setZoom("custom", Math.min(zoom.scale + 0.25, 5));
  }, [setZoom, zoom.scale]);

  const handleZoomOut = useCallback(() => {
    setZoom("custom", Math.max(zoom.scale - 0.25, 0.1));
  }, [setZoom, zoom.scale]);

  const handleZoomModeChange = useCallback(
    (value: unknown) => {
      const mode = value as ZoomMode;
      setZoom(mode);
    },
    [setZoom],
  );

  const handlePageInput = useCallback(
    (_value: number | null) => {
      if (_value !== null && _value >= 1 && _value <= numPages) {
        goToPage(_value);
      }
    },
    [goToPage, numPages],
  );

  const zoomMenuItems: MenuProps["items"] = [
    {
      key: "fit-width",
      label: "适应宽度",
      onClick: () => setZoom("fit-width"),
    },
    {
      key: "fit-page",
      label: "适应页面",
      onClick: () => setZoom("fit-page"),
    },
    { type: "divider" },
    {
      key: "50",
      label: "50%",
      onClick: () => setZoom("custom", 0.5),
    },
    {
      key: "75",
      label: "75%",
      onClick: () => setZoom("custom", 0.75),
    },
    {
      key: "100",
      label: "100%",
      onClick: () => setZoom("custom", 1.0),
    },
    {
      key: "125",
      label: "125%",
      onClick: () => setZoom("custom", 1.25),
    },
    {
      key: "150",
      label: "150%",
      onClick: () => setZoom("custom", 1.5),
    },
    {
      key: "200",
      label: "200%",
      onClick: () => setZoom("custom", 2.0),
    },
  ];

  const annotationMenuItems: MenuProps["items"] = [
    {
      key: "highlight",
      label: "高亮批注",
      icon: <HighlightOutlined />,
    },
    {
      key: "underline",
      label: "下划线批注",
      icon: <UnderlineOutlined />,
    },
    {
      key: "comment",
      label: "文字批注",
      icon: <CommentOutlined />,
    },
  ];

  if (status === "idle") {
    return (
      <div className="pdf-toolbar pdf-toolbar--idle">
        <Space>
          <Button icon={<AppstoreOutlined />} onClick={onOpenFile}>
            打开文件
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <div className="pdf-toolbar">
      <Space size="middle" wrap>
        <Space size="small">
          <Tooltip title="打开文件">
            <Button icon={<AppstoreOutlined />} onClick={onOpenFile} />
          </Tooltip>
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Tooltip title="上一页">
            <Button
              icon={<LeftOutlined />}
              onClick={prevPage}
              disabled={currentPage <= 1}
            />
          </Tooltip>

          <Space size="small">
            <InputNumber
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={handlePageInput}
              style={{ width: 60 }}
              aria-label="页码"
            />
            <span style={{ color: "#666", whiteSpace: "nowrap" }}>
              / {numPages}
            </span>
          </Space>

          <Tooltip title="下一页">
            <Button
              icon={<RightOutlined />}
              onClick={nextPage}
              disabled={currentPage >= numPages}
            />
          </Tooltip>
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
          </Tooltip>

          <Dropdown menu={{ items: zoomMenuItems }} trigger={["click"]}>
            <Button style={{ minWidth: 80 }}>
              <Space>
                <span>{Math.round(zoom.scale * 100)}%</span>
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>

          <Tooltip title="放大">
            <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
          </Tooltip>

          <Segmented
            value={zoom.mode}
            onChange={handleZoomModeChange}
            options={[
              { label: "宽度", value: "fit-width" },
              { label: "页面", value: "fit-page" },
            ]}
            size="small"
          />
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Tooltip title="向左旋转">
            <Button icon={<RotateLeftOutlined />} onClick={() => rotateAll()} />
          </Tooltip>

          <Tooltip title="向右旋转">
            <Button icon={<RotateRightOutlined />} onClick={() => rotateAll()} />
          </Tooltip>
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Tooltip title={showThumbnails ? "隐藏缩略图" : "显示缩略图"}>
            <Badge count={showThumbnails ? 1 : 0} size="small" dot>
              <Button
                type={showThumbnails ? "primary" : "default"}
                icon={<AppstoreOutlined />}
                onClick={toggleThumbnails}
              />
            </Badge>
          </Tooltip>

          <Tooltip title="搜索 (Ctrl+F)">
            <Badge count={showSearch ? 1 : 0} size="small" dot>
              <Button
                type={showSearch ? "primary" : "default"}
                icon={<SearchOutlined />}
                onClick={toggleSearch}
              />
            </Badge>
          </Tooltip>
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Dropdown menu={{ items: annotationMenuItems }} trigger={["click"]}>
            <Button icon={<HighlightOutlined />}>
              <Space>
                批注
                <DownOutlined />
              </Space>
            </Button>
          </Dropdown>
        </Space>

        <Divider type="vertical" />

        <Space size="small">
          <Tooltip title="打印">
            <Button icon={<PrinterOutlined />} onClick={print} />
          </Tooltip>
        </Space>

        {fileName && (
          <>
            <div style={{ flex: 1 }} />
            <span
              style={{
                color: "#666",
                fontSize: 12,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={fileName}
            >
              {fileName}
            </span>
          </>
        )}
      </Space>
    </div>
  );
}
