import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { SettingsLayout } from './index';

describe('SettingsLayout', () => {
  it('渲染标题、副标题与内容', () => {
    renderWithApp(
      <SettingsLayout title="通用" subtitle="外观与启动行为">
        <p>内容区</p>
      </SettingsLayout>
    );
    expect(screen.getByText('通用')).toBeInTheDocument();
    expect(screen.getByText('外观与启动行为')).toBeInTheDocument();
    expect(screen.getByText('内容区')).toBeInTheDocument();
  });

  it('省略标题与副标题时只渲染内容', () => {
    renderWithApp(
      <SettingsLayout>
        <p>内容区</p>
      </SettingsLayout>
    );
    expect(screen.getByText('内容区')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('按最大宽度约束内容列', () => {
    const { container } = renderWithApp(
      <SettingsLayout maxWidth={720}>
        <p>内容区</p>
      </SettingsLayout>
    );
    expect(container.firstElementChild?.getAttribute('style')).toContain('max-width: 720px');
  });

  it('可在无 ChipsProvider 的环境直接渲染（默认令牌）', () => {
    render(
      <SettingsLayout title="独立设置">
        <p>内容区</p>
      </SettingsLayout>
    );
    expect(screen.getByText('独立设置')).toBeInTheDocument();
  });
});
