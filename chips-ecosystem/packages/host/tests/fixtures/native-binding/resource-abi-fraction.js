'use strict';
/** 资源域 ABI 非法夹具：`coreAbiVersion()` 返回非整数。应判 `abi-mismatch`。 */
module.exports = require('./resource-variant-factory.js')({ coreVersionResult: '0.1.0', coreAbiVersionResult: 1.5 });
