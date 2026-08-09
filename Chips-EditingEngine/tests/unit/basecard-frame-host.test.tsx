// @vitest-environment jsdom

import React, { act, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BasecardFrameHost } from '../../src/basecard-runtime/frame-host';
import { createBasecardFrameThemeCss } from '../../src/basecard-runtime/theme-css';

const mockRenderView = vi.fn();
let mockPreviewPointerEvents: 'native' | 'shielded' = 'native';

vi.mock('../../src/basecard-runtime/registry', () => ({
  getBasecardDescriptor: () => ({
    pluginId: 'mock.basecard',
    cardType: 'base.mock',
    displayName: 'Mock Basecard',
    commitDebounceMs: 260,
    previewPointerEvents: mockPreviewPointerEvents,
    createInitialConfig: (baseCardId: string) => ({ id: baseCardId }),
    normalizeConfig: (input: Record<string, unknown>, baseCardId: string) => ({
      ...input,
      id: baseCardId,
    }),
    validateConfig: () => ({
      valid: true,
      errors: {},
    }),
    renderView: mockRenderView,
  }),
  normalizeBasecardConfig: (_cardType: string, baseCardId: string, input: Record<string, unknown>) => ({
    ...input,
    id: baseCardId,
  }),
  getBasecardRegistryVersion: () => 0,
  subscribeBasecardRegistry: () => () => undefined,
}));

function ParentHarness() {
  const [readyRevision, setReadyRevision] = useState(0);
  const stableConfig = useMemo(() => ({
    id: 'base-1',
    content_text: 'demo',
  }), []);

  return (
    <div data-ready-revision={String(readyRevision)}>
      <BasecardFrameHost
        baseCardId="base-1"
        cardType="base.mock"
        config={stableConfig}
        resourceBaseUrl="file:///workspace/demo.card/"
        selectable
        interactionPolicy="delegate"
        themeCacheKey="theme-1"
        onSelect={() => undefined}
        onInteraction={() => undefined}
        onStatusChange={(status) => {
          if (status.state === 'ready') {
            setReadyRevision((current) => current === 0 ? 1 : current);
          }
        }}
      />
    </div>
  );
}

function RefreshHarness() {
  const [config, setConfig] = useState<Record<string, unknown>>({
    id: 'base-1',
    content_text: 'long',
  });

  return (
    <div>
      <button
        type="button"
        data-testid="refresh-config"
        onClick={() => {
          setConfig({
            id: 'base-1',
            content_text: 'grid',
          });
        }}
      >
        refresh
      </button>
      <BasecardFrameHost
        baseCardId="base-1"
        cardType="base.mock"
        config={config}
        resourceBaseUrl="file:///workspace/demo.card/"
        interactionPolicy="delegate"
        onInteraction={() => undefined}
      />
    </div>
  );
}

describe('BasecardFrameHost', () => {
  let container: HTMLDivElement;
  let root: Root;
  const createObjectURL = vi.fn(() => 'blob:pending-cover');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    mockRenderView.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    mockPreviewPointerEvents = 'native';
    mockRenderView.mockImplementation(({ container: mountContainer, config }: {
      container: HTMLElement;
      config?: Record<string, unknown>;
    }) => {
      const height = config?.content_text === 'grid' ? 128 : 420;
      Object.defineProperty(mountContainer, 'scrollHeight', {
        configurable: true,
        value: height,
      });
      Object.defineProperty(mountContainer, 'offsetHeight', {
        configurable: true,
        value: height,
      });
      Object.defineProperty(mountContainer, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          width: 320,
          height,
          top: 0,
          left: 0,
          right: 320,
          bottom: height,
          x: 0,
          y: 0,
          toJSON: () => undefined,
        }),
      });
      const marker = mountContainer.ownerDocument.createElement('div');
      marker.textContent = 'mounted';
      mountContainer.appendChild(marker);
      return () => {
        while (mountContainer.firstChild) {
          mountContainer.removeChild(mountContainer.firstChild);
        }
      };
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the iframe mounted after ready-driven parent rerenders', async () => {
    await act(async () => {
      root.render(<ParentHarness />);
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(frame).not.toBeNull();
    expect(frame?.srcdoc).toContain('<base href="file:///workspace/demo.card/" />');
    expect(frame?.srcdoc).toContain('background: transparent !important;');
    expect(frame?.getAttribute('allowtransparency')).toBe('true');
    expect(frame?.style.backgroundColor).toBe('transparent');

    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });

    const host = container.querySelector('.basecard-frame-host') as HTMLDivElement | null;
    expect(mockRenderView).toHaveBeenCalled();
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="error"]')).toBeNull();
    expect(container.querySelector('[data-ready-revision="1"]')).not.toBeNull();
    expect(host?.style.minHeight).toBe('0px');
    expect(frame?.style.minHeight).toBe('0px');
  }, 15000);

  it('generates fixed apple-palette frame CSS without reading the theme system', () => {
    const cssText = createBasecardFrameThemeCss(container);

    expect(cssText).toContain('color: #1d1d1f;');
    expect(cssText).toContain('background: #ffffff;');
    expect(cssText).toContain('.chips-basecard__body a { color: #0a84ff; }');
    expect(cssText).toContain('border-left: 3px solid rgba(0, 0, 0, 0.08);');
    expect(cssText).not.toContain('@font-face');
    expect(cssText).not.toMatch(/--chips-/);
    expect(cssText).not.toContain('Material Symbols');
  });

  it('resolves pending imported resources for preview rendering before they are persisted', async () => {
    mockRenderView.mockReset();
    mockRenderView.mockImplementation(({ container: mountContainer, resolveResourceUrl }: {
      container: HTMLElement;
      resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    }) => {
      void resolveResourceUrl?.('cover.png').then((src) => {
        const image = mountContainer.ownerDocument.createElement('img');
        image.setAttribute('data-preview-image', 'true');
        image.src = src;
        mountContainer.appendChild(image);
      });

      return () => {
        while (mountContainer.firstChild) {
          mountContainer.removeChild(mountContainer.firstChild);
        }
      };
    });

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          pendingResourceImports={new Map([
            ['cover.png', { path: 'cover.png', data: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }],
          ])}
          interactionPolicy="native"
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
      await Promise.resolve();
    });

    const previewImage = frame?.contentDocument?.querySelector('[data-preview-image="true"]') as HTMLImageElement | null;
    expect(previewImage).not.toBeNull();
    expect(previewImage?.getAttribute('src')?.startsWith('blob:')).toBe(true);
  });

  it('keeps the iframe mounted while invalidating replaced pending resource urls', async () => {
    const resolvedUrls: string[] = [];
    createObjectURL
      .mockReturnValueOnce('blob:pending-cover-v1')
      .mockReturnValueOnce('blob:pending-cover-v2');
    mockRenderView.mockReset();
    mockRenderView.mockImplementation(({ resolveResourceUrl }: {
      resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    }) => {
      void resolveResourceUrl?.('cover.png').then((src) => {
        resolvedUrls.push(src);
      });
      return () => undefined;
    });

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          pendingResourceImports={new Map([
            ['cover.png', { path: 'cover.png', data: new Uint8Array([1, 2, 3]), mimeType: 'image/png', token: 'v1' }],
          ])}
          interactionPolicy="native"
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolvedUrls).toContain('blob:pending-cover-v1');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRenderView).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          pendingResourceImports={new Map([
            ['cover.png', { path: 'cover.png', data: new Uint8Array([4, 5, 6]), mimeType: 'image/png', token: 'v2' }],
          ])}
          interactionPolicy="native"
        />,
      );
      await Promise.resolve();
    });

    const lastRenderCall = mockRenderView.mock.calls[mockRenderView.mock.calls.length - 1];
    const resolveResourceUrl = lastRenderCall?.[0]?.resolveResourceUrl as
      | ((resourcePath: string) => Promise<string>)
      | undefined;
    const nextUrl = await resolveResourceUrl?.('cover.png');

    expect(nextUrl).toBe('blob:pending-cover-v2');
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:pending-cover-v1');
    expect(mockRenderView).toHaveBeenCalledTimes(1);
  });

  it('renders a transparent selection shield when the descriptor requests shielded preview pointers', async () => {
    mockPreviewPointerEvents = 'shielded';
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          selectable
          interactionPolicy="native"
          onSelect={onSelect}
        />,
      );
      await Promise.resolve();
    });

    const shield = container.querySelector('.basecard-frame-host__selection-shield') as HTMLDivElement | null;
    expect(shield).not.toBeNull();

    await act(async () => {
      const pointerEvent = typeof PointerEvent === 'function'
        ? new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
        : new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
      shield?.dispatchEvent(pointerEvent);
      await Promise.resolve();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('resolves pending preview text resources through runtime resource urls', async () => {
    const resolvedUrls: string[] = [];
    mockRenderView.mockReset();
    mockRenderView.mockImplementation(({ resolveResourceUrl }: {
      resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    }) => {
      void resolveResourceUrl?.('docs/article.md').then((resourceUrl) => {
        resolvedUrls.push(resourceUrl);
      });
      return () => undefined;
    });

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          pendingResourceImports={new Map([
            ['docs/article.md', { path: 'docs/article.md', data: new TextEncoder().encode('# Pending Preview') }],
          ])}
          interactionPolicy="native"
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(resolvedUrls.length).toBeGreaterThan(0);
    expect(new Set(resolvedUrls).size).toBe(1);
    expect(resolvedUrls[0]?.startsWith('blob:')).toBe(true);
  });

  it('passes normalized resource open intent from basecard preview to the host callback', async () => {
    const onResourceOpen = vi.fn();
    mockRenderView.mockReset();
    mockRenderView.mockImplementation(({ openResource }: {
      openResource?: (input: {
        resourceId: string;
        mimeType?: string;
        title?: string;
        fileName?: string;
        payload?: Record<string, unknown>;
      }) => void;
    }) => {
      openResource?.({
        resourceId: 'images/cover.png',
        mimeType: ' image/png ',
        title: ' Cover ',
        fileName: ' cover.png ',
        payload: {
          kind: 'chips.image-card',
          index: 0,
        },
      });
      return () => undefined;
    });

    await act(async () => {
      root.render(
        <BasecardFrameHost
          baseCardId="base-1"
          cardType="base.mock"
          config={{ id: 'base-1' }}
          resourceBaseUrl="file:///workspace/demo.card/"
          interactionPolicy="native"
          onResourceOpen={onResourceOpen}
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });

    expect(onResourceOpen).toHaveBeenCalledWith({
      resourceId: 'file:///workspace/demo.card/images/cover.png',
      mimeType: 'image/png',
      title: 'Cover',
      fileName: 'cover.png',
      payload: {
        kind: 'chips.image-card',
        index: 0,
      },
    });
  });

  it('keeps previously rendered preview visible while a config refresh is remounting', async () => {
    await act(async () => {
      root.render(<RefreshHarness />);
      await Promise.resolve();
    });

    const frame = container.querySelector('iframe') as HTMLIFrameElement | null;
    const frameWindow = frame?.contentWindow as (Window & { requestAnimationFrame?: (cb: FrameRequestCallback) => number }) | null;
    expect(frameWindow).not.toBeNull();
    Object.defineProperty(frameWindow, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: ((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }) as (cb: FrameRequestCallback) => number,
    });

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });

    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();
    expect(frame?.style.height).toBe('420px');

    const refreshButton = container.querySelector('[data-testid="refresh-config"]') as HTMLButtonElement | null;
    expect(refreshButton).not.toBeNull();

    await act(async () => {
      refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();

    await act(async () => {
      frame?.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });

    expect(frame?.style.height).toBe('128px');
  });
});
