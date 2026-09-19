import { render, screen } from '@testing-library/react';
import { DatePicker, Pagination } from 'antd';
import { describe, expect, it } from 'vitest';

describe('上游默认 locale 已固定为简体中文（补丁栈生效证据）', () => {
  it('未安装主题根时日期组件文案仍为简体中文', () => {
    render(<DatePicker />);
    expect(screen.getByPlaceholderText('请选择日期')).toBeInTheDocument();
  });

  it('未安装主题根时分页组件文案仍为简体中文', () => {
    const { container } = render(<Pagination total={50} showQuickJumper showSizeChanger />);
    expect(container.textContent).toContain('跳至');
  });

  it('日期面板的星期与快捷文案为简体中文（dayjs 语言包已登记）', async () => {
    render(<DatePicker open />);

    expect(await screen.findByText('今天')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择月份' })).toBeInTheDocument();
    expect(screen.getAllByText('一').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '上个月' })).toBeInTheDocument();
  });
});
