'use strict';
/**
 * 部分漂移替身夹具（工单036 波 C3）：23 名中仅缺波 C3 补登两名（域尾）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该两名（在位名不得混入点名表）。
 * （母型承接 `resource-stale-20.js`——工单036 波 C3 提交链两名补登前为
 * 「21 名中仅缺末位 `resourceGrantSession`」同臂。）
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: ['resourceCommitChangeset', 'resourceRebuildArchive'],
});
