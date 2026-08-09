import React, { useMemo, useState } from 'react';
import { CommandPalette, MenuBar, Toolbar, useCommandShortcuts, type CommandItem, type MenuBarGroup } from '@chips/ui';
import { useEditor } from '../../context/EditorContext';
import { AppBrandIcon } from '../../icons/AppBrandIcon';
import './HeaderBar.css';

interface HeaderBarProps {
    commands: CommandItem[];
}

const MENU_DESCRIPTORS = [
    { menuId: 'file', label: '文件' },
    { menuId: 'edit', label: '编辑' },
    { menuId: 'view', label: '视图' },
    { menuId: 'app', label: '应用' },
] as const;

export function HeaderBar({ commands }: HeaderBarProps) {
    const { state } = useEditor();
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);

    const isReady = state === 'ready';

    const menus = useMemo<MenuBarGroup[]>(() =>
        MENU_DESCRIPTORS.map(({ menuId, label }) => ({
            menuId,
            label,
            commands: commands.filter((command) => command.menuId === menuId),
        })),
    [commands]);

    const toolbarItems = useMemo(
        () => commands.filter((command) => command.toolbarId === 'workspace'),
        [commands],
    );

    const paletteCommand = useMemo(
        () => ({
            id: 'editing-engine.command-palette',
            title: '命令面板',
            shortcut: 'Mod+P',
            run: () => setIsPaletteOpen(true),
        }),
        [],
    );

    useCommandShortcuts([paletteCommand]);

    return (
        <div className="header-bar">
            <div className="header-bar__left">
                <div className="header-bar__logo">
                    <AppBrandIcon className="header-bar__logo-image" aria-hidden="true" />
                </div>
                <div className="header-bar__title">Chips Editing Engine</div>
                <div className={`header-bar__status ${isReady ? 'header-bar__status--ready' : ''}`}>
                    {isReady ? '就绪' : '加载中…'}
                </div>
            </div>

            <div className="header-bar__center">
                <MenuBar groups={menus} />
                <Toolbar items={toolbarItems} />
            </div>

            <div className="header-bar__right">
                <CommandPalette
                    open={isPaletteOpen}
                    onClose={() => setIsPaletteOpen(false)}
                    placeholder="搜索命令"
                />
            </div>
        </div>
    );
}
