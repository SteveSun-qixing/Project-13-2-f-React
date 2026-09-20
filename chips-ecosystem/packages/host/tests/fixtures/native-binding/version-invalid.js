'use strict';
/** 元信息取值非法夹具：`coreVersion()` 返回数字。应判 `surface-mismatch`。 */
module.exports = require('./variant-factory.js')({ coreVersionResult: 42, coreAbiVersionResult: 1 });
