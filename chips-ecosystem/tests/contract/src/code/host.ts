/**
 * 实现侧（Host/PAL）契约登记表：壳侧已登记错误码。
 *
 * 壳启动诊断码（`HOST_STARTUP_FAILED` 等）属壳内部诊断、不跨越 Bridge，
 * 不属于插件可见错误面，因此不进入注册表比对；`PAL_ERROR_CODES` 是
 * 「PAL 端口使用的已登记错误码」，必须全部落在文档错误码注册表内。
 */

import { PAL_ERROR_CODES } from '../../../../packages/host/src/platform/errors';
import { RESOURCE_ERROR_HTTP_STATUS } from '../../../../packages/host/src/protocol/resource-error';

export interface HostCodeModel {
  readonly palErrorCodes: readonly string[];
  /** 资源协议 §7.2 的完整错误码集合（HTTP 状态映射表的键）。 */
  readonly resourceErrorCodes: readonly string[];
}

export function loadHostCodeModel(): HostCodeModel {
  return {
    palErrorCodes: Object.values(PAL_ERROR_CODES),
    resourceErrorCodes: Object.keys(RESOURCE_ERROR_HTTP_STATUS),
  };
}
