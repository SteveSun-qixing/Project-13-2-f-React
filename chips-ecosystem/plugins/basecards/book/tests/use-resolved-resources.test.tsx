import type { ComponentProps, ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResolvedResourceMap } from '../src/shared/use-resolved-resources';
import { resolveResourceUrlWithRetry } from '../src/shared/utils';

/**
 * 资源解析 Hook 测试：以注入解析器驱动真实 React 挂载（jsdom + createRoot），
 * 断言归一去重、重试、释放时序与取消语义；不 mock Hook 本体。
 */

function Probe(props: {
  paths: string[];
  resolve?: (resourcePath: string) => Promise<string>;
  release?: (resourcePath: string) => Promise<void> | void;
  onResolved: (resolved: Map<string, string>) => void;
}): ReactElement {
  const resolved = useResolvedResourceMap(props.paths, props.resolve, props.release);
  props.onResolved(resolved);
  return <span data-role="probe" />;
}

function mountProbe(props: Omit<ComponentProps<typeof Probe>, 'onResolved'>): {
  container: HTMLDivElement;
  lastResolved: () => Map<string, string>;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let latest = new Map<string, string>();
  flushSync(() => {
    root.render(
      <Probe {...props} onResolved={(resolved) => {
        latest = resolved;
      }} />
    );
  });
  return {
    container,
    lastResolved: () => latest,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

async function settle(): Promise<void> {
  await vi.waitFor(() => {
    if (document.querySelector('[data-role="probe"]') === null) {
      throw new Error('probe 尚未挂载');
    }
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResolvedResourceMap', () => {
  it('无解析器时保持空映射', async () => {
    const probe = mountProbe({ paths: ['covers/a.jpg'] });
    await settle();

    expect(probe.lastResolved().size).toBe(0);
    probe.unmount();
  });

  it('归一路径并去重后逐项解析', async () => {
    const resolve = vi.fn((resourcePath: string) => Promise.resolve(`file:///pkg/${resourcePath}`));
    const probe = mountProbe({
      paths: ['./covers/a.jpg', 'covers/a.jpg', 'covers/b.jpg', '', '../escape.jpg'],
      resolve,
    });
    await settle();

    expect([...probe.lastResolved().keys()].sort()).toEqual(['covers/a.jpg', 'covers/b.jpg']);
    expect(probe.lastResolved().get('covers/a.jpg')).toBe('file:///pkg/covers/a.jpg');
    probe.unmount();
  });

  it('解析失败且重试耗尽时跳过该项，不进入映射', async () => {
    let attempts = 0;
    const resolve = vi.fn((resourcePath: string) => {
      if (resourcePath === 'covers/bad.jpg') {
        attempts += 1;
        return Promise.reject(new Error('resolve failed'));
      }
      return Promise.resolve(`file:///pkg/${resourcePath}`);
    });
    const probe = mountProbe({
      paths: ['covers/good.jpg', 'covers/bad.jpg'],
      resolve,
    });
    // 映射在全部路径处理完（含坏项重试耗尽）后一次性落账，等待其到达。
    await vi.waitFor(
      () => {
        expect(probe.lastResolved().size).toBeGreaterThan(0);
      },
      { timeout: 2000 }
    );

    expect(probe.lastResolved().has('covers/good.jpg')).toBe(true);
    expect(probe.lastResolved().has('covers/bad.jpg')).toBe(false);
    expect(attempts).toBeGreaterThanOrEqual(2);
    probe.unmount();
  });

  it('卸载时只释放已成功解析的资源', async () => {
    const release = vi.fn();
    const resolve = vi.fn((resourcePath: string) => {
      if (resourcePath === 'covers/fail.jpg') {
        return Promise.reject(new Error('resolve failed'));
      }
      return Promise.resolve(`file:///pkg/${resourcePath}`);
    });
    const probe = mountProbe({ paths: ['covers/ok.jpg', 'covers/fail.jpg'], resolve, release });
    await settle();

    probe.unmount();

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('covers/ok.jpg');
  });

  it('路径变更时释放上一组已解析资源', async () => {
    const release = vi.fn();
    const resolve = vi.fn((resourcePath: string) => Promise.resolve(`file:///pkg/${resourcePath}`));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const render = (paths: string[]): void => {
      flushSync(() => {
        root.render(
          <Probe paths={paths} resolve={resolve} release={release} onResolved={() => undefined} />
        );
      });
    };

    render(['covers/first.jpg']);
    await settle();
    render(['covers/second.jpg']);
    await settle();

    expect(release).toHaveBeenCalledWith('covers/first.jpg');
    root.unmount();
    container.remove();
  });

  it('resolveResourceUrlWithRetry 重试后成功返回', async () => {
    let attempts = 0;
    const resolved = await resolveResourceUrlWithRetry(() => {
      attempts += 1;
      if (attempts < 3) {
        return Promise.reject(new Error('flaky'));
      }
      return Promise.resolve('file:///pkg/ok.jpg');
    }, 'covers/ok.jpg', 3, 1);

    expect(resolved).toBe('file:///pkg/ok.jpg');
    expect(attempts).toBe(3);
  });

  it('resolveResourceUrlWithRetry 重试耗尽后抛出最后一次错误', async () => {
    const attempts = vi.fn();
    await expect(
      resolveResourceUrlWithRetry(() => {
        attempts();
        return Promise.reject(new Error('always fails'));
      }, 'covers/ok.jpg', 2, 1)
    ).rejects.toThrow('always fails');
    expect(attempts).toHaveBeenCalledTimes(2);
  });
});
