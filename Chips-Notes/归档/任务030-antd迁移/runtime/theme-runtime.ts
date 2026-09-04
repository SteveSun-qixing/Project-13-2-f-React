import type { ChipsThemeState, ThemeEventSource } from '@chips/component-library';
import type { Client } from 'chips-sdk';

export interface ThemeRuntimeState {
  themeId: string;
  version: string;
}

export const DEFAULT_THEME_RUNTIME_STATE: ChipsThemeState = {
  themeId: 'chips-official.default-theme',
  version: '0',
};

export function createThemeRuntimeEventSource(client: Client): ThemeEventSource {
  return {
    subscribe(eventName, handler) {
      return client.events.on(eventName, handler);
    },
  };
}

export async function readCurrentThemeRuntimeState(client: Client): Promise<ThemeRuntimeState> {
  const theme = await client.theme.getCurrent();

  return {
    themeId: theme.themeId,
    version: theme.version ?? DEFAULT_THEME_RUNTIME_STATE.version,
  };
}
