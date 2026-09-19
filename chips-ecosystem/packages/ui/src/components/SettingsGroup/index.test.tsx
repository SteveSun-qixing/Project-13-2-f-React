import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { SettingsGroup } from './index';
import { SettingsRow } from '../SettingsRow';

describe('SettingsGroup', () => {
  it('渲染分组标题与内容行', () => {
    renderWithApp(
      <SettingsGroup title="外观">
        <SettingsRow label="跟随系统外观" />
      </SettingsGroup>
    );
    expect(screen.getByText('外观')).toBeInTheDocument();
    expect(screen.getByText('跟随系统外观')).toBeInTheDocument();
  });

  it('省略标题时只渲染内容卡片', () => {
    const { container } = renderWithApp(
      <SettingsGroup>
        <SettingsRow label="第一行" />
        <SettingsRow label="第二行" />
      </SettingsGroup>
    );
    expect(screen.getByText('第一行')).toBeInTheDocument();
    expect(screen.getByText('第二行')).toBeInTheDocument();
    const card = container.firstElementChild;
    expect(card?.children).toHaveLength(2);
    expect(card?.children[0]?.getAttribute('style')).toBeNull();
    expect(card?.children[1]?.getAttribute('style')).toContain('border-top');
  });

  it('子元素带 key 时按 key 渲染分隔容器', () => {
    const { container } = renderWithApp(
      <SettingsGroup>
        <SettingsRow key="first" label="第一行" />
        <SettingsRow key="second" label="第二行" />
      </SettingsGroup>
    );
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('空分组渲染空卡片容器', () => {
    const { container } = renderWithApp(<SettingsGroup />);
    expect(container.firstElementChild?.children).toHaveLength(0);
  });
});
