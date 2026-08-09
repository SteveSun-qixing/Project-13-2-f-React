import React from "react";
import { ArrowRightOutlined } from "@ant-design/icons";

interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  control?: React.ReactNode;
  onClick?: () => void;
  detailLabel?: string;
  role?: "button" | "group";
  children?: React.ReactNode;
}

export function SettingsRow({
  label,
  description,
  icon,
  control,
  onClick,
  detailLabel,
  role = onClick ? "button" : "group",
  children,
}: SettingsRowProps): React.ReactElement {
  const interactive = Boolean(onClick);
  const content = (
    <>
      {icon ? <span className="settings-row__icon" aria-hidden="true">{icon}</span> : null}
      <span className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description ? <span className="settings-row__description">{description}</span> : null}
      </span>
      {control ? <span className="settings-row__control" onClick={(event) => event.stopPropagation()}>{control}</span> : null}
      {children ? <span className="settings-row__children">{children}</span> : null}
      {interactive ? <ArrowRightOutlined className="settings-row__chevron" aria-hidden="true" /> : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className="settings-row settings-row--interactive"
        role={role}
        aria-label={detailLabel}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className="settings-row">{content}</div>;
}
