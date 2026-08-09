import React from "react";
import { Switch } from "antd";

interface SettingsToggleRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  switchLabel?: string;
}

export function SettingsToggleRow({
  label,
  description,
  icon,
  checked,
  disabled,
  onChange,
  switchLabel,
}: SettingsToggleRowProps): React.ReactElement {
  return (
    <div className="settings-row">
      {icon ? <span className="settings-row__icon" aria-hidden="true">{icon}</span> : null}
      <span className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description ? <span className="settings-row__description">{description}</span> : null}
      </span>
      <span className="settings-row__control">
        <Switch
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-label={switchLabel ?? (typeof label === "string" ? label : undefined)}
        />
      </span>
    </div>
  );
}
