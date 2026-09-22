'use strict';
/** 资源域元信息非法夹具：`coreVersion()` 返回空串。应判 `surface-mismatch`。 */
module.exports = require('./resource-variant-factory.js')({ coreVersionResult: '', coreAbiVersionResult: 1 });
