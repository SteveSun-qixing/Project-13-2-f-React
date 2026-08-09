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

export function resolveCardCoverFrameState(input: CardCoverFrameStateInput): string;
export function resolveCompositeCardWindowState(input: CompositeCardWindowStateInput): string;
