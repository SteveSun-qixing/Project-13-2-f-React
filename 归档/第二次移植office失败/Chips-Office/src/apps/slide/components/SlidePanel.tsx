/**
 * 缩略图面板组件
 * 左侧幻灯片缩略图导航面板
 */
import React, { useCallback, useRef, useEffect } from "react";
import { Button, Tooltip, Dropdown, Space, Spin } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  HolderOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ThumbnailList } from "./Thumbnail";
import type { SlideThumbnail } from "../types";
import { formatMessage } from "../../../lib/messages";

export interface SlidePanelProps {
  /** 缩略图列表 */
  thumbnails: SlideThumbnail[];
  /** 当前幻灯片索引 */
  currentSlideIndex: number;
  /** 选中索引 */
  selectedIndex?: number;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 缩略图宽度 */
  thumbnailWidth?: number;
  /** 点击缩略图回调 */
  onThumbnailClick?: (index: number) => void;
  /** 双击缩略图回调 */
  onThumbnailDoubleClick?: (index: number) => void;
  /** 新建幻灯片回调 */
  onNewSlide?: () => void;
  /** 删除幻灯片回调 */
  onDeleteSlide?: (index: number) => void;
  /** 复制幻灯片回调 */
  onDuplicateSlide?: (index: number) => void;
  /** 上移幻灯片回调 */
  onMoveSlideUp?: (index: number) => void;
  /** 下移幻灯片回调 */
  onMoveSlideDown?: (index: number) => void;
}

/** 幻灯片面板组件 */
export const SlidePanel = React.memo(function SlidePanel({
  thumbnails,
  currentSlideIndex,
  selectedIndex,
  isLoading = false,
  disabled = false,
  readOnly = false,
  thumbnailWidth = 160,
  onThumbnailClick,
  onThumbnailDoubleClick,
  onNewSlide,
  onDeleteSlide,
  onDuplicateSlide,
  onMoveSlideUp,
  onMoveSlideDown,
}: SlidePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const selectedElement = container.querySelector('[data-is-current="true"]');
    if (selectedElement) {
      selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentSlideIndex]);

  const handleThumbnailClick = useCallback(
    (index: number) => {
      if (!disabled && !readOnly) {
        onThumbnailClick?.(index);
      }
    },
    [disabled, readOnly, onThumbnailClick],
  );

  const handleThumbnailDoubleClick = useCallback(
    (index: number) => {
      if (!disabled) {
        onThumbnailDoubleClick?.(index);
      }
    },
    [disabled, onThumbnailDoubleClick],
  );

  const getSlideMenu = useCallback(
    (index: number): MenuProps["items"] => [
      {
        key: "duplicate",
        icon: <CopyOutlined />,
        label: formatMessage("slide.panel.duplicate"),
        onClick: () => onDuplicateSlide?.(index),
        disabled: readOnly,
      },
      {
        key: "moveUp",
        icon: <HolderOutlined />,
        label: formatMessage("slide.panel.moveUp"),
        onClick: () => onMoveSlideUp?.(index),
        disabled: index === 0 || readOnly,
      },
      {
        key: "moveDown",
        icon: <HolderOutlined />,
        label: formatMessage("slide.panel.moveDown"),
        onClick: () => onMoveSlideDown?.(index),
        disabled: index === thumbnails.length - 1 || readOnly,
      },
      { type: "divider" },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        label: formatMessage("slide.panel.delete"),
        danger: true,
        disabled: thumbnails.length <= 1 || readOnly,
        onClick: () => onDeleteSlide?.(index),
      },
    ],
    [
      onDuplicateSlide,
      onMoveSlideUp,
      onMoveSlideDown,
      onDeleteSlide,
      thumbnails.length,
      readOnly,
    ],
  );

  const slideCount = thumbnails.length;

  return (
    <div
      ref={containerRef}
      style={{
        width: thumbnailWidth + 32,
        minWidth: thumbnailWidth + 32,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fafafa",
        borderRight: "1px solid #e8e8e8",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #e8e8e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>
          {formatMessage("slide.panel.title", { count: slideCount })}
        </span>
        {!readOnly && (
          <Tooltip title={formatMessage("slide.panel.newSlide")}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={onNewSlide}
              disabled={disabled}
            />
          </Tooltip>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Spin size="small" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
            {thumbnails.map((thumbnail, idx) => (
              <div
                key={thumbnail.index}
                data-is-current={idx === currentSlideIndex}
                style={{ position: "relative" }}
              >
                <ThumbnailList
                  thumbnails={[thumbnail]}
                  currentIndex={currentSlideIndex}
                  selectedIndex={selectedIndex}
                  thumbnailWidth={thumbnailWidth}
                  onThumbnailClick={handleThumbnailClick}
                  onThumbnailDoubleClick={handleThumbnailDoubleClick}
                />
                {!readOnly && (
                  <Dropdown
                    menu={{ items: getSlideMenu(idx) }}
                    trigger={["click"]}
                    placement="bottomLeft"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 16,
                        opacity: 0.6,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
