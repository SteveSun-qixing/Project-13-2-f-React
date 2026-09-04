import type { EditorValidationResult } from '../basecard-runtime/contracts';

import type { BasecardResourceOperations } from '../basecard-runtime/contracts';

export interface EditorSessionSnapshot {
  key: string;
  cardId: string;
  baseCardId: string;
  cardType: string;
  sourceConfig: Record<string, unknown>;
  draftConfig: Record<string, unknown>;
  validation: EditorValidationResult;
  dirty: boolean;
  commitDebounceMs: number;
  mountRevision: number;
  revision: number;
  isCommitting: boolean;
  hasPendingResourceChanges: boolean;
  errorMessage: string | null;
}

export interface EditorSessionCommitPayload {
  config: Record<string, unknown>;
  resourceOperations: BasecardResourceOperations;
}
