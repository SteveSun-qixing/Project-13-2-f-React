import React from "react";
import { Empty, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export interface SettingsSidebarItem {
  id: string;
  title: string;
  summary?: string;
  icon: React.ReactNode;
}

export interface SettingsSidebarGroup {
  key: string;
  label: string;
  items: SettingsSidebarItem[];
}

interface SettingsSidebarProps {
  groups: SettingsSidebarGroup[];
  selectedId: string;
  searchValue: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  emptyText: string;
  onSearchChange: (value: string) => void;
  onSelect: (itemId: string) => void;
}

function matchesItem(item: SettingsSidebarItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const searchable = `${item.title} ${item.summary ?? ""}`.toLocaleLowerCase();
  return searchable.includes(normalizedQuery);
}

export function SettingsSidebar({
  groups,
  selectedId,
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  emptyText,
  onSearchChange,
  onSelect,
}: SettingsSidebarProps): React.ReactElement {
  const normalizedQuery = searchValue.trim().toLocaleLowerCase();
  const hasAnyMatch = groups.some((group) => group.items.some((item) => matchesItem(item, normalizedQuery)));

  return (
    <div className="settings-sidebar">
      <div className="settings-sidebar__search">
        <Input
          className="settings-sidebar__search-input"
          value={searchValue}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          prefix={<SearchOutlined />}
          allowClear
          variant="filled"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <nav className="settings-sidebar__nav" aria-label={searchAriaLabel}>
        {!hasAnyMatch ? (
          <div className="settings-sidebar__empty">
            <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          groups.map((group) => {
            const visibleItems = group.items.filter((item) => matchesItem(item, normalizedQuery));
            if (visibleItems.length === 0) {
              return null;
            }
            return (
              <div key={group.key} className="settings-sidebar__group">
                <div className="settings-sidebar__group-label">{group.label}</div>
                {visibleItems.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`settings-sidebar__item${selected ? " settings-sidebar__item--selected" : ""}`}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      <span className="settings-sidebar__item-icon" aria-hidden="true">{item.icon}</span>
                      <span className="settings-sidebar__item-text">
                        <span className="settings-sidebar__item-title">{item.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}
