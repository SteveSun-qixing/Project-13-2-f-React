import { useCallback, useMemo } from "react";
import { Tooltip, Popconfirm } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { usePdf } from "../hooks/usePdf";
import type { Annotation, AnnotationRect } from "../types";

interface AnnotationLayerProps {
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
}

const ANNOTATION_COLORS: Record<string, string> = {
  highlight: "rgba(255, 255, 0, 0.3)",
  underline: "rgba(0, 0, 255, 0.3)",
  comment: "rgba(255, 0, 0, 0.2)",
};

const ANNOTATION_BORDER_COLORS: Record<string, string> = {
  highlight: "#ffff00",
  underline: "#0000ff",
  comment: "#ff0000",
};

export function AnnotationLayer({ pageIndex, pageWidth, pageHeight }: AnnotationLayerProps) {
  const { annotations, updateAnnotation, removeAnnotation } = usePdf();

  const pageAnnotations = useMemo(() => {
    return annotations.filter((ann) => ann.pageIndex === pageIndex);
  }, [annotations, pageIndex]);

  const handleAnnotationClick = useCallback(
    (annotation: Annotation, e: React.MouseEvent) => {
      e.stopPropagation();
      console.log("Annotation clicked:", annotation);
    },
    [],
  );

  const handleDelete = useCallback(
    (annotationId: string) => {
      removeAnnotation(annotationId);
    },
    [removeAnnotation],
  );

  const renderAnnotation = (annotation: Annotation) => {
    const { id, type, rect, color, text, author, createdAt } = annotation;

    const style: React.CSSProperties = {
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      backgroundColor: ANNOTATION_COLORS[type] || color,
      border: `1px solid ${ANNOTATION_BORDER_COLORS[type] || color}`,
      cursor: "pointer",
      transition: "opacity 0.2s",
    };

    if (type === "highlight") {
      style.opacity = 0.4;
      style.mixBlendMode = "multiply";
    } else if (type === "underline") {
      style.backgroundColor = "transparent";
      style.borderBottom = `2px solid ${ANNOTATION_BORDER_COLORS.underline}`;
      style.borderLeft = "none";
      style.borderRight = "none";
      style.borderTop = "none";
    } else if (type === "comment") {
      style.borderRadius = 4;
      style.padding = 4;
    }

    return (
      <Tooltip
        key={id}
        title={
          <div>
            <div>类型: {type === "highlight" ? "高亮" : type === "underline" ? "下划线" : "批注"}</div>
            {author && <div>作者: {author}</div>}
            {text && <div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{text}</div>}
            <div style={{ fontSize: 10, color: "#999" }}>
              {new Date(createdAt).toLocaleString()}
            </div>
          </div>
        }
        placement="top"
      >
        <div
          style={style}
          onClick={(e) => handleAnnotationClick(annotation, e)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleAnnotationClick(annotation, e as unknown as React.MouseEvent);
            }
          }}
          aria-label={`${type} 注释`}
        >
          {type === "comment" && text && (
            <div
              style={{
                fontSize: 11,
                color: "#333",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {text}
            </div>
          )}
        </div>
      </Tooltip>
    );
  };

  if (pageAnnotations.length === 0) {
    return null;
  }

  return (
    <div
      className="pdf-annotation-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {pageAnnotations.map((annotation) => (
        <div key={annotation.id} style={{ pointerEvents: "auto" }}>
          {renderAnnotation(annotation)}
        </div>
      ))}
    </div>
  );
}

export interface AnnotationOverlayProps {
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
}

export function AnnotationOverlay({
  pageIndex,
  pageWidth,
  pageHeight,
  scale,
}: AnnotationOverlayProps) {
  const { annotations, addAnnotation, removeAnnotation } = usePdf();

  const pageAnnotations = useMemo(() => {
    return annotations.filter((ann) => ann.pageIndex === pageIndex);
  }, [annotations, pageIndex]);

  const handleAddHighlight = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const pageRect = e.currentTarget.closest(".pdf-page")?.getBoundingClientRect();

      if (!pageRect) return;

      const x = rect.left - pageRect.left;
      const y = rect.top - pageRect.top;

      addAnnotation({
        pageIndex,
        type: "highlight",
        rect: {
          x: x / scale,
          y: y / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        },
        color: "rgba(255, 255, 0, 0.4)",
      });
    },
    [addAnnotation, pageIndex, scale],
  );

  const handleAddComment = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pageRect = e.currentTarget.closest(".pdf-page")?.getBoundingClientRect();

      if (!pageRect) return;

      const x = e.clientX - pageRect.left;
      const y = e.clientY - pageRect.top;

      addAnnotation({
        pageIndex,
        type: "comment",
        rect: {
          x: x / scale,
          y: y / scale,
          width: 150,
          height: 60,
        },
        color: "rgba(255, 0, 0, 0.2)",
        text: "新建批注",
      });
    },
    [addAnnotation, pageIndex, scale],
  );

  if (pageAnnotations.length === 0) {
    return null;
  }

  return (
    <div
      className="pdf-annotation-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: "none",
        zIndex: 15,
      }}
    >
      {pageAnnotations.map((annotation) => (
        <div
          key={annotation.id}
          style={{
            position: "absolute",
            left: annotation.rect.x,
            top: annotation.rect.y,
            width: annotation.rect.width,
            height: annotation.rect.height,
            backgroundColor: annotation.color,
            borderRadius: annotation.type === "comment" ? 4 : 0,
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {annotation.type === "comment" && (
            <div
              style={{
                fontSize: 10,
                color: "#333",
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: 4,
              }}
            >
              {annotation.text || "批注"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
