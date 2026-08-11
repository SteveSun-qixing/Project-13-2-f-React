// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardSettingsDialog } from '../../src/components/CardSettings/CardSettingsDialog';

const updateCardMetadata = vi.fn();
const updateCardCover = vi.fn();
const saveCard = vi.fn(async () => undefined);

vi.mock('../../src/context/CardContext', () => ({
  useCard: () => ({
    getCard: () => ({
      id: 'card-1',
      path: '/workspace/demo.card',
      metadata: {
        name: 'Demo Card',
        themeId: 'chips-official.default-theme',
        coverRatio: '3:4',
        tags: ['demo'],
        createdAt: '2026-03-13T10:00:00.000Z',
        modifiedAt: '2026-03-13T11:00:00.000Z',
      },
      cover: {
        html: '<html><body>demo</body></html>',
        ratio: '3:4',
        resources: [],
      },
      structure: {
        basicCards: [],
      },
    }),
    updateCardMetadata,
    updateCardCover,
    saveCard,
  }),
}));

vi.mock('../../src/components/CardSettings/panels/BasicInfoPanel', () => ({
  BasicInfoPanel: ({
    cardInfo,
    onUpdateName,
    onUpdateTags,
  }: {
    cardInfo: { metadata: { createdAt?: string } };
    onUpdateName?: (name: string) => void;
    onUpdateTags?: (tags: string[]) => void;
  }) => (
    <div>
      <button type="button" data-testid="rename-card" onClick={() => onUpdateName?.('Renamed Card')}>
        rename
      </button>
      <button type="button" data-testid="retag-card" onClick={() => onUpdateTags?.(['alpha', 'beta'])}>
        retag
      </button>
      <span data-testid="created-at">{cardInfo.metadata.createdAt}</span>
    </div>
  ),
}));

vi.mock('../../src/components/CardSettings/panels/CoverPanel', () => ({
  CoverPanel: ({
    onDraftChange,
  }: {
    onDraftChange?: (draft: {
      html: string;
      ratio: string;
      resources: Array<{ path: string; data: Uint8Array }>;
      dirty: boolean;
      valid: boolean;
    }) => void;
  }) => (
    <button
      type="button"
      data-testid="set-cover-draft"
      onClick={() => onDraftChange?.({
        html: '<html><body>next-cover</body></html>',
        ratio: '16:9',
        resources: [
          {
            path: 'cardcover/cover-image.png',
            data: new Uint8Array([1, 2, 3]),
          },
        ],
        dirty: true,
        valid: true,
      })}
    >
      cover-panel
    </button>
  ),
}));

vi.mock('../../src/components/CardSettings/panels/ExportPanel', () => ({
  ExportPanel: () => <div>export-panel</div>,
}));

describe('CardSettingsDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(_callback: ResizeObserverCallback) {}

      observe(): void {}

      disconnect(): void {}

      unobserve(): void {}
    } as typeof ResizeObserver;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    updateCardMetadata.mockClear();
    updateCardCover.mockClear();
    saveCard.mockClear();
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

  it('routes metadata edits through the formal card-service update API', async () => {
    await act(async () => {
      root.render(
        <CardSettingsDialog
          cardId="card-1"
          visible
          onClose={() => undefined}
          onSave={() => undefined}
        />,
      );
    });

    expect(document.body.querySelector('[data-testid="created-at"]')?.textContent).toBe('2026-03-13T10:00:00.000Z');

    await act(async () => {
      (document.body.querySelector('[data-testid="rename-card"]') as HTMLButtonElement).click();
      (document.body.querySelector('[data-testid="retag-card"]') as HTMLButtonElement).click();
    });

    expect(updateCardMetadata).toHaveBeenCalledWith('card-1', { name: 'Renamed Card' });
    expect(updateCardMetadata).toHaveBeenCalledWith('card-1', { tags: ['alpha', 'beta'] });
  });

  it('saves through the formal saveCard API when the user confirms', async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        <CardSettingsDialog
          cardId="card-1"
          visible
          onClose={() => undefined}
          onSave={onSave}
        />,
      );
    });

    await act(async () => {
      const buttons = Array.from(document.body.querySelectorAll('button'));
      const saveButton = buttons.find((button) => (button.textContent ?? '').replace(/\s/g, '') === '保存');
      saveButton?.click();
      await Promise.resolve();
    });

    expect(saveCard).toHaveBeenCalledWith('card-1');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('applies the embedded cover editor draft through the formal card cover API before saving', async () => {
    await act(async () => {
      root.render(
        <CardSettingsDialog
          cardId="card-1"
          visible
          onClose={() => undefined}
          onSave={() => undefined}
        />,
      );
    });

    await act(async () => {
      await clickTab('封面');
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="set-cover-draft"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    await act(async () => {
      const buttons = Array.from(document.body.querySelectorAll('button'));
      const saveButton = buttons.find((button) => (button.textContent ?? '').replace(/\s/g, '') === '保存');
      saveButton?.click();
      await Promise.resolve();
    });

    expect(updateCardCover).toHaveBeenCalledWith('card-1', {
      html: '<html><body>next-cover</body></html>',
      ratio: '16:9',
      resources: [
        {
          path: 'cardcover/cover-image.png',
          data: new Uint8Array([1, 2, 3]),
        },
      ],
    });
    expect(saveCard).toHaveBeenCalledWith('card-1');
  });

  it('can transition from hidden to visible without breaking hook order and renders into document.body', async () => {
    await act(async () => {
      root.render(
        <CardSettingsDialog
          cardId="card-1"
          visible={false}
          onClose={() => undefined}
          onSave={() => undefined}
        />,
      );
    });

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      root.render(
        <CardSettingsDialog
          cardId="card-1"
          visible
          onClose={() => undefined}
          onSave={() => undefined}
        />,
      );
    });

    const modal = document.body.querySelector('.ant-modal') as HTMLElement | null;

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(modal).not.toBeNull();
    expect(modal?.style.width).toBe('960px');
    expect(modal?.querySelector('.document-settings-dialog__container')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__body')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-header')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-body')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-content')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs')).not.toBeNull();

    await act(async () => {
      await clickTab('封面');
    });

    expect((document.body.querySelector('.ant-modal') as HTMLElement | null)?.style.width).toBe('960px');
    expect(document.body.querySelector('.document-settings-dialog__container')).not.toBeNull();
    expect(document.body.querySelector('.document-settings-dialog__tabs-content')).not.toBeNull();
  });

  it('binds the fixed responsive height and overflow chain to Ant Design semantic elements', () => {
    const css = readFileSync(
      path.resolve(process.cwd(), 'src/components/CardSettings/CardSettingsDialog.css'),
      'utf8',
    );

    expect(css).toMatch(
      /\.card-settings-dialog-root \.document-settings-dialog__container\s*{[^}]*height:\s*min\(720px,\s*calc\(100dvh - 48px\)\)\s*!important;/s,
    );
    expect(css).toMatch(
      /\.card-settings-dialog-root \.document-settings-dialog__body\s*{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /\.document-settings-dialog__tabs > \.document-settings-dialog__tabs-body\s*{[^}]*flex:\s*1;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /\.card-settings-dialog__panel\s*{[^}]*height:\s*100%;[^}]*overflow-y:\s*auto;/s,
    );
    expect(css).not.toContain('.ant-modal-content');
    expect(css).not.toContain('.ant-tabs-content-holder');
  });
});
