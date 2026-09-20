'use strict';
/** ABI 版本漂移夹具：`coreAbiVersion()` 返回 2（宿主期望 1）。装载闸应判 `abi-mismatch`。 */
module.exports = require('./variant-factory.js')({ coreVersionResult: '0.1.0', coreAbiVersionResult: 2 });
