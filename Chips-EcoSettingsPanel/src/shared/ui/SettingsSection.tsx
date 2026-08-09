import React from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps): React.ReactElement {
  return (
    <section className="settings-section" aria-label={title}>
      <div className="settings-section__header">
        <h3 className="settings-section__title">{title}</h3>
        {description ? <p className="settings-section__description">{description}</p> : null}
      </div>
      <div className="settings-section__card">{children}</div>
    </section>
  );
}
