/**
 * 阅读偏好 Hook：装配归一模型（core/book-model）与弹性配置客户端（reading/config-client）。
 *
 * 挂载时读取并归一持久化偏好；更新时立即生效并落盘（config 域未就绪时落内存态，
 * 持久化形态由调用方经客户端 `mode` 呈现，不在本 Hook 内伪造成功状态）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_READER_PREFERENCES,
  normalizeReaderPreferences,
  type ReaderPreferences,
} from '../core/book-model';
import { PREFERENCES_CONFIG_KEY, type ReadingConfigClient } from '../reading/config-client';

export interface UseReaderPreferencesParams {
  configClient: ReadingConfigClient;
}

export interface UseReaderPreferencesReturn {
  /** 当前生效的阅读偏好（挂载读取完成前为默认值）。 */
  preferences: ReaderPreferences;
  /** 合并更新一批偏好字段；归一后生效并落盘。 */
  update: (patch: Partial<ReaderPreferences>) => void;
  /** 恢复全部偏好为默认值并落盘。 */
  reset: () => void;
}

function readStoredPreferences(value: unknown): Partial<ReaderPreferences> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
}

export function useReaderPreferences(
  params: UseReaderPreferencesParams
): UseReaderPreferencesReturn {
  const { configClient } = params;
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  const preferencesRef = useRef<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  preferencesRef.current = preferences;

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      const stored = await configClient.get<unknown>(PREFERENCES_CONFIG_KEY);
      if (cancelled) {
        return;
      }
      setPreferences(
        normalizeReaderPreferences({
          ...DEFAULT_READER_PREFERENCES,
          ...readStoredPreferences(stored),
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [configClient]);

  const persist = useCallback(
    (next: ReaderPreferences): void => {
      void configClient.set(PREFERENCES_CONFIG_KEY, next);
    },
    [configClient]
  );

  const update = useCallback(
    (patch: Partial<ReaderPreferences>): void => {
      const next = normalizeReaderPreferences({ ...preferencesRef.current, ...patch });
      setPreferences(next);
      persist(next);
    },
    [persist]
  );

  const reset = useCallback((): void => {
    setPreferences(DEFAULT_READER_PREFERENCES);
    persist(DEFAULT_READER_PREFERENCES);
  }, [persist]);

  return { preferences, update, reset };
}
