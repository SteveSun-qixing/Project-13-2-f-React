'use strict';
/** ABI 版本非法夹具：`coreAbiVersion()` 返回非整数。装载闸应判 `abi-mismatch`。 */
module.exports = require('./variant-factory.js')({ coreVersionResult: '0.1.0', coreAbiVersionResult: 1.5 });
