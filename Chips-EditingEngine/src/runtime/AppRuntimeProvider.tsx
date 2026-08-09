import React, { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { Client } from 'chips-sdk';
import { formatMessage } from '../lib/messages';
import { getEditingEngineClient } from './chips-client';
import { readLaunchContext, type EditingEngineLaunchSnapshot } from './launch-context';

export interface AppRuntimeContextValue {
  client: Client;
  launch: EditingEngineLaunchSnapshot;
  t(key: string, params?: Record<string, string | number>): string;
}

const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null);

export function useAppRuntime(): AppRuntimeContextValue {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error('useAppRuntime must be used within AppRuntimeProvider');
  }

  return runtime;
}

export interface AppRuntimeProviderProps {
  children: ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps) {
  const client = useMemo(() => getEditingEngineClient(), []);
  const launch = useMemo(() => readLaunchContext(client), [client]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return formatMessage(key, params);
  }, []);

  const contextValue = useMemo<AppRuntimeContextValue>(() => ({
    client,
    launch,
    t,
  }), [client, launch, t]);

  return (
    <AppRuntimeContext.Provider value={contextValue}>
      {children}
    </AppRuntimeContext.Provider>
  );
}
