'use strict';
/** 资源域元信息调用抛错夹具：`coreVersion()` / `coreAbiVersion()` 一律抛错。应判 `surface-mismatch`。 */
module.exports = require('./resource-variant-factory.js')({ throwOnVersionCall: true });
