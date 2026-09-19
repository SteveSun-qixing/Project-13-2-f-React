import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { StateBoundary } from './index';

describe('StateBoundary', () => {
  it('默认渲染内容', () => {
    renderWithApp(
      <StateBoundary>
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.getByText('正文内容')).toBeInTheDocument();
  });

  it('加载态不渲染内容', () => {
    renderWithApp(
      <StateBoundary loading>
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.queryByText('正文内容')).toBeNull();
  });

  it('错误态展示统一标题、失败说明与重试', () => {
    const onRetry = vi.fn();
    renderWithApp(
      <StateBoundary
        error={{ code: 'BRIDGE_TIMEOUT', message: '请求超时，请重试' }}
        onRetry={onRetry}
      >
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.getByText('出错了')).toBeInTheDocument();
    expect(screen.getByText('请求超时，请重试')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('正文内容')).toBeNull();
  });

  it('错误态未提供重试回调时不渲染按钮', () => {
    renderWithApp(
      <StateBoundary error={{ code: 'E', message: '失败了' }}>
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('空态展示默认与自定义说明', () => {
    const { unmount } = renderWithApp(
      <StateBoundary empty>
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.getByText('暂无内容')).toBeInTheDocument();
    unmount();

    renderWithApp(
      <StateBoundary empty emptyText="还没有打开任何卡片">
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.getByText('还没有打开任何卡片')).toBeInTheDocument();
  });

  it('内容为空时给出骨架占位', () => {
    const { container } = renderWithApp(<StateBoundary>{null}</StateBoundary>);
    expect(container.querySelector('.ant-skeleton')).not.toBeNull();
  });

  it('优先级：加载优先于错误与空态', () => {
    renderWithApp(
      <StateBoundary loading error={{ code: 'E', message: '失败了' }} empty>
        <p>正文内容</p>
      </StateBoundary>
    );
    expect(screen.queryByText('出错了')).toBeNull();
    expect(screen.queryByText('暂无内容')).toBeNull();
  });

  it('可在无 ChipsProvider 的测试环境直接渲染（默认令牌）', () => {
    render(<StateBoundary empty />);
    expect(screen.getByText('暂无内容')).toBeInTheDocument();
  });
});
