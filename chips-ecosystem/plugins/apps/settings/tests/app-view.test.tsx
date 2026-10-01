import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppView from '../src/ui/AppView';

/**
 * 应用壳挂载测试：jsdom 真实挂载 AppView（ChipsProvider + CommandProvider + App）。
 *
 * 偏好持久化翻正臂（工单066 第一批）：`config:*` 宿主真实现以受控假桥回放——
 * 快照初值投影、回执驱动 UI 锁（写入期间控件锁定、回执后经快照重读翻正）、
 * config:changed 订阅刷新（多窗口一致性）；宿主缺位契约：通道不可用时降级会话
 * 内存并如实呈现（不伪造持久化成功），配置域错误码行内简体中文提示不吞错。
 * antd message 通知亦带 role="alert"，偏好错误面按 data-role 精确定位。
 */

type ChipsBridgeStub = {
  request: (capabilityId: string, input?: unknown) => Promise<unknown>;
  subscribe: (eventId: string, handler: (payload: unknown) => void) => { dispose(): void };
  resource: (uri: string) => unknown;
};

/** 受控假桥舞台：按已登记能力 ID 回放宿主 config:* 语义（用户层覆盖表 + 写臂脚本）。 */
function createConfigStage(options: {
  snapshotTable?: Record<string, unknown>;
  /** config:set 脚本：commit 模拟宿主回执（表已收值），fail 模拟配置域错误拒绝。 */
  setScript?: (
    input: { key: string; value: unknown },
    commit: () => void,
    fail: (error: Error) => void,
  ) => void;
} = {}): {
  setCalls: { key: string; value: unknown }[];
  resetCalls: string[][];
  emitChange: (payload: unknown) => void;
  disposeCalls: number;
} {
  const table = new Map<string, unknown>(Object.entries(options.snapshotTable ?? {}));
  const setCalls: { key: string; value: unknown }[] = [];
  const resetCalls: string[][] = [];
  let changeHandler: ((payload: unknown) => void) | null = null;
  const stage = {
    setCalls,
    resetCalls,
    emitChange: (payload: unknown): void => {
      changeHandler?.(payload);
    },
    disposeCalls: 0,
  };
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string, input?: unknown): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      if (capabilityId === 'config:snapshot') {
        return Promise.resolve({ values: { ...Object.fromEntries(table) } });
      }
      if (capabilityId === 'config:set') {
        const record = (input ?? {}) as { key?: string; value?: unknown };
        setCalls.push({ key: record.key ?? '', value: record.value });
        return new Promise((resolve, reject) => {
          const commit = (): void => {
            // 宿主承载以完整配置键落表（config.user.json 键为完整键）；入参 key 为相对键。
            table.set(`platform.${record.key ?? ''}`, record.value);
            resolve(undefined);
          };
          const fail = (error: Error): void => {
            reject(error);
          };
          const fallbackScript = options.setScript ?? ((_input, commitState) => {
            commitState();
          });
          fallbackScript({ key: record.key ?? '', value: record.value }, commit, fail);
        });
      }
      if (capabilityId === 'config:reset') {
        const record = (input ?? {}) as { keys?: string[] };
        for (const key of record.keys ?? []) {
          table.delete(key);
        }
        resetCalls.push(record.keys ?? []);
        return Promise.resolve(undefined);
      }
      return Promise.reject(
        Object.assign(new Error(`能力未注册：${capabilityId}`), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' }),
      );
    }),
    subscribe: vi.fn((eventId: string, handler: (payload: unknown) => void): { dispose(): void } => {
      if (eventId === 'config:changed') {
        changeHandler = handler;
      }
      return {
        dispose: (): void => {
          stage.disposeCalls += 1;
        },
      };
    }),
    resource: vi.fn(() => {
      throw Object.assign(new Error('资源通道不可用'), { code: 'SDK_BRIDGE_UNAVAILABLE' });
    }),
  };
  (globalThis as { chips?: unknown }).chips = bridge;
  return stage;
}

/** 命令通道可用而配置域缺位的假桥（命令就绪 + 偏好降级双轨呈现）。 */
function installCommandOnlyChips(): void {
  const bridge: ChipsBridgeStub = {
    request: vi.fn((capabilityId: string): Promise<unknown> => {
      if (capabilityId === 'command:register' || capabilityId === 'command:unregister') {
        return Promise.resolve({});
      }
      return Promise.reject(
        Object.assign(new Error(`能力未注册：${capabilityId}`), { code: 'BRIDGE_CAPABILITY_NOT_FOUND' }),
      );
    }),
    subscribe: vi.fn(() => ({ dispose: (): void => undefined })),
    resource: vi.fn(() => {
      throw Object.assign(new Error('资源通道不可用'), { code: 'SDK_BRIDGE_UNAVAILABLE' });
    }),
  };
  (globalThis as { chips?: unknown }).chips = bridge;
}

function degradeAlert(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-role="persistence-degraded"]');
}

function writeErrorAlert(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-role="preference-error"]');
}

beforeEach(() => {
  delete (globalThis as { chips?: unknown }).chips;
});

afterEach(() => {
  cleanup();
  delete (globalThis as { chips?: unknown }).chips;
});

describe('AppView（生态设置面板壳）', () => {
  it('九类导航按注册表顺序呈现，缺省落在「外观」页', async () => {
    render(<AppView />);
    // 活动分类标题会同时出现在导航行与页头，按「至少一处」断言；偏好快照为异步读取。
    const navTexts = [
      '外观',
      '行为',
      '工作区',
      '插件治理',
      '权限',
      '快捷键',
      '文件打开方式',
      '存储缓存',
      '关于更新',
    ];
    for (const text of navTexts) {
      expect(screen.getAllByText(text).length).toBeGreaterThanOrEqual(1);
    }
    await waitFor(() => {
      expect(screen.getByText('界面密度')).toBeTruthy();
    });
  });

  it('配置持久化通道缺位时降级会话内存态并如实呈现（降级横幅 + 生效层标记）', async () => {
    render(<AppView />);
    await waitFor(() => {
      expect(degradeAlert()).not.toBeNull();
    });
    expect(degradeAlert()?.textContent).toContain('配置持久化通道不可用');
    expect(degradeAlert()?.getAttribute('role')).toBe('alert');
    expect(screen.getByText(/生效层：会话内存（未持久化）/)).toBeTruthy();
  });

  it('降级会话内存态下偏好项即时生效：切换系统通知开关写回会话存储并如实反馈', async () => {
    render(<AppView />);
    fireEvent.click(screen.getByText('行为'));
    const toggle = await screen.findByRole('switch', { name: '系统通知' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(screen.getByText(/「系统通知」已更新（会话内存，未持久化）/)).toBeTruthy();
    });
    expect(screen.getByRole('switch', { name: '系统通知' }).getAttribute('aria-checked')).toBe('false');
  });

  it('域依赖分类页呈现依赖域与落波去向，不铺设替代控件', async () => {
    render(<AppView />);
    fireEvent.click(screen.getByText('工作区'));
    await waitFor(() => {
      expect(screen.getByText('依赖域缺位说明')).toBeTruthy();
    });
    expect(
      screen.getByText(/config:get 域已随工单066 第一批翻正就位；工作区状态查询与 shell:openExternal 域仍待落波/),
    ).toBeTruthy();
    expect(screen.getByText('暂无可呈现数据')).toBeTruthy();
  });

  it('宿主命令通道缺位时收敛为命令通道异常状态行，界面照常工作', async () => {
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/命令通道异常/)).toBeTruthy();
    });
    expect(screen.getByText('界面密度')).toBeTruthy();
  });

  it('命令通道就绪而配置域缺位时：状态行翻正、偏好降级横幅如实并存', async () => {
    installCommandOnlyChips();
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText('命令注册状态：命令已就绪')).toBeTruthy();
    });
    await waitFor(() => {
      expect(degradeAlert()).not.toBeNull();
    });
    expect(screen.getByText('界面密度')).toBeTruthy();
  });
});

describe('AppView（偏好持久化翻正臂：config:* 真实现消费）', () => {
  it('持久化通道就绪：快照初值投影为界面取值，生效层如实标记用户层配置', async () => {
    createConfigStage({ snapshotTable: { 'platform.appearance.density': 'compact' } });
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getAllByText('紧凑').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText(/生效层：用户层持久化配置/)).toBeTruthy();
    expect(degradeAlert()).toBeNull();
  });

  it('回执驱动 UI 锁：写入期间控件锁定且取值不前移，config:set 回执后经重读翻正并持久化反馈', async () => {
    let commitSet: (() => void) | null = null;
    const stage = createConfigStage({
      snapshotTable: { 'platform.behavior.notifications': true },
      setScript: (_input, commit) => {
        commitSet = commit;
      },
    });
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/生效层：用户层持久化配置/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('行为'));
    const toggle = screen.getByRole('switch', { name: '系统通知' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    // 回执未到：控件锁定、取值不前移（回执驱动，不乐观翻面）。
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    commitSet!();
    await waitFor(() => {
      expect(screen.getByText(/「系统通知」已更新并持久化/)).toBeTruthy();
    });
    const settled = screen.getByRole('switch', { name: '系统通知' });
    expect(settled.getAttribute('aria-checked')).toBe('false');
    expect(settled.hasAttribute('disabled')).toBe(false);
    expect(stage.setCalls).toEqual([{ key: 'behavior.notifications', value: false }]);
  });

  it('配置域写臂失败：错误码行内简体中文提示不吞错，取值回滚不前移', async () => {
    createConfigStage({
      snapshotTable: { 'platform.behavior.notifications': true },
      setScript: (_input, _commit, fail) => {
        fail(Object.assign(new Error('落盘失败'), { code: 'CONFIG_WRITE_FAILED' }));
      },
    });
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/生效层：用户层持久化配置/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('行为'));
    fireEvent.click(screen.getByRole('switch', { name: '系统通知' }));
    await waitFor(() => {
      expect(writeErrorAlert()).not.toBeNull();
    });
    expect(writeErrorAlert()?.getAttribute('role')).toBe('alert');
    expect(writeErrorAlert()?.textContent).toContain('CONFIG_WRITE_FAILED');
    expect(writeErrorAlert()?.textContent).toContain('配置落盘失败，请重试');
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: '系统通知' }).hasAttribute('disabled')).toBe(false);
    });
    expect(screen.getByRole('switch', { name: '系统通知' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/已更新并持久化/)).toBeNull();
  });

  it('写臂通道中断：降级会话内存态继续生效，降级横幅如实呈现', async () => {
    createConfigStage({
      snapshotTable: { 'platform.behavior.notifications': true },
      setScript: (_input, _commit, fail) => {
        fail(Object.assign(new Error('窗口桥未注入'), { code: 'SDK_BRIDGE_UNAVAILABLE' }));
      },
    });
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/生效层：用户层持久化配置/)).toBeTruthy();
    });
    fireEvent.click(screen.getByText('行为'));
    fireEvent.click(screen.getByRole('switch', { name: '系统通知' }));
    await waitFor(() => {
      expect(degradeAlert()).not.toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/「系统通知」已更新（会话内存，未持久化）/)).toBeTruthy();
    });
    expect(screen.getByRole('switch', { name: '系统通知' }).getAttribute('aria-checked')).toBe('false');
  });

  it('config:changed 事件按注册表驱动界面刷新（多窗口一致性）', async () => {
    const stage = createConfigStage({ snapshotTable: { 'platform.appearance.motion': 'reduced' } });
    render(<AppView />);
    await waitFor(() => {
      expect(screen.getByText(/生效层：用户层持久化配置/)).toBeTruthy();
    });
    stage.emitChange({
      key: 'platform.appearance.density',
      layer: 'user',
      value: 'compact',
      effectiveValue: 'compact',
      isDefault: false,
      origin: 'plugin:chips.official.other',
    });
    await waitFor(() => {
      expect(screen.getAllByText('紧凑').length).toBeGreaterThanOrEqual(1);
    });
    // 注册表外键不进入界面投影。
    stage.emitChange({
      key: 'plugins.chips.official.notes.bootstrapped',
      layer: 'plugin',
      value: true,
      effectiveValue: true,
      isDefault: false,
      origin: 'plugin:chips.official.notes',
    });
    expect(writeErrorAlert()).toBeNull();
  });
});
