import React, { type ReactNode } from 'react';
import { AppProviders as EditingEngineStateProviders } from '../context';
import { AppRuntimeProvider } from '../runtime/AppRuntimeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRuntimeProvider>
      <EditingEngineStateProviders>
        {children}
      </EditingEngineStateProviders>
    </AppRuntimeProvider>
  );
}
