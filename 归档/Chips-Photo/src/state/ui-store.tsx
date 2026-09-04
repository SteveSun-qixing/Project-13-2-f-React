import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DialogId =
  | "new-image"
  | "open-url"
  | "image-size"
  | "resize-image"
  | "rotate-image"
  | "trim-image"
  | "translate-layer"
  | "layer-details"
  | "layer-composition"
  | "effect"
  | "effects-browser"
  | "shape-picker"
  | "guides"
  | "image-info"
  | "histogram"
  | "palette"
  | "shortcuts"
  | "about"
  | "confirm-unsaved";

export interface DialogState {
  id: DialogId;
  payload?: Record<string, unknown>;
}

export interface DialogApi {
  openDialogs: DialogState[];
  openDialog(id: DialogId, payload?: Record<string, unknown>): void;
  closeDialog(id: DialogId): void;
  isDialogOpen(id: DialogId): boolean;
}

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [openDialogs, setOpenDialogs] = useState<DialogState[]>([]);

  const openDialog = useCallback((id: DialogId, payload?: Record<string, unknown>) => {
    setOpenDialogs((previous) => {
      if (previous.some((dialog) => dialog.id === id)) {
        return previous.map((dialog) =>
          dialog.id === id ? { id, payload: payload ?? dialog.payload } : dialog,
        );
      }
      return [...previous, { id, payload }];
    });
  }, []);

  const closeDialog = useCallback((id: DialogId) => {
    setOpenDialogs((previous) => previous.filter((dialog) => dialog.id !== id));
  }, []);

  const isDialogOpen = useCallback(
    (id: DialogId) => openDialogs.some((dialog) => dialog.id === id),
    [openDialogs],
  );

  const value = useMemo<DialogApi>(
    () => ({ openDialogs, openDialog, closeDialog, isDialogOpen }),
    [openDialogs, openDialog, closeDialog, isDialogOpen],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function useDialogs(): DialogApi {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialogs 必须在 DialogProvider 内使用");
  }
  return context;
}

export function hasOpenAntdDialog(): boolean {
  return typeof document !== "undefined" && document.querySelector(".ant-modal-wrap") !== null;
}
