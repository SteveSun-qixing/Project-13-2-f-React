import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { EmptyHint, LayoutSkeleton, SkeletonBlock, SkeletonDot, SkeletonLine } from './index';

describe('骨架原子', () => {
  it('SkeletonBlock 为装饰元素且支持虚线形态', () => {
    const { container } = renderWithApp(
      <>
        <SkeletonBlock width={96} height={128} radius={12} />
        <SkeletonBlock width="60%" height={64} dashed />
      </>
    );
    const blocks = container.querySelectorAll('[aria-hidden="true"]');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.getAttribute('style')).toContain('width: 96px');
    expect(blocks[1]?.getAttribute('style')).toContain('dashed');
  });

  it('SkeletonLine 支持宽度与自定义圆角', () => {
    const { container } = renderWithApp(<SkeletonLine width={120} height={8} radius={4} />);
    const line = container.querySelector('[aria-hidden="true"]');
    expect(line?.getAttribute('style')).toContain('width: 120px');
    expect(line?.getAttribute('style')).toContain('height: 8px');
    expect(line?.getAttribute('style')).toContain('border-radius: 4px');
  });

  it('SkeletonDot 使用默认直径', () => {
    const { container } = renderWithApp(<SkeletonDot />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.getAttribute('style')).toContain('width: 12px');
    expect(dot?.getAttribute('style')).toContain('border-radius: 50%');
  });
});

describe('EmptyHint', () => {
  it('使用默认简体中文文案并居中', () => {
    renderWithApp(<EmptyHint />);
    expect(screen.getByText('这里还没有内容')).toBeInTheDocument();
    expect(screen.getByText('在编辑器中添加卡片或箱子，开始填充这个箱子')).toBeInTheDocument();
  });

  it('支持自定义文案与对齐方式', () => {
    const { unmount } = renderWithApp(
      <EmptyHint title="还没有照片" description="拖入图片开始" align="start" />
    );
    expect(screen.getByText('还没有照片')).toBeInTheDocument();
    expect(screen.getByText('拖入图片开始')).toBeInTheDocument();
    const hint = screen.getByText('还没有照片').parentElement;
    expect(hint?.getAttribute('style')).toContain('flex-start');
    unmount();

    renderWithApp(<EmptyHint title="时间线" align="end" />);
    const endHint = screen.getByText('时间线').parentElement;
    expect(endHint?.getAttribute('style')).toContain('flex-end');
  });
});

describe('LayoutSkeleton', () => {
  it('渲染提示与形态骨架', () => {
    renderWithApp(
      <LayoutSkeleton hint={<EmptyHint title="空网格" />}>
        <SkeletonBlock width={80} height={100} />
      </LayoutSkeleton>
    );
    expect(screen.getByLabelText('空箱子预览')).toBeInTheDocument();
    expect(screen.getByText('空网格')).toBeInTheDocument();
  });

  it('无提示时可只渲染骨架并就自定义最小高度', () => {
    const { container } = renderWithApp(
      <LayoutSkeleton minHeight={360}>
        <SkeletonLine width="80%" />
      </LayoutSkeleton>
    );
    const root = container.querySelector('[data-layout-skeleton]');
    expect(root?.getAttribute('style')).toContain('min-height: 360px');
  });

  it('可在无 ChipsProvider 的环境直接渲染', () => {
    render(<LayoutSkeleton>骨架</LayoutSkeleton>);
    expect(screen.getByText('骨架')).toBeInTheDocument();
  });
});
