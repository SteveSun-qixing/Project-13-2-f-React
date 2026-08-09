import React from "react";
import { Card, Flex, Typography } from "antd";

interface PageStackProps {
  children: React.ReactNode;
}

interface PageSectionProps {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  titleId?: string;
  children: React.ReactNode;
}

type CardGridEmphasis = "hero" | "wide" | "standard";

interface SummaryPanelProps {
  ariaLabel: string;
  main: React.ReactNode;
  meta?: React.ReactNode;
}

interface CardGridProps {
  minItemSize?: string;
  children: React.ReactNode;
}

interface ShowcaseCardGridProps {
  children: React.ReactNode;
}

interface CardGridItemProps {
  emphasis?: CardGridEmphasis;
  children: React.ReactNode;
}

interface CardDescriptionProps {
  children: React.ReactNode;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
}

export function PageStack({ children }: PageStackProps): React.ReactElement {
  return (
    <Flex vertical gap={18} className="settings-page-stack">
      {children}
    </Flex>
  );
}

export function PageSection({
  title,
  description,
  meta,
  titleId,
  children,
}: PageSectionProps): React.ReactElement {
  return (
    <section className="settings-page-section" aria-labelledby={titleId}>
      <header className="settings-page-section__header">
        <Typography.Title level={5} id={titleId} className="settings-page-section__title">
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary" className="settings-page-section__description">
            {description}
          </Typography.Text>
        ) : null}
      </header>
      <div className="settings-page-section__content">{children}</div>
      {meta ? <div className="settings-page-section__meta">{meta}</div> : null}
    </section>
  );
}

export function SummaryPanel({ ariaLabel, main, meta }: SummaryPanelProps): React.ReactElement {
  return (
    <section className="settings-summary-panel" aria-label={ariaLabel}>
      <div className="settings-summary-panel__grid">
        <div className="settings-summary-panel__main">{main}</div>
        {meta ? <div className="settings-summary-panel__meta">{meta}</div> : null}
      </div>
    </section>
  );
}

export function CardGrid({ minItemSize = "260px", children }: CardGridProps): React.ReactElement {
  return (
    <div
      className="settings-card-grid"
      style={{ "--settings-card-grid-min": minItemSize } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export function ShowcaseCardGrid({ children }: ShowcaseCardGridProps): React.ReactElement {
  return (
    <div className="settings-card-grid settings-card-grid--showcase">
      {children}
    </div>
  );
}

export function CardGridItem({ emphasis = "standard", children }: CardGridItemProps): React.ReactElement {
  return (
    <article className="settings-card-grid__item" data-grid-emphasis={emphasis}>
      {children}
    </article>
  );
}

export function CardDescription({ children }: CardDescriptionProps): React.ReactElement {
  return (
    <Typography.Paragraph type="secondary" className="settings-card-description">
      {children}
    </Typography.Paragraph>
  );
}

export function MetricCard({ label, value, detail }: MetricCardProps): React.ReactElement {
  return (
    <Card className="settings-metric-card" aria-label={label}>
      <div className="settings-metric-card__label">{label}</div>
      <strong className="settings-metric-card__value">{value}</strong>
      <div className="settings-metric-card__detail">{detail}</div>
    </Card>
  );
}
