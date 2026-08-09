import { Dropdown, type MenuProps } from "antd";
import { type ReactNode } from "react";
import type { CommandItem } from "../runtime/commands";

export type ChromeTone = "light" | "dark-glass";

export interface MenuBarProps {
  appName?: string;
  groups: MenuBarGroup[];
  tone?: ChromeTone;
}

export interface MenuBarGroup {
  menuId: string;
  label: string;
  commands: CommandItem[];
}

function shortcutText(shortcut: string | undefined): string {
  if (!shortcut) {
    return "";
  }
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Mod") {
        return "⌘";
      }
      if (part === "Shift") {
        return "⇧";
      }
      if (part === "Alt") {
        return "⌥";
      }
      return part;
    })
    .join(" ");
}

const menuItemStyle: React.CSSProperties = {
  padding: "3px 10px",
  cursor: "default",
  fontSize: 13,
  lineHeight: "20px",
  borderRadius: 6,
};

const LIGHT_TEXT = "#1d1d1f";
const DARK_TEXT = "rgba(255,255,255,0.9)";
const DARK_GLASS_BACKGROUND = "rgba(28,28,30,0.55)";
const DARK_GLASS_SOLID_BACKGROUND = "rgba(28,28,30,0.9)";
const DARK_BORDER = "rgba(255,255,255,0.1)";
const DARK_HOVER_BACKGROUND = "rgba(255,255,255,0.12)";
const LIGHT_DISABLED_TEXT = "#c7c7cc";
const DARK_DISABLED_TEXT = "rgba(255,255,255,0.28)";

export function MenuBar({ appName, groups, tone = "light" }: MenuBarProps): React.ReactElement {
  const dark = tone === "dark-glass";
  return (
    <div
      className="chips-menu-bar apple-titlebar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: 36,
        padding: "0 10px",
        flexShrink: 0,
        borderBottom: `1px solid ${dark ? DARK_BORDER : "rgba(0,0,0,0.06)"}`,
        background: dark ? DARK_GLASS_BACKGROUND : "rgba(245,245,247,0.78)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        backdropFilter: "saturate(180%) blur(20px)",
      }}
    >
      {appName ? (
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            marginRight: 14,
            paddingLeft: 2,
            color: dark ? DARK_TEXT : LIGHT_TEXT,
            letterSpacing: "0.2px",
          }}
        >
          {appName}
        </span>
      ) : null}
      {groups
        .filter((group) => group.commands.some((command) => command.visible !== false))
        .map((group) => {
          const items: MenuProps["items"] = group.commands
            .filter((command) => command.visible !== false)
            .map((command) => ({
              key: command.id,
              label: command.title,
              disabled: command.enabled === false,
              icon: command.icon,
              shortcut: shortcutText(command.shortcut),
              onClick: () => command.run(),
            }));
          return (
            <Dropdown key={group.menuId} trigger={["click"]} menu={{ items }}>
              <span style={{ ...menuItemStyle, color: dark ? DARK_TEXT : LIGHT_TEXT }}>{group.label}</span>
            </Dropdown>
          );
        })}
    </div>
  );
}

export interface ToolbarProps {
  items: CommandItem[];
  children?: ReactNode;
  tone?: ChromeTone;
}

export function Toolbar({ items, children, tone = "light" }: ToolbarProps): React.ReactElement {
  const dark = tone === "dark-glass";
  return (
    <div
      className="chips-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "6px 12px",
        flexShrink: 0,
        borderBottom: `1px solid ${dark ? DARK_BORDER : "rgba(0,0,0,0.06)"}`,
        background: dark ? DARK_GLASS_SOLID_BACKGROUND : "rgba(245,245,247,0.9)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        backdropFilter: "saturate(180%) blur(20px)",
      }}
    >
      {items
        .filter((command) => command.visible !== false)
        .map((command) => (
          <button
            key={command.id}
            type="button"
            title={command.shortcut ? `${command.title} (${shortcutText(command.shortcut)})` : command.title}
            aria-label={command.title}
            disabled={command.enabled === false}
            onClick={() => command.run()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "none",
              borderRadius: 8,
              background: "transparent",
              color:
                command.enabled === false
                  ? dark
                    ? DARK_DISABLED_TEXT
                    : LIGHT_DISABLED_TEXT
                  : dark
                    ? DARK_TEXT
                    : LIGHT_TEXT,
              cursor: command.enabled === false ? "not-allowed" : "pointer",
              fontSize: 16,
            }}
            onMouseEnter={(event) => {
              if (command.enabled !== false) {
                event.currentTarget.style.background = dark ? DARK_HOVER_BACKGROUND : "rgba(0,0,0,0.06)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            {command.icon}
          </button>
        ))}
      {children}
    </div>
  );
}
