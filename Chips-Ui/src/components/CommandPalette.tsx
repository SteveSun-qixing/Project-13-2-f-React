import { App, Empty, Input, List, Modal } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useCommandRegistry, type CommandItem } from "../runtime/commands";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  placeholder?: string;
  emptyText?: string;
}

function ShortcutHint({ shortcut }: { shortcut: string }): React.ReactElement {
  const labels = shortcut
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

  return <span className="command-palette-shortcut">{labels}</span>;
}

export function CommandPalette({
  open,
  onClose,
  placeholder = "输入命令名称…",
  emptyText = "没有匹配的命令",
}: CommandPaletteProps): React.ReactElement {
  const { commands, invoke } = useCommandRegistry();
  const [query, setQuery] = useState("");
  const { message } = App.useApp();

  const visibleCommands = useMemo<CommandItem[]>(() => {
    const normalized = query.trim().toLowerCase();
    const candidates = commands.filter((command) => command.visible !== false);
    if (!normalized) {
      return candidates;
    }
    return candidates.filter((command) => {
      if (command.title.toLowerCase().includes(normalized)) {
        return true;
      }
      return (command.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalized));
    });
  }, [commands, query]);

  const runCommand = (command: CommandItem): void => {
    onClose();
    setQuery("");
    try {
      command.run();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error("命令执行失败");
      }
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      closable={false}
      destroyOnHidden
      styles={{ body: { padding: 12 } }}
    >
      <Input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        allowClear
        onKeyDown={(event) => {
          if (event.key === "Enter" && visibleCommands.length > 0) {
            event.preventDefault();
            const command = visibleCommands[0];
            if (command) {
              runCommand(command);
            }
          }
          if (event.key === "Escape") {
            onClose();
          }
        }}
      />
      <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 8 }}>
        {visibleCommands.length === 0 ? (
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={visibleCommands}
            renderItem={(command) => (
              <List.Item
                className="command-palette-item"
                style={{ cursor: "pointer", padding: "8px 12px", borderRadius: 8 }}
                onClick={() => runCommand(command)}
                actions={command.shortcut ? [<ShortcutHint key="hint" shortcut={command.shortcut} />] : []}
              >
                <List.Item.Meta
                  avatar={command.icon}
                  title={command.title}
                  description={command.group}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
}
