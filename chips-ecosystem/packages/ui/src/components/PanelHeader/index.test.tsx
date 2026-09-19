import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { PanelHeader } from './index';

describe('PanelHeader', () => {
  it('渲染标题、说明与操作区', () => {
    renderWithApp(
      <PanelHeader
        title="导出设置"
        description="配置导出格式与尺寸"
        extra={<button type="button">保存</button>}
      />
    );
    expect(screen.getByText('导出设置')).toBeInTheDocument();
    expect(screen.getByText('配置导出格式与尺寸')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('省略说明与操作区时只渲染标题', () => {
    renderWithApp(<PanelHeader title="统计" />);
    expect(screen.getByText('统计')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('空说明不渲染说明元素', () => {
    renderWithApp(<PanelHeader title="统计" description="" />);
    expect(screen.queryByText('统计')?.parentElement?.textContent).toBe('统计');
  });

  it('未包裹 ChipsProvider 时仍可渲染（依赖默认令牌）', () => {
    render(<PanelHeader title="独立面板" />);
    expect(screen.getByText('独立面板')).toBeInTheDocument();
  });
});
