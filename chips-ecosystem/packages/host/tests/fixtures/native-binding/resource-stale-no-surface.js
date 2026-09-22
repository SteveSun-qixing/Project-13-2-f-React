'use strict';
/**
 * 现态旧构建产物替身夹具：仅元信息两项在位、§11.3 十五导出全部缺位
 * （当前部署产物 34 导出零资源名的在册形态）。装载闸应判 `surface-mismatch`
 * 并逐项点名全部 15 名。
 */
module.exports = require('./resource-variant-factory.js')({
  coreVersionResult: '0.1.0',
  coreAbiVersionResult: 1,
  omit: [
    'resourceOpen',
    'resourceStat',
    'resourceRead',
    'resourceReadChunk',
    'resourceRelease',
    'resourceCommitWrite',
    'resourceCommitWriteStream',
    'resourceListDirectory',
    'resourceDelete',
    'resourceRename',
    'resourceCopy',
    'resourceCreateDirectory',
    'resourceOpenSession',
    'resourceCloseSession',
    'resourceRegisterTempScope',
  ],
});
