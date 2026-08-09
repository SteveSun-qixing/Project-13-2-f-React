// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePanel } from '../../src/components/CardSettings/panels/ThemePanel';

const listThemes = vi.fn(async () => [
  {
    id: 'chips-official.default-theme',
    displayName: 'Official Light',
    version: '1.0.0',
    isDefault: true,
  },
  {
    id: 'chips-official.default-dark-theme',
    displayName: 'Official Dark',
    version: '1.1.0',
    isDefault: false,
  },
]);

const getCurrentTheme = vi.fn(async () => ({
  themeId: 'chips-official.default-dark-theme',
  displayName: 'Official Dark',
  version: '1.1.0',
}));

const translate = (key: string) => ({
  'card_settings.theme_default_light': '默认浅色',
  'card_settings.theme_default_dark': '默认深色',
  'card_settings.theme_select': '选择主题',
  'card_settings.theme_loading': '加载中...',
  'card_settings.theme_hint': '可前往插件市场下载更多主题。',
}[key] ?? key);

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    theme: {
      list: listThemes,
      getCurrent: getCurrentTheme,
    },
  }),
}));

vi.mock('../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('ThemePanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    listThemes.mockClear();
    getCurrentTheme.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('loads themes from the formal runtime API and aligns the selection to the current theme', async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(<ThemePanel value="" onChange={onChange} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listThemes).toHaveBeenCalledTimes(1);
    expect(getCurrentTheme).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('chips-official.default-dark-theme');
    expect(container.textContent).toContain('默认浅色 1.0.0');
    expect(container.textContent).toContain('默认深色 1.1.0');
  });
});
