import React, { useMemo, type ReactNode } from 'react';
import { Dropdown, type MenuProps } from 'antd';
import type { CommandItem } from '@chips/ui';

interface ContextMenuProps {
    commands: CommandItem[];
    onCommand: (commandId: string) => void;
    children: ReactNode;
}

function shortcutText(shortcut: string | undefined): string | undefined {
    if (!shortcut) {
        return undefined;
    }
    return shortcut
        .split('+')
        .map((part) => {
            if (part === 'Mod') {
                return '⌘';
            }
            if (part === 'Shift') {
                return '⇧';
            }
            if (part === 'Alt') {
                return '⌥';
            }
            return part;
        })
        .join(' ');
}

export function ContextMenu({ commands, onCommand, children }: ContextMenuProps) {
    const items = useMemo<MenuProps['items']>(() => {
        const visibleCommands = commands.filter((command) => command.visible !== false);
        const result: NonNullable<MenuProps['items']> = [];
        let lastGroup: string | undefined;

        for (const command of visibleCommands) {
            if (command.group !== lastGroup && result.length > 0) {
                result.push({ type: 'divider' });
            }
            lastGroup = command.group;
            const shortcut = shortcutText(command.shortcut);
            result.push({
                key: command.id,
                label: (
                    <span
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 24,
                        }}
                    >
                        <span>{command.title}</span>
                        {shortcut ? <span style={{ color: '#86868b', fontSize: 12 }}>{shortcut}</span> : null}
                    </span>
                ),
                icon: command.icon,
                disabled: command.enabled === false,
            });
        }

        return result;
    }, [commands]);

    return (
        <Dropdown
            trigger={['contextMenu']}
            menu={{
                items,
                onClick: ({ key }) => onCommand(key),
            }}
        >
            {children}
        </Dropdown>
    );
}
