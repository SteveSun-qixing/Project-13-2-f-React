/**
 * 卡片编辑会话常量：动作名、错误码、事件名
 */

export const CARD_SESSION_ACTIONS = {
  init: 'card.init',
  open: 'card.session.open',
  get: 'card.session.get',
  updateBasicCard: 'card.session.updateBasicCard',
  addBasicCard: 'card.session.addBasicCard',
  removeBasicCard: 'card.session.removeBasicCard',
  moveBasicCard: 'card.session.moveBasicCard',
  updateMetadata: 'card.session.updateMetadata',
  updateCover: 'card.session.updateCover',
  persist: 'card.session.persist',
  undo: 'card.session.undo',
  redo: 'card.session.redo',
  history: 'card.session.history',
  close: 'card.session.close',
} as const;

export const CARD_SESSION_ERROR_CODES = {
  SESSION_NOT_FOUND: 'CARD_SESSION_NOT_FOUND',
  SESSION_CLOSED: 'CARD_SESSION_CLOSED',
  BASIC_CARD_NOT_FOUND: 'CARD_SESSION_BASIC_CARD_NOT_FOUND',
  INVALID_RESOURCE_PATH: 'CARD_SESSION_INVALID_RESOURCE_PATH',
  PERSIST_FAILED: 'CARD_SESSION_PERSIST_FAILED',
  HISTORY_EMPTY: 'CARD_SESSION_HISTORY_EMPTY',
} as const;

export const CARD_SESSION_EVENTS = {
  opened: 'card.session.opened',
  updated: 'card.session.updated',
  dirty: 'card.session.dirty',
  persisted: 'card.session.persisted',
  persistError: 'card.session.persist-error',
  closed: 'card.session.closed',
  undo: 'card.session.undo',
  redo: 'card.session.redo',
} as const;

/** 历史入栈合并窗口（同一基础卡片连续更新合并为一步），单位 ms */
export const HISTORY_MERGE_WINDOW_MS = 500;

/** 历史上限（默认步数） */
export const HISTORY_LIMIT = 100;

/** 自动保存防抖窗口，单位 ms */
export const AUTOSAVE_DEBOUNCE_MS = 260;
