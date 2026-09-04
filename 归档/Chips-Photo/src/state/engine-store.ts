import { useContext, useMemo, useSyncExternalStore, type Context, createContext } from "react";
import { engine as engineSingleton, getEngine, type PhotoEngine } from "../engine/photo-engine";
import type { EngineSnapshot, PhotoLayer } from "../engine/types";

export type { PhotoEngine };

const EngineContext: Context<PhotoEngine | null> = createContext<PhotoEngine | null>(null);

export const EngineProvider = EngineContext.Provider;

export function useEngine(): PhotoEngine {
  const provided = useContext(EngineContext);
  return provided ?? engineSingleton;
}

export function useEngineSnapshot(): EngineSnapshot {
  const instance = useEngine();
  const subscribe = useMemo(() => instance.subscribe.bind(instance), [instance]);
  return useSyncExternalStore(subscribe, () => instance.getSnapshot());
}

export function useEngineState<T>(selector: (snapshot: EngineSnapshot) => T): T {
  const snapshot = useEngineSnapshot();
  return selector(snapshot);
}

export function useSelectedLayer(): PhotoLayer | null {
  const snapshot = useEngineSnapshot();
  const selectedId = snapshot.selectedLayerId;
  return useMemo(
    () => snapshot.layers.find((layer) => layer.id === selectedId) ?? null,
    [snapshot.layers, selectedId],
  );
}

export function useCanUndoRedo(): { canUndo: boolean; canRedo: boolean } {
  const snapshot = useEngineSnapshot();
  return useMemo(
    () => ({ canUndo: snapshot.canUndo, canRedo: snapshot.canRedo }),
    [snapshot.canUndo, snapshot.canRedo],
  );
}

export { getEngine };
