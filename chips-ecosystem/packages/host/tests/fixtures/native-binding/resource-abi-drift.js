'use strict';
/** 资源域 ABI 漂移夹具：17 项在位但 `coreAbiVersion()` 返回 2（宿主期望 1）。应判 `abi-mismatch`。 */
module.exports = require('./resource-variant-factory.js')({ coreVersionResult: '0.1.0', coreAbiVersionResult: 2 });
