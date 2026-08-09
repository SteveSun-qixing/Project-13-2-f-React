import * as React from "react";

export interface StandardError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export interface EmbeddedDocumentFrameProps {
  surfaceId?: string;
  title?: string;
  src?: string;
  srcDoc?: string;
  ratio?: string;
  loading?: boolean;
  disabled?: boolean;
  sandbox?: string;
  scope?: string;
  onActivate?: (surfaceId?: string) => void;
  onFrameReady?: (surfaceId?: string) => void;
  onFrameError?: (error: StandardError) => void;
}

export interface CardCoverFrameProps {
  cardId?: string;
  title?: string;
  coverUrl?: string;
  ratio?: string;
  loading?: boolean;
  disabled?: boolean;
  sandbox?: string;
  onOpenCard?: (cardId?: string) => void;
  onFrameReady?: (cardId?: string) => void;
  onFrameError?: (error: StandardError) => void;
}

export interface CompositeCardWindowReadyPayload {
  cardId: string;
  nodeCount: number;
}

export interface CompositeCardWindowNodeErrorPayload {
  nodeId: string;
  error: StandardError;
}

export type CompositeResizeReason =
  | "initial"
  | "ready"
  | "node-load"
  | "node-height"
  | "resize-observer";

export interface CompositeCardWindowResizePayload {
  height: number;
  nodeCount: number;
  reason: CompositeResizeReason;
}

export interface CompositeCardWindowProps {
  cardFile: string;
  frameUrl?: string;
  mode?: CompositeWindowModeValue;
  loading?: boolean;
  disabled?: boolean;
  sandbox?: string;
  allowedOrigins?: string[];
  onReady?: (payload: CompositeCardWindowReadyPayload) => void;
  onResize?: (payload: CompositeCardWindowResizePayload) => void;
  onNodeError?: (payload: CompositeCardWindowNodeErrorPayload) => void;
  onFatalError?: (error: StandardError) => void;
}

export interface CardCoverFrameStateInput {
  coverUrl?: string;
  frameStatus?: string;
  loading?: boolean;
  disabled?: boolean;
  loadError?: unknown;
}

export interface CompositeCardWindowStateInput {
  disabled?: boolean;
  fatalError?: unknown;
  nodeErrorCount?: number;
  loading?: boolean;
  phase?: string;
}

export interface CompositeFrameReadyMessage {
  type: "ready";
  cardId: string;
  nodeCount: number;
}

export interface CompositeFrameNodeErrorMessage {
  type: "node-error";
  nodeId: string;
  error: StandardError;
}

export interface CompositeFrameResizeMessage {
  type: "resize";
  height: number;
  nodeCount: number;
  reason: CompositeResizeReason;
}

export interface CompositeFrameFatalErrorMessage {
  type: "fatal-error";
  error: StandardError;
}

export type CompositeFrameMessage =
  | CompositeFrameReadyMessage
  | CompositeFrameResizeMessage
  | CompositeFrameNodeErrorMessage
  | CompositeFrameFatalErrorMessage;

export interface CardDisplayAdapter {
  resolveCoverFrame(input: {
    cardId?: string;
    cardFile?: string;
    signal?: AbortSignal;
  }): Promise<{ cardId?: string; title?: string; ratio?: string; coverUrl: string }>;
  resolveCompositeWindow(input: {
    cardFile: string;
    mode: CompositeWindowModeValue;
    signal?: AbortSignal;
  }): Promise<{ cardId?: string; frameUrl: string; nodeCount?: number }>;
}

export const CompositeWindowMode: {
  readonly VIEW: "view";
  readonly PREVIEW: "preview";
};
export type CompositeWindowModeValue = (typeof CompositeWindowMode)[keyof typeof CompositeWindowMode];

export const CardDisplayAdapterMethod: {
  readonly RESOLVE_COVER_FRAME: "resolveCoverFrame";
  readonly RESOLVE_COMPOSITE_WINDOW: "resolveCompositeWindow";
};

export const COMPOSITE_FRAME_CHANNEL: "chips.composite";
export const CompositeFrameEventType: {
  readonly READY: "ready";
  readonly RESIZE: "resize";
  readonly NODE_ERROR: "node-error";
  readonly FATAL_ERROR: "fatal-error";
};

export function EmbeddedDocumentFrame(props: EmbeddedDocumentFrameProps): React.ReactElement;
export function CardCoverFrame(props: CardCoverFrameProps): React.ReactElement;
export function CompositeCardWindow(props: CompositeCardWindowProps): React.ReactElement;
export function resolveCardCoverFrameState(input: CardCoverFrameStateInput): string;
export function resolveCompositeCardWindowState(input: CompositeCardWindowStateInput): string;
export function toStandardError(error: unknown, fallbackCode: string): StandardError;
export function parseCompositeFrameMessage(data: unknown): CompositeFrameMessage | null;
export function validateCardDisplayAdapter(adapter: CardDisplayAdapter): true;
export function loadCoverFrameData(
  adapter: CardDisplayAdapter,
  input: { cardId?: string; cardFile?: string },
  options?: { signal?: AbortSignal },
): Promise<{ cardId: string; title: string; ratio?: string; coverUrl: string }>;
export function loadCompositeWindowData(
  adapter: CardDisplayAdapter,
  input: { cardFile: string; mode?: CompositeWindowModeValue },
  options?: { signal?: AbortSignal },
): Promise<{ cardId: string; frameUrl: string; nodeCount: number }>;
export function resolveIframeSandboxPolicy(sandbox?: string): string;
export function isAllowedFrameOrigin(origin: string, allowedOrigins?: string[]): boolean;
