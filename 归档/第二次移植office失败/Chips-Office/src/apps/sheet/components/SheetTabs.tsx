import React, { memo, useCallback, useState } from "react";
import { Input, Button, Dropdown, Tooltip, type MenuProps } from "antd";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";
import { formatMessage } from "../lib/messages";

export interface SheetTabsProps {
  sheets: string[];
  activeIndex: number;
  onTabChange: (index: number) => void;
  onTabAdd: () => void;
  onTabRename: (index: number, newName: string) => void;
  onTabDelete: (index: number) => void;
  disabled?: boolean;
}

export const SheetTabs = memo<SheetTabsProps>(function SheetTabs({
  sheets,
  activeIndex,
  onTabChange,
  onTabAdd,
  onTabRename,
  onTabDelete,
  disabled,
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);

  const handleTabClick = useCallback(
    (index: number) => {
      if (editingIndex !== null) return;
      onTabChange(index);
    },
    [onTabChange, editingIndex],
  );

  const handleDoubleClick = useCallback((index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName);
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingName(e.target.value);
  }, []);

  const handleNameCommit = useCallback(() => {
    if (editingIndex !== null && editingName.trim()) {
      onTabRename(editingIndex, editingName.trim());
    }
    setEditingIndex(null);
    setEditingName("");
  }, [editingIndex, editingName, onTabRename]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleNameCommit();
      } else if (e.key === "Escape") {
        setEditingIndex(null);
        setEditingName("");
      }
    },
    [handleNameCommit],
  );

  const handleContextMenu = useCallback((index: number) => {
    setContextMenuIndex(index);
  }, []);

  const handleDeleteTab = useCallback(() => {
    if (contextMenuIndex !== null && sheets.length > 1) {
      onTabDelete(contextMenuIndex);
      if (activeIndex >= sheets.length - 1) {
        onTabChange(Math.max(0, activeIndex - 1));
      }
    }
    setContextMenuIndex(null);
  }, [contextMenuIndex, sheets.length, onTabDelete, activeIndex, onTabChange]);

  const contextMenuItems: MenuProps["items"] = [
    {
      key: "rename",
      label: "重命名",
      onClick: () => {
        if (contextMenuIndex !== null) {
          handleDoubleClick(contextMenuIndex, sheets[contextMenuIndex]);
        }
        setContextMenuIndex(null);
      },
    },
    { type: "divider" },
    {
      key: "delete",
      label: "删除工作表",
      danger: true,
      disabled: sheets.length <= 1,
      onClick: handleDeleteTab,
    },
  ];

  return (
    <div className="sheet-tabs" role="tablist" aria-label="工作表标签">
      <div className="sheet-tabs__container">
        {sheets.map((sheetName, index) => (
          <Dropdown
            key={index}
            menu={{ items: contextMenuItems }}
            trigger={["contextMenu"]}
            onOpenChange={(open) => {
              if (open) setContextMenuIndex(index);
              else if (contextMenuIndex === index) setContextMenuIndex(null);
            }}
          >
            <div
              className={`sheet-tab${index === activeIndex ? " sheet-tab--active" : ""}`}
              role="tab"
              aria-selected={index === activeIndex}
              tabIndex={0}
              onClick={() => handleTabClick(index)}
              onDoubleClick={() => handleDoubleClick(index, sheetName)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleTabClick(index);
                }
              }}
            >
              {editingIndex === index ? (
                <Input
                  className="sheet-tab__rename-input"
                  value={editingName}
                  onChange={handleNameChange}
                  onBlur={handleNameCommit}
                  onKeyDown={handleNameKeyDown}
                  autoFocus
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="sheet-tab__name">{sheetName}</span>
              )}
            </div>
          </Dropdown>
        ))}
        <Tooltip title={formatMessage("sheet.stage.actions.addSheet")}>
          <Button
            className="sheet-tabs__add"
            icon={<PlusOutlined />}
            onClick={onTabAdd}
            disabled={disabled || sheets.length >= 255}
            size="small"
            type="text"
          />
        </Tooltip>
      </div>
    </div>
  );
});

export default SheetTabs;
