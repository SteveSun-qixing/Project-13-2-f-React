'use strict';
/**
 * 文档解析域装载闸「33 项旧产物」替身夹具（仅测试使用）：元信息两项 + §6.4 冻结 13 项
 * + 工单034 正式化名之一（`documentLayoutConfig`）在位，仅缺 `documentRevision`
 * （第 34 项正式化导出）。装载闸应判 `surface-mismatch` 且只点名 `documentRevision`
 * （收口闸粒度锁：工单034 收口后任何未含第 34 项导出的产物在装载点即拒，防静默降级）。
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
  documentLayoutConfig: resolvedNull,
};
