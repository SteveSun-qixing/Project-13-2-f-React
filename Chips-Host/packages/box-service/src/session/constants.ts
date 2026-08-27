/**
 * 箱子编辑会话常量：动作名、错误码、事件名
 */

export const BOX_SESSION_ACTIONS = {
  create: 'box.create',
  rename: 'box.rename',
  open: 'box.session.open',
  get: 'box.session.get',
  addEntry: 'box.session.addEntry',
  addEmbeddedCard: 'box.session.addEmbeddedCard',
  updateEntry: 'box.session.updateEntry',
  moveEntry: 'box.session.moveEntry',
  removeEntry: 'box.session.removeEntry',
  updateLayoutConfig: 'box.session.updateLayoutConfig',
  importAsset: 'box.session.importAsset',
  deleteAsset: 'box.session.deleteAsset',
  updateCover: 'box.session.updateCover',
  persist: 'box.session.persist',
  undo: 'box.session.undo',
  redo: 'box.session.redo',
  history: 'box.session.history',
  close: 'box.session.close',
} as const;

export const BOX_SESSION_ERROR_CODES = {
  SESSION_NOT_FOUND: 'BOX_SESSION_NOT_FOUND',
  ENTRY_NOT_FOUND: 'BOX_SESSION_ENTRY_NOT_FOUND',
  INVALID_RESOURCE_PATH: 'BOX_SESSION_INVALID_RESOURCE_PATH',
  PERSIST_FAILED: 'BOX_SESSION_PERSIST_FAILED',
  DOCUMENT_NOT_SUPPORTED: 'BOX_SESSION_DOCUMENT_NOT_SUPPORTED',
} as const;

export const BOX_SESSION_EVENTS = {
  opened: 'box.session.opened',
  updated: 'box.session.updated',
  dirty: 'box.session.dirty',
  persisted: 'box.session.persisted',
  persistError: 'box.session.persist-error',
  closed: 'box.session.closed',
  undo: 'box.session.undo',
  redo: 'box.session.redo',
} as const;

/** 自动保存防抖窗口，单位 ms */
export const BOX_AUTOSAVE_DEBOUNCE_MS = 180;
