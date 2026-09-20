'use strict';
/**
 * 文档解析域装载闸「ABI 漂移」替身夹具（仅测试使用）：17 导出全在位，
 * 但 `coreAbiVersion()` 返回 2（宿主期望 1）。装载闸应判 `abi-mismatch`。
 */

const base = require('./parser-available.js');

module.exports = Object.assign({}, base, {
  coreAbiVersion() {
    return 2;
  },
});
