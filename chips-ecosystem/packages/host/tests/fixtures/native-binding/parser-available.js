'use strict';
/**
 * 文档解析域装载闸「可用面」替身夹具（仅测试使用）：元信息两项 + §6.4 冻结 13 项 +
 * 工单034 正式化 2 项 + 工单036 波 C3 存储序列化名 1 项共 18 导出在位，ABI 返回宿主期望 1。
 * 装载闸应判 `available`。
 * 夹具不承载解析语义（适配器行为断言用 TS 替身模块，见
 * `tests/document-native-parser-adapter.test.ts`）。
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
  documentRevision: resolvedNull,
  documentLayoutConfig: resolvedNull,
  documentSerialize: resolvedNull,
};
