import React from 'react';
import { Icon } from '../runtime/icons/Icon';
import './CardViewerPageShell.css';

interface CardViewerPageShellProps {
  title?: string;
  backLabel: string;
  onBack: () => void;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

interface CardViewerPageStageProps {
  children: React.ReactNode;
}

interface CardViewerPageStateProps {
  children: React.ReactNode;
}

export function CardViewerPageShell({
  title,
  backLabel,
  onBack,
  meta,
  actions,
  children,
}: CardViewerPageShellProps) {
  return (
    <div className="card-viewer-page">
      <div className="card-viewer-page__floating-layer">
        <button
          type="button"
          className="card-viewer-page__floating-button card-viewer-page__back-button"
          onClick={onBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <Icon name="arrow-left" size={20} />
        </button>

        {title ? (
          <aside className="card-viewer-page__info-panel" aria-label={title}>
            <h1>{title}</h1>
            {meta ? <div className="card-viewer-page__meta">{meta}</div> : null}
          </aside>
        ) : null}

        {actions ? <div className="card-viewer-page__actions">{actions}</div> : null}
      </div>

      <main className="card-viewer-page__body">{children}</main>
    </div>
  );
}

export function CardViewerPageStage({ children }: CardViewerPageStageProps) {
  return <section className="card-viewer-page__stage">{children}</section>;
}

export function CardViewerPageState({ children }: CardViewerPageStateProps) {
  return (
    <section className="card-viewer-page__state" aria-live="polite">
      {children}
    </section>
  );
}
