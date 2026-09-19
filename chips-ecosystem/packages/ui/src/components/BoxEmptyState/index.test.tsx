import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { BoxEmptyState } from './index';

describe('BoxEmptyState', () => {
  it('使用默认简体中文空态文案', () => {
    renderWithApp(<BoxEmptyState />);
    expect(screen.getByText('这里还没有内容')).toBeInTheDocument();
    expect(screen.getByText('在编辑器中添加卡片或箱子，开始填充这个箱子')).toBeInTheDocument();
  });

  it('渲染自定义文案与操作区', () => {
    renderWithApp(
      <BoxEmptyState
        title="空时间线"
        description="添加事件开始记录"
        action={<button type="button">新建</button>}
      />
    );
    expect(screen.getByText('空时间线')).toBeInTheDocument();
    expect(screen.getByText('添加事件开始记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建' })).toBeInTheDocument();
  });

  it('保留布局空态的语义锚点与插画骨架', () => {
    const { container } = renderWithApp(<BoxEmptyState />);
    expect(container.querySelector('[data-layout-empty]')).not.toBeNull();
    expect(container.querySelector('[data-layout-empty-title]')).not.toBeNull();
    expect(container.querySelector('[data-layout-empty-text]')).not.toBeNull();
    expect(container.querySelectorAll('[data-box-empty-card]')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('紧凑形态按比例缩小插画', () => {
    const { container } = renderWithApp(<BoxEmptyState compact />);
    const front = container.querySelector('[data-box-empty-card="front"]');
    expect(front?.getAttribute('style')).toContain('scale(0.78)');
  });

  it('可在无 ChipsProvider 的环境直接渲染（默认令牌）', () => {
    render(<BoxEmptyState />);
    expect(screen.getByText('这里还没有内容')).toBeInTheDocument();
  });
});
