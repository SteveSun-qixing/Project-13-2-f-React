import React, { useRef } from 'react';
import { Layout as FlexLayout, Model, TabNode, IJsonModel } from 'flexlayout-react';
import { DirectoryTreePanel } from '../panels/DirectoryTreePanel';
import { NoteEditorPanel } from '../panels/NoteEditorPanel';
import { CardLibraryPanel } from '../panels/CardLibraryPanel';

const flexLayoutConfig: IJsonModel = {
  global: {
    tabEnableClose: false,
    tabEnableRename: false,
    tabSetEnableDrag: false,
    tabSetEnableDivide: false,
    tabSetEnableMaximize: false,
    splitterSize: 4,
    tabSetHeaderHeight: 0,
    tabSetTabStripHeight: 0,
  },
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 20,
        id: 'sidebar',
        children: [
          {
            type: 'tab',
            name: '目录树',
            component: 'directory-tree',
            enableClose: false,
          },
        ],
      },
      {
        type: 'tabset',
        weight: 50,
        id: 'editor',
        children: [
          {
            type: 'tab',
            name: '编辑区',
            component: 'note-editor',
            enableClose: false,
          },
        ],
      },
      {
        type: 'tabset',
        weight: 30,
        id: 'panel',
        children: [
          {
            type: 'tab',
            name: '卡片库',
            component: 'card-library',
            enableClose: false,
          },
        ],
      },
    ],
  },
};

export function NotesLayout(): React.ReactElement {
  const modelRef = useRef(Model.fromJson(flexLayoutConfig));

  const factory = (node: TabNode): React.ReactNode => {
    const component = node.getComponent();

    switch (component) {
      case 'directory-tree':
        return <DirectoryTreePanel />;
      case 'note-editor':
        return <NoteEditorPanel />;
      case 'card-library':
        return <CardLibraryPanel />;
      default:
        return <div>Unknown component: {component}</div>;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <FlexLayout model={modelRef.current} factory={factory} />
    </div>
  );
}
