import { createContext, useContext, useRef } from "react";
import type { ViewerTool } from "../pdf/view-config";

/**
 * 查看器能力桥：DocumentScene 在挂载时写入实现，命令系统通过引用调用。
 * 文档未打开时桥为 null，命令入口安全降级（提示或忽略）。
 */
export interface PdfViewerBridge {
  hasDocument(): boolean;
  openDocument(): Promise<void> | void;
  saveDocument(): Promise<void> | void;
  saveDocumentAs(): Promise<void> | void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
  nextPage(): void;
  prevPage(): void;
  toggleFind(): void;
  toggleSidebar(): void;
  setTool(tool: ViewerTool): void;
}

export type ViewerBridgeRef = { current: PdfViewerBridge | null };

const ViewerBridgeContext = createContext<ViewerBridgeRef | null>(null);

export function useViewerBridgeRef(): ViewerBridgeRef {
  const existing = useContext(ViewerBridgeContext);
  const ref = useRef<PdfViewerBridge | null>(null);
  return existing ?? ref;
}

export const ViewerBridgeProvider = ViewerBridgeContext.Provider;

export function useViewerBridge(): PdfViewerBridge | null {
  const ref = useContext(ViewerBridgeContext);
  return ref?.current ?? null;
}
