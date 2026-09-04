/**
 * 幻灯片缩略图组件
 * 展示单个幻灯片的缩略图预览
 */
import React, { useCallback, useMemo } from "react";
import { Image, Badge } from "antd";
import type { SlideThumbnail } from "../types";
import type { RenderSlide } from "../../../engine/pptx-render/src/index";
import { normalizeColor } from "../konva/render-adapter";

export interface ThumbnailProps {
  /** 缩略图数据 */
  thumbnail: SlideThumbnail;
  /** 缩略图宽度 */
  width?: number;
  /** 是否选中 */
  isSelected?: boolean;
  /** 点击回调 */
  onClick?: (index: number) => void;
  /** 双击回调 */
  onDoubleClick?: (index: number) => void;
}

/** 缩略图背景颜色 */
function getBackgroundColor(renderSlide: RenderSlide | null): string {
  if (!renderSlide) return "#ffffff";
  if (renderSlide.background.kind === "solid") {
    return normalizeColor(renderSlide.background.color);
  }
  return "#ffffff";
}

/** 缩略图组件 */
export const Thumbnail = React.memo(function Thumbnail({
  thumbnail,
  width = 160,
  isSelected = false,
  onClick,
  onDoubleClick,
}: ThumbnailProps) {
  const { index, renderSlide, isCurrent } = thumbnail;
  /** 引擎解析 <p:sld show="0"> 得到的隐藏幻灯片标记（RenderSlide.hidden） */
  const hidden = renderSlide?.hidden === true;

  const handleClick = useCallback(() => {
    onClick?.(index);
  }, [index, onClick]);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.(index);
  }, [index, onDoubleClick]);

  const aspectRatio = useMemo(() => {
    if (!renderSlide) return 16 / 9;
    return renderSlide.widthPx / renderSlide.heightPx;
  }, [renderSlide]);

  const height = width / aspectRatio;

  const backgroundColor = getBackgroundColor(renderSlide);

  const slideNumber = index + 1;

  return (
    <Badge
      count={hidden ? "隐藏" : undefined}
      style={{ display: "block" }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
        style={{
          width,
          height: height + 32,
          padding: "8px",
          background: isCurrent ? "#e6f7ff" : "#f5f5f5",
          border: isSelected ? "2px solid #0078D4" : isCurrent ? "2px solid #1890ff" : "1px solid #d9d9d9",
          borderRadius: 4,
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isCurrent ? "0 2px 8px rgba(0, 120, 212, 0.2)" : "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height,
            background: backgroundColor,
            border: "1px solid #e0e0e0",
            borderRadius: 2,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {renderSlide ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#999",
              }}
            >
              <span style={{ fontWeight: 500 }}>{renderSlide.nodes.length} 个元素</span>
            </div>
          ) : (
            <span style={{ color: "#ccc", fontSize: 12 }}>无法预览</span>
          )}
        </div>
        <div
          style={{
            marginTop: 4,
            textAlign: "center",
            fontSize: 12,
            color: isCurrent ? "#0078D4" : "#666",
            fontWeight: isCurrent ? 600 : 400,
          }}
        >
          {slideNumber}
        </div>
      </div>
    </Badge>
  );
});

export interface ThumbnailListProps {
  /** 缩略图列表 */
  thumbnails: SlideThumbnail[];
  /** 当前幻灯片索引 */
  currentIndex: number;
  /** 选中索引 */
  selectedIndex?: number;
  /** 缩略图宽度 */
  thumbnailWidth?: number;
  /** 点击回调 */
  onThumbnailClick?: (index: number) => void;
  /** 双击回调 */
  onThumbnailDoubleClick?: (index: number) => void;
}

/** 缩略图列表组件 */
export const ThumbnailList = React.memo(function ThumbnailList({
  thumbnails,
  currentIndex,
  selectedIndex,
  thumbnailWidth = 160,
  onThumbnailClick,
  onThumbnailDoubleClick,
}: ThumbnailListProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 8,
        overflowY: "auto",
        maxHeight: "100%",
      }}
    >
      {thumbnails.map((thumbnail, idx) => (
        <Thumbnail
          key={thumbnail.index}
          thumbnail={thumbnail}
          width={thumbnailWidth}
          isSelected={selectedIndex === idx}
          onClick={onThumbnailClick}
          onDoubleClick={onThumbnailDoubleClick}
        />
      ))}
    </div>
  );
});
