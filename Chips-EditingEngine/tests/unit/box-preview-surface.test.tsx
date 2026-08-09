// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxPreviewSurface } from '../../src/components/BoxWindow/BoxPreviewSurface';

const mockState = vi.hoisted(() => ({
  client: {
    document: {
      window: {
        render: vi.fn(async () => ({
          frame: document.createElement('iframe'),
          origin: 'file://',
          dispose: vi.fn(async () => undefined),
          documentType: 'box' as const,
        })),
        onReady: vi.fn((_frame: HTMLIFrameElement, handler: () => void) => {
          handler();
          return () => undefined;
        }),
        onError: vi.fn(() => () => undefined),
      },
    },
  },
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: vi.fn(() => mockState.client),
}));

describe('BoxPreviewSurface', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('uses a full-size preview host container for box documents', async () => {
    await act(async () => {
      root.render(
        <BoxPreviewSurface
          session={{
            boxId: 'box-1',
            boxFile: '/workspace/demo.box',
            workspaceDir: '/workspace/.chips-editing-engine/box-sessions/session-box-1',
            metadata: {
              boxId: 'box-1',
              name: 'Demo Box',
              activeLayoutType: 'chips.layout.grid',
              coverRatio: '3:4',
              chipStandardsVersion: '1.0.0',
              createdAt: '2026-04-09T00:00:00.000Z',
              modifiedAt: '2026-04-09T00:00:00.000Z',
            },
            coverHtml: '<html></html>',
            content: {
              activeLayoutType: 'chips.layout.grid',
              layoutConfigs: {},
            },
            entries: [],
            assets: [],
            isDirty: false,
            isSaving: false,
            lastSavedAt: '2026-04-09T00:00:00.000Z',
          }}
          locale="zh-CN"
          className="box-window__preview"
        />,
      );
      await Promise.resolve();
    });

    const previewHost = container.querySelector('[data-chips-drop-surface="box-preview"]') as HTMLDivElement | null;
    expect(previewHost).not.toBeNull();
    expect(previewHost?.style.display).toBe('flex');
    expect(previewHost?.style.flexDirection).toBe('column');
    expect(previewHost?.style.flex).toBe('1 1 auto');
    expect(previewHost?.style.alignSelf).toBe('stretch');
    expect(previewHost?.style.width).toBe('100%');
    expect(previewHost?.style.maxWidth).toBe('100%');
    expect(previewHost?.style.minWidth).toBe('0px');
    expect(previewHost?.style.minHeight).toBe('100%');
    expect(mockState.client.document.window.render).toHaveBeenCalledWith({
      filePath: '/workspace/demo.box',
      documentType: 'box',
      locale: 'zh-CN',
    });
  });
});
