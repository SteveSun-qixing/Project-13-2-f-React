import { act, render, screen } from '@testing-library/react';
import { theme } from '@chips/antd';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChipsProvider } from './ChipsProvider';
import { useChips } from './context';
import {
  DARK_APPEARANCE_QUERY,
  readSystemAppearance,
  useSystemAppearance,
} from './use-system-appearance';

interface FakeMediaQuery {
  readonly query: string;
  matches: boolean;
  readonly listeners: Set<(event: MediaQueryListEvent) => void>;
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function installFakeMatchMedia(initialDark: boolean): FakeMediaQuery {
  const state: FakeMediaQuery = {
    query: DARK_APPEARANCE_QUERY,
    matches: initialDark,
    listeners: new Set(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return state.matches;
      },
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        state.listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        state.listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }),
  });
  return state;
}

afterEach(() => {
  if (originalMatchMedia === undefined) {
    Reflect.deleteProperty(window, 'matchMedia');
  } else {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  }
  vi.restoreAllMocks();
});

const EnvironmentProbe: React.FC = () => {
  const { appId, surface } = useChips();
  const { token } = theme.useToken();
  return (
    <span data-testid="environment">
      {appId}|{surface}|{token.colorPrimary}
    </span>
  );
};

describe('ChipsProvider', () => {
  it('提供 appId 与 surface，并安装设计令牌主题根', () => {
    render(
      <ChipsProvider appId="chips.test.app" surface="desktop">
        <EnvironmentProbe />
      </ChipsProvider>
    );
    expect(screen.getByTestId('environment').textContent).toBe('chips.test.app|desktop|#0a84ff');
  });

  it('系统深色外观下解析深色令牌', () => {
    const media = installFakeMatchMedia(true);
    const LayoutProbe: React.FC = () => {
      const { token } = theme.useToken();
      return <span data-testid="layout">{token.colorBgLayout}</span>;
    };
    render(
      <ChipsProvider appId="chips.test.app" surface="window">
        <LayoutProbe />
      </ChipsProvider>
    );
    expect(screen.getByTestId('layout').textContent).toBe('#1c1c1e');

    act(() => {
      media.matches = false;
      for (const listener of media.listeners) {
        listener({ matches: false } as MediaQueryListEvent);
      }
    });
    expect(screen.getByTestId('layout').textContent).toBe('#f5f5f7');
  });

  it('useChips 越界调用抛出简体中文错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<EnvironmentProbe />)).toThrow('useChips 必须在 ChipsProvider 内使用。');
    spy.mockRestore();
  });
});

describe('useSystemAppearance', () => {
  it('无 matchMedia 的环境按浅色收口', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    expect(readSystemAppearance()).toBe('light');
  });

  it('订阅外观变化并在卸载时移除监听', () => {
    const media = installFakeMatchMedia(false);
    const AppearanceProbe: React.FC = () => {
      const appearance = useSystemAppearance();
      return <span data-testid="appearance">{appearance}</span>;
    };
    const { unmount } = render(<AppearanceProbe />);
    expect(screen.getByTestId('appearance').textContent).toBe('light');

    act(() => {
      media.matches = true;
      for (const listener of media.listeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    expect(screen.getByTestId('appearance').textContent).toBe('dark');

    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
