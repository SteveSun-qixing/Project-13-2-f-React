import type { CSSProperties, ReactNode } from "react";

export interface BoxEmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

const CARD_BASE: CSSProperties = {
  position: "absolute",
  width: 96,
  height: 128,
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

/**
 * 薯片生态统一空状态（苹果风格）：错落叠影卡片插画 + 标题 + 说明 + 可选操作。
 * 用于各布局插件箱子空内容占位（data-layout-empty 语义锚点保留在根节点）。
 */
export function BoxEmptyState({
  title = "这里还没有内容",
  description = "在编辑器中添加卡片或箱子，开始填充这个箱子",
  action,
  compact = false,
}: BoxEmptyStateProps): React.ReactElement {
  const scale = compact ? 0.78 : 1;

  return (
    <div
      data-layout-empty
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 10 : 16,
        minHeight: compact ? 160 : 280,
        padding: compact ? "20px 16px" : "40px 24px",
        textAlign: "center",
        boxSizing: "border-box",
        color: "#6e6e73",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: 110 * scale,
          height: 132 * scale,
          marginBottom: compact ? 2 : 6,
          flexShrink: 0,
        }}
      >
        <span
          data-box-empty-card="back"
          style={{
            ...CARD_BASE,
            transform: `translate(-42px, 4px) rotate(-10deg) scale(${scale})`,
            background: "#f2f2f7",
            boxShadow: "none",
          }}
        />
        <span
          data-box-empty-card="back"
          style={{
            ...CARD_BASE,
            transform: `translate(42px, 4px) rotate(10deg) scale(${scale})`,
            background: "#f2f2f7",
            boxShadow: "none",
          }}
        />
        <span
          data-box-empty-card="front"
          style={{
            ...CARD_BASE,
            left: 7 * scale,
            top: 2 * scale,
            transform: `scale(${scale})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg, #ffffff 0%, #fbfbfd 100%)",
          }}
        >
          <span
            style={{
              width: 30 * scale,
              height: 30 * scale,
              borderRadius: "50%",
              border: `1.5px dashed rgba(0,0,0,0.18)`,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15 * scale,
                lineHeight: 1,
                color: "rgba(0,0,0,0.28)",
                fontWeight: 400,
              }}
            >
              +
            </span>
          </span>
        </span>
      </div>

      <strong
        data-layout-empty-title
        style={{
          fontSize: compact ? 14 : 16,
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
          fontSize: compact ? 12 : 13,
          lineHeight: 1.6,
          maxWidth: 320,
          color: "#6e6e73",
        }}
      >
        {description}
      </span>

      {action ? (
        <div style={{ marginTop: compact ? 4 : 8 }}>{action}</div>
      ) : null}
    </div>
  );
}
