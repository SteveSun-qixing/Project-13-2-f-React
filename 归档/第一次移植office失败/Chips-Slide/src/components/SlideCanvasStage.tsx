/**
 * 幻灯片交互画布（react-konva）：渲染 RenderTree（经 NodeBody/StaticNode 机械映射），
 * 并提供选择、拖动、八向缩放、旋转与双击文字编辑。
 * 交互几何全部以视口 px 计算，提交时经 px→EMU 换算走 setTransform op；
 * 一次手势（拖动/缩放/旋转）整体提交为一个撤销步骤。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect } from "react-konva";
import type Konva from "konva";
import type {
  RenderNode,
  RenderSlide,
  ShapeRenderNode,
} from "@genoffice/pptx-render";
import { boxPivotProps, fillToKonva, isEditableText } from "../slides/render/konva-adapter";
import { NodeBody } from "../slides/render/NodeBody";
import { TextEditOverlay } from "../slides/render/TextEditOverlay";
import type { EditParagraph } from "../slides/types";
import type { Op } from "../slides/ops";
import {
  HANDLE_ANCHORS,
  nodeKeepAspect,
  pxToEmu,
  resizeBoxFromHandle,
  rotationFromPointer,
  type HandleId,
  type PxBox,
} from "./canvas-geometry";
import type { DeckEditingState } from "../state/deck-store";

const HANDLE_SCREEN_PX = 9;
const ROTATE_HANDLE_SCREEN_OFFSET = 22;

export interface SlideCanvasStageProps {
  slide: RenderSlide;
  images: Map<string, HTMLImageElement>;
  selectedId: string | null;
  editing: DeckEditingState | null;
  onSelect(sourceId: string | null): void;
  onStartEdit(sourceId: string, caret?: { x: number; y: number }): void;
  onCancelEdit(): void;
  onCommitText(paragraphs: EditParagraph[]): void;
  apply(op: Op): boolean;
}

interface PreviewTransform {
  sourceId: string;
  box: PxBox;
  rotationDeg: number;
}

interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeBox(node: RenderNode): NodeBox {
  return { x: node.box.x, y: node.box.y, w: node.box.w, h: node.box.h };
}

export function SlideCanvasStage(props: SlideCanvasStageProps): React.ReactElement {
  const {
    slide,
    images,
    selectedId,
    editing,
    onSelect,
    onStartEdit,
    onCancelEdit,
    onCommitText,
    apply,
  } = props;

  const stageRef = useRef<Konva.Stage | null>(null);
  const rotateStartRef = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<PreviewTransform | null>(null);

  const scale = slide.scale || 1;
  const invScale = 1 / scale;

  useEffect(() => {
    setPreview(null);
    rotateStartRef.current = null;
  }, [selectedId, slide]);

  const editableNode = useMemo(() => {
    if (!editing) return null;
    return slide.nodes.find(
      (n) => n.sourceId === editing.sourceId && isEditableText(n),
    ) as ShapeRenderNode | undefined;
  }, [editing, slide.nodes]);

  const selectedNode = useMemo(
    () => slide.nodes.find((n) => n.sourceId === selectedId && !n.decoration),
    [selectedId, slide.nodes],
  );

  const commitTransform = useCallback(
    (sourceId: string, box: PxBox, rotationDeg: number) => {
      void apply({
        op: "setTransform",
        target: { slide: 0, el: sourceId },
        box: {
          x: pxToEmu(box.x, scale),
          y: pxToEmu(box.y, scale),
          cx: pxToEmu(box.w, scale),
          cy: pxToEmu(box.h, scale),
        },
        rotDeg: Math.round(rotationDeg * 100) / 100,
      });
      setPreview(null);
      rotateStartRef.current = null;
    },
    [apply, scale],
  );

  const handleStageMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (event.target === event.target.getStage()) {
        onSelect(null);
        onCancelEdit();
      }
    },
    [onCancelEdit, onSelect],
  );

  const effectiveBox = useCallback(
    (node: RenderNode): { box: NodeBox; rotationDeg: number } => {
      if (preview && preview.sourceId === node.sourceId) {
        return { box: preview.box, rotationDeg: preview.rotationDeg };
      }
      return { box: nodeBox(node), rotationDeg: node.box.rotationDeg };
    },
    [preview],
  );

  const renderNode = (node: RenderNode): React.ReactElement => {
    if (node.decoration || !node.sourceId) {
      return (
        <Group key={node.id} {...boxPivotProps(node.box)} listening={false}>
          <NodeBody node={node} images={images} />
        </Group>
      );
    }
    const isSelected = node.sourceId === selectedId;
    const { box, rotationDeg } = effectiveBox(node);
    const nodeBase = nodeBox(node);
    return (
      <Group
        key={node.id}
        {...boxPivotProps({ ...box, rotationDeg, flipH: node.box.flipH, flipV: node.box.flipV })}
        draggable={isSelected}
        onClick={(event) => {
          event.cancelBubble = true;
          onSelect(node.sourceId);
        }}
        onDblClick={(event) => {
          event.cancelBubble = true;
          if (isEditableText(node)) {
            const pos = event.target.getStage()?.getPointerPosition();
            onStartEdit(node.sourceId, pos ?? undefined);
          }
        }}
        onDragEnd={(event) => {
          const deltaX = event.target.x() - (nodeBase.x + nodeBase.w / 2);
          const deltaY = event.target.y() - (nodeBase.y + nodeBase.h / 2);
          commitTransform(
            node.sourceId,
            { x: nodeBase.x + deltaX, y: nodeBase.y + deltaY, w: nodeBase.w, h: nodeBase.h },
            node.box.rotationDeg,
          );
        }}
      >
        <Group
          listening={false}
          scaleX={box.w > 0 ? box.w / nodeBase.w : 1}
          scaleY={box.h > 0 ? box.h / nodeBase.h : 1}
        >
          <NodeBody
            node={node}
            images={images}
            hideText={editing?.sourceId === node.sourceId}
          />
        </Group>
        <Rect
          x={0}
          y={0}
          width={nodeBase.w}
          height={nodeBase.h}
          fill="rgba(0,0,0,0)"
          strokeEnabled={false}
        />
      </Group>
    );
  };

  const selectionChrome = (): React.ReactElement | null => {
    if (!selectedNode || editing) return null;
    const base = nodeBox(selectedNode);
    const { box, rotationDeg } = effectiveBox(selectedNode);
    const handlePx = HANDLE_SCREEN_PX * invScale;
    const rotateHandle = (
      <Rect
        x={box.w / 2}
        y={-ROTATE_HANDLE_SCREEN_OFFSET * invScale}
        width={handlePx}
        height={handlePx}
        offsetX={handlePx / 2}
        offsetY={handlePx / 2}
        fill="#ffffff"
        stroke="#0a84ff"
        strokeWidth={1.5 * invScale}
        draggable
        onDragStart={(event) => {
          const pointer = event.target.getStage()?.getPointerPosition();
          if (pointer) rotateStartRef.current = pointer;
        }}
        onDragMove={(event) => {
          const pointer = event.target.getStage()?.getPointerPosition();
          const start = rotateStartRef.current;
          if (!pointer || !start) return;
          const nextDeg = rotationFromPointer(base, selectedNode.box.rotationDeg, start, pointer);
          setPreview({ sourceId: selectedNode.sourceId, box, rotationDeg: nextDeg });
        }}
        onDragEnd={() => {
          if (preview && preview.sourceId === selectedNode.sourceId) {
            commitTransform(selectedNode.sourceId, preview.box, preview.rotationDeg);
          }
        }}
      />
    );
    return (
      <Group {...boxPivotProps({ ...box, rotationDeg })}>
        <Rect
          x={0}
          y={0}
          width={box.w}
          height={box.h}
          stroke="#0a84ff"
          strokeWidth={1.5 * invScale}
          listening={false}
        />
        {(Object.keys(HANDLE_ANCHORS) as HandleId[]).map((handle) => {
          const anchor = HANDLE_ANCHORS[handle];
          return (
            <Rect
              key={handle}
              x={anchor.x * box.w}
              y={anchor.y * box.h}
              width={handlePx}
              height={handlePx}
              offsetX={anchor.x * handlePx}
              offsetY={anchor.y * handlePx}
              fill="#0a84ff"
              stroke="#ffffff"
              strokeWidth={1 * invScale}
              draggable
              onDragMove={(event) => {
                const pointer = event.target.getStage()?.getPointerPosition();
                if (!pointer) return;
                const next = resizeBoxFromHandle(
                  base,
                  rotationDeg,
                  handle,
                  pointer,
                  nodeKeepAspect(selectedNode),
                );
                setPreview({ sourceId: selectedNode.sourceId, box: next, rotationDeg });
              }}
              onDragEnd={() => {
                if (preview && preview.sourceId === selectedNode.sourceId) {
                  commitTransform(selectedNode.sourceId, preview.box, preview.rotationDeg);
                }
              }}
            />
          );
        })}
        {rotateHandle}
      </Group>
    );
  };

  return (
    <div className="slide-canvas" data-testid="slide-canvas">
      <Stage
        ref={stageRef}
        width={slide.widthPx}
        height={slide.heightPx}
        onMouseDown={handleStageMouseDown}
        onTouchStart={handleStageMouseDown}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={slide.widthPx}
            height={slide.heightPx}
            {...bgFillProps(slide, images)}
            listening={false}
          />
          {slide.nodes.map((node) => renderNode(node))}
          {selectionChrome()}
        </Layer>
      </Stage>
      {editing && editableNode ? (
        <TextEditOverlay
          node={editableNode}
          scale={scale}
          onCommit={onCommitText}
          onCancel={onCancelEdit}
          zoom={1}
        />
      ) : null}
    </div>
  );
}

function bgFillProps(slide: RenderSlide, images: Map<string, HTMLImageElement>) {
  const fill = fillToKonva(slide.background, slide.widthPx, slide.heightPx, images);
  return Object.keys(fill).length ? fill : { fill: "#ffffff" };
}
