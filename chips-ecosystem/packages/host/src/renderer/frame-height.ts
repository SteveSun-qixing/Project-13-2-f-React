/**
 * 父帧侧高度自适应：高度控制器与高度缓存。
 *
 * 权威：`05-渲染引擎设计` §9.4（高度自适应算法 3/5/8 条父帧侧职责）、§9.6（拒绝越限高度、
 * 非递增 epoch，并记录诊断）。
 *
 * @remarks
 * - 合并与去抖（同 rAF 一条、100ms 稳定窗口）发生在子帧帧运行时（§9.4 第 1/2/6 条）；
 *   父帧侧职责为：clamp → 应用 → `host:height-ack` 回执（§9.4 第 3 条）。
 * - 达到 `maxHeight` 后父帧停止更新（§9.4 第 5 条：避免"增长-滚动"震荡），但继续回执 ack，
 *   子帧据此清理已确认批次；后续上报低于上限时解除冻结（内容收缩恢复正常跟随）。
 */

import { FRAME_HEIGHT_MIN_DELTA_PX } from './frame-protocol.js';
import type { FrameLimits, FrameRole } from './frame-protocol.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';

/** 高度控制器依赖。 */
export interface IFrameHeightControllerDeps {
  /** 帧尺寸限制（来自 `host:init` 同源的 `FrameLimits`）。 */
  readonly limits: FrameLimits;
  /** 应用高度到 iframe 元素（px）。 */
  readonly applyHeight(heightPx: number): void;
  /** 回执 `host:height-ack`。 */
  readonly sendAck(epoch: number): void;
  /** 诊断口（拒绝与违规记录）。 */
  readonly diagnostics: DiagnosticsSink;
  /** 诊断 scope；缺省 `render.height`。 */
  readonly scope?: string;
}

/** 单条高度上报的处理结果。 */
export type FrameHeightOutcome = 'applied' | 'ack-only' | 'rejected';

/**
 * 父帧侧高度控制器：单帧一个实例。
 */
export class FrameHeightController {
  private readonly deps: IFrameHeightControllerDeps;
  private lastEpoch = 0;
  private lastApplied: number | null = null;
  private frozen = false;

  constructor(deps: IFrameHeightControllerDeps) {
    this.deps = deps;
  }

  /** 当前已应用高度（未应用过为 `null`）。 */
  get appliedHeight(): number | null {
    return this.lastApplied;
  }

  /** 是否处于上限冻结。 */
  get isFrozenAtMax(): boolean {
    return this.frozen;
  }

  /**
   * 处理一条 `frame:height`。返回处理结果：
   * `applied` = 高度变化已应用；`ack-only` = 仅回执（冻结或变化小于 1px）；`rejected` = 拒绝且回执。
   */
  handleReport(height: number, epoch: number): FrameHeightOutcome {
    if (!Number.isFinite(height) || height <= 0) {
      this.deps.diagnostics.warn(this.deps.scope ?? 'render.height', '拒绝非法高度上报', { height, epoch });
      return 'rejected';
    }
    if (!Number.isFinite(epoch) || epoch <= this.lastEpoch) {
      this.deps.diagnostics.warn(this.deps.scope ?? 'render.height', '拒绝非递增高度代数', { height, epoch, lastEpoch: this.lastEpoch });
      return 'rejected';
    }
    this.lastEpoch = epoch;
    const { minHeight, maxHeight } = this.deps.limits;
    if (height >= maxHeight) {
      this.frozen = true;
      return this.applyIfChanged(maxHeight, epoch);
    }
    if (this.frozen) {
      this.frozen = false;
    }
    const clamped = Math.max(minHeight, Math.min(height, maxHeight));
    if (this.lastApplied !== null && Math.abs(clamped - this.lastApplied) < FRAME_HEIGHT_MIN_DELTA_PX) {
      this.deps.sendAck(epoch);
      return 'ack-only';
    }
    return this.applyIfChanged(clamped, epoch);
  }

  /** 会话视图更新（`host:update`）后调用：内容重建后解除上限冻结。 */
  resetFreeze(): void {
    this.frozen = false;
  }

  /** 应用高度（变化才应用）并回执 ack。 */
  private applyIfChanged(heightPx: number, epoch: number): FrameHeightOutcome {
    if (this.lastApplied === heightPx) {
      this.deps.sendAck(epoch);
      return 'ack-only';
    }
    this.lastApplied = heightPx;
    this.deps.applyHeight(heightPx);
    this.deps.sendAck(epoch);
    return 'applied';
  }
}

/** 高度缓存条目键的输入。 */
export interface IFrameHeightCacheKeyInput {
  readonly role: FrameRole;
  /** 文档来源 URI（渲染请求的 `source`）。 */
  readonly source: string;
  /** 会话修订号。 */
  readonly revision: number;
}

/** 高度缓存键（§9.4 第 8 条：按帧类型与 `source + revision 摘要` 记录）。 */
export function frameHeightCacheKey(input: IFrameHeightCacheKeyInput): string {
  return `${input.role}\u0000${input.source}\u0000r${input.revision}`;
}

/**
 * 高度缓存：用于虚拟化估算与首屏占位，避免二次抖动（§9.4 第 8 条）。
 */
export class FrameHeightCache {
  private readonly entries = new Map<string, number>();

  /** 记录一次已应用高度。 */
  remember(key: string, heightPx: number): void {
    this.entries.set(key, heightPx);
  }

  /** 读取估算高度；无记录返回 `undefined`。 */
  estimate(key: string): number | undefined {
    return this.entries.get(key);
  }

  /** 失效指定键（文档关闭时释放）。 */
  invalidate(key: string): void {
    this.entries.delete(key);
  }
}
