import React from 'react';
import { AppChrome, useCommandRegistry } from '@chips/ui';
import { NotesLayout } from '../layouts/NotesLayout';

export function AppShell(): React.ReactElement {
    useCommandRegistry();

    return (
        <AppChrome paletteShortcut="Mod+P" contentStyle={{ overflow: 'hidden', padding: 0 }}>
            <NotesLayout />
        </AppChrome>
    );
}
