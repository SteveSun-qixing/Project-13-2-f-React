'use strict';
/**
 * 旧构建产物替身夹具：仅元信息两项在位、§11.3 二十一导出全部缺位
 * （波 A1 前旧构建零资源名的历史形态）。装载闸应判 `surface-mismatch`
 * 并逐项点名全部 21 名。
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
    'resourceMountDirectory',
    'resourceMountArchive',
    'resourceUnregisterScope',
    'resourceLocalPathOf',
    'resourceManagedUriOfPath',
    'resourceGrantSession',
  ],
});
