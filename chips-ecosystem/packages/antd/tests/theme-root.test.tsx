import { render, screen } from '@testing-library/react';
import { App, DatePicker, theme } from 'antd';
import type { GlobalToken } from 'antd';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChipsThemeConfigError, ChipsThemeRoot } from '../src/index';
import type { ThemeConfig } from '../src/index';

interface TokenSnapshot {
  readonly token: GlobalToken;
  readonly cssVar: GlobalToken;
  readonly hashId: string;
}

let snapshot: TokenSnapshot | null = null;

function TokenProbe(): ReactElement {
  const { token, cssVar, hashId } = theme.useToken();
  const app = App.useApp();
  snapshot = { token, cssVar, hashId };
  return (
    <span>{typeof app.message.info === 'function' ? '应用上下文就绪' : '应用上下文缺失'}</span>
  );
}

const appleTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: { colorPrimary: '#0a84ff', borderRadius: 10, fontSize: 14 },
  components: { Button: { borderRadius: 8 }, Table: { cellPaddingBlock: 14 } },
};

function collectStyleText(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((styleElement) => styleElement.textContent ?? '')
    .join('\n');
}

describe('ChipsThemeRoot', () => {
  it('安装主题根并注入令牌与 antd App 上下文', () => {
    render(
      <ChipsThemeRoot theme={appleTheme}>
        <TokenProbe />
        <DatePicker />
      </ChipsThemeRoot>
    );

    expect(snapshot?.token.colorPrimary).toBe('#0a84ff');
    expect(snapshot?.token.borderRadius).toBe(10);
    expect(screen.getByText('应用上下文就绪')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请选择日期')).toBeInTheDocument();
  });

  it('使用 --chips-* CSS 变量与 .css-var-chips 作用域，单实例下关闭哈希', () => {
    render(
      <ChipsThemeRoot theme={appleTheme}>
        <TokenProbe />
      </ChipsThemeRoot>
    );

    expect(snapshot?.cssVar.colorPrimary).toBe('var(--chips-color-primary)');
    expect(snapshot?.cssVar.borderRadius).toBe('var(--chips-border-radius)');
    expect(snapshot?.hashId).toBe('');

    const styleText = collectStyleText();
    expect(styleText).toContain('.css-var-chips');
    expect(styleText).toMatch(/--chips-color-primary\s*:\s*#0a84ff/);
  });

  it('拒绝越权主题配置并阻止渲染', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() =>
        render(
          <ChipsThemeRoot theme={{ components: { Tree: { colorPrimary: '#000000' } } }}>
            <span>不应出现</span>
          </ChipsThemeRoot>
        )
      ).toThrow(ChipsThemeConfigError);
    } finally {
      consoleError.mockRestore();
    }
  });
});
