// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { resolveCanvasInteractionSurface } from '../../src/layouts/InfiniteCanvas/interaction-routing';

describe('resolveCanvasInteractionSurface', () => {
  it('treats desktop background surfaces as desktop interactions', () => {
    const canvas = document.createElement('div');
    canvas.className = 'infinite-canvas';

    const desktopLayer = document.createElement('div');
    desktopLayer.className = 'desktop-layer';
    canvas.appendChild(desktopLayer);

    const backgroundNode = document.createElement('div');
    desktopLayer.appendChild(backgroundNode);

    expect(resolveCanvasInteractionSurface(canvas, canvas)).toBe('desktop-background');
    expect(resolveCanvasInteractionSurface(backgroundNode, canvas)).toBe('desktop-background');
  });

  it('routes delegate-marked composite preview surfaces to desktop panning', () => {
    const canvas = document.createElement('div');
    const desktopLayer = document.createElement('div');
    desktopLayer.className = 'desktop-layer';
    canvas.appendChild(desktopLayer);

    const cardWindow = document.createElement('div');
    cardWindow.className = 'card-window-base card-window-base--normal';
    desktopLayer.appendChild(cardWindow);

    const preview = document.createElement('div');
    preview.className = 'card-window__preview';
    preview.setAttribute('data-chips-composite-scroll-surface', 'delegate');
    cardWindow.appendChild(preview);

    const previewChild = document.createElement('div');
    preview.appendChild(previewChild);

    expect(resolveCanvasInteractionSurface(previewChild, canvas)).toBe('composite-delegate');
  });

  it('keeps tool windows and non-delegate card chrome local', () => {
    const canvas = document.createElement('div');

    const toolWindow = document.createElement('div');
    toolWindow.className = 'base-window';
    const toolContent = document.createElement('div');
    toolWindow.appendChild(toolContent);

    const cardWindow = document.createElement('div');
    cardWindow.className = 'card-window-base card-window-base--collapsed';
    const header = document.createElement('div');
    header.className = 'card-window-base__header';
    cardWindow.appendChild(header);

    const collapsedPreview = document.createElement('div');
    collapsedPreview.className = 'card-window__preview';
    collapsedPreview.setAttribute('data-chips-composite-scroll-surface', 'native');
    cardWindow.appendChild(collapsedPreview);

    const collapsedPreviewChild = document.createElement('div');
    collapsedPreview.appendChild(collapsedPreviewChild);

    expect(resolveCanvasInteractionSurface(toolContent, canvas)).toBe('local-window');
    expect(resolveCanvasInteractionSurface(header, canvas)).toBe('local-window');
    expect(resolveCanvasInteractionSurface(collapsedPreviewChild, canvas)).toBe('local-window');
  });
});
