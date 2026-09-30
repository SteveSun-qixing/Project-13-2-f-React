import type { IScaffoldContext, IScaffoldFile } from '../types.js';

/**
 * `service` 角色模板：服务插件多形态完整骨架（W4 row6 / 覆盖矩阵 G2）。
 *
 * 在一个可运行工程内演示四种形态（权威：《06-服务插件开发指南》§七、
 * 《04-能力契约规范》§八）：
 * 1. Bridge 能力注册（§七）：`<domain>:<action>` 状态查询能力与注册选项；
 * 2. Cordis 内容处理服务（§八）：描述符声明 + `contracts/` 契约包（JSON Schema 2020-12）；
 * 3. 异步 job 编排：阶段化进度上报、AbortSignal 取消令牌与幂等清理；
 * 4. 可逆生命周期：start 登记、stop 幂等、health 只读，定时器与订阅经 `effect` 收口。
 */

/** 派生标识集：由生成上下文推导，值一经登记即稳定（04-能力契约规范 §8.7）。 */
interface IServiceTemplateIds {
  readonly cordisServiceName: string;
  readonly contentCapabilityId: string;
  readonly bridgeCapabilityId: string;
  readonly providerPluginId: string;
}

function templateIds(context: IScaffoldContext): IServiceTemplateIds {
  const cordisServiceName = `content-${context.assetSlug}`;
  return {
    cordisServiceName,
    contentCapabilityId: `${cordisServiceName}.convert`,
    bridgeCapabilityId: `${context.assetSlug}:status`,
    providerPluginId: context.options.pluginId,
  };
}

/** 一次性输入上限（字节）：输入/输出 schema 与描述符共用。 */
const MAX_INLINE_INPUT_BYTES = 1048576;

function indexTs(context: IScaffoldContext): string {
  const ids = templateIds(context);
  return `import { ChipsError } from '@chips/sdk';
import type {
  ICapability,
  IEventSubscription,
  IServiceContext,
  IServicePlugin,
  JSONSchema,
} from '@chips/sdk';

/**
 * 服务插件入口（10-服务插件接口 §2 IServicePlugin）。
 *
 * 本工程完整演示服务插件的四种形态：
 * 1. Bridge 能力注册（06-服务插件开发指南 §七）：状态查询能力与注册选项；
 * 2. Cordis 内容处理服务（04-能力契约规范 §八）：描述符声明与 contracts/ 契约包，
 *    消费方在 manifest dependencies 声明本插件后经 ctx.inject 注入调用；
 * 3. 异步 job 编排：阶段化进度上报（15-文件处理契约 §3.7 的阶段与单调百分比语义）、
 *    AbortSignal 取消令牌（04-能力契约规范 §8.3 通用约束 2）与幂等清理；
 * 4. 可逆生命周期：start 登记、stop 幂等、health 只读，定时器与订阅经 effect 收口。
 *
 * 模块顶层只声明、不产生副作用；全部状态归属插件 Fork。
 */

/* ===== 标识常量：值一经登记即稳定（04-能力契约规范 §8.2、§8.7）===== */

/** Cordis 服务名：content- 前缀 + 内核服务文法（04-能力契约规范 §8.2）。 */
export const CORDIS_SERVICE_NAME = '${ids.cordisServiceName}';

/** 内容处理能力 ID：\`<service>.<operation>\` 恰为两段（04-能力契约规范 §8.2）。 */
export const CONTENT_CAPABILITY_ID = '${ids.contentCapabilityId}';

/** 提供方插件 ID（官方插件使用 chips.service.* 命名空间，见 04-能力契约规范 §8.2）。 */
export const PROVIDER_PLUGIN_ID = '${ids.providerPluginId}';

/**
 * Bridge 能力 ID：\`<domain>:<action>\` 文法（06-服务插件开发指南 §7.1）。
 * domain 由平台统一登记分配、插件不得自造：发布前必须完成能力契约登记前置评审
 * （§7.1 登记前置），以登记通过的 ID 为准，不得以本样例值直接发布。
 */
export const BRIDGE_CAPABILITY_ID = '${ids.bridgeCapabilityId}';

/** 一次性输入上限（字节）；与描述符 maxInlineInputBytes 一致。 */
export const MAX_INLINE_INPUT_BYTES = ${MAX_INLINE_INPUT_BYTES};

/** 分块字符数边界与缺省值（与 contracts/convert.input.schema.json 一致）。 */
export const DEFAULT_CHUNK_SIZE = 4096;
export const MIN_CHUNK_SIZE = 64;
export const MAX_CHUNK_SIZE = 65536;

/** 心跳配置键与边界（assets/schemas/config.schema.json）。 */
const CONFIG_KEY = 'interval-seconds';
const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 3600;

/* ===== 错误面：统一 ChipsError，码族随提供方契约登记（04-能力契约规范 §8.6）===== */

/** 输入不支持：schema 校验通过后的业务级二次校验失败（06-服务插件开发指南 §7.6）。 */
const CODE_INPUT_INVALID = 'CONTENT_INPUT_INVALID';

/** 通道码：调用方取消（04-能力契约规范 §11.3）；不得自造 BRIDGE_* 业务码。 */
const CODE_CANCELLED = 'BRIDGE_CANCELLED';

function inputInvalid(message: string, details: Record<string, unknown>): ChipsError {
  return new ChipsError({ code: CODE_INPUT_INVALID, message, details, retryable: false });
}

function cancelled(message: string): ChipsError {
  return new ChipsError({ code: CODE_CANCELLED, message, retryable: false });
}

/* ===== 内容处理能力描述符（04-能力契约规范 §8.3 IContentCapabilityDescriptor）===== */

export interface IContentCapabilityDescriptor {
  /** 能力 ID：\`<service>.<operation>\`，官方登记处为 04-能力契约规范 §8.4。 */
  readonly id: string;
  /** Cordis 服务名（content- 前缀，内核服务文法）。 */
  readonly service: string;
  /** 提供方插件 ID。 */
  readonly provider: string;
  /** 服务方法名（原子操作）；每个能力 ID 恰好一个操作。 */
  readonly operations: readonly string[];
  /** 接受的规范化来源格式。 */
  readonly sourceFormats: readonly string[];
  /** 产出的规范化目标格式。 */
  readonly targetFormats: readonly string[];
  /** 流式能力：输入输出均为一次性结构化值。 */
  readonly streaming: { readonly input: boolean; readonly output: boolean };
  /** 一次性输入上限（字节）；超出必须拒绝。 */
  readonly maxInlineInputBytes: number;
  /** 提供方契约包位置。 */
  readonly contractPackage: string;
}

/** 与 contracts/descriptor.schema.json 逐字一致的能力描述符。 */
export const contentCapabilityDescriptor: IContentCapabilityDescriptor = {
  id: CONTENT_CAPABILITY_ID,
  service: CORDIS_SERVICE_NAME,
  provider: PROVIDER_PLUGIN_ID,
  operations: ['convert'],
  sourceFormats: ['text'],
  targetFormats: ['convert-report'],
  streaming: { input: false, output: false },
  maxInlineInputBytes: MAX_INLINE_INPUT_BYTES,
  contractPackage: PROVIDER_PLUGIN_ID + '/contracts',
};

/* ===== 异步 job 契约类型 ===== */

/** 转换阶段（15-文件处理契约 §3.7 的阶段子集：prepare → transform → cleanup → completed）。 */
export type ConvertStage = 'prepare' | 'transform' | 'cleanup' | 'completed';

/** 进度载荷：同一操作内 percent 0-100、单调不减；message 简体中文、面向用户。 */
export interface IConvertProgress {
  readonly stage: ConvertStage;
  readonly percent: number;
  readonly message?: string;
}

/** 调用上下文：取消令牌与进度上报回调（均为可选）。 */
export interface IConvertCallContext {
  /** 取消令牌：实现必须在阶段边界与安全点检查（04-能力契约规范 §8.3 通用约束 2）。 */
  readonly signal?: AbortSignal;
  /** 进度上报回调：同步触发；不得阻塞、不得依赖其抛异常（15-文件处理契约 §3.7）。 */
  readonly onProgress?: (progress: IConvertProgress) => void;
}

/** convert 输入（contracts/convert.input.schema.json 的 TS 形状）。 */
export interface IConvertInput {
  readonly text: string;
  readonly chunkSize?: number;
}

/** 转换警告：不是错误，随结果返回。 */
export interface IConvertWarning {
  readonly code: string;
  readonly message: string;
}

/** convert 输出（contracts/convert.output.schema.json 的 TS 形状）。 */
export interface IConvertOutput {
  readonly chunks: number;
  readonly processedChars: number;
  readonly processedBytes: number;
  readonly durationMs: number;
  readonly warnings: readonly IConvertWarning[];
}

/** Cordis 服务对象：消费方经 ctx.inject 注入后调用。 */
export interface IConvertService {
  readonly capabilityId: string;
  convert(input: IConvertInput, call?: IConvertCallContext): Promise<IConvertOutput>;
}

/* ===== 运行时状态：两个对外形态共享，全部归属插件 Fork ===== */

export interface IContentServiceRuntimeState {
  /** 本 Fork 启动时间（Unix 毫秒）。 */
  startedAtMs: number;
  /** 已成功完成的 convert 任务数。 */
  processedJobs: number;
  /** 当前在途 convert 任务数。 */
  inFlightJobs: number;
}

export function createRuntimeState(): IContentServiceRuntimeState {
  return { startedAtMs: 0, processedJobs: 0, inFlightJobs: 0 };
}

/* ===== 输入归一：schema 校验之后的业务级二次校验（06-服务插件开发指南 §7.6）===== */

function requireText(input: IConvertInput): string {
  if (typeof input.text !== 'string' || input.text.length === 0) {
    throw inputInvalid('text 必须为非空字符串。', { field: 'text' });
  }
  const byteLength = new TextEncoder().encode(input.text).byteLength;
  if (byteLength > MAX_INLINE_INPUT_BYTES) {
    throw inputInvalid('text 字节量超出单次输入上限。', {
      field: 'text',
      limitBytes: MAX_INLINE_INPUT_BYTES,
      actualBytes: byteLength,
    });
  }
  return input.text;
}

function normalizeChunkSize(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_CHUNK_SIZE;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw inputInvalid('chunkSize 必须是有限数字。', { field: 'chunkSize' });
  }
  return Math.min(Math.max(Math.round(value), MIN_CHUNK_SIZE), MAX_CHUNK_SIZE);
}

/** 取消令牌安全点检查：任一安全点命中即抛通道码 BRIDGE_CANCELLED。 */
function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw cancelled('调用已被取消。');
  }
}

/** 进度上报器：守护 percent 单调不减、0-100 封顶（15-文件处理契约 §3.7）。 */
class JobProgressReporter {
  private readonly call: IConvertCallContext;
  private lastPercent = 0;

  constructor(call: IConvertCallContext) {
    this.call = call;
  }

  public report(stage: ConvertStage, percent: number, message?: string): void {
    const safePercent = Math.max(this.lastPercent, Math.min(100, Math.round(percent)));
    this.lastPercent = safePercent;
    this.call.onProgress?.({
      stage,
      percent: safePercent,
      ...(message === undefined ? {} : { message }),
    });
  }
}

/** 幂等清理临时分块登记：清空后再次清空为 no-op，取消与失败路径同样安全。 */
function discardPendingChunks(pending: number[]): void {
  pending.length = 0;
}

/**
 * 创建 Cordis 内容处理服务（04-能力契约规范 §8.1：经 ctx.provide 注册，
 * 不注册为 Bridge 能力、不进入 Bridge 权限判定与审计）。
 *
 * convert 为异步 job 编排形态：prepare(0-10) → transform(10-80) → cleanup(90) →
 * completed(100)，阶段顺序固定、百分比单调不减；取消在安全点检查；临时分块
 * 登记在 finally 幂等清理，取消与失败路径同样收口。
 */
export function createConvertService(state: IContentServiceRuntimeState): IConvertService {
  return {
    capabilityId: CONTENT_CAPABILITY_ID,

    async convert(input: IConvertInput, call: IConvertCallContext = {}): Promise<IConvertOutput> {
      const signal = call.signal;
      throwIfCancelled(signal);
      const startedAtMs = Date.now();
      state.inFlightJobs += 1;
      const reporter = new JobProgressReporter(call);
      const textEncoder = new TextEncoder();
      // 临时分块登记：job 中间状态，finally 统一幂等清理。
      const pendingChunkBytes: number[] = [];
      try {
        const text = requireText(input);
        const chunkSize = normalizeChunkSize(input.chunkSize);
        reporter.report('prepare', 10, '输入归一完成');
        throwIfCancelled(signal);

        reporter.report('transform', 10, '开始分块转换');
        const totalChunks = Math.ceil(text.length / chunkSize);
        for (let index = 0; index < totalChunks; index += 1) {
          throwIfCancelled(signal);
          const chunk = text.slice(index * chunkSize, (index + 1) * chunkSize);
          pendingChunkBytes.push(textEncoder.encode(chunk).byteLength);
          reporter.report(
            'transform',
            10 + Math.round((70 * (index + 1)) / totalChunks),
            '已完成分块 ' + (index + 1) + '/' + totalChunks
          );
        }

        reporter.report('cleanup', 90, '汇总并清理临时分块登记');
        const processedBytes = pendingChunkBytes.reduce((sum, item) => sum + item, 0);
        discardPendingChunks(pendingChunkBytes);
        const output: IConvertOutput = {
          chunks: totalChunks,
          processedChars: text.length,
          processedBytes,
          durationMs: Date.now() - startedAtMs,
          warnings: [],
        };
        reporter.report('completed', 100, '转换完成');
        state.processedJobs += 1;
        return output;
      } finally {
        // 幂等清理：取消、失败与成功路径统一收口；重复调用为 no-op。
        discardPendingChunks(pendingChunkBytes);
        state.inFlightJobs -= 1;
      }
    },
  };
}

/* ===== Bridge 能力（06-服务插件开发指南 §七）===== */

/** status 输入（与 statusInputSchema 一致）。 */
export interface IStatusInput {
  readonly verbose?: boolean;
}

/** status 输出：结构化克隆兼容值，不含输入原文、凭证材料与内部路径。 */
export interface IStatusOutput {
  readonly service: string;
  readonly capabilityId: string;
  readonly bridgeCapabilityId: string;
  readonly uptimeMs: number;
  readonly processedJobs: number;
  readonly inFlightJobs: number;
}

/** 输入 schema：可离线编译子集——顶层 object、additionalProperties false、无远程 $ref（§7.4）。 */
const statusInputSchema: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verbose: { type: 'boolean', description: '预留的详细输出开关；样例输出恒为摘要' },
  },
};

/**
 * 创建状态查询 Bridge 能力：纯计算能力声明空权限数组（06-服务插件开发指南 §7.4）。
 * execute 收到的 input 已通过 schema 校验；实现仍执行业务级二次校验并响应取消信号，
 * 输出为结构化克隆兼容值（§7.6 实现约束）。
 */
export function createStatusCapability(
  state: IContentServiceRuntimeState
): ICapability<IStatusInput, IStatusOutput> {
  return {
    id: BRIDGE_CAPABILITY_ID,
    permissions: [],
    schema: statusInputSchema,
    execute: async (input: IStatusInput, capabilityCtx): Promise<IStatusOutput> => {
      throwIfCancelled(capabilityCtx.signal);
      if (typeof input !== 'object' || input === null) {
        throw inputInvalid('输入必须为对象。', { field: 'input' });
      }
      return {
        service: CORDIS_SERVICE_NAME,
        capabilityId: CONTENT_CAPABILITY_ID,
        bridgeCapabilityId: BRIDGE_CAPABILITY_ID,
        uptimeMs: Date.now() - state.startedAtMs,
        processedJobs: state.processedJobs,
        inFlightJobs: state.inFlightJobs,
      };
    },
  };
}

/* ===== 服务插件入口（10-服务插件接口 §2）===== */

/**
 * 服务插件实现。
 *
 * start 中登记的定时器、订阅与两个对外形态（Cordis 服务 + Bridge 能力）全部归属
 * 插件 Fork；stop 与 effect 清理幂等。
 */
class ServicePlugin implements IServicePlugin {
  private context: IServiceContext | null = null;
  private running = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly state: IContentServiceRuntimeState = createRuntimeState();

  public async start(ctx: IServiceContext): Promise<void> {
    this.context = ctx;
    this.running = true;
    this.state.startedAtMs = Date.now();
    this.state.processedJobs = 0;
    this.state.inFlightJobs = 0;

    const intervalSeconds = await this.readIntervalSeconds(ctx);
    this.startHeartbeat(ctx, intervalSeconds);
    // 定时器清理统一经 effect 登记，随 Fork 撤销（10-服务插件接口 §3.8）。
    ctx.effect(() => {
      if (this.heartbeatTimer !== null) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    });

    // 配置热更新：心跳周期变更即重启定时器；订阅句柄随 Fork 经 effect 撤销。
    const subscription: IEventSubscription = ctx.config.watch(CONFIG_KEY, (change) => {
      const value = change.effectiveValue;
      if (typeof value === 'number' && Number.isFinite(value)) {
        const next = Math.min(
          Math.max(Math.round(value), MIN_INTERVAL_SECONDS),
          MAX_INTERVAL_SECONDS
        );
        if (next !== intervalSeconds) {
          this.startHeartbeat(ctx, next);
          ctx.logger.info('心跳周期已更新', { intervalSeconds: next });
        }
      }
    });
    ctx.effect(() => {
      subscription.dispose();
    });

    // Cordis 内容处理服务（04-能力契约规范 §8.1）。
    ctx.provide(CORDIS_SERVICE_NAME, createConvertService(this.state));
    // Bridge 能力（06-服务插件开发指南 §7.2）：注册只能在 start() 执行期间调用，
    // 平台以 start 成功返回作为提交点；串行策略演示注册选项形状（§7.3）。
    ctx.registerCapability(createStatusCapability(this.state), {
      timeoutMs: 30_000,
      concurrency: 'serial',
      maxQueue: 16,
    });

    ctx.logger.info('服务已启动', {
      pluginId: ctx.pluginId,
      service: CORDIS_SERVICE_NAME,
      capability: CONTENT_CAPABILITY_ID,
      intervalSeconds,
    });
  }

  public async stop(): Promise<void> {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.running = false;
    this.context = null;
  }

  public async health(): Promise<boolean> {
    return this.running && this.context !== null;
  }

  /**
   * 读取心跳周期配置；缺失或非法时回退默认值。
   *
   * @param ctx - 服务上下文
   * @returns 归一后的周期秒数
   */
  private async readIntervalSeconds(ctx: IServiceContext): Promise<number> {
    try {
      const view = await ctx.config.get(CONFIG_KEY);
      const value = view.value;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(Math.max(Math.round(value), MIN_INTERVAL_SECONDS), MAX_INTERVAL_SECONDS);
      }
    } catch {
      // 配置缺失或读取失败时回退默认值，不阻断服务启动
    }
    return DEFAULT_INTERVAL_SECONDS;
  }

  /** 启动或重启心跳定时器；重复调用先清理旧定时器，句柄归属本类。 */
  private startHeartbeat(ctx: IServiceContext, intervalSeconds: number): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
    }
    this.heartbeatTimer = setInterval(() => {
      ctx.logger.debug('服务心跳', { pluginId: ctx.pluginId });
    }, intervalSeconds * 1000);
  }
}

export default new ServicePlugin();
`;
}

function descriptorSchemaJson(context: IScaffoldContext): string {
  const ids = templateIds(context);
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      'x-chips-contract': 'IContentCapabilityDescriptor（04-能力契约规范 §8.3）',
      title: `内容处理能力描述符：${context.options.name}`,
      type: 'object',
      additionalProperties: false,
      required: [
        'id',
        'service',
        'provider',
        'operations',
        'sourceFormats',
        'targetFormats',
        'streaming',
        'maxInlineInputBytes',
        'contractPackage',
      ],
      properties: {
        id: {
          type: 'string',
          const: ids.contentCapabilityId,
          description:
            '内容处理能力 ID（04-能力契约规范 §8.2 文法，`<service>.<operation>` 恰为两段；官方登记处为 §8.4，一经登记即稳定）',
        },
        service: {
          type: 'string',
          const: ids.cordisServiceName,
          description: '本插件注册的 Cordis 服务名（content- 前缀，内核服务文法）',
        },
        provider: {
          type: 'string',
          const: ids.providerPluginId,
          description: '提供方插件 ID（官方插件使用 chips.service.* 命名空间）',
        },
        operations: {
          type: 'array',
          items: { type: 'string', const: 'convert' },
          minItems: 1,
          maxItems: 1,
          description: '服务方法名（原子操作）；每个能力 ID 恰好一个操作',
        },
        sourceFormats: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: '接受的规范化来源格式',
        },
        targetFormats: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: '产出的规范化目标格式',
        },
        streaming: {
          type: 'object',
          additionalProperties: false,
          properties: {
            input: { type: 'boolean', const: false },
            output: { type: 'boolean', const: false },
          },
          description: '输入输出均为一次性结构化值，不支持流式',
        },
        maxInlineInputBytes: {
          type: 'integer',
          const: MAX_INLINE_INPUT_BYTES,
          description: '一次性输入上限（字节）；超出必须拒绝',
        },
        contractPackage: {
          type: 'string',
          const: `${ids.providerPluginId}/contracts`,
          description: '提供方契约包位置（本目录）',
        },
      },
      'x-chips-error-codes': {
        description:
          '错误统一为 ChipsError（code/message/details/retryable），message 简体中文；码形 <DOMAIN>_<REASON>，码族随提供方契约登记（04-能力契约规范 §8.6）；禁止复用 BRIDGE_* / FILE_* / RESOURCE_* / DOCUMENT_* 业务码前缀，BRIDGE_CANCELLED 为在册通道码',
        codes: [
          {
            code: 'CONTENT_INPUT_INVALID',
            retryable: false,
            meaning: '输入不支持：schema 校验通过后的业务级二次校验失败；details.field 携带字段名',
          },
          {
            code: 'BRIDGE_CANCELLED',
            retryable: false,
            meaning: '调用方取消（04-能力契约规范 §11.3 通道码）：AbortSignal 已中止时在安全点抛出',
          },
        ],
      },
    },
    null,
    2
  )}\n`;
}

function convertInputSchemaJson(context: IScaffoldContext): string {
  const ids = templateIds(context);
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      'x-chips-schema-version': 1,
      title: `${context.options.name}输入（${ids.contentCapabilityId}）`,
      description:
        '原子操作 convert 的输入。纯处理契约（04-能力契约规范 §8.3 通用约束 1）：不读写路径、不接触权限系统；输入为结构化克隆兼容值。',
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          minLength: 1,
          maxLength: MAX_INLINE_INPUT_BYTES,
          title: '待转换文本',
          description:
            'UTF-16 字符串；实现侧按 UTF-8 字节量做资源级二次校验，上限 ' +
            MAX_INLINE_INPUT_BYTES +
            ' 字节（与描述符 maxInlineInputBytes 一致，06-服务插件开发指南 §7.6）',
        },
        chunkSize: {
          type: 'integer',
          minimum: 64,
          maximum: 65536,
          default: 4096,
          title: '分块字符数',
          description: '省略时取默认值 4096；实现侧对越界值做边界归一',
        },
      },
    },
    null,
    2
  )}\n`;
}

function convertOutputSchemaJson(context: IScaffoldContext): string {
  const ids = templateIds(context);
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      'x-chips-schema-version': 1,
      title: `${context.options.name}输出（${ids.contentCapabilityId}）`,
      description:
        '原子操作 convert 的输出。纯计算产物：结构化克隆兼容值，不含输入原文、凭证材料与内部路径（04-能力契约规范 §8.3 通用约束 5）。',
      type: 'object',
      additionalProperties: false,
      required: ['chunks', 'processedChars', 'processedBytes', 'durationMs', 'warnings'],
      properties: {
        chunks: {
          type: 'integer',
          minimum: 1,
          title: '分块数量',
        },
        processedChars: {
          type: 'integer',
          minimum: 1,
          title: '处理的 UTF-16 字符总数',
        },
        processedBytes: {
          type: 'integer',
          minimum: 1,
          title: '处理的 UTF-8 字节总数',
        },
        durationMs: {
          type: 'integer',
          minimum: 0,
          title: '处理耗时（毫秒）',
        },
        warnings: {
          type: 'array',
          title: '警告面：不是错误，随结果返回',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', title: '警告码（随提供方契约发布）' },
              message: { type: 'string', title: '简体中文警告说明' },
            },
          },
        },
      },
    },
    null,
    2
  )}\n`;
}

function configSchema(context: IScaffoldContext): string {
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `${context.options.name}配置`,
      'x-chips-schema-version': 1,
      type: 'object',
      additionalProperties: false,
      properties: {
        'interval-seconds': {
          type: 'integer',
          minimum: 1,
          maximum: 3600,
          default: 30,
          title: '心跳周期（秒）',
        },
      },
    },
    null,
    2
  )}\n`;
}

function testsTs(context: IScaffoldContext): string {
  const ids = templateIds(context);
  return `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChipsError } from '@chips/sdk';
import type { ICapability, ICapabilityContext, IServiceContext } from '@chips/sdk';
import plugin, {
  BRIDGE_CAPABILITY_ID,
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  contentCapabilityDescriptor,
} from '../src/index';
import type { IConvertProgress, IConvertService, IStatusOutput } from '../src/index';

interface ICapabilityCall {
  readonly capability: { readonly id: string };
  readonly options?: { readonly timeoutMs?: number; readonly concurrency?: string; readonly maxQueue?: number };
}

interface IContextStub {
  readonly ctx: IServiceContext;
  readonly provides: { name: string; service: unknown }[];
  readonly capabilityCalls: ICapabilityCall[];
  readonly effects: (() => void)[];
  readonly info: ReturnType<typeof vi.fn>;
  readonly debug: ReturnType<typeof vi.fn>;
}

function createContext(intervalSeconds: unknown): IContextStub {
  const info = vi.fn();
  const debug = vi.fn();
  const provides: { name: string; service: unknown }[] = [];
  const capabilityCalls: ICapabilityCall[] = [];
  const effects: (() => void)[] = [];
  const ctx = {
    pluginId: '${ids.providerPluginId}',
    config: {
      get: async (key: string) => ({
        key: 'plugins.${ids.providerPluginId}.' + key,
        value: intervalSeconds,
        layer: 'plugin',
        isDefault: true,
      }),
      watch: () => ({ dispose: () => undefined }),
    },
    logger: { debug, info, warn: vi.fn(), error: vi.fn() },
    provide: (name: string, service: unknown) => {
      provides.push({ name, service });
    },
    registerCapability: (capability: { id: string }, options?: ICapabilityCall['options']) => {
      capabilityCalls.push({ capability, ...(options === undefined ? {} : { options }) });
    },
    effect: (cleanup: () => void) => {
      effects.push(cleanup);
    },
  } as unknown as IServiceContext;
  return { ctx, provides, capabilityCalls, effects, info, debug };
}

async function startPlugin(intervalSeconds: unknown = 30): Promise<IContextStub> {
  const stub = createContext(intervalSeconds);
  await plugin.start(stub.ctx);
  return stub;
}

function convertServiceOf(stub: IContextStub): IConvertService {
  expect(stub.provides).toHaveLength(1);
  return stub.provides[0]?.service as IConvertService;
}

function statusCapabilityOf(
  stub: IContextStub
): ICapability<Record<string, unknown>, IStatusOutput> {
  expect(stub.capabilityCalls).toHaveLength(1);
  return stub.capabilityCalls[0]?.capability as unknown as ICapability<
    Record<string, unknown>,
    IStatusOutput
  >;
}

describe('服务插件生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await plugin.stop();
    vi.useRealTimers();
  });

  it('start 登记 Cordis 服务与 Bridge 能力并进入健康态', async () => {
    const stub = await startPlugin();
    expect(await plugin.health()).toBe(true);
    expect(stub.provides[0]?.name).toBe(CORDIS_SERVICE_NAME);
    expect(stub.capabilityCalls[0]?.capability.id).toBe(BRIDGE_CAPABILITY_ID);
    expect(stub.capabilityCalls[0]?.options).toEqual({
      timeoutMs: 30000,
      concurrency: 'serial',
      maxQueue: 16,
    });
    expect(stub.info).toHaveBeenCalledTimes(1);
  });

  it('心跳按配置周期输出日志', async () => {
    const { debug } = await startPlugin(2);
    vi.advanceTimersByTime(2000);
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it('stop 幂等且停后不再心跳', async () => {
    const { debug } = await startPlugin(5);
    await plugin.stop();
    expect(await plugin.health()).toBe(false);
    await plugin.stop();
    vi.advanceTimersByTime(10000);
    expect(debug).not.toHaveBeenCalled();
  });
});

describe('异步 job 编排', () => {
  afterEach(async () => {
    await plugin.stop();
  });

  it('convert 进度阶段齐全、单调不减且终值为 100', async () => {
    const stub = await startPlugin();
    const service = convertServiceOf(stub);
    const progress: IConvertProgress[] = [];
    const output = await service.convert(
      { text: 'x'.repeat(1000), chunkSize: 300 },
      { onProgress: (item) => progress.push(item) }
    );
    expect(output.chunks).toBe(4);
    expect(output.processedChars).toBe(1000);
    expect(output.processedBytes).toBe(1000);
    expect(output.durationMs).toBeGreaterThanOrEqual(0);
    expect(output.warnings).toEqual([]);
    expect(progress[0]?.stage).toBe('prepare');
    expect(progress.at(-1)).toMatchObject({ stage: 'completed', percent: 100 });
    expect(new Set(progress.map((item) => item.stage))).toEqual(
      new Set(['prepare', 'transform', 'cleanup', 'completed'])
    );
    for (let index = 1; index < progress.length; index += 1) {
      expect(progress[index]?.percent).toBeGreaterThanOrEqual(progress[index - 1]?.percent ?? 0);
    }
  });

  it('convert 响应取消令牌：拒绝 BRIDGE_CANCELLED 并幂等清理', async () => {
    const stub = await startPlugin();
    const service = convertServiceOf(stub);
    const status = statusCapabilityOf(stub);
    const controller = new AbortController();
    const pending = service.convert(
      { text: 'y'.repeat(5000), chunkSize: 64 },
      {
        signal: controller.signal,
        onProgress: (item) => {
          if (item.percent > 10) {
            controller.abort();
          }
        },
      }
    );
    const caught: unknown = await pending.then(
      () => null,
      (error: unknown) => error
    );
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe('BRIDGE_CANCELLED');
    expect((caught as ChipsError).retryable).toBe(false);
    const signal = new AbortController().signal;
    const snapshot = await status.execute({}, { signal } as ICapabilityContext);
    expect(snapshot.inFlightJobs).toBe(0);
  });

  it('convert 输入校验失败抛 CONTENT_INPUT_INVALID', async () => {
    const stub = await startPlugin();
    const service = convertServiceOf(stub);
    const caught: unknown = await service
      .convert({ text: '' })
      .then(
        () => null,
        (error: unknown) => error
      );
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe('CONTENT_INPUT_INVALID');
  });

  it('status 能力返回运行统计且响应取消信号', async () => {
    const stub = await startPlugin();
    const service = convertServiceOf(stub);
    const status = statusCapabilityOf(stub);
    await service.convert({ text: 'z'.repeat(128), chunkSize: 64 });
    const signal = new AbortController().signal;
    const snapshot = await status.execute({}, { signal } as ICapabilityContext);
    expect(snapshot.service).toBe(CORDIS_SERVICE_NAME);
    expect(snapshot.capabilityId).toBe(CONTENT_CAPABILITY_ID);
    expect(snapshot.processedJobs).toBe(1);
    expect(snapshot.inFlightJobs).toBe(0);
    const aborted = new AbortController();
    aborted.abort();
    const caught: unknown = await status
      .execute({}, { signal: aborted.signal } as ICapabilityContext)
      .then(
        () => null,
        (error: unknown) => error
      );
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe('BRIDGE_CANCELLED');
  });

  it('描述符声明与标识常量一致', async () => {
    const stub = await startPlugin();
    const descriptor = contentCapabilityDescriptor;
    expect(descriptor.id).toBe(CONTENT_CAPABILITY_ID);
    expect(descriptor.service).toBe(CORDIS_SERVICE_NAME);
    expect(descriptor.provider).toBe(stub.ctx.pluginId);
    expect(descriptor.operations).toEqual(['convert']);
    expect(descriptor.contractPackage).toBe(stub.ctx.pluginId + '/contracts');
  });
});
`;
}

/** 构建 `service` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildServiceFiles(context: IScaffoldContext): IScaffoldFile[] {
  return [
    { path: 'src/index.ts', content: indexTs(context) },
    { path: 'contracts/descriptor.schema.json', content: descriptorSchemaJson(context) },
    { path: 'contracts/convert.input.schema.json', content: convertInputSchemaJson(context) },
    { path: 'contracts/convert.output.schema.json', content: convertOutputSchemaJson(context) },
    { path: 'assets/schemas/config.schema.json', content: configSchema(context) },
    { path: 'tests/service.test.ts', content: testsTs(context) },
  ];
}
