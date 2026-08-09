import React from "react";
import { Button } from "antd";
import type { ReactNode } from "react";

export interface ControlButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "dock" | "nav" | "close";
}

export function ControlButton(props: ControlButtonProps): React.ReactElement {
  const { label, icon, onClick, disabled = false, active = false, variant = "default" } = props;

  const variantClass =
    variant === "dock"
      ? "book-reader-controlButton--dock"
      : variant === "nav"
        ? "book-reader-controlButton--nav"
        : variant === "close"
          ? "book-reader-controlButton--close"
          : "";

  return (
    <Button
      type="text"
      className={[
        "book-reader-controlButton",
        active ? "book-reader-controlButton--active" : "",
        variantClass,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => void onClick()}
      icon={variant === "dock" ? undefined : icon}
    >
      {variant === "dock" ? (
        <span className="book-reader-controlButton__dock">
          <span className="book-reader-controlButton__dockIcon" aria-hidden="true">
            {icon}
          </span>
          <span className="book-reader-controlButton__dockLabel">{label}</span>
        </span>
      ) : null}
    </Button>
  );
}
