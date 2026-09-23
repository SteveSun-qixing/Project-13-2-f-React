'use strict';
/**
 * 部分漂移替身夹具：20 名中仅缺 `resourceManagedUriOfPath`（末位）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该一名（在位名不得混入点名表）。
 * （母型承接 `归档/native-binding夹具-波B翻正/resource-stale-17.js`——
 * 波 B 任务 #231 两换算名补登前为「18 名中仅缺末位 `resourceUnregisterScope`」同臂。）
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: ['resourceManagedUriOfPath'],
});
