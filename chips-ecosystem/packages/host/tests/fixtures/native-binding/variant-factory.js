'use strict';
/**
 * 表面变体夹具工厂：六必备导出在位，仅元信息返回值可注入（单文件多实例经
 * `require` 参数化不可行，故按判定分支各落一份薄文件，共用本工厂）。
 *
 * @param {{ coreVersionResult?: unknown; coreAbiVersionResult?: unknown; throwOnVersionCall?: boolean }} options
 */
module.exports = function makeNativeBindingVariant(options) {
  const probe = {
    coreVersion() {
      if (options.throwOnVersionCall === true) {
        throw new Error('元信息导出调用失败模拟');
      }
      return options.coreVersionResult;
    },
    coreAbiVersion() {
      if (options.throwOnVersionCall === true) {
        throw new Error('元信息导出调用失败模拟');
      }
      return options.coreAbiVersionResult;
    },
    bridgeRegister() {},
    bridgeUnregister() {},
    bridgeRequest() {
      return Promise.resolve(null);
    },
    bridgeCancelSession() {},
  };
  return probe;
};
