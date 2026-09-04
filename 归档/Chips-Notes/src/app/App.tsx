/**
 * 应用外壳：命令系统 + 笔记主场景
 */

import React from 'react';
import { AppChrome } from '@chips/ui';
import { NotesScene } from './NotesScene';

export function App(): React.ReactElement {
  return (
    <AppChrome paletteShortcut="Mod+Shift+P">
      <NotesScene />
    </AppChrome>
  );
}
