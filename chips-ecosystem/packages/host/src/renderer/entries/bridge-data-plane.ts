/**
 * 窗口入口数据面：渲染进程帧动作转发臂（Bridge capability invoke）。
 *
 * 权威：`04-能力契约规范` §7.2 / §7.5 / §7.6 / §7.8（`shell:openExternal`、`resource:open`、
 * `notification:send`、`clipboard:write` 能力 ID 与输入形状）、`05-渲染引擎设计` §9.3
 * （`frame:action` 全部经 Bridge 能力转发并做权限判定）。
 *
 * @remarks
 * - 本模块是**入口组合根的动作数据臂**：只按冻结契约发起 `window.chips.request` 调用，
 *   不承载任何主进程逻辑、不伪造数据。
 * - 视图臂已退役（任务 #112 / 工单035 §九 缝②）：原 `createBridgeCardViewBuilder` 与其
 *   `guardCardRenderView` 守门以 `document:read`（`part: 'structure'`）结构分片暂行承载
 *   `DocumentView`，现由宿主内部取视图通道正式件整体取代——消费臂
 *   `renderer/document-view-channel-client.ts`（`createDocumentViewChannelBuilder`，经
 *   `document-view:request` 通道）、到达侧守门 `renderer/document-view-channel.ts`
 *   `guardDocumentViewCardRenderView`（#105 冻结契约，字段级深校验为旧暂行守门的契约超集）。
 *   暂行臂原文逐字快照在 `chips-ecosystem/归档/工单035-暂行视图臂退役-任务112/`，禁直删纪律
 *   按在册口径执行。`entries/card.ts` 已切换至通道消费臂，本模块不再导出任何视图构建面。
 * - 动作臂（`createFrameActionForwarder`）：`frame:action` 四类动作逐 kind 映射到冻结内置
 *   能力 ID；§9.3 要求的 RenderHost「URI 属于当前渲染会话可见引用」校验依赖资源映射表
 *   （资源管理器正式绑定属 W3 / 集成缝 2），本波由 Bridge 侧 `resources:read` 权限判定与
 *   打开路由兜底，校验臂接线点已在开发日志登记。
 * - 失败归一：动作臂失败原样上抛，由帧通道按 §9.3 回 `host:action-error`。
 */

import { ChipsError } from '@chips/bridge';

import type { DesignTokens, FrameActionPayload } from '../index.js';
import type { IChipsRequestFacade } from '../index.js';

/** 帧动作四类 kind 对应的冻结内置能力 ID（`04-能力契约规范` §七）。 */
export const FRAME_ACTION_CAPABILITY_IDS = {
  'open-external': 'shell:openExternal',
  'open-resource': 'resource:open',
  'copy-text': 'clipboard:write',
  notify: 'notification:send',
} as const;

/** 入口组合根消费的 `window.chips` 最小面（与 preload 挂载面同构）。 */
export type IChipsWindowFacade = IChipsRequestFacade;

/**
 * 构造帧动作转发器（`frame:action` → 冻结内置能力，权限判定在 Bridge 侧，R19）。
 *
 * @param chips `window.chips` 方法面。
 */
export function createFrameActionForwarder(chips: IChipsWindowFacade): (action: FrameActionPayload) => Promise<void> {
  return async (action) => {
    switch (action.kind) {
      case 'open-external': {
        await chips.request(FRAME_ACTION_CAPABILITY_IDS['open-external'], { url: action.url });
        return;
      }
      case 'open-resource': {
        // §9.2 表：`request` 为 `IResourceOpenRequest`（14-资源打开与默认处理器契约 §2.2，
        // additionalProperties: false——顶层仅 intent / resource，无 origin 字段）；帧来源
        // （`origin: 'frame'`）身份归 RenderHost 校验臂以承载文档会话的应用身份调用路由
        // （14 §2.1，装载臂候 #85 落波），转发面按契约原样透传，禁自造字段。
        await chips.request(FRAME_ACTION_CAPABILITY_IDS['open-resource'], action.request);
        return;
      }
      case 'copy-text': {
        await chips.request(FRAME_ACTION_CAPABILITY_IDS['copy-text'], { text: action.text });
        return;
      }
      case 'notify': {
        await chips.request(FRAME_ACTION_CAPABILITY_IDS.notify, {
          level: action.level,
          message: action.message,
        });
        return;
      }
      default: {
        // 未列入 §9.2 清单的动作载荷：以无效输入拒绝（协议违规由帧通道回 `host:action-error`）。
        throw new ChipsError({
          code: 'BRIDGE_INVALID_INPUT',
          message: '帧动作类型无效：未列入契约清单的动作载荷',
          retryable: false,
        });
      }
    }
  };
}

/** 渲染入口的 Design Tokens 空表（平台初始值；文档级 token 随装载输入注入）。 */
export const EMPTY_DESIGN_TOKENS: DesignTokens = Object.freeze({});
