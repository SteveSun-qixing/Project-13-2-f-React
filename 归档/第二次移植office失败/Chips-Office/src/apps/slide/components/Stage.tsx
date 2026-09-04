/**
 * Konva 舞台组件 - 渲染幻灯片内容
 * 使用 react-konva 进行高性能 Canvas 渲染
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Group, Line, Path, Text, Image, Arc } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type { RenderSlide, RenderNode, ShapeRenderNode, PictureRenderNode } from "../../../engine/pptx-render/src/index";
import {
  resolveFillConfig,
  resolveStrokeConfig,
  resolveShadowConfig,
  resolveTextConfig,
  normalizeColor,
  isNodeInteractive,
  isNodeSelectable,
} from "../konva/render-adapter";
import type { ZoomState, ToolType } from "../types";

export interface SlideStageProps {
  /** 渲染后的幻灯片数据 */
  renderSlide: RenderSlide | null;
  /** 缩放状态 */
  zoomState: ZoomState;
  /** 缩放改变回调 */
  onZoomChange?: (newZoom: number) => void;
  /** 选择元素回调 */
  onSelectElement?: (elementId: string, addToSelection: boolean) => void;
  /** 清除选择回调 */
  onClearSelection?: () => void;
  /** 选中的元素 ID 列表 */
  selectedElementIds?: string[];
  /** 当前工具 */
  activeTool?: ToolType;
  /** 容器宽度 */
  containerWidth?: number;
  /** 容器高度 */
  containerHeight?: number;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 元素拖拽回调 */
  onElementDrag?: (elementId: string, x: number, y: number) => void;
  /** 元素大小改变回调 */
  onElementResize?: (elementId: string, width: number, height: number, x: number, y: number) => void;
}

/** 加载图片 Hook */
function useImageLoader(src?: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}

/** 渲染形状节点 */
function ShapeNode({
  node,
  isSelected,
  onSelect,
  draggable,
  onDragEnd,
}: {
  node: ShapeRenderNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  draggable: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const { box, fill, stroke, shadow, line, polygonPoints, pathData, cornerRadiusPx } = node;
  const fillConfig = resolveFillConfig(fill);
  const strokeConfig = resolveStrokeConfig(stroke, box.w, box.h);
  const shadowConfig = resolveShadowConfig(shadow);

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.sourceId);
    },
    [node.sourceId, onSelect],
  );

  const commonProps = {
    id: node.id,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    rotation: box.rotationDeg ?? 0,
    scaleX: box.flipH ? -1 : 1,
    scaleY: box.flipV ? -1 : 1,
    fill: fillConfig.fill,
    stroke: strokeConfig.stroke,
    strokeWidth: strokeConfig.strokeWidth ?? 0,
    cornerRadius: cornerRadiusPx,
    shadowColor: shadowConfig.shadowColor,
    shadowBlur: shadowConfig.shadowBlur,
    shadowOffsetX: shadowConfig.shadowOffsetX,
    shadowOffsetY: shadowConfig.shadowOffsetY,
    shadowOpacity: shadowConfig.shadowEnabled ? 1 : 0,
    draggable,
    onClick: handleClick,
    onTap: handleClick,
    onDragEnd: onDragEnd
      ? (e: KonvaEventObject<DragEvent>) => {
          onDragEnd(node.sourceId, e.target.x(), e.target.y());
        }
      : undefined,
  };

  if (line) {
    return (
      <Line
        points={line.points}
        stroke={strokeConfig.stroke}
        strokeWidth={strokeConfig.strokeWidth ?? 1}
        lineCap={stroke?.cap}
        lineJoin={stroke?.join}
        dash={stroke?.dash}
        tension={line.bezier ? 0.5 : 0}
        rotation={box.rotationDeg ?? 0}
        hitStrokeWidth={10}
      />
    );
  }

  if (polygonPoints && polygonPoints.length > 0) {
    return (
      <Line
        {...commonProps}
        points={polygonPoints}
        closed
        fill={fillConfig.fill}
      />
    );
  }

  if (pathData) {
    return (
      <Path
        {...commonProps}
        data={pathData}
      />
    );
  }

  if (node.text) {
    return (
      <TextNode
        node={node}
        isSelected={isSelected}
        onSelect={onSelect}
        draggable={draggable}
        onDragEnd={onDragEnd}
      />
    );
  }

  return (
    <Rect
      {...commonProps}
      fill={fillConfig.fill}
    />
  );
}

/** 渲染文本节点 */
function TextNode({
  node,
  isSelected,
  onSelect,
  draggable,
  onDragEnd,
}: {
  node: ShapeRenderNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  draggable: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const { box, text } = node;

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.sourceId);
    },
    [node.sourceId, onSelect],
  );

  if (!text) {
    return (
      <Rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rotation={box.rotationDeg ?? 0}
        draggable={draggable}
        onClick={handleClick}
        onTap={handleClick}
        stroke={isSelected ? "#0078D4" : undefined}
        strokeWidth={isSelected ? 2 : 0}
      />
    );
  }

  const textConfigs = resolveTextConfig(text, box.w, box.h);

  return (
    <Group
      x={box.x}
      y={box.y}
      rotation={box.rotationDeg ?? 0}
      draggable={draggable}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={
        onDragEnd
          ? (e: KonvaEventObject<DragEvent>) => {
              onDragEnd(node.sourceId, e.target.x(), e.target.y());
            }
          : undefined
      }
    >
      <Rect
        width={box.w}
        height={box.h}
        stroke={isSelected ? "#0078D4" : undefined}
        strokeWidth={isSelected ? 2 : 0}
        dash={isSelected ? [4, 4] : undefined}
      />
      {textConfigs.map((config, idx) => (
        <Text
          key={idx}
          x={config.x}
          y={config.y}
          text={config.text}
          fontSize={config.fontSize}
          fontFamily={config.fontFamily}
          fill={config.fill}
          fontStyle={config.fontStyle}
          textDecoration={config.textDecoration}
          width={config.width}
          align={config.align}
          letterSpacing={config.letterSpacing}
          kerningEnabled={config.kerningEnabled}
          rotation={config.rotation}
        />
      ))}
    </Group>
  );
}

/** 渲染图片节点 */
function PictureNode({
  node,
  isSelected,
  onSelect,
  draggable,
  onDragEnd,
}: {
  node: PictureRenderNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  draggable: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const { box, dataUrl, fill } = node;
  const image = useImageLoader(dataUrl);
  const fillConfig = resolveFillConfig(fill);

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.sourceId);
    },
    [node.sourceId, onSelect],
  );

  return (
    <Group
      x={box.x}
      y={box.y}
      rotation={box.rotationDeg ?? 0}
      scaleX={box.flipH ? -1 : 1}
      scaleY={box.flipV ? -1 : 1}
      draggable={draggable}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={
        onDragEnd
          ? (e: KonvaEventObject<DragEvent>) => {
              onDragEnd(node.sourceId, e.target.x(), e.target.y());
            }
          : undefined
      }
    >
      {fillConfig.fill && fillConfig.fill !== "transparent" && (
        <Rect
          width={box.w}
          height={box.h}
          fill={fillConfig.fill}
        />
      )}
      {image && (
        <Image
          image={image}
          width={box.w}
          height={box.h}
          stroke={isSelected ? "#0078D4" : undefined}
          strokeWidth={isSelected ? 2 : 0}
        />
      )}
      {!image && (
        <Rect
          width={box.w}
          height={box.h}
          fill="#f0f0f0"
          stroke={isSelected ? "#0078D4" : "#cccccc"}
          strokeWidth={isSelected ? 2 : 1}
        />
      )}
    </Group>
  );
}

/** 渲染组节点 */
function GroupNode({
  node,
  selectedElementIds,
  onSelect,
  draggable,
  onDragEnd,
}: {
  node: import("../../../engine/pptx-render/src/index").GroupRenderNode;
  selectedElementIds: string[];
  onSelect: (id: string) => void;
  draggable: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const { box, children } = node;

  return (
    <Group
      x={box.x}
      y={box.y}
      rotation={box.rotationDeg ?? 0}
      scaleX={box.flipH ? -1 : 1}
      scaleY={box.flipV ? -1 : 1}
      draggable={draggable}
      onDragEnd={
        onDragEnd
          ? (e: KonvaEventObject<DragEvent>) => {
              onDragEnd(node.sourceId, e.target.x(), e.target.y());
            }
          : undefined
      }
    >
      {children.map((child) => (
        <RenderNodeComponent
          key={child.id}
          node={child}
          selectedElementIds={selectedElementIds}
          onSelect={onSelect}
          draggable={draggable}
          onDragEnd={onDragEnd}
        />
      ))}
    </Group>
  );
}

/** 渲染表格节点 */
function TableNode({
  node,
  isSelected,
  onSelect,
}: {
  node: import("../../../engine/pptx-render/src/index").TableRenderNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { box, cells, gridX, gridY } = node;

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.sourceId);
    },
    [node.sourceId, onSelect],
  );

  return (
    <Group
      x={box.x}
      y={box.y}
      onClick={handleClick}
      onTap={handleClick}
    >
      {cells.map((cell, idx) => (
        <Group key={idx}>
          <Rect
            x={cell.x}
            y={cell.y}
            width={cell.w}
            height={cell.h}
            fill={
              cell.fill.kind === "solid"
                ? normalizeColor(cell.fill.color)
                : cell.fill.kind === "none"
                  ? "transparent"
                  : "#f0f0f0"
            }
            stroke="#cccccc"
            strokeWidth={0.5}
          />
          {cell.text && (
            <Text
              x={cell.x + 2}
              y={cell.y + 2}
              width={cell.w - 4}
              height={cell.h - 4}
              text={cell.text.lines
                .flatMap((line) => line.runs.map((run) => run.text))
                .join("")}
              fontSize={12}
              fontFamily="Arial"
              fill="#000000"
            />
          )}
        </Group>
      ))}
    </Group>
  );
}

/** 渲染图表节点 */
function ChartNode({
  node,
  isSelected,
  onSelect,
}: {
  node: import("../../../engine/pptx-render/src/index").ChartRenderNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { box } = node;

  const handleClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(node.sourceId);
    },
    [node.sourceId, onSelect],
  );

  return (
    <Group
      x={box.x}
      y={box.y}
      onClick={handleClick}
      onTap={handleClick}
    >
      <Rect
        width={box.w}
        height={box.h}
        fill="#fafafa"
        stroke={isSelected ? "#0078D4" : "#e0e0e0"}
        strokeWidth={isSelected ? 2 : 1}
      />
      <Text
        x={0}
        y={box.h / 2 - 10}
        width={box.w}
        text="图表"
        fontSize={16}
        fontFamily="Arial"
        fill="#666666"
        align="center"
      />
    </Group>
  );
}

/** 渲染占位符节点 */
function ChipNode({ node }: { node: import("../../../engine/pptx-render/src/index").ChipRenderNode }) {
  const { box, label } = node;

  return (
    <Group x={box.x} y={box.y}>
      <Rect
        width={box.w}
        height={box.h}
        fill="#e0e0e0"
        stroke="#999999"
        strokeWidth={1}
        cornerRadius={4}
      />
      <Text
        x={0}
        y={box.h / 2 - 10}
        width={box.w}
        text={label}
        fontSize={14}
        fontFamily="Arial"
        fill="#666666"
        align="center"
      />
    </Group>
  );
}

/** 根据节点类型渲染对应组件 */
function RenderNodeComponent({
  node,
  selectedElementIds,
  onSelect,
  draggable,
  onDragEnd,
}: {
  node: RenderNode;
  selectedElementIds: string[];
  onSelect: (id: string) => void;
  draggable: boolean;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  if (!isNodeInteractive(node)) {
    return null;
  }

  const isSelected = selectedElementIds.includes(node.sourceId);
  const nodeProps = {
    isSelected,
    onSelect,
    draggable: draggable && isNodeSelectable(node),
    onDragEnd,
  };

  switch (node.type) {
    case "shape":
      return <ShapeNode node={node} {...nodeProps} />;
    case "text":
      return <TextNode node={node} {...nodeProps} />;
    case "picture":
      return <PictureNode node={node} {...nodeProps} />;
    case "group":
      return (
        <GroupNode
          node={node}
          selectedElementIds={selectedElementIds}
          onSelect={onSelect}
          draggable={draggable}
          onDragEnd={onDragEnd}
        />
      );
    case "table":
      return <TableNode node={node} {...nodeProps} />;
    case "chart":
      return <ChartNode node={node} {...nodeProps} />;
    case "placeholder-chip":
      return <ChipNode node={node} />;
    default:
      return null;
  }
}

/** 主舞台组件 */
export const SlideStage = React.memo(function SlideStage({
  renderSlide,
  zoomState,
  selectedElementIds = [],
  onSelectElement,
  onClearSelection,
  activeTool = "select",
  containerWidth = 800,
  containerHeight = 600,
  readOnly = false,
  onElementDrag,
  onElementResize,
}: SlideStageProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: containerWidth, height: containerHeight });

  useEffect(() => {
    setStageSize({ width: containerWidth, height: containerHeight });
  }, [containerWidth, containerHeight]);

  const handleSelect = useCallback(
    (elementId: string) => {
      if (onSelectElement) {
        onSelectElement(elementId, false);
      }
    },
    [onSelectElement],
  );

  const handleDragEnd = useCallback(
    (elementId: string, x: number, y: number) => {
      if (onElementDrag) {
        onElementDrag(elementId, x, y);
      }
    },
    [onElementDrag],
  );

  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        onClearSelection?.();
      }
    },
    [onClearSelection],
  );

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = zoomState.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - zoomState.offsetX) / oldScale,
        y: (pointer.y - zoomState.offsetY) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.1;
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      const clampedScale = Math.max(0.1, Math.min(4, newScale));

      if (stage) {
        setStageSize({
          width: containerWidth * clampedScale,
          height: containerHeight * clampedScale,
        });
      }
    },
    [zoomState, containerWidth, containerHeight],
  );

  const stageStyle = useMemo(
    () => ({
      width: stageSize.width,
      height: stageSize.height,
      transform: `scale(${zoomState.scale})`,
      transformOrigin: "top left",
    }),
    [stageSize, zoomState.scale],
  );

  if (!renderSlide) {
    return (
      <div
        style={{
          width: containerWidth,
          height: containerHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f5f5",
          color: "#999",
        }}
      >
        暂无幻灯片内容
      </div>
    );
  }

  const backgroundFill =
    renderSlide.background.kind === "solid"
      ? normalizeColor(renderSlide.background.color)
      : "#ffffff";

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        overflow: "auto",
        background: "#e0e0e0",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
      }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={zoomState.scale}
        scaleY={zoomState.scale}
        x={zoomState.offsetX}
        y={zoomState.offsetY}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onWheel={handleWheel}
        style={stageStyle}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={renderSlide.widthPx}
            height={renderSlide.heightPx}
            fill={backgroundFill}
          />
          {renderSlide.nodes.map((node) => (
            <RenderNodeComponent
              key={node.id}
              node={node}
              selectedElementIds={selectedElementIds}
              onSelect={handleSelect}
              draggable={!readOnly && activeTool === "select"}
              onDragEnd={onElementDrag ? handleDragEnd : undefined}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
});
