'use strict';
/**
 * 部分漂移替身夹具（工单036 波 C3）：18 名中仅缺 `documentSerialize`（末位）。
 * 装载闸应判 `surface-mismatch` 且逐项点名恰只含该一名（在位名不得混入点名表）。
 * （母型承接 `parser-stale-33.js`——工单036 波 C3 `documentSerialize` 补登前
 * 为「17 名中仅缺末位 `documentLayoutConfig`」同臂。）
 */
module.exports = (() => {
  const full = require('./parser-available.js');
  const stale = { ...full };
  delete stale.documentSerialize;
  return stale;
})();
