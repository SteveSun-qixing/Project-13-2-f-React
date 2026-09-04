import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type EditorSelectionTarget =
  | {
      kind: 'card';
      cardId: string;
      baseCardId: string | null;
    }
  | {
      kind: 'box';
      boxId: string;
    }
  | null;

interface EditorSelectionContextValue {
  target: EditorSelectionTarget;
  selectCard: (cardId: string, baseCardId?: string | null) => void;
  selectBox: (boxId: string) => void;
  clearSelection: () => void;
}

const DEFAULT_CONTEXT_VALUE: EditorSelectionContextValue = {
  target: null,
  selectCard: () => undefined,
  selectBox: () => undefined,
  clearSelection: () => undefined,
};

const EditorSelectionContext = createContext<EditorSelectionContextValue>(DEFAULT_CONTEXT_VALUE);

export function EditorSelectionProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorSelectionTarget>(null);

  const selectCard = useCallback((cardId: string, baseCardId: string | null = null) => {
    setTarget({
      kind: 'card',
      cardId,
      baseCardId,
    });
  }, []);

  const selectBox = useCallback((boxId: string) => {
    setTarget({
      kind: 'box',
      boxId,
    });
  }, []);

  const clearSelection = useCallback(() => {
    setTarget(null);
  }, []);

  const value = useMemo<EditorSelectionContextValue>(() => ({
    target,
    selectCard,
    selectBox,
    clearSelection,
  }), [clearSelection, selectBox, selectCard, target]);

  return (
    <EditorSelectionContext.Provider value={value}>
      {children}
    </EditorSelectionContext.Provider>
  );
}

export function useEditorSelection() {
  return useContext(EditorSelectionContext);
}
