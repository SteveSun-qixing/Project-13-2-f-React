import React from "react";

export type SettingsStatusTone = "neutral" | "positive" | "attention" | "danger";

interface SettingsStatusDotProps {
  tone: SettingsStatusTone;
  label: string;
}

const TONE_CLASS_MAP: Record<SettingsStatusTone, string> = {
  neutral: "settings-status-dot--neutral",
  positive: "settings-status-dot--positive",
  attention: "settings-status-dot--attention",
  danger: "settings-status-dot--danger",
};

export function SettingsStatusDot({ tone, label }: SettingsStatusDotProps): React.ReactElement {
  return (
    <span className={`settings-status-dot ${TONE_CLASS_MAP[tone]}`} role="status">
      <span className="settings-status-dot__dot" aria-hidden="true" />
      <span className="settings-status-dot__label">{label}</span>
    </span>
  );
}
