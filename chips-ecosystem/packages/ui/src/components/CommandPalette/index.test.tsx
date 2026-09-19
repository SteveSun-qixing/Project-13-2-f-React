import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createMockBridge,
  makeCommandView,
  renderWithApp,
  renderWithCommands,
} from '../../../tests/helpers/harness';
import type { IMockBridge } from '../../../tests/helpers/harness';
import { CommandPalette } from './index';

function listOf(bridge: IMockBridge, views: readonly unknown[]): void {
  bridge.handle('command:list', () => ({ views }));
}

function dispatchPaletteShortcut(): void {
  fireEvent.keyDown(window, {
    key: 'p',
    code: 'KeyP',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
}

describe('CommandPalette 非受控模式', () => {
  it('默认快捷键打开面板并列出可见命令分组', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({
        definition: { id: 'app:open', title: '打开卡片', group: '文件' },
      }),
      makeCommandView({ definition: { id: 'app:exit', title: '退出', group: '文件' } }),
      makeCommandView({ definition: { id: 'app:about', title: '关于' } }),
    ]);

    renderWithCommands(<CommandPalette />, bridge.port);
    expect(screen.queryByRole('dialog')).toBeNull();

    dispatchPaletteShortcut();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('打开卡片')).toBeInTheDocument();
    expect(screen.getByText('文件')).toBeInTheDocument();
    expect(screen.getByText('常规')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('输入搜索匹配标题、说明与关键词（大小写不敏感）', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } }),
      makeCommandView({
        definition: {
          id: 'app:export',
          title: '导出图片',
          description: '生成 IconSet',
          keywords: ['ICO'],
        },
      }),
    ]);

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    const input = await screen.findByRole('textbox', { name: '搜索命令' });

    fireEvent.change(input, { target: { value: '导出' } });
    expect(screen.getByText('导出图片')).toBeInTheDocument();
    expect(screen.queryByText('打开卡片')).toBeNull();

    fireEvent.change(input, { target: { value: 'iconset' } });
    expect(screen.getByText('导出图片')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ico' } });
    expect(screen.getByText('导出图片')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '不存在的命令' } });
    expect(screen.getByText('没有匹配的命令')).toBeInTheDocument();
  });

  it('禁用命令可见但不可触发并展示原因', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({
        definition: { id: 'app:save', title: '保存' },
        state: { enabled: false, reason: '当前没有打开的文档' },
      }),
    ]);

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    const button = await screen.findByRole('button', { name: '保存' });
    expect(button).toBeDisabled();
    expect(screen.getByText('当前没有打开的文档')).toBeInTheDocument();
    fireEvent.click(button);
    expect(bridge.calls.filter((call) => call.capabilityId === 'command:invoke')).toHaveLength(0);
  });

  it('点击命令以 palette 来源派发并关闭面板', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } })]);
    bridge.handle('command:invoke', () => ({
      invocationId: '01H',
      commandId: 'app:open',
      target: 'ui',
      status: 'dispatched',
    }));
    const onClose = vi.fn();

    renderWithCommands(<CommandPalette onClose={onClose} />, bridge.port);
    dispatchPaletteShortcut();
    fireEvent.click(await screen.findByRole('button', { name: '打开卡片' }));

    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        capabilityId: 'command:invoke',
        input: { commandId: 'app:open', source: 'palette' },
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('回车触发首条可执行命令，Escape 关闭面板', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({
        definition: { id: 'app:disabled', title: '禁用命令' },
        state: { enabled: false, reason: '不可用' },
      }),
      makeCommandView({ definition: { id: 'app:enabled', title: '可用命令' } }),
    ]);
    bridge.handle('command:invoke', () => ({
      invocationId: '01H',
      commandId: 'app:enabled',
      target: 'ui',
      status: 'dispatched',
    }));

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    const input = await screen.findByRole('textbox', { name: '搜索命令' });

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        capabilityId: 'command:invoke',
        input: { commandId: 'app:enabled', source: 'palette' },
      });
    });

    dispatchPaletteShortcut();
    fireEvent.keyDown(await screen.findByRole('textbox', { name: '搜索命令' }), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('IME 组合中的快捷键与可编辑上下文中的快捷键不打开面板', () => {
    const bridge = createMockBridge();
    listOf(bridge, []);
    renderWithCommands(<CommandPalette />, bridge.port);

    const composing = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(composing, 'isComposing', { value: true });
    fireEvent(window, composing);
    expect(screen.queryByRole('dialog')).toBeNull();

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'p', code: 'KeyP', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    input.remove();
  });

  it('列表读取失败时展示错误态并可重试', async () => {
    const bridge = createMockBridge();
    let fail = true;
    bridge.handle('command:list', () => {
      if (fail) {
        throw Object.assign(new Error('读取命令列表失败，请重试'), { code: 'BRIDGE_TIMEOUT' });
      }
      return { views: [makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } })] };
    });

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    expect(await screen.findByText('读取命令列表失败，请重试')).toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('打开卡片')).toBeInTheDocument();
  });
});

describe('CommandPalette 受控模式与参数采集', () => {
  it('受控开关：不响应快捷键，只按 open 属性渲染', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } })]);
    const onClose = vi.fn();

    const { rerender } = renderWithCommands(
      <CommandPalette open={false} onClose={onClose} />,
      bridge.port
    );
    dispatchPaletteShortcut();
    expect(screen.queryByRole('dialog')).toBeNull();

    rerender(<CommandPalette open onClose={onClose} />);
    expect(await screen.findByText('打开卡片')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('textbox', { name: '搜索命令' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('参数型命令先采集参数再调用，可选参数缺省不写入', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({
        definition: {
          id: 'app:export',
          title: '导出图片',
          paramsSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['source'],
            properties: {
              source: { type: 'string', title: '来源路径' },
              overwrite: { type: 'boolean', title: '覆盖' },
            },
          },
        },
      }),
    ]);
    bridge.handle('command:invoke', () => ({
      invocationId: '01H',
      commandId: 'app:export',
      target: 'ui',
      status: 'dispatched',
    }));

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    fireEvent.click(await screen.findByRole('button', { name: '导出图片' }));

    const sourceInput = await screen.findByRole('textbox', { name: '来源路径' });
    fireEvent.click(screen.getByRole('button', { name: '执行' }));
    expect(await screen.findByText('来源路径为必填项')).toBeInTheDocument();
    expect(bridge.calls.filter((call) => call.capabilityId === 'command:invoke')).toHaveLength(0);

    fireEvent.change(sourceInput, { target: { value: 'a.card' } });
    fireEvent.click(screen.getByRole('button', { name: '执行' }));
    await waitFor(() => {
      expect(bridge.calls).toContainEqual({
        capabilityId: 'command:invoke',
        input: {
          commandId: 'app:export',
          source: 'palette',
          payload: { source: 'a.card', overwrite: false },
        },
      });
    });
  });

  it('参数表单可返回命令列表', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [
      makeCommandView({
        definition: {
          id: 'app:export',
          title: '导出图片',
          paramsSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['source'],
            properties: { source: { type: 'string', title: '来源路径' } },
          },
        },
      }),
    ]);

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    fireEvent.click(await screen.findByRole('button', { name: '导出图片' }));
    expect(await screen.findByRole('textbox', { name: '来源路径' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(await screen.findByRole('button', { name: '导出图片' })).toBeInTheDocument();
  });

  it('派发失败时保留面板并给出简体中文提示', async () => {
    const bridge = createMockBridge();
    listOf(bridge, [makeCommandView({ definition: { id: 'app:open', title: '打开卡片' } })]);
    bridge.handle('command:invoke', () => {
      throw Object.assign(new Error('当前没有打开的文档'), { code: 'COMMAND_STATE_INVALID' });
    });

    renderWithCommands(<CommandPalette />, bridge.port);
    dispatchPaletteShortcut();
    fireEvent.click(await screen.findByRole('button', { name: '打开卡片' }));
    expect(await screen.findByText('当前没有打开的文档')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('自定义快捷键与占位文案生效', async () => {
    const bridge = createMockBridge();
    listOf(bridge, []);
    renderWithCommands(
      <CommandPalette
        paletteShortcut="CommandOrControl+K"
        placeholder="搜索动作…"
        emptyText="无结果"
      />,
      bridge.port
    );

    fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true });
    expect(await screen.findByPlaceholderText('搜索动作…')).toBeInTheDocument();
    expect(screen.getByText('无结果')).toBeInTheDocument();
  });
});

describe('CommandPalette 越界使用', () => {
  it('未挂载 CommandProvider 时抛出简体中文错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderWithApp(<CommandPalette />)).toThrow(
      'useCommandRuntime 必须在 CommandProvider 内使用。'
    );
    spy.mockRestore();
  });
});
