// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardWindow } from '../../src/components/CardWindow/CardWindow';

const setActiveCard = vi.fn();
const setSelectedBaseCard = vi.fn();
const panByInput = vi.fn();
const zoomByFactorAtPoint = vi.fn();
const markInteractionSequence = vi.fn();
const coverFrameRender = vi.fn();
const resolveCardResourceUrl = vi.fn();
const openResource = vi.fn();
const { mockOpenCards } = vi.hoisted(() => ({
  mockOpenCards: new Map<string, any>(),
}));

let latestAssemblerProps: Record<string, unknown> | null = null;

function createMockBaseCards(count = 1) {
  return Array.from({ length: count }, (_, index) => ({
    id: `base-${index + 1}`,
    type: 'base.richtext',
    data: { id: `base-${index + 1}`, content_text: `Intro ${index + 1}` },
  }));
}

function resetMockOpenCards(baseCards = createMockBaseCards()) {
  mockOpenCards.clear();
  mockOpenCards.set('card-1', {
    id: 'card-1',
    path: '/workspace/demo.card',
    metadata: {
      name: 'Demo Card',
      coverRatio: '3:4',
      modifiedAt: '2026-03-13T00:00:00.000Z',
    },
    structure: {
      basicCards: baseCards,
      layout: {
        padding: 16,
        gap: 12,
      },
    },
  });
}

vi.mock('../../src/basecard-runtime/CompositeCardAssembler', () => ({
  CompositeCardAssembler: (props: Record<string, any>) => {
    latestAssemblerProps = props;

    return (
      <div data-testid="composite-assembler">
        <button
          type="button"
          data-testid="select-basecard"
          onClick={() => props.onBaseCardSelect?.('base-1')}
        >
          select
        </button>
        <button
          type="button"
          data-testid="height-large"
          onClick={() => props.onHeightChange?.(913)}
        >
          height-large
        </button>
        <button
          type="button"
          data-testid="height-small"
          onClick={() => props.onHeightChange?.(129)}
        >
          height-small
        </button>
        <button
          type="button"
          data-testid="preview-error"
          onClick={() => props.onErrorChange?.('single basecard failed')}
        >
          preview-error
        </button>
      </div>
    );
  },
}));

vi.mock('../../src/context/CardContext', () => ({
  useCard: () => ({
    openCards: mockOpenCards,
    selectedBaseCardId: null,
    setActiveCard,
    setSelectedBaseCard,
  }),
}));

vi.mock('../../src/layouts/InfiniteCanvas/CanvasContext', () => ({
  useCanvas: () => ({
    zoom: 1,
    panByInput,
    panByScreenDelta: vi.fn(),
    zoomByFactorAtPoint,
    markInteractionSequence,
    clearInteractionSequence: vi.fn(),
    isDesktopZoomSuppressed: vi.fn(() => false),
  }),
}));


vi.mock('../../src/components/CardWindowBase/CardWindowBase', () => ({
  CardWindowBase: ({
    children,
    headerSlot,
  }: {
    children: React.ReactNode;
    headerSlot?: React.ReactNode;
  }) => (
    <div>
      <div>{headerSlot}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../src/components/CardSettings/CardSettingsDialog', () => ({
  CardSettingsDialog: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="card-settings-dialog">card-settings-dialog</div> : null
  ),
}));

vi.mock('../../src/components/WindowMenu/WindowMenu', () => ({
  WindowMenu: ({ onSettings }: { onSettings?: () => void }) => (
    <button type="button" data-testid="window-settings" onClick={() => onSettings?.()}>
      settings
    </button>
  ),
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    renameFile: vi.fn(),
  },
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    card: {
      resolveResourceUrl: resolveCardResourceUrl,
      coverFrame: {
        render: coverFrameRender,
      },
    },
    resource: {
      open: openResource,
    },
  }),
}));

describe('CardWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    latestAssemblerProps = null;
    resetMockOpenCards();
    setActiveCard.mockClear();
    setSelectedBaseCard.mockClear();
    panByInput.mockClear();
    zoomByFactorAtPoint.mockClear();
    markInteractionSequence.mockClear();
    coverFrameRender.mockReset();
    resolveCardResourceUrl.mockReset();
    resolveCardResourceUrl.mockImplementation(async (_cardRootDir: string, resourcePath: string) => (
      `chips-render://card-root/card-token/${resourcePath}`
    ));
    openResource.mockReset();
    openResource.mockResolvedValue({ mode: 'system' });
    coverFrameRender.mockResolvedValue({
      frame: document.createElement('iframe'),
      origin: 'null',
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderCardWindow(overrides: Partial<Record<string, unknown>> = {}) {
    await act(async () => {
      root.render(
        <CardWindow
          config={{
            id: 'window-1',
            type: 'card',
            cardId: 'card-1',
            position: { x: 0, y: 0 },
            size: { width: 640, height: 480 },
            state: 'normal',
            isEditing: true,
            title: 'Demo Card',
            ...overrides,
          } as any}
          onUpdateConfig={() => undefined}
          onClose={() => undefined}
          onFocus={() => undefined}
        />,
      );
      await Promise.resolve();
    });
  }

  it('maps assembled base card selection into card selection state', async () => {
    await renderCardWindow();

    await act(async () => {
      (container.querySelector('[data-testid="select-basecard"]') as HTMLButtonElement).click();
    });

    expect(setActiveCard).toHaveBeenCalledWith('card-1');
    expect(setSelectedBaseCard).toHaveBeenCalledWith('base-1');
  });

  it('applies assembled preview height to the preview container', async () => {
    await renderCardWindow();

    await act(async () => {
      (container.querySelector('[data-testid="height-large"]') as HTMLButtonElement).click();
    });

    const preview = container.querySelector('.card-window__preview') as HTMLDivElement | null;
    expect(preview?.style.height).toBe('913px');
    expect(preview?.style.minHeight).toBe('913px');
    expect(preview?.style.width).toBe('100%');
    expect(preview?.style.maxWidth).toBe('100%');
    expect(preview?.style.flex).toBe('1 1 auto');
  });

  it('keeps short assembled cards content-driven in expanded mode', async () => {
    await renderCardWindow();

    await act(async () => {
      (container.querySelector('[data-testid="height-small"]') as HTMLButtonElement).click();
    });

    const preview = container.querySelector('.card-window__preview') as HTMLDivElement | null;
    expect(preview?.style.height).toBe('129px');
    expect(preview?.style.minHeight).toBe('129px');
  });

  it('does not cover the whole composite card when one basecard reports an error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderCardWindow();

    await act(async () => {
      (container.querySelector('[data-testid="preview-error"]') as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="composite-assembler"]')).not.toBeNull();
    expect(container.querySelector('.card-window__overlay--error')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      '[CardWindow] Basecard preview failed.',
      expect.objectContaining({
        cardId: 'card-1',
        error: 'single basecard failed',
      }),
    );
    consoleError.mockRestore();
  });

  it('uses the formal surface token for the composite preview background', () => {
    const cardWindowCss = readFileSync(
      resolve(process.cwd(), 'src/components/CardWindow/CardWindow.css'),
      'utf8',
    );

    expect(cardWindowCss).toContain('.card-window__preview');
    expect(cardWindowCss).toContain('background: #ffffff;');
    expect(cardWindowCss).not.toContain('background: linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(241, 245, 249, 0.9) 100%);');
  });

  it('passes the preview mode and interaction policy to the assembler', async () => {
    await renderCardWindow();

    expect(latestAssemblerProps?.mode).toBe('preview');
    expect(latestAssemblerProps?.interactionPolicy).toBe('delegate');

    await renderCardWindow({
      state: 'collapsed',
    });

    expect(latestAssemblerProps?.interactionPolicy).toBe('native');
  });

  it('resolves preview resources through the SDK card resource route', async () => {
    await renderCardWindow();

    const resolveResourceUrl = latestAssemblerProps?.resolveResourceUrl as
      | ((resourcePath: string) => Promise<string>)
      | undefined;
    const resourceUrl = await resolveResourceUrl?.('webpage-bundle/index.html');

    expect(resolveCardResourceUrl).toHaveBeenCalledWith(
      '/workspace/demo.card',
      'webpage-bundle/index.html',
    );
    expect(resourceUrl).toBe(
      'chips-render://card-root/card-token/webpage-bundle/index.html',
    );
    expect(latestAssemblerProps).not.toHaveProperty('resourceBaseUrl');
  });

  it('marks populated preview surfaces as insert targets only while editing', async () => {
    await renderCardWindow();

    const editablePreview = container.querySelector('.card-window__preview') as HTMLDivElement | null;
    expect(editablePreview?.dataset.chipsDropSurface).toBe('composite-preview');
    expect(editablePreview?.dataset.chipsDropAccept).toBe('true');

    await renderCardWindow({
      isEditing: false,
    });

    const readonlyPreview = container.querySelector('.card-window__preview') as HTMLDivElement | null;
    expect(readonlyPreview?.dataset.chipsDropAccept).toBe('false');
  });

  it('exposes the empty card state as a first-slot drop surface in edit mode', async () => {
    resetMockOpenCards([]);

    await renderCardWindow();

    const emptyState = container.querySelector('.card-window__empty') as HTMLDivElement | null;
    expect(emptyState?.dataset.chipsDropSurface).toBe('composite-preview');
    expect(emptyState?.dataset.chipsCardId).toBe('card-1');
    expect(emptyState?.dataset.chipsBaseCardCount).toBe('0');
    expect(emptyState?.dataset.chipsDropAccept).toBe('true');
  });

  it('routes assembled interaction events into canvas pan and anchored zoom actions', async () => {
    await renderCardWindow();

    const frame = document.createElement('iframe');
    frame.getBoundingClientRect = vi.fn(() => ({
      x: 120,
      y: 240,
      left: 120,
      top: 240,
      right: 760,
      bottom: 720,
      width: 640,
      height: 480,
      toJSON: () => ({}),
    })) as unknown as typeof frame.getBoundingClientRect;

    await act(async () => {
      (latestAssemblerProps?.onInteraction as any)?.({
        intent: 'pan',
        deltaX: 12,
        deltaY: 36,
        zoomDelta: 0,
        clientX: 32,
        clientY: 64,
      }, frame);
    });

    expect(markInteractionSequence).toHaveBeenCalledWith({ suppressDesktopZoom: true });
    expect(panByInput).toHaveBeenCalledWith(12, 36);

    await act(async () => {
      (latestAssemblerProps?.onInteraction as any)?.({
        intent: 'zoom',
        deltaX: 0,
        deltaY: 0,
        zoomDelta: 0.2,
        clientX: 50,
        clientY: 80,
      }, frame);
    });

    expect(zoomByFactorAtPoint).toHaveBeenCalledWith(1.2, 170, 320);
  });

  it('opens the card settings dialog from the window menu settings action', async () => {
    await renderCardWindow();

    expect(container.querySelector('[data-testid="card-settings-dialog"]')).toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="window-settings"]') as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="card-settings-dialog"]')).not.toBeNull();
  });

  it('renders the formal cover iframe in cover mode without placeholder text chrome', async () => {
    const coverFrame = document.createElement('iframe');
    coverFrameRender.mockResolvedValue({
      frame: coverFrame,
      origin: 'null',
    });

    await renderCardWindow({
      state: 'cover',
      coverRatio: '9:19.5',
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(coverFrameRender).toHaveBeenCalledWith({
      cardFile: '/workspace/demo.card',
    });

    const cover = container.querySelector('.card-cover') as HTMLDivElement | null;
    const frameHost = container.querySelector('.card-cover__frame-host') as HTMLDivElement | null;
    expect(cover).not.toBeNull();
    expect(frameHost?.contains(coverFrame)).toBe(true);
    expect(container.querySelector('.card-cover__title')).toBeNull();
    expect(container.querySelector('.card-cover__placeholder')).toBeNull();
    expect(coverFrame.style.pointerEvents).toBe('none');
    expect(parseFloat(cover?.style.width ?? '0')).toBe(208);

    await act(async () => {
      coverFrame.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });

    expect(container.querySelector('.card-cover__status--loading')).toBeNull();
  });
});
