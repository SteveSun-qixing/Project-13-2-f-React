import React from "react";

interface PageFrameProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageFrame({ title, description, actions, children }: PageFrameProps): React.ReactElement {
  return (
    <section className="settings-page-frame" aria-label={title}>
      <header className="settings-page-frame__header">
        <div className="settings-page-frame__titles">
          <h1 className="settings-page-frame__title">{title}</h1>
          {description ? <p className="settings-page-frame__description">{description}</p> : null}
        </div>
        {actions ? <div className="settings-page-frame__actions">{actions}</div> : null}
      </header>
      <div className="settings-page-frame__body">{children}</div>
    </section>
  );
}
