/**
 * 窗口会话运行时（16-CC §2.2 `ui/runtime/` 的起步臂形态：会话状态机 + 服务器基址持有）。
 *
 * 诚实降级面（不假接线）：
 * - `config:*` 域宿主处理器缺位（工单066 在册）：服务器基址收敛为**窗口会话内存态**——
 *   校验（§5.3）通过后写入本会话内存并即时生效，跨会话不持久；生效层如实标记
 *   「会话内存（未持久化）」；`config:*` 落波后以同一接口换接 `config:get/set` 与
 *   `config:changed` 订阅，消费面零改动（判例同 settings 起步臂偏好存储）。
 * - `credential:*` / `http:*` 域宿主处理器缺位：会话恢复链（§5.2 启动恢复）无法执行，
 *   会话如实呈现「未登录」，不伪造登录态；落波后按 §5.2 接续（读凭证 → 刷新 → 拉资料）。
 *
 * 服务器地址变更（§5.3/§5.2 第 5 条）：先清会话（内存状态 + 凭证）再切换基址；
 * 本臂无会话可清，落波后同一入口承接清会话语义。
 */

import {
  DEFAULT_COMMUNITY_SERVER_URL,
  validateCommunityServerUrl,
  type ServerUrlValidation,
} from '../../domain/community/serverConfig';

/** 服务器基址生效层：本臂为窗口会话内存层；`config:*` 落波后增配置层。 */
export type ServerBaseEffectLayer = 'session-memory';

/**
 * 会话状态：本臂如实呈现「未登录」；`http:*` / `credential:*` 落波后增登录态分支
 * （`loggedIn: true` 携带服务器回包的 `username`，不自造标识）。
 */
export type CommunitySessionState =
  | { readonly loggedIn: true; readonly username: string }
  | { readonly loggedIn: false; readonly reason: string };

/** 服务器基址快照：生效值与生效层。 */
export interface ServerBaseSnapshot {
  readonly url: string;
  readonly layer: ServerBaseEffectLayer;
}

/** 保存服务器基址结果：通过返回新快照，拒绝返回在册错误码。 */
export type SaveServerBaseResult =
  | { readonly ok: true; readonly snapshot: ServerBaseSnapshot }
  | { readonly ok: false; readonly code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED' };

/** 窗口会话运行时接口（`config:*` / `credential:*` 落波后仅换实现，消费面不变）。 */
export interface CommunityRuntime {
  /** 当前服务器基址快照（生效值 + 生效层）。 */
  getServerBase(): ServerBaseSnapshot;
  /** 校验并保存服务器基址（§5.3 设置页校验；拒绝时返回 `COMMUNITY_CLIENT_SERVER_UNSUPPORTED`）。 */
  saveServerBase(value: string): SaveServerBaseResult;
  /** 当前会话状态（本臂恒为未登录，见文件头）。 */
  getSession(): CommunitySessionState;
}

/** 创建窗口会话内存态运行时（诚实降级实现，见文件头；测试经此建立隔离实例）。 */
export function createCommunityRuntime(): CommunityRuntime {
  let serverBase: ServerBaseSnapshot = { url: DEFAULT_COMMUNITY_SERVER_URL, layer: 'session-memory' };

  return {
    getServerBase(): ServerBaseSnapshot {
      return serverBase;
    },

    saveServerBase(value: string): SaveServerBaseResult {
      const validation: ServerUrlValidation = validateCommunityServerUrl(value);
      if (!validation.ok) {
        return { ok: false, code: validation.code };
      }
      serverBase = { url: validation.url, layer: 'session-memory' };
      return { ok: true, snapshot: serverBase };
    },

    getSession(): CommunitySessionState {
      return {
        loggedIn: false,
        reason: '登录与会话恢复候前置件：credential:manage 与 http:request 宿主处理器落波后开放',
      };
    },
  };
}

/** 窗口会话默认运行时：渲染上下文内共享（组合根消费）；测试用 `createCommunityRuntime` 隔离。 */
const windowRuntime = createCommunityRuntime();

export function getCommunityRuntime(): CommunityRuntime {
  return windowRuntime;
}
