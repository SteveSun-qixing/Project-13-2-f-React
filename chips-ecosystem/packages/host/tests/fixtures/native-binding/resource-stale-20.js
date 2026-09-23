'use strict';
/**
 * 部分漂移替身夹具：21 名中仅缺 `resourceGrantSession`（末位）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该一名（在位名不得混入点名表）。
 * （母型承接 `归档/native-binding夹具-波D1翻正/resource-stale-19.js`——
 * 点位五 D1 任务 #244 `resourceGrantSession` 补登前为「20 名中仅缺末位
 * `resourceManagedUriOfPath`」同臂。）
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: ['resourceGrantSession'],
});
