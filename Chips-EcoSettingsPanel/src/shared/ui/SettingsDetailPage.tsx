import React from "react";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

export interface DetailField {
  label: string;
  value: React.ReactNode;
}

export interface DetailFieldGroup {
  title: string;
  description?: string;
  fields: DetailField[];
}

interface SettingsDetailPageProps {
  title: string;
  description?: string;
  titleBadge?: React.ReactNode;
  backLabel: string;
  onBack: () => void;
  hero?: React.ReactNode;
  status?: React.ReactNode;
  primaryActions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  fields?: DetailField[];
  fieldGroups?: DetailFieldGroup[];
  children?: React.ReactNode;
}

export function SettingsDetailPage({
  title,
  description,
  titleBadge,
  backLabel,
  onBack,
  hero,
  status,
  primaryActions,
  secondaryActions,
  fields = [],
  fieldGroups,
  children,
}: SettingsDetailPageProps): React.ReactElement {
  const resolvedFieldGroups = fieldGroups ?? (fields.length > 0 ? [{ title: "", fields }] : []);

  return (
    <section className="settings-detail-page" aria-label={title}>
      <div className="settings-detail-page__toolbar">
        <Button
          type="text"
          className="settings-detail-page__back"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
        >
          {backLabel}
        </Button>
      </div>
      <header className="settings-detail-page__header">
        <div className="settings-detail-page__heading">
          <h1 className="settings-detail-page__title">
            {hero ? <span className="settings-detail-page__hero" aria-hidden="true">{hero}</span> : null}
            <span>{title}</span>
            {titleBadge ? <span className="settings-detail-page__title-badge">{titleBadge}</span> : null}
          </h1>
          {description ? <p className="settings-detail-page__description">{description}</p> : null}
        </div>
        {status || primaryActions ? (
          <div className="settings-detail-page__summary">
            {status ? <div className="settings-detail-page__status">{status}</div> : null}
            {primaryActions ? <div className="settings-detail-page__actions">{primaryActions}</div> : null}
          </div>
        ) : null}
      </header>
      {resolvedFieldGroups.length > 0 ? (
        <div className="settings-detail-groups">
          {resolvedFieldGroups.map((group) => (
            <section className="settings-detail-group" key={group.title || "default"}>
              {group.title || group.description ? (
                <header className="settings-detail-group__header">
                  {group.title ? <h3 className="settings-detail-group__title">{group.title}</h3> : null}
                  {group.description ? <p className="settings-detail-group__description">{group.description}</p> : null}
                </header>
              ) : null}
              <dl className="settings-detail-field-list">
                {group.fields.map((field) => (
                  <div key={field.label} className="settings-detail-field-list__item">
                    <dt className="settings-detail-field-list__label">{field.label}</dt>
                    <dd className="settings-detail-field-list__value">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : null}
      {children ? (
        <div className="settings-detail-page__body">
          {children}
        </div>
      ) : null}
      {secondaryActions ? (
        <section className="settings-detail-page__secondary-actions">
          {secondaryActions}
        </section>
      ) : null}
    </section>
  );
}
