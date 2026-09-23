'use strict';
/**
 * §11.3 资源域装载闸表面变体夹具工厂（仅测试使用）：元信息两项 + 资源域 20 导出的
 * 可参数化盘形——`omit` 指名缺位导出（模拟旧构建产物面漂移）、`throwOnVersionCall`
 * 模拟元信息调用抛错、两个返回值注入面模拟 ABI / 版本非法。
 *
 * 判据分支各落一份薄文件共用本工厂（`variant-factory.js` 同法）；夹具不承载资源语义
 * （本波宿主侧只交付装载闸与消费面类型视图，端口适配器落地后行为断言随该批补）。
 *
 * @param {{
 *   coreVersionResult?: unknown;
 *   coreAbiVersionResult?: unknown;
 *   throwOnVersionCall?: boolean;
 *   omit?: readonly string[];
 * }} options
 */

/** §11.3 二十导出名（表行序）；与 `native-resource-module.ts` 镜像常量的一致性由锁测单点锁定。 */
const RESOURCE_NAMES = [
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
];

module.exports = function makeResourceBindingVariant(options) {
  const omit = new Set(options.omit ?? []);
  const meta = {
    coreVersion() {
      if (options.throwOnVersionCall === true) {
        throw new Error('元信息导出调用失败模拟');
      }
      return options.coreVersionResult;
    },
    coreAbiVersion() {
      if (options.throwOnVersionCall === true) {
        throw new Error('元信息导出调用失败模拟');
      }
      return options.coreAbiVersionResult;
    },
  };
  /** 资源域替身：一律返回已决 Promise / 空转函数，不承载语义。 */
  const surface = {};
  for (const name of RESOURCE_NAMES) {
    if (!omit.has(name)) {
      surface[name] = function resourceStub() {
        return Promise.resolve(null);
      };
    }
  }
  return Object.assign(meta, surface);
};
