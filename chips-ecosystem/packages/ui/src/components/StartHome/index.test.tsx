import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { StartHome } from './index';

const baseProps = {
  title: '卡片信息查看器',
  description: '打开 .card 文档，查看卡片的基本信息',
  formatsText: '支持 .card',
  openLabel: '打开卡片',
  shortcutText: '⌘O',
  dragActiveText: '松开以打开卡片',
  onOpen: () => undefined,
} as const;

describe('StartHome', () => {
  it('渲染标题、说明、格式与快捷键提示', () => {
    renderWithApp(<StartHome {...baseProps} dragActive={false} />);
    expect(screen.getByText('卡片信息查看器')).toBeInTheDocument();
    expect(screen.getByText('打开 .card 文档，查看卡片的基本信息')).toBeInTheDocument();
    expect(screen.getByText('支持 .card')).toBeInTheDocument();
    expect(screen.getByText('⌘O')).toBeInTheDocument();
  });

  it('点击打开按钮触发打开动作', () => {
    const onOpen = vi.fn();
    renderWithApp(<StartHome {...baseProps} dragActive={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '打开卡片' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('提供新建入口时渲染并回调', () => {
    const onCreate = vi.fn();
    renderWithApp(
      <StartHome {...baseProps} dragActive={false} createLabel="新建卡片" onCreate={onCreate} />
    );
    fireEvent.click(screen.getByRole('button', { name: '新建卡片' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('缺少新建回调或文案时不渲染新建入口', () => {
    const { unmount } = renderWithApp(
      <StartHome {...baseProps} dragActive={false} createLabel="新建卡片" />
    );
    expect(screen.queryByRole('button', { name: '新建卡片' })).toBeNull();
    unmount();

    renderWithApp(<StartHome {...baseProps} dragActive={false} onCreate={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('渲染可选图标', () => {
    renderWithApp(
      <StartHome
        {...baseProps}
        dragActive={false}
        icon={<span data-testid="app-icon">图标</span>}
      />
    );
    expect(screen.getByTestId('app-icon')).toBeInTheDocument();
  });

  it('拖放态显示提示层，退出拖放态后隐藏', () => {
    const { rerender } = renderWithApp(<StartHome {...baseProps} dragActive={false} />);
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<StartHome {...baseProps} dragActive onOpen={baseProps.onOpen} />);
    expect(screen.getByRole('status')).toHaveTextContent('松开以打开卡片');

    rerender(<StartHome {...baseProps} dragActive={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('可在无 ChipsProvider 的环境直接渲染（默认令牌）', () => {
    render(<StartHome {...baseProps} dragActive={false} />);
    expect(screen.getByText('卡片信息查看器')).toBeInTheDocument();
  });
});
