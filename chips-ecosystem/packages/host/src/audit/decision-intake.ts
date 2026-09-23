/**
 * native 判定素材的宿主 TS 单消费点（工单046 段四接线波，任务 #205 M2；
 * RFC-权限审计跨层采集sink裁定 v1.0.1 §5.3 / §八 / §九）。
 *
 * 权威分工（素材面/条目面两分，RFC §5.2）：`chips-native` 观察者把
 * `PermissionDecision` 素材经非阻塞 Neon Channel 抛来（帧
 * `{ decision, dropped }`，键表 RFC §八条 3 =《08.08》§8.2 camelCase 词表
 * 直译）；**本模块是全生态唯一的 §8.2 条目组装点**——宿主侧字段
 * （`id`/`timestamp`/`actor`/`pluginVersion` 与 `traceId` 补挂腿）在此单点
 * 补齐后直连 `IHostRuntime.auditWriter.enqueue` 唯一入口（RFC §九 9.2-2
 * 「单条目单落点」），组装禁下沉 crate 或 bridge 绑定包。
 *
 * 十六字段取值口径（RFC §5.3 对齐表逐行落地，逐字段对账表见交回报告）：
 * - crate 产出腿直传：`action` / `pluginId` / `permission` / `resourceUri` /
 *   `reason` / `capabilityId`；`sessionId` 数值 → 字符串化（§5.3 行注）；
 * - 宿主侧：`id` = 段一 ULID 供给面（`@chips/bridge` `createUlidGenerator`）；
 *   `timestamp` = 消费时刻 ISO 8601 UTC；`actor` 运行时判定恒 `system`；
 *   `source` 运行时记录缺省不造值；`pluginVersion` 宿主授权/会话权威侧
 *   补挂（注入端口，无值即拒组装——不伪造版本串）；
 * - 双侧腿：`traceId` 素材非空（bridge 域 crate 出）直传，resource 域
 *   crate 无值经注入的段一横切 `InvocationContext.traceId` 贯通链端口补
 *   （**禁另造关联键**，RFC §5.3 行原文与立项书段一口径；两腿均缺值即
 *   弃帧留痕）；`requestId` 素材有值直传，缺省不落字段（§8.2 可选位，
 *   resource 域「宿主调用现场补」的现场位随资源域流量波在册）；
 *   `target` / `qualifier` 素材可缺省（qualifier 恒 None 至限定值判定交付）。
 *
 * 禁双记录自查（RFC §5.3 注4 / §九）：本消费点是 native 素材的唯一接收方；
 * `chips-bridge` admit 与 `chips-resource` decide 发射面即本链路唯一素材源，
 * 宿主 TS 判定臂（router）当前无并发审计发射位（段三挂点硬绑 025③，工单
 * 046 裁定三），writer 链在本波前无任何 `enqueue` 生产者（实读核证）——
 * 结构上不存在双记录窗口。
 *
 * 丢弃可见性（RFC §六条 2 宿主实现面）：帧携带 native 观察侧累计 `dropped`
 * 计数，增量出现即经诊断告警一次（`host-trace.ts` dropped+onFault 母型同
 * 族口径）；本模块自身的拒组装（素材非法 / pluginVersion 或 traceId 无源）
 * 计数并可经 `report()` 观察。观察失败永不回传判定面（总则 G2）：本模块
 * 任何臂不抛出。
 *
 * @remarks
 * 零依赖结构视图：`INativePermissionDecision` / `INativeAuditDecisionFrame`
 * 镜像自 `packages/native/types/chips-native.d.ts`（与 `main/native-bridge.ts`
 * / `adapters/native-resource-module.ts` 镜像模式同构，无运行时依赖边）。
 */

import { createUlidGenerator, type IPermissionAuditEntry } from '@chips/bridge';

import type { DiagnosticsSink } from '../shared/diagnostics.js';
import type { IPermissionAuditWriter } from './types.js';

/** 诊断 scope（比照 `audit` 写入器链同源点名）。 */
const INTAKE_SCOPE = 'audit';

/** §8.2 `PermissionAuditAction` 运行时子集（观察面只承载 allow/deny，RFC §5.1）。 */
const OBSERVED_ACTIONS: readonly string[] = ['allow', 'deny'];

/** §8.2 `PermissionDenyReason` 五值词表（snake_case 同词）。 */
const DENY_REASONS: readonly string[] = ['not_granted', 'revoked', 'out_of_scope', 'user_rejected', 'policy'];

/** 素材域判别字面量（native `DecisionDomain` 序列化词表）。 */
const DECISION_DOMAINS: readonly string[] = ['capability', 'resource'];

/**
 * 权限判定出站素材（native `PermissionDecision` JSON 投影的结构镜像；
 * 键表 RFC §八条 3，与 `chips-native.d.ts` `INativePermissionDecision` 逐字
 * 一致；三方一致性由 `tests/audit-decision-intake.test.ts` 文本锁单点钉死）。
 */
export interface INativePermissionDecision {
  domain: 'capability' | 'resource';
  action: 'allow' | 'deny';
  pluginId: string;
  sessionId: number;
  permission: string;
  required: string[];
  missing: string[];
  reason: 'not_granted' | 'revoked' | 'out_of_scope' | 'user_rejected' | 'policy' | null;
  capabilityId: string | null;
  resourceUri: string | null;
  target: string | null;
  requestId: string | null;
  traceId: string | null;
  qualifier: string | null;
}

/** 审计决策帧镜像（与 `chips-native.d.ts` `INativeAuditDecisionFrame` 一致）。 */
export interface INativeAuditDecisionFrame {
  decision: INativePermissionDecision;
  dropped: number;
}

/** 条目组装消费面（宿主唯一 sink 函数形状，即 `auditBindDecisionSink` 入参）。 */
export type PermissionDecisionSink = (frame: INativeAuditDecisionFrame) => void;

/** 消费点组装统计（丢弃可见性载荷，RFC §六条 2 尾注）。 */
export interface IPermissionDecisionIntakeReport {
  /** 收到的帧总数（含拒组装）。 */
  readonly received: number;
  /** 成功组装并投递写入器的条目数。 */
  readonly assembled: number;
  /** 拒组装计数（素材非法 / 必填腿无源 / 帧结构异常）。 */
  readonly rejected: number;
  /** 最近一次观测到的 native 观察侧累计丢弃计数。 */
  readonly nativeDropped: number;
}

/** 组装消费点构造选项（全部注入面，供确定性测试；生产缺省即文档口径）。 */
export interface PermissionDecisionIntakeOptions {
  /** 权限审计写入器（`IHostRuntime.auditWriter` 唯一入口，RFC §九 9.2-2）。 */
  readonly auditWriter: IPermissionAuditWriter;
  /** 诊断口（拒组装留痕、native dropped 增量告警）。 */
  readonly diagnostics: DiagnosticsSink;
  /**
   * 插件版本供给端口（§5.3「宿主授权/会话权威侧补挂」）：返回 `null`
   * 即该条素材拒组装——不伪造版本串。
   */
  readonly resolvePluginVersion: (pluginId: string) => string | null;
  /**
   * resource 域 `traceId` 腿的段一横切贯通链补挂端口（§5.3 行原文；禁另造
   * 关联键——端口只读取既有链路值，不生成新键）。bridge 域素材自带
   * `traceId`，不经本端口。缺省即 resource 域素材无腿可补，拒组装留痕。
   */
  readonly resolveTraceId?: (decision: INativePermissionDecision) => string | null;
  /** 条目 `id` 供给（段一 ULID 母型；测试注入面）。 */
  readonly newId?: () => string;
  /** 当前时刻 Unix 毫秒（`timestamp` 源；测试注入面）。 */
  readonly now?: () => number;
}

/** 消费点交付面。 */
export interface IPermissionDecisionIntake {
  /** 唯一 sink 函数：直连 `auditBindDecisionSink` 绑定。永不抛出。 */
  readonly consume: PermissionDecisionSink;
  /** 组装统计快照。 */
  report(): IPermissionDecisionIntakeReport;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** 素材帧结构闸（跨 Neon 边界防御；非法帧拒组装留痕，不猜测补齐）。 */
function validateFrame(frame: unknown): frame is INativeAuditDecisionFrame {
  if (typeof frame !== 'object' || frame === null) {
    return false;
  }
  const raw = frame as Record<string, unknown>;
  if (typeof raw['dropped'] !== 'number' || !Number.isFinite(raw['dropped'])) {
    return false;
  }
  const decision: unknown = raw['decision'];
  if (typeof decision !== 'object' || decision === null) {
    return false;
  }
  const d = decision as Record<string, unknown>;
  if (typeof d['domain'] !== 'string' || !DECISION_DOMAINS.includes(d['domain'])) {
    return false;
  }
  if (typeof d['action'] !== 'string' || !OBSERVED_ACTIONS.includes(d['action'])) {
    return false;
  }
  if (!isNonEmptyString(d['pluginId']) || !isNonEmptyString(d['permission'])) {
    return false;
  }
  if (typeof d['sessionId'] !== 'number' || !Number.isInteger(d['sessionId']) || d['sessionId'] < 0) {
    return false;
  }
  if (!isStringArray(d['required']) || !isStringArray(d['missing'])) {
    return false;
  }
  if (d['reason'] !== null && (typeof d['reason'] !== 'string' || !DENY_REASONS.includes(d['reason']))) {
    return false;
  }
  for (const field of ['capabilityId', 'resourceUri', 'target', 'requestId', 'traceId', 'qualifier'] as const) {
    const value: unknown = d[field];
    if (value !== null && typeof value !== 'string') {
      return false;
    }
  }
  return true;
}

/** 可缺省字符串腿：素材非空值透出，否则不构造键（缺省不造值）。 */
function optionalString(value: string | null): string | undefined {
  return value === null || value.length === 0 ? undefined : value;
}

/**
 * 创建判定素材消费点（唯一 sink）。
 *
 * @param options 注入面（写入器 / 诊断 / 版本与横切链路端口）。
 * @returns `consume` 直连 `auditBindDecisionSink`；`report` 观察丢弃可见性。
 */
export function createPermissionDecisionIntake(options: PermissionDecisionIntakeOptions): IPermissionDecisionIntake {
  const ulid = createUlidGenerator();
  const newId = options.newId ?? ((): string => ulid.next());
  const now = options.now ?? ((): number => Date.now());
  let received = 0;
  let assembled = 0;
  let rejected = 0;
  let lastNativeDropped = 0;

  const reject = (frame: unknown, cause: string): void => {
    rejected += 1;
    const rawPluginId =
      typeof frame === 'object' && frame !== null ? (frame as Record<string, unknown>)['decision'] : undefined;
    const pluginId =
      typeof rawPluginId === 'object' && rawPluginId !== null
        ? (rawPluginId as Record<string, unknown>)['pluginId']
        : undefined;
    const summary = typeof pluginId === 'string' ? pluginId : 'unknown';
    options.diagnostics.warn(INTAKE_SCOPE, `native 判定素材拒组装：${cause}（pluginId=${summary}）`);
  };

  const consume: PermissionDecisionSink = (frame) => {
    received += 1;
    // native 观察侧丢弃计数：增量即告警一次（背压可见性，RFC §六条 2）。
    if (typeof frame === 'object' && frame !== null) {
      const dropped = (frame as Partial<INativeAuditDecisionFrame>).dropped;
      if (typeof dropped === 'number' && Number.isFinite(dropped) && dropped > lastNativeDropped) {
        options.diagnostics.warn(INTAKE_SCOPE, 'native 审计观察面素材丢弃（有界队列满丢 / 未绑定窗口 / JS 投递失败）', {
          delta: dropped - lastNativeDropped,
          total: dropped,
        });
        lastNativeDropped = dropped;
      }
    }
    if (!validateFrame(frame)) {
      reject(frame, '帧结构越 §八条 3 键表');
      return;
    }
    const { decision } = frame;
    // traceId 双腿口径（RFC §5.3）：素材自带腿优先，resource 域经贯通链
    // 端口补；两腿均缺值禁另造关联键——拒组装留痕。
    const traceLeg = isNonEmptyString(decision.traceId)
      ? decision.traceId
      : (options.resolveTraceId?.(decision) ?? null);
    const traceId = isNonEmptyString(traceLeg) ? traceLeg : null;
    if (traceId === null) {
      reject(frame, 'traceId 双腿均无源（禁另造关联键）');
      return;
    }
    const pluginVersion = options.resolvePluginVersion(decision.pluginId);
    if (!isNonEmptyString(pluginVersion)) {
      reject(frame, 'pluginVersion 无宿主权威源（不伪造版本串）');
      return;
    }
    const qualifier = optionalString(decision.qualifier);
    const capabilityId = optionalString(decision.capabilityId);
    const target = optionalString(decision.target);
    const resourceUri = optionalString(decision.resourceUri);
    const requestId = optionalString(decision.requestId);
    const entry: IPermissionAuditEntry = {
      id: newId(),
      timestamp: new Date(now()).toISOString(),
      action: decision.action,
      actor: 'system',
      pluginId: decision.pluginId,
      pluginVersion,
      sessionId: String(decision.sessionId),
      permission: decision.permission,
      traceId,
      ...(qualifier === undefined ? {} : { qualifier }),
      ...(capabilityId === undefined ? {} : { capabilityId }),
      ...(target === undefined ? {} : { target }),
      ...(resourceUri === undefined ? {} : { resourceUri }),
      ...(requestId === undefined ? {} : { requestId }),
      ...(decision.reason === null ? {} : { reason: decision.reason }),
    };
    // writer.enqueue 契约即永不抛出（有界 + 校验 + 自计丢弃）；此处直投。
    options.auditWriter.enqueue(entry);
    assembled += 1;
  };

  return {
    consume,
    report: (): IPermissionDecisionIntakeReport => ({
      received,
      assembled,
      rejected,
      nativeDropped: lastNativeDropped,
    }),
  };
}

/** 审计观察域装载结果（bind 三态诚实呈现，比照装载闸四分面语义）。 */
export type NativeAuditBindOutcome =
  /** 绑定成功：native 观察者已持有本消费函数。 */
  | { readonly status: 'bound' }
  /** 产物缺 `auditBindDecisionSink` 导出（旧构建产物，素材将滞留观察侧计数）。 */
  | { readonly status: 'export-missing'; readonly detail: string }
  /** 绑定调用抛出（重复绑定 / 参数非函数等 `NATIVE_*` 归一错误）。 */
  | { readonly status: 'bind-failed'; readonly detail: string };

/**
 * 在已装载的原生模块面上绑定审计消费函数（`auditBindDecisionSink`，
 * §8.6 audit 域首导出；RFC §八条 1 构造期注入、终身不可换）。
 *
 * @remarks 调用方（组合根）负责启动序：绑定先于任何 `bridge*` / `resource*`
 * 判定流量，消除未绑定窗口（窗口内素材按 native 侧 dropped 计数丢弃）。
 * 本函数不抛错：一切失败以 {@link NativeAuditBindOutcome} 如实回传，由调用
 * 方诊断留痕（writer 仍常开，宿主 TS 面无中断）。
 *
 * @param moduleValue `chips-native.node` 模块导出对象（与 Bridge/资源/解析域
 *   装载闸共享同一进程级实例，Node 模块缓存保证单例）。
 * @param sink 消费函数（{@link createPermissionDecisionIntake} 交付的 `consume`）。
 */
export function bindNativeDecisionSink(
  moduleValue: Record<string, unknown>,
  sink: PermissionDecisionSink,
): NativeAuditBindOutcome {
  if (typeof moduleValue['auditBindDecisionSink'] !== 'function') {
    return {
      status: 'export-missing',
      detail: 'auditBindDecisionSink 导出缺位或非函数（疑似旧构建产物，请重新构建 @chips/native）',
    };
  }
  try {
    (moduleValue['auditBindDecisionSink'] as (value: PermissionDecisionSink) => unknown)(sink);
    return { status: 'bound' };
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error;
    return { status: 'bind-failed', detail: `auditBindDecisionSink 调用失败：${message}` };
  }
}
