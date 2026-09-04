import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { globalEventEmitter } from '../core/event-emitter';
import { EditorSessionStore } from './session-store';

const EditorRuntimeContext = createContext<EditorSessionStore | null>(null);

export function EditorRuntimeProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<EditorSessionStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new EditorSessionStore();
  }

  const store = storeRef.current;

  useEffect(() => {
    const closedSubscriptionId = globalEventEmitter.on<{ card?: { id?: string } }>('card:closed', (payload) => {
      const cardId = payload?.card?.id;
      if (!cardId) {
        return;
      }

      store.clearCard(cardId);
    });

    const resetSubscriptionId = globalEventEmitter.on('card:reset', () => {
      store.clear();
    });

    return () => {
      globalEventEmitter.off('card:closed', closedSubscriptionId);
      globalEventEmitter.off('card:reset', resetSubscriptionId);
    };
  }, [store]);

  const value = useMemo(() => store, [store]);

  return (
    <EditorRuntimeContext.Provider value={value}>
      {children}
    </EditorRuntimeContext.Provider>
  );
}

export function useEditorRuntime(): EditorSessionStore {
  const store = useContext(EditorRuntimeContext);
  if (!store) {
    throw new Error('useEditorRuntime must be used within an EditorRuntimeProvider');
  }
  return store;
}

