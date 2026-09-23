'use strict';
/**
 * 部分漂移替身夹具：18 名中仅缺 `resourceUnregisterScope`（末位）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该一名（在位名不得混入点名表）。
 * （母型承接 `归档/native-binding夹具-波A2a翻正/resource-stale-14.js`——
 * 波 A2a 任务 #212 三名补登前为「15 名中仅缺末位 `resourceRegisterTempScope`」同臂。）
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: ['resourceUnregisterScope'],
});
