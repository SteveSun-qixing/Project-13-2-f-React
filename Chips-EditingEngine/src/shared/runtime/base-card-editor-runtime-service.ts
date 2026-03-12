import type {
  BaseCardEditorConfigChange,
  BaseCardEditorConfigSyncedPayload,
  BaseCardEditorReadyPayload,
  BaseCardEditorRenderResult,
  BaseCardRecord,
  Client,
  CompositeNodeSelection,
  StandardError,
} from "chips-sdk";

export interface BaseCardEditorRuntimeService {
  getBaseCard(cardFile: string, nodeId: string): Promise<BaseCardRecord>;
  updateBaseCard(cardFile: string, nodeId: string, config: Record<string, unknown>): Promise<BaseCardRecord>;
  renderEditor(options: { cardFile: string; nodeId: string }): Promise<BaseCardEditorRenderResult>;
  syncEditorConfig(frame: HTMLIFrameElement, config: Record<string, unknown>): void;
  onEditorReady(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorReadyPayload) => void): () => void;
  onEditorConfigChange(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorConfigChange) => void): () => void;
  onEditorConfigSynced(frame: HTMLIFrameElement, handler: (payload: BaseCardEditorConfigSyncedPayload) => void): () => void;
  onEditorFatalError(frame: HTMLIFrameElement, handler: (error: StandardError) => void): () => void;
  onCompositeNodeSelect(frame: HTMLIFrameElement, handler: (payload: CompositeNodeSelection) => void): () => void;
}

export function createBaseCardEditorRuntimeService(client: Client): BaseCardEditorRuntimeService {
  return {
    getBaseCard(cardFile, nodeId) {
      return client.card.getBaseCard(cardFile, nodeId);
    },
    updateBaseCard(cardFile, nodeId, config) {
      return client.card.updateBaseCard(cardFile, nodeId, config);
    },
    renderEditor(options) {
      return client.card.baseCardEditor.render(options);
    },
    syncEditorConfig(frame, config) {
      client.card.baseCardEditor.syncConfig(frame, config);
    },
    onEditorReady(frame, handler) {
      return client.card.baseCardEditor.onReady(frame, handler);
    },
    onEditorConfigChange(frame, handler) {
      return client.card.baseCardEditor.onConfigChange(frame, handler);
    },
    onEditorConfigSynced(frame, handler) {
      return client.card.baseCardEditor.onConfigSynced(frame, handler);
    },
    onEditorFatalError(frame, handler) {
      return client.card.baseCardEditor.onFatalError(frame, handler);
    },
    onCompositeNodeSelect(frame, handler) {
      return client.card.compositeWindow.onNodeSelect(frame, handler);
    },
  };
}
