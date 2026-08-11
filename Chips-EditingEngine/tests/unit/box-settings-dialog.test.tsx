// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoxDocumentSessionSnapshot } from '../../src/services/box-document-service';
import { BoxSettingsDialog } from '../../src/components/BoxWindow/BoxSettingsDialog';

vi.mock('../../src/services/box-document-service', () => ({
  boxDocumentService: {
    updateMetadata: vi.fn(),
    updateCover: vi.fn(),
    saveBox: vi.fn(),
  },
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    refresh: vi.fn(),
  },
}));

vi.mock('../../src/components/CardSettings/panels/BasicInfoPanel', () => ({
  BasicInfoPanel: () => <div data-testid="box-basic-info">basic-info</div>,
}));

vi.mock('../../src/components/CardSettings/panels/CoverPanel', () => ({
  CoverPanel: () => <div data-testid="box-cover-panel">cover-panel</div>,
}));

vi.mock('../../src/components/BoxWindow/BoxExportPanel', () => ({
  BoxExportPanel: () => <div data-testid="box-export-panel">export-panel</div>,
}));

const SESSION = {
  boxId: 'box-1',
  boxFile: '/workspace/demo.box',
  workspaceDir: '/workspace/.chips-editing-engine/box-sessions/box-1',
  metadata: {
    boxId: 'box-1',
    name: 'Demo Box',
    tags: [],
    coverRatio: '3:4',
  },
  coverHtml: '<html><body>cover</body></html>',
} as unknown as BoxDocumentSessionSnapshot;

describe('BoxSettingsDialog', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserverMock {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    } as typeof ResizeObserver;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function clickTab(label: string) {
    const tab = Array.from(document.body.querySelectorAll('[role="tab"]'))
      .find((node) => (node.textContent ?? '').includes(label));
    (tab as HTMLElement | undefined)?.click();
    await Promise.resolve();
  }

  it('uses the same fixed responsive modal shell as card settings', async () => {
    await act(async () => {
      root.render(
        <BoxSettingsDialog
          boxId="box-1"
          visible
          session={SESSION}
          onClose={() => undefined}
          onSave={() => undefined}
        />,
      );
    });

    const modal = document.body.querySelector('.ant-modal') as HTMLElement | null;

    expect(modal?.style.width).toBe('960px');
    expect(modal?.querySelector('.document-settings-dialog__container')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__body')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-body')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-content')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__form')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="box-basic-info"]')).not.toBeNull();

    await act(async () => {
      await clickTab('封面');
    });

    expect(document.body.querySelector('.document-settings-dialog__container')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-content')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="box-cover-panel"]')).not.toBeNull();

    await act(async () => {
      await clickTab('导出');
    });

    expect(document.body.querySelector('[data-testid="box-export-panel"]')).not.toBeNull();
  });
});
