import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createMockBridge,
  renderWithApp,
  renderWithCommands,
} from '../../../tests/helpers/harness';
import { AppChrome } from './index';

describe('AppChrome', () => {
  it('渲染内容区与底部区域', () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));
    renderWithCommands(
      <AppChrome footer="未打开卡片">
        <p>内容区</p>
      </AppChrome>,
      bridge.port
    );
    expect(screen.getByText('内容区')).toBeInTheDocument();
    expect(screen.getByText('未打开卡片')).toBeInTheDocument();
    expect(screen.getByText('未打开卡片').parentElement?.getAttribute('style')).toContain(
      'border-top'
    );
  });

  it('省略底部区域时只渲染内容区', () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));
    renderWithCommands(
      <AppChrome>
        <p>内容区</p>
      </AppChrome>,
      bridge.port
    );
    expect(screen.getByText('内容区')).toBeInTheDocument();
    expect(screen.getByText('内容区').parentElement?.getAttribute('style')).toContain('padding:');
  });

  it('沉浸式内容区去掉内边距并透传附加样式', () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));
    renderWithCommands(
      <AppChrome immersive contentStyle={{ background: 'transparent' }}>
        <p>内容区</p>
      </AppChrome>,
      bridge.port
    );
    const content = screen.getByText('内容区').parentElement;
    expect(content?.getAttribute('style')).toContain('padding: 0px');
    expect(content?.getAttribute('style')).toContain('background: transparent');
  });

  it('内置命令面板：默认快捷键打开、自定义快捷键生效', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));

    const { unmount } = renderWithCommands(
      <AppChrome>
        <p>内容区</p>
      </AppChrome>,
      bridge.port
    );
    fireEvent.keyDown(window, { key: 'p', code: 'KeyP', ctrlKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('textbox', { name: '搜索命令' }), { key: 'Escape' });
    unmount();

    const custom = renderWithCommands(
      <AppChrome paletteShortcut="CommandOrControl+K">
        <p>内容区</p>
      </AppChrome>,
      bridge.port
    );
    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    custom.unmount();
  });

  it('未挂载 CommandProvider 时抛出简体中文错误（命令面板依赖运行时）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      renderWithApp(
        <AppChrome>
          <p>内容区</p>
        </AppChrome>
      )
    ).toThrow('useCommandRuntime 必须在 CommandProvider 内使用。');
    spy.mockRestore();
  });
});
