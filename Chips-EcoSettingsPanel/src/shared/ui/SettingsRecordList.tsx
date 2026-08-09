import React from "react";
import { Button } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";

interface SettingsRecordListProps {
  ariaLabel: string;
  children: React.ReactNode;
}

interface SettingsRecordItemProps {
  id: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  summary?: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  detailLabel: string;
  onOpenDetail: () => void;
}

interface SettingsRecordRowData {
  id: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  summary?: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  detailLabel: string;
  onOpenDetail: () => void;
}

function isSettingsRecordItem(element: React.ReactNode): element is React.ReactElement<SettingsRecordItemProps> {
  return React.isValidElement(element) && element.type === SettingsRecordItem;
}

export function SettingsRecordList({ ariaLabel, children }: SettingsRecordListProps): React.ReactElement {
  const rows = React.useMemo<SettingsRecordRowData[]>(() => {
    return React.Children.toArray(children).flatMap((child) => {
      if (!isSettingsRecordItem(child)) {
        return [];
      }
      return [
        {
          id: child.key !== null && child.key !== undefined ? String(child.key) : child.props.id,
          icon: child.props.icon,
          title: child.props.title,
          summary: child.props.summary,
          meta: child.props.meta,
          status: child.props.status,
          actions: child.props.actions,
          detailLabel: child.props.detailLabel,
          onOpenDetail: child.props.onOpenDetail,
        },
      ];
    });
  }, [children]);

  return (
    <ul className="settings-record-list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <li key={row.id} className="settings-record">
          <button
            type="button"
            className="settings-record__main"
            aria-label={row.detailLabel}
            onClick={row.onOpenDetail}
          >
            {row.icon ? <span className="settings-record__icon" aria-hidden="true">{row.icon}</span> : null}
            <span className="settings-record__text">
              <span className="settings-record__title">{row.title}</span>
              {row.summary ? <span className="settings-record__summary">{row.summary}</span> : null}
            </span>
            {row.meta ? <span className="settings-record__meta">{row.meta}</span> : null}
            {row.status ? <span className="settings-record__status">{row.status}</span> : null}
            {row.actions ? <span className="settings-record__actions">{row.actions}</span> : null}
            <ArrowRightOutlined className="settings-record__chevron" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SettingsRecordItem(props: SettingsRecordItemProps): React.ReactElement {
  void props;
  return <></>;
}

export { Button as SettingsRecordActionButton };
