import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { SettingsRow } from './index';

describe('SettingsRow', () => {
  it('渲染标签、说明与控件', () => {
    renderWithApp(
      <SettingsRow label="自动保存" description="每 30 秒保存一次" control={<span>开关</span>} />
    );
    expect(screen.getByText('自动保存')).toBeInTheDocument();
    expect(screen.getByText('每 30 秒保存一次')).toBeInTheDocument();
    expect(screen.getByText('开关')).toBeInTheDocument();
  });

  it('提供点击回调时可用鼠标与键盘触发', () => {
    const onClick = vi.fn();
    renderWithApp(<SettingsRow label="打开缓存目录" onClick={onClick} />);
    const row = screen.getByRole('button');
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('非交互按键不触发回调', () => {
    const onClick = vi.fn();
    renderWithApp(<SettingsRow label="打开缓存目录" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('禁用时不可点击且标记 aria-disabled', () => {
    const onClick = vi.fn();
    renderWithApp(<SettingsRow label="清理缓存" onClick={onClick} disabled />);
    const row = screen.getByText('清理缓存').closest('[aria-disabled="true"]');
    expect(row).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    if (row !== null) {
      fireEvent.click(row);
      fireEvent.keyDown(row, { key: 'Enter' });
    }
    expect(onClick).not.toHaveBeenCalled();
  });

  it('未提供点击回调时为纯展示行', () => {
    renderWithApp(<SettingsRow label="版本" control={<span>0.1.0</span>} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('可在无 ChipsProvider 的环境直接渲染（默认令牌）', () => {
    render(<SettingsRow label="独立设置行" />);
    expect(screen.getByText('独立设置行')).toBeInTheDocument();
  });
});
