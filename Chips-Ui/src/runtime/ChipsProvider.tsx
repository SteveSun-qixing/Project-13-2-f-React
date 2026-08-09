import type { Client, PlatformLaunchContext } from "chips-sdk";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface ChipsContextValue {
  client: Client | null;
  launchContext: PlatformLaunchContext | null;
  ready: boolean;
}

const ChipsContext = createContext<ChipsContextValue>({
  client: null,
  launchContext: null,
  ready: false,
});

export interface ChipsProviderProps {
  client: Client | null;
  children: ReactNode;
}

export function ChipsProvider({ client, children }: ChipsProviderProps): React.ReactElement {
  const [launchContext, setLaunchContext] = useState<PlatformLaunchContext | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!client) {
      setLaunchContext(null);
      setReady(true);
      return;
    }

    try {
      setLaunchContext(client.platform.getLaunchContext());
    } catch {
      setLaunchContext(null);
    }
    setReady(true);
  }, [client]);

  const value = useMemo<ChipsContextValue>(
    () => ({ client, launchContext, ready }),
    [client, launchContext, ready],
  );

  return <ChipsContext.Provider value={value}>{children}</ChipsContext.Provider>;
}

export function useChips(): ChipsContextValue {
  return useContext(ChipsContext);
}
