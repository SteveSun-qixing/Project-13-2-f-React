'use strict';
/**
 * 旧构建产物替身夹具：仅元信息 + Cordis/Context + 取消令牌 11 导出，
 * 缺 §8.6 Bridge 域四导出（工单 025 实测过的漂移形态）。装载闸应判 `surface-mismatch`。
 */

module.exports = {
  coreVersion() {
    return '0.1.0';
  },
  coreAbiVersion() {
    return 1;
  },
  contextProvide() {},
  contextInject() {
    return 0;
  },
  contextGet() {
    return undefined;
  },
  contextOn() {
    return 0;
  },
  contextUnsubscribe() {},
  contextEmit() {},
  contextEffect() {},
  createCancelToken() {
    return {};
  },
  cancelTokenCancel() {},
};
