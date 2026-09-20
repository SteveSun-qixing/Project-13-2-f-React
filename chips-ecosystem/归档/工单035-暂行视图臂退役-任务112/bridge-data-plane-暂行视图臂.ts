/**
 * 【归档件 · 任务 #112 / 工单035 §九 残留缝② 收口】bridge-data-plane 暂行视图臂退役快照。
 *
 * 退役原因（口径改写，非放宽）：
 * - 视图臂曾以 `document:read`（`part: 'structure'`）结构分片承载 `DocumentView`，
 *   系 #100 波次在宿主内部取视图通道（工单035 裁定件）落地前的**暂行实现**；
 * - 工单035 裁定一 + #105 冻结契约件 `renderer/document-view-channel.ts` 交付后，
 *   视图承载的唯一正式通路 = `document-view:request` 宿主内部 IPC 通道
 *   （消费臂 `renderer/document-view-channel-client.ts`，视图守门 = #105
 *   `guardDocumentViewCardRenderView`——其字段级深校验是本文件 `guardCardRenderView`
 *   的契约超集：封套两侧权威闸 + 可结构化克隆深校验 + 在册错误面）；
 * - `entries/card.ts` 视图臂已于任务 #112 切换至 `createDocumentViewChannelBuilder`，
 *   本文件的 `createBridgeCardViewBuilder` / `guardCardRenderView` 自此无生产消费方，
 *   按「暂行臂退役 = 移归档、禁直删」纪律整体快照于此。
 *
 * 本文件自 2026-09 起**不参与任何构建与测试**（不参与 tsc/eslint：置于 packages 之外），
 * 仅作退役可追溯快照保留。留存时刻意保留对已退役 `document:read` 通路的 `subscribe` 缺席
 * 形态（不随之改写）。动作臂（`createFrameActionForwarder`）与常量面**未退役**，
 * 仍现役于 `src/renderer/entries/bridge-data-plane.ts`。
 *
 * ———— 以下为退役当日（切换前最后一版）原文逐字快照 ————
 */

/**
 * 窗口入口数据面：渲染进程按冻结契约编码的文档消费臂（Bridge capability invoke）。
 *
 * 权威：`04-能力契约规范` §7.2 / §7.3 / §7.5 / §7.6 / §7.8（`shell:openExternal`、`resource:open`、
 * `notification:send`、`clipboard:write`、`document:open|read` 能力 ID 与输入形状）、
 * `05-渲染引擎设计` §2.3（跨进程时序：解析请求经 Bridge）、§9.3（`frame:action` 全部经 Bridge
 * 能力转发并做权限判定）、§2.6 / §6.6（`DocumentView` 冻结形状：父帧消费前逐字段校验）。
 *
 * @remarks
 * - 本模块是**入口组合根的数据臂**：只按冻结契约发起 `window.chips.request` 调用并校验响应
 *   形状，不承载任何主进程逻辑、不伪造数据。
 * - 视图臂（`createBridgeCardViewBuilder`）：§2.6 规定 `DocumentView` 由主进程视图构建器产出、
 *   经 Bridge 送达渲染侧；本波以 `document:read`（`part: 'structure'`）为视图载送臂按冻结
 *   契约编码，响应 `value` 必须是 §6.6/§9.2 的卡片视图形状（守门重建后交付）。视图载送语义
 *   的最终裁决（结构分片承载 vs. 专属视图能力）在册等待文档链路接线波次（开发日志合缝点）。
 * - 动作臂（`createFrameActionForwarder`）：`frame:action` 四类动作逐 kind 映射到冻结内置
 *   能力 ID；§9.3 要求的 RenderHost「URI 属于当前渲染会话可见引用」校验依赖资源映射表
 *   （资源管理器正式绑定属 W3 / 集成缝 2），本波由 Bridge 侧 `resources:read` 权限判定与
 *   打开路由兜底，校验臂接线点已在开发日志登记。
 * - 失败归一：文档域失败经渲染面既有 `normalizeDocumentFailure` 归一（透传契约码，不发明
 *   映射）；动作臂失败原样上抛，由帧通道按 §9.3 回 `host:action-error`。
 */

import { ChipsError } from '@chips/bridge';

import { DOCUMENT_CAPABILITY_IDS } from '../../packages/host/src/capabilities/document/contract.js';
import type { DocumentKind } from '../../packages/host/src/capabilities/document/contract.js';
import { normalizeDocumentFailure } from '../../packages/host/src/renderer/index.js';
import type { IDocumentViewBuilder } from '../../packages/host/src/renderer/index.js';
import type { DesignTokens, FrameActionPayload, ICardRenderView } from '../../packages/host/src/renderer/index.js';
import type { IChipsRequestFacade } from '../../packages/host/src/renderer/index.js';

/** 帧动作四类 kind 对应的冻结内置能力 ID（`04-能力契约规范` §七）。 */
export const FRAME_ACTION_CAPABILITY_IDS = {
  'open-external': 'shell:openExternal',
  'open-resource': 'resource:open',
  'copy-text': 'clipboard:write',
  notify: 'notification:send',
} as const;

/** 入口组合根消费的 `window.chips` 最小面（与 preload 挂载面同构）。 */
export type IChipsWindowFacade = IChipsRequestFacade;

/** 构造 Bridge 形态的卡片视图构建端口（渲染侧，按冻结契约触达文档能力）。 */
export function createBridgeCardViewBuilder(chips: IChipsWindowFacade): IDocumentViewBuilder {
  return {
    async buildView(input: {
      readonly source: string;
      readonly documentId: string;
      readonly kind: DocumentKind;
    }): Promise<ICardRenderView> {
      if (input.kind !== 'card') {
        throw new ChipsError({
          code: 'BRIDGE_INVALID_INPUT',
          message: '视图构建失败：当前渲染入口仅支持卡片视图（箱子视图随后续波次开通）',
          retryable: false,
        });
      }
      let raw: unknown;
      try {
        raw = await chips.request(DOCUMENT_CAPABILITY_IDS.read, {
          documentId: input.documentId,
          part: 'structure',
        });
      } catch (error) {
        throw normalizeDocumentFailure(error);
      }
      return guardCardRenderView(raw);
    },
  };
}

/**
 * 把 `document:read`（`structure`）响应守门重建为 §9.2 `ICardRenderView` 冻结形状。
 *
 * @remarks 接受 `IDocumentReadOutput` 包装（取 `value`）或直接视图对象两种响应形态；
 * 逐字段严格投影：非纯数据、缺字段、类型不符一律以契约违约拒绝（与主进程构建器同一口径），
 * 不透明值（`content`、`tags` 成员）原样保留。
 */
export function guardCardRenderView(raw: unknown): ICardRenderView {
  const value = unwrapReadOutput(raw);
  if (!isRecord(value)) {
    throw contractViolation('视图响应不是对象');
  }
  assertExactKeys(value, ['kind', 'revision', 'card_id', 'name', 'chip_standards_version', 'cover_ratio', 'tags', 'cover', 'content_nodes']);
  if (value['kind'] !== 'card') {
    throw contractViolation('视图 kind 不是 card');
  }
  const revision = value['revision'];
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
    throw contractViolation('视图 revision 不是非负安全整数');
  }
  const cover = value['cover'];
  if (!isRecord(cover)) {
    throw contractViolation('视图 cover 不是对象');
  }
  assertExactKeys(cover, ['entry', 'ratio']);
  const tags = value['tags'];
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' && !Array.isArray(tag))) {
    throw contractViolation('视图 tags 不是标签序列（字符串或字符串数组）');
  }
  const nodes = value['content_nodes'];
  if (!Array.isArray(nodes)) {
    throw contractViolation('视图 content_nodes 不是数组');
  }
  const contentNodes = nodes.map((node, index) => {
    if (!isRecord(node)) {
      throw contractViolation(`content_nodes[${String(index)}] 不是对象`);
    }
    assertExactKeys(node, ['node_id', 'card_type', 'content']);
    const nodeId = node['node_id'];
    const cardType = node['card_type'];
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      throw contractViolation(`content_nodes[${String(index)}].node_id 非法`);
    }
    if (typeof cardType !== 'string' || cardType.length === 0) {
      throw contractViolation(`content_nodes[${String(index)}].card_type 非法`);
    }
    const content = node['content'];
    if (!isRecord(content)) {
      throw contractViolation(`content_nodes[${String(index)}].content 不是映射对象`);
    }
    return { node_id: nodeId, card_type: cardType, content };
  });
  const entry = cover['entry'];
  const ratio = cover['ratio'];
  if (typeof entry !== 'string' || typeof ratio !== 'string') {
    throw contractViolation('视图 cover 字段不是字符串');
  }
  return {
    kind: 'card',
    revision,
    card_id: requireString(value['card_id'], 'card_id'),
    name: requireString(value['name'], 'name'),
    chip_standards_version: requireString(value['chip_standards_version'], 'chip_standards_version'),
    cover_ratio: requireString(value['cover_ratio'], 'cover_ratio'),
    tags: tags as ICardRenderView['tags'],
    cover: { entry, ratio },
    content_nodes: contentNodes,
  };
}

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
        // §9.3：RenderHost 以 `origin: 'frame'` 调用资源打开路由（契约规范 §14 §2.2）。
        await chips.request(FRAME_ACTION_CAPABILITY_IDS['open-resource'], {
          ...action.request,
          origin: 'frame',
        });
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

/** 解包 `IDocumentReadOutput` 形态（`{ part, value, diagnostics }`）；非该形态原样返回。 */
function unwrapReadOutput(raw: unknown): unknown {
  if (isRecord(raw) && raw['part'] === 'structure' && 'value' in raw) {
    return raw['value'];
  }
  return raw;
}

/** 视图契约违约错误（与主进程构建器同域口径：`BRIDGE_INTERNAL`，不发明错误码）。 */
function contractViolation(reason: string): ChipsError {
  return new ChipsError({
    code: 'BRIDGE_INTERNAL',
    message: `文档视图形状违约：${reason}`,
    retryable: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(value);
  const missing = keys.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !keys.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    throw contractViolation(`字段不符（缺失：${missing.join(',') || '无'}；多余：${extra.join(',') || '无'}）`);
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw contractViolation(`${field} 不是字符串`);
  }
  return value;
}

/** 渲染入口的 Design Tokens 空表（平台初始值；文档级 token 随装载输入注入）。 */
export const EMPTY_DESIGN_TOKENS: DesignTokens = Object.freeze({});
