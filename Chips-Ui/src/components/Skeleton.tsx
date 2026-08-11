import type { CSSProperties, ReactNode } from "react";

const BASE: CSSProperties = {
  display: "block",
  background: "#f2f2f7",
  borderRadius: 10,
  boxSizing: "border-box",
};

/**
 * 布局骨架原子：浅灰圆角块（封面/卡片轮廓）。
 * 供各布局插件空状态按自身形态组合骨架占位。
 */
export interface SkeletonBlockProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  dashed?: boolean;
  style?: CSSProperties;
}

export function SkeletonBlock({
  width,
  height,
  radius = 10,
  dashed = false,
  style,
}: SkeletonBlockProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        ...BASE,
        width,
        height,
        borderRadius: radius,
        border: dashed ? "1.5px dashed rgba(0,0,0,0.10)" : undefined,
        background: dashed ? "transparent" : "#f2f2f7",
        ...style,
      }}
    />
  );
}

/**
 * 布局骨架原子：浅灰圆角线条（标题/文本行）。
 */
export interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: CSSProperties;
}

export function SkeletonLine({
  width,
  height = 10,
  radius = 5,
  style,
}: SkeletonLineProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        ...BASE,
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/**
 * 布局骨架原子：圆形（时间线节点 / 地图钉 / 封面流圆点）。
 */
export interface SkeletonDotProps {
  size?: number;
  style?: CSSProperties;
}

export function SkeletonDot({
  size = 12,
  style,
}: SkeletonDotProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      style={{
        ...BASE,
        width: size,
        height: size,
        borderRadius: "50%",
        ...style,
      }}
    />
  );
}

/**
 * 骨架上的空状态提示（小字）：用于布局形态骨架旁/下方说明"这里还没有内容"。
 */
export interface EmptyHintProps {
  title?: string;
  description?: string;
  align?: "center" | "start" | "end";
  style?: CSSProperties;
}

export function EmptyHint({
  title = "这里还没有内容",
  description = "在编辑器中添加卡片或箱子，开始填充这个箱子",
  align = "center",
  style,
}: EmptyHintProps): React.ReactElement {
  return (
    <div
      data-layout-empty-hint
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: align === "start" ? "flex-start" : align === "end" ? "flex-end" : "center",
        textAlign: align === "center" ? "center" : align === "start" ? "left" : "right",
        padding: "12px 16px",
        ...style,
      }}
    >
      <strong
        data-layout-empty-title
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#1d1d1f",
          lineHeight: 1.4,
        }}
      >
        {title}
      </strong>
      <span
        data-layout-empty-text
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "#6e6e73",
        }}
      >
        {description}
      </span>
    </div>
  );
}

export interface LayoutSkeletonProps {
  children: ReactNode;
  hint?: ReactNode;
  minHeight?: number;
}

/**
 * 布局骨架容器：包裹布局形态骨架，底部（或传入位置）附空状态提示。
 * 各布局插件空状态统一使用：<LayoutSkeleton hint={<EmptyHint />}>…自身形态骨架…</LayoutSkeleton>
 */
export function LayoutSkeleton({
  children,
  hint,
  minHeight = 280,
}: LayoutSkeletonProps): React.ReactElement {
  return (
    <div
      data-layout-skeleton
      aria-label="空箱子预览"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "center",
        gap: 16,
        minHeight,
        padding: "36px 24px",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>{children}</div>
      {hint}
    </div>
  );
}
