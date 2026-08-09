import React from "react";
import type { Client } from "chips-sdk";
import { getChipsClient } from "../../shared/runtime/client";
import { normalizeSettingsError, type SettingsPanelError } from "../../shared/runtime/errors";
import { createRuntimeEventSource, type RuntimeEventSource } from "../../shared/runtime/event-source";
import { formatMessage } from "../../lib/messages";

interface RuntimeContextValue {
  client: Client;
  eventSource: RuntimeEventSource;
  ready: boolean;
  runtimeError: SettingsPanelError | null;
  refreshRuntimeState: () => Promise<void>;
}

const RuntimeContext = React.createContext<RuntimeContextValue | null>(null);

export function RuntimeProvider({ children }: React.PropsWithChildren): React.ReactElement {
  const client = React.useMemo(() => getChipsClient(), []);
  const eventSource = React.useMemo(() => createRuntimeEventSource(client), [client]);
  const [ready, setReady] = React.useState(false);
  const [runtimeError, setRuntimeError] = React.useState<SettingsPanelError | null>(null);

  const refreshRuntimeState = React.useCallback(async () => {
    try {
      await client.platform.getInfo();
      setRuntimeError(null);
      setReady(true);
    } catch (error) {
      setRuntimeError(normalizeSettingsError(error, formatMessage("settingsPanel.errors.runtimeState")));
      setReady(true);
    }
  }, [client]);

  React.useEffect(() => {
    let active = true;

    void client.platform
      .getInfo()
      .then(() => {
        if (active) {
          setRuntimeError(null);
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRuntimeError(normalizeSettingsError(error, formatMessage("settingsPanel.errors.runtimeState")));
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [client]);

  const value = React.useMemo<RuntimeContextValue>(() => {
    return {
      client,
      eventSource,
      ready,
      runtimeError,
      refreshRuntimeState,
    };
  }, [client, eventSource, ready, refreshRuntimeState, runtimeError]);

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntimeContext(): RuntimeContextValue {
  const context = React.useContext(RuntimeContext);
  if (!context) {
    throw new Error("RuntimeContext is not available.");
  }
  return context;
}
