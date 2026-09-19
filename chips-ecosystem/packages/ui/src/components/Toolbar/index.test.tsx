import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ICommandView } from '../../command/contract';
import {
  createMockBridge,
  makeCommandView,
  renderWithApp,
  renderWithCommands,
} from '../../../tests/helpers/harness';
import { Toolbar } from './index';

const MAIN_TOOLBAR = 'doc-viewer-main';

function viewFor(options: {
  readonly id: string;
  readonly title: string;
  readonly iconUri?: string | null;
  readonly enabled?: boolean;
  readonly reason?: string;
  readonly order?: number;
  readonly toolbarId?: string;
  readonly visible?: boolean;
  readonly target?: 'platform' | 'main' | 'ui';
}): ICommandView {
  return makeCommandView({
    definition: {
      id: options.id,
      title: options.title,
      toolbars: [
        {
          toolbarId: options.toolbarId ?? MAIN_TOOLBAR,
          ...(options.order === undefined ? {} : { order: options.order }),
        },
      ],
    },
    iconUri: options.iconUri ?? null,
    target: options.target ?? 'ui',
    state: {
      visible: options.visible ?? true,
      enabled: options.enabled ?? true,
      checked: false,
      ...(options.reason === undefined ? {} : { reason: options.reason }),
    },
  });
}

describe('Toolbar（契约 §5.1、§5.4）', () => {
  it('按 toolbarId 过滤并按 order 排序，图标缺失时退化为文字按钮', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [
        viewFor({ id: 'app:second', title: '第二个', order: 20 }),
        viewFor({ id: 'app:first', title: '第一个', order: 10 }),
        viewFor({ id: 'app:other', title: '其他工具栏', toolbarId: 'other-toolbar' }),
        viewFor({ id: 'app:no-placement', title: '未放置', toolbarId: 'other-toolbar' }),
      ],
    }));

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.textContent).toBe('第一个');
    expect(buttons[1]?.textContent).toBe('第二个');
    expect(screen.queryByText('其他工具栏')).toBeNull();
  });

  it('声明图标的命令渲染图标按钮并保留无障碍名称', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [
        viewFor({
          id: 'app:open',
          title: '打开卡片',
          iconUri: 'chips-resource://plugin/assets/icons/open.svg',
        }),
      ],
    }));

    const { container } = renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '打开卡片' })).toBeInTheDocument();
    });
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'chips-resource://plugin/assets/icons/open.svg'
    );
  });

  it('enabled=false 渲染为禁用并展示原因，点击不派发', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [
        viewFor({ id: 'app:save', title: '保存', enabled: false, reason: '当前没有打开的文档' }),
      ],
    }));

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    const button = await screen.findByRole('button', { name: '保存' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(bridge.calls.filter((call) => call.capabilityId === 'command:invoke')).toHaveLength(0);
  });

  it('visible=false 的命令不渲染', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [viewFor({ id: 'app:hidden', title: '隐藏命令', visible: false })],
    }));

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    await waitFor(() => {
      expect(bridge.calls.some((call) => call.capabilityId === 'command:list')).toBe(true);
    });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('点击经 command:invoke 派发且来源为 toolbar', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [viewFor({ id: 'app:open', title: '打开', iconUri: null })],
    }));
    bridge.handle('command:invoke', () => ({
      invocationId: '01H',
      commandId: 'app:open',
      target: 'ui',
      status: 'dispatched',
    }));

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    fireEvent.click(await screen.findByRole('button', { name: '打开' }));
    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        capabilityId: 'command:invoke',
        input: { commandId: 'app:open', source: 'toolbar' },
      });
    });
  });

  it('派发失败时给出简体中文提示', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({
      views: [viewFor({ id: 'app:open', title: '打开' })],
    }));
    bridge.handle('command:invoke', () => {
      throw Object.assign(new Error('命令不存在'), { code: 'COMMAND_NOT_FOUND' });
    });

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    fireEvent.click(await screen.findByRole('button', { name: '打开' }));
    expect(await screen.findByText('命令不存在')).toBeInTheDocument();
  });

  it('列表读取失败时有误提示', async () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => {
      throw new Error('读取命令列表失败，请重试');
    });

    renderWithCommands(<Toolbar toolbarId={MAIN_TOOLBAR} />, bridge.port);
    expect(await screen.findByText('读取命令列表失败，请重试')).toBeInTheDocument();
  });

  it('渲染附加自定义控件', () => {
    const bridge = createMockBridge();
    bridge.handle('command:list', () => ({ views: [] }));
    renderWithCommands(
      <Toolbar toolbarId={MAIN_TOOLBAR}>
        <span data-testid="extra">缩放 100%</span>
      </Toolbar>,
      bridge.port
    );
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });

  it('未挂载 CommandProvider 时抛出简体中文错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderWithApp(<Toolbar toolbarId={MAIN_TOOLBAR} />)).toThrow(
      'useCommandRuntime 必须在 CommandProvider 内使用。'
    );
    spy.mockRestore();
  });
});
