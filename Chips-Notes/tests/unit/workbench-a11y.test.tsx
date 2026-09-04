// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainArea } from '../../src/layouts/Workbench/MainArea';
import { SidePanel } from '../../src/layouts/Workbench/SidePanel';

describe('Workbench a11y controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('moves tab focus with horizontal roving keyboard navigation', async () => {
    const onTabChange = vi.fn();

    await act(async () => {
      root.render(
        <MainArea
          activeTabId="one"
          tabs={[
            { id: 'one', title: 'One', closable: true },
            { id: 'two', title: 'Two', modified: true },
          ]}
          tabListLabel="Open files"
          modifiedLabel="Modified"
          closeTabLabel={(title) => `Close ${title}`}
          onTabChange={onTabChange}
        />,
      );
    });

    const tablist = container.querySelector('[role="tablist"]') as HTMLDivElement | null;
    const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLDivElement[];
    expect(tablist?.getAttribute('aria-label')).toBe('Open files');
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1]);
    expect(tabs[1]?.querySelector('.main-area__tab-indicator')?.getAttribute('aria-label')).toBe('Modified');
    expect(tabs[0]?.querySelector('button')?.getAttribute('aria-label')).toBe('Close One');

    await act(async () => {
      tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onTabChange).toHaveBeenLastCalledWith('two');
  });

  it('resizes side panels from the separator keyboard path', async () => {
    const onWidthChange = vi.fn();

    await act(async () => {
      root.render(
        <SidePanel
          title="Project Directory"
          width={280}
          minWidth={180}
          maxWidth={480}
          resizeLabel="Resize Project Directory"
          onWidthChange={onWidthChange}
        >
          <div>content</div>
        </SidePanel>,
      );
    });

    const separator = container.querySelector('[role="separator"]') as HTMLDivElement | null;
    expect(separator?.getAttribute('aria-valuemin')).toBe('180');
    expect(separator?.getAttribute('aria-valuemax')).toBe('480');
    expect(separator?.getAttribute('aria-valuenow')).toBe('280');

    await act(async () => {
      separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onWidthChange).toHaveBeenLastCalledWith(288);

    await act(async () => {
      separator?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });

    expect(onWidthChange).toHaveBeenLastCalledWith(180);
  });
});
