'use strict';
/**
 * 文档解析域装载闸「旧 13 项产物」替身夹具（仅测试使用）：元信息两项 + §6.4 冻结 13 项
 * 在位，缺工单034 两项正式化名（`documentRevision` / `documentLayoutConfig`）。
 * 装载闸应判 `surface-mismatch` 并逐项点名缺位导出（防静默降级口径）。
 */

function noop() {}
function resolvedNull() {
  return Promise.resolve(null);
}

module.exports = {
  coreVersion() {
    return '0.1.0';
  },
  coreAbiVersion() {
    return 1;
  },
  openDocument: resolvedNull,
  openCard: resolvedNull,
  openBox: resolvedNull,
  documentMetadata: resolvedNull,
  documentStructure: resolvedNull,
  documentContent: resolvedNull,
  documentEntries: resolvedNull,
  documentReadResource: resolvedNull,
  documentValidate: resolvedNull,
  buildDocumentView: resolvedNull,
  documentClose: resolvedNull,
  createCancelToken: noop,
  cancelTokenCancel: noop,
};
