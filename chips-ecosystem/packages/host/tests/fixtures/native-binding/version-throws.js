'use strict';
/** 元信息调用抛错夹具：`coreVersion()` / `coreAbiVersion()` 直接 throw。应判 `surface-mismatch`。 */
module.exports = require('./variant-factory.js')({ throwOnVersionCall: true });
