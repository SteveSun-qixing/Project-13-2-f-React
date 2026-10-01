import { useCallback, useEffect, useRef, useState } from 'react';
import { findSetting } from '../domain/settings/catalog';
import { describeConfigError, getPreferenceConfigGateway } from '../domain/settings/configGateway';
import {
  createConfigSettingsStore,
  createSessionSettingsStore,
  type ConfigSettingsStore,
  type SettingsPreferenceStore,
  type SettingsSnapshot,
} from '../domain/settings/preferenceStore';

/** 偏好运行时阶段：读取中 → 配置域持久化；通道不可用降级会话内存。 */
export type PreferenceRuntimePhase = 'loading' | 'config' | 'degraded';

/** 失败通知：携带归一错误码与通道消息（界面按码分支呈现，不吞错）。 */
export interface PreferenceFailureNotice {
  readonly code: string;
  readonly message: string;
}

/** 写入失败：定位到具体偏好键的行内失败面。 */
export interface PreferenceWriteError extends PreferenceFailureNotice {
  readonly key: string;
}

/** 通道类错误码：持久化通道整体不可用，按降级口径收敛会话内存（§8.2 如实呈现）。 */
const CHANNEL_LOSS_CODES: ReadonlySet<string> = new Set([
  'SDK_BRIDGE_UNAVAILABLE',
  'BRIDGE_CAPABILITY_NOT_FOUND',
  'SETTINGS_GATEWAY_ERROR',
  'SETTINGS_SNAPSHOT_RECEIPT_INVALID',
]);

/** `usePreferenceRuntime` 选项。 */
export interface UsePreferenceRuntimeOptions {
  /** 成功类反馈出口（顶部浮层短提示；失败类反馈由界面行内呈现）。 */
  readonly onNotify: (text: string) => void;
}

/** `usePreferenceRuntime` 返回值（属性式函数成员，回调全部稳定，组合根可安全装配命令动作）。 */
export interface UsePreferenceRuntimeResult {
  readonly phase: PreferenceRuntimePhase;
  /** 当前投影快照（读取完成前为 `null`）。 */
  readonly snapshot: SettingsSnapshot | null;
  /** 写臂/恢复默认在途的键集合（界面据此锁定控件，回执驱动不乐观翻面）。 */
  readonly busyKeys: ReadonlySet<string>;
  /** 写臂失败面（定位键 + 错误码 + 通道消息；下一次动作或重读时清空）。 */
  readonly writeError: PreferenceWriteError | null;
  /** 降级通知（持久化通道不可用；如实呈现，不伪造持久化成功）。 */
  readonly degradeNotice: PreferenceFailureNotice | null;
  /** 重新读取偏好快照（`settings:refresh-view` 命令出口；重试配置域通道）。 */
  readonly reload: () => void;
  /** 写入偏好（回执驱动：回执后经快照重读翻正界面并给出持久化反馈）。 */
  readonly writeKey: (key: string, value: unknown) => void;
  /** 恢复单项默认。 */
  readonly resetKey: (key: string) => void;
  /** 一次调用恢复一组键的默认（分组「恢复本组默认」出口；`groupName` 供如实反馈）。 */
  readonly resetKeys: (keys: readonly string[], groupName?: string) => void;
}

/**
 * 偏好运行时（工单066 翻正第一批应用侧落点）。
 *
 * 挂载即读初值（`config:snapshot`）→ 成功进入配置域阶段并订阅 `config:changed`
 * （多窗口一致性）；通道不可用按降级口径收敛会话内存并携带降级通知。写臂按回执
 * 驱动：控件锁定 → `config:set` 回执 → 快照重读 → 界面翻正；配置域错误码行内
 * 呈现不吞错，通道类错误降级会话内存并让本次操作在会话内即时生效。
 */
export function usePreferenceRuntime(options: UsePreferenceRuntimeOptions): UsePreferenceRuntimeResult {
  const [phase, setPhase] = useState<PreferenceRuntimePhase>('loading');
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const [writeError, setWriteError] = useState<PreferenceWriteError | null>(null);
  const [degradeNotice, setDegradeNotice] = useState<PreferenceFailureNotice | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const configStoreRef = useRef<ConfigSettingsStore | null>(null);
  const sessionStoreRef = useRef<SettingsPreferenceStore | null>(null);
  const subscriptionRef = useRef<{ dispose(): void } | null>(null);
  const phaseRef = useRef<PreferenceRuntimePhase>('loading');
  const notifyRef = useRef(options.onNotify);
  notifyRef.current = options.onNotify;

  const setPhaseSafe = useCallback((next: PreferenceRuntimePhase): void => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const markBusy = useCallback((keys: readonly string[], busy: boolean): void => {
    setBusyKeys((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (busy) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  /** 降级会话内存：以降级横幅如实呈现，不伪造持久化成功。 */
  const degradeToSession = useCallback((notice: PreferenceFailureNotice): void => {
    const store = createSessionSettingsStore();
    sessionStoreRef.current = store;
    subscriptionRef.current?.dispose();
    subscriptionRef.current = null;
    configStoreRef.current = null;
    setSnapshot(store.snapshot());
    setDegradeNotice(notice);
    setWriteError(null);
    setPhaseSafe('degraded');
  }, [setPhaseSafe]);

  /**
   * 配置域动作护跑：控件锁定 → 回执 → 投影翻正 → 成功反馈；配置域错误码行内呈现，
   * 通道类错误降级会话内存（`onChannelLoss` 在降级后的会话存储上落实本次操作意图并
   * 如实反馈）。`successToast` 为回执到达后的如实反馈文案。
   */
  const runGuarded = useCallback(
    (
      keys: readonly string[],
      successToast: string,
      action: (store: ConfigSettingsStore) => Promise<SettingsSnapshot>,
      onChannelLoss?: (store: SettingsPreferenceStore) => void,
    ): void => {
      const store = configStoreRef.current;
      if (store === null) {
        return;
      }
      setWriteError(null);
      markBusy(keys, true);
      void (async (): Promise<void> => {
        try {
          const next = await action(store);
          setSnapshot(next);
          notifyRef.current(successToast);
        } catch (error: unknown) {
          const { code, message } = describeConfigError(error);
          if (CHANNEL_LOSS_CODES.has(code)) {
            degradeToSession({ code, message });
            const session = sessionStoreRef.current;
            if (session !== null && onChannelLoss !== undefined) {
              onChannelLoss(session);
            }
          } else {
            setWriteError({ key: keys[0] ?? '', code, message });
          }
        } finally {
          markBusy(keys, false);
        }
      })();
    },
    [degradeToSession, markBusy],
  );

  useEffect(() => {
    let cancelled = false;
    setPhaseSafe('loading');
    setWriteError(null);
    setDegradeNotice(null);
    const store = createConfigSettingsStore(getPreferenceConfigGateway());
    configStoreRef.current = store;
    void (async (): Promise<void> => {
      try {
        const initial = await store.load();
        if (cancelled) {
          return;
        }
        setSnapshot(initial);
        setPhaseSafe('config');
        subscriptionRef.current?.dispose();
        subscriptionRef.current = store.subscribe((next) => {
          if (!cancelled) {
            setSnapshot(next);
          }
        });
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        degradeToSession(describeConfigError(error));
      }
    })();
    return (): void => {
      cancelled = true;
      subscriptionRef.current?.dispose();
      subscriptionRef.current = null;
      configStoreRef.current = null;
    };
  }, [reloadToken, degradeToSession, setPhaseSafe]);

  const writeKey = useCallback(
    (key: string, value: unknown): void => {
      const label = findSetting(key)?.label ?? key;
      if (phaseRef.current === 'degraded') {
        const store = sessionStoreRef.current;
        if (store === null) {
          return;
        }
        store.write(key, value);
        setSnapshot(store.snapshot());
        notifyRef.current(`「${label}」已更新（会话内存，未持久化）`);
        return;
      }
      runGuarded(
        [key],
        `「${label}」已更新并持久化`,
        (configStore) => configStore.write(key, value),
        (session) => {
          session.write(key, value);
          setSnapshot(session.snapshot());
          notifyRef.current(`「${label}」已更新（会话内存，未持久化）`);
        },
      );
    },
    [runGuarded],
  );

  const resetKey = useCallback(
    (key: string): void => {
      const label = findSetting(key)?.label ?? key;
      if (phaseRef.current === 'degraded') {
        const store = sessionStoreRef.current;
        if (store === null) {
          return;
        }
        store.reset(key);
        setSnapshot(store.snapshot());
        notifyRef.current(`「${label}」已恢复默认（会话内存）`);
        return;
      }
      runGuarded(
        [key],
        `「${label}」已恢复默认`,
        (configStore) => configStore.reset(key),
        (session) => {
          session.reset(key);
          setSnapshot(session.snapshot());
          notifyRef.current(`「${label}」已恢复默认（会话内存）`);
        },
      );
    },
    [runGuarded],
  );

  const resetKeys = useCallback(
    (keys: readonly string[], groupName?: string): void => {
      if (keys.length === 0) {
        return;
      }
      const successToast =
        groupName === undefined
          ? `「${findSetting(keys[0] ?? '')?.label ?? keys[0] ?? ''}」已恢复默认`
          : `「${groupName}」分组已恢复默认`;
      const degradedToast = `${successToast}（会话内存）`;
      if (phaseRef.current === 'degraded') {
        const store = sessionStoreRef.current;
        if (store === null) {
          return;
        }
        store.resetKeys(keys);
        setSnapshot(store.snapshot());
        notifyRef.current(degradedToast);
        return;
      }
      runGuarded(
        keys,
        successToast,
        (configStore) => configStore.resetKeys(keys),
        (session) => {
          session.resetKeys(keys);
          setSnapshot(session.snapshot());
          notifyRef.current(degradedToast);
        },
      );
    },
    [runGuarded],
  );

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    phase,
    snapshot,
    busyKeys,
    writeError,
    degradeNotice,
    reload,
    writeKey,
    resetKey,
    resetKeys,
  };
}
