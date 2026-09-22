'use strict';
/**
 * 部分漂移替身夹具：15 名中仅缺 `resourceRegisterTempScope`（末位）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该一名（在位名不得混入点名表）。
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: ['resourceRegisterTempScope'],
});
