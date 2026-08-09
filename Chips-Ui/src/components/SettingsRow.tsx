import type { ReactNode } from "react";

export interface SettingsRowProps {
  label: string;
  control?: ReactNode;
  description?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function SettingsRow({
  label,
  control,
  description,
  onClick,
  disabled,
}: SettingsRowProps): React.ReactElement {
  const content = (
    <>
      <span className="ios-grouped-list__label">
        {label}
        {description ? <div className="ios-caption" style={{ marginTop: 2 }}>{description}</div> : null}
      </span>
      {control ? <span className="ios-grouped-list__value">{control}</span> : null}
    </>
  );

  return (
    <div
      className="ios-grouped-list__row"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        onClick && !disabled
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  );
}
