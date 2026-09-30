import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import AppView from '../../src/ui/AppView';

/**
 * 应用窗口界面渲染冒烟：jsdom 下经真实 React 渲染链验证结构、命令通道诚实态与预览降级文案。
 *
 * 说明：antd 运动组件树与异步 `act` 存在定时器等待，挂载用同步 `act`，异步状态
 * （命令注册回执、预览回执）以真实宏任务时钟冲刷后断言。
 */

const containers: HTMLDivElement[] = [];
const roots: Root[] = [];

function renderView(): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(<AppView />);
  });
}

async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  act(() => undefined);
}

afterEach(() => {
  for (const root of roots.splice(0).reverse()) {
    act(() => {
      root.unmount();
    });
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

describe('应用窗口界面（jsdom 渲染冒烟）', () => {
  it('渲染工作台骨架：标题、基础设置、高级设置与实时预览', () => {
    renderView();

    const root = containers[0]!;
    expect(root.textContent).toContain('图标工坊');
    expect(root.textContent).toContain('基础设置');
    expect(root.textContent).toContain('高级设置');
    expect(root.textContent).toContain('实时预览');
    expect(root.querySelector('canvas[aria-label="图标实时预览画布"]')).toBeTruthy();

    const generateButton = root.querySelector<HTMLButtonElement>('#icon-workbench-generate');
    expect(generateButton).toBeTruthy();
    expect(generateButton?.disabled).toBe(true);
    expect(root.textContent).toContain('请先上传图片或切换到图标字体。');
  });

  it('Bridge 缺席时命令通道如实进入异常态，不阻塞工作台', async () => {
    renderView();
    await flushAsync();

    const root = containers[0]!;
    expect(root.textContent).toContain('命令通道：命令通道异常（SDK_BRIDGE_UNAVAILABLE）');
    // 工作台功能不因命令通道异常而消失。
    expect(root.textContent).toContain('基础设置');
  });

  it('窗口渲染环境无 2D 上下文时预览以失败文案诚实呈现', async () => {
    renderView();
    await flushAsync();

    expect(containers[0]!.textContent).toContain('预览生成失败。');
  });
});
