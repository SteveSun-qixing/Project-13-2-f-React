import React from "react";
import { SettingsStatusDot, type SettingsStatusTone } from "./SettingsStatusDot";

interface StatusBadgeProps {
  tone: "neutral" | "positive" | "attention" | "danger";
  label: string;
}

export function StatusBadge({ tone, label }: StatusBadgeProps): React.ReactElement {
  return <SettingsStatusDot tone={tone as SettingsStatusTone} label={label} />;
}
