/**
 * 富文本编辑会话（编辑臂；固定复合卡片的单文档编辑会话前端侧落点）。
 *
 * 回流唯一时序（08-基础卡片插件接口 §4.3 规则 1、12-编辑引擎设计 §6.1 同源）：
 * `getChange()` → 编辑链路校验 → `document:write`（输出 `{ revision }`）→ 投影更新
 * （update）→ `markCommitted(revision)`。应用不落盘（`document:write` 只改宿主内存模型；
 * 落盘唯一入口是 `document:save`），投影以写后 `document:read` 重读为准，不本地拼装第二事实源。
 *
 * 修订锁：`{ revision }` 回执严格递增（04-能力契约规范 §7.3：从 1 开始，每次成功写入前进 1）；
 * 不大于当前水位的回执一律拒绝（revision-stale），投影与 `markCommitted` 均不执行（12 §3.5）。
 *
 * 校验臂（回流第②拍）：内容字段按《01-卡片文件格式》§6.6 闸（inline/file 互斥、能力矩阵、
 * 正文非空），展示 `config` 按插件 `validateConfig`（08 §2.4.3，configSchema 同口径）；
 * 失败码使用生成契约常量 `EDIT_VALIDATION_FAILED`（12 §6.5、§9.2），不自造第二套码。
 *
 * 写值装配：`replace` 变更为插件编辑器 emit 的内容全量（插件模型不感知的 §6.1 保留字段
 * `theme` 自基线保真回填）；`patch` 变更按 RFC 6901 增量应用到基线（缺失父位按插件契约
 * emit 形态补建）。编辑器不写文件；`discard()` 丢弃会话待提交镜像，编辑面草稿按 08 §4.3
 * 规则 9 经重挂载丢弃。
 */

import type { BaseCardChange, BaseCardView, IBaseCardEditor, ISubscription } from '@chips/sdk';
import { validateConfig } from '@chips/plugin-richtext';
import { normalizeRelativeResourcePath } from '../card/path';
import { assembleBaseCardView } from './sessionView';

/** 回流校验闸失败码（生成契约常量，12 §9.2）。 */
const EDIT_VALIDATION_FAILED = 'EDIT_VALIDATION_FAILED';

/** 能力矩阵七项（§6.6 required 顺序）。 */
const MARKDOWN_CAPABILITY_KEYS = [
  'commonmark',
  'gfm',
  'math',
  'highlight',
  'underline',
  'superscript',
  'subscript',
] as const;

/** 校验结果：通过，或携带失败码与简体中文消息。 */
export type ChangeValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errorCode: string; readonly message: string };

/** 从变更内容读取普通对象形态（数组与原始值一律拒绝）。 */
function readPlainRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 读取非空字符串（去首尾空白）。 */
function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** 校验卡片根相对 `.md` 资源路径（§6.6 content_file + §8.2 保留命名空间同口径）。 */
function isValidContentFilePath(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = normalizeRelativeResourcePath(value);
  return (
    !!normalized &&
    normalized === value &&
    normalized.toLowerCase().endsWith('.md') &&
    !normalized.startsWith('.card/') &&
    !normalized.startsWith('content/')
  );
}

/** 校验 `replace` 变更内容根（§6.6 字段级闸 + 插件 validateConfig configSchema 同口径）。 */
function validateReplaceContent(content: Record<string, unknown>): ChangeValidation {
  if (content['card_type'] !== 'base.richtext') {
    return {
      ok: false,
      errorCode: EDIT_VALIDATION_FAILED,
      message: 'content_type 必须为 base.richtext',
    };
  }
  if (content['content_format'] !== 'markdown') {
    return {
      ok: false,
      errorCode: EDIT_VALIDATION_FAILED,
      message: 'content_format 必须为 markdown',
    };
  }
  const source = content['content_source'];
  if (source === 'inline') {
    if (readNonEmptyString(content['content_text']) === null) {
      return { ok: false, errorCode: EDIT_VALIDATION_FAILED, message: 'inline 模式正文不能为空' };
    }
    if (content['content_file'] !== undefined) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'inline 模式不能携带 content_file',
      };
    }
  } else if (source === 'file') {
    if (!isValidContentFilePath(content['content_file'])) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'content_file 必须为卡片根相对的 .md 资源路径',
      };
    }
    const text = content['content_text'];
    if (typeof text === 'string' && text.trim().length > 0) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'file 模式不能携带非空 content_text',
      };
    }
  } else {
    return {
      ok: false,
      errorCode: EDIT_VALIDATION_FAILED,
      message: 'content_source 必须为 inline 或 file',
    };
  }
  const capabilities = readPlainRecord(content['markdown_capabilities']);
  if (capabilities === null) {
    return {
      ok: false,
      errorCode: EDIT_VALIDATION_FAILED,
      message: 'markdown_capabilities 必须显式声明',
    };
  }
  for (const key of MARKDOWN_CAPABILITY_KEYS) {
    if (typeof capabilities[key] !== 'boolean') {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: `markdown_capabilities.${key} 必须显式声明为布尔值`,
      };
    }
  }
  if (!validateConfig(content['config'])) {
    return {
      ok: false,
      errorCode: EDIT_VALIDATION_FAILED,
      message: '展示 config 不满足插件 configSchema 口径',
    };
  }
  return { ok: true };
}

/** 校验 `patch` 变更操作面（RFC 6901 增量；根指针与 `~` 转义段不在本会话取值内）。 */
function validatePatchOperations(
  operations: readonly { op: string; path: string; value?: unknown }[]
): ChangeValidation {
  for (const operation of operations) {
    if (operation.op !== 'add' && operation.op !== 'remove' && operation.op !== 'replace') {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: `patch 操作 ${operation.op} 不在契约取值内`,
      };
    }
    if (!operation.path.startsWith('/') || operation.path.length < 2) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'patch 指针必须为非根 RFC 6901 相对指针',
      };
    }
    if (operation.path.includes('~')) {
      return { ok: false, errorCode: EDIT_VALIDATION_FAILED, message: 'patch 指针不允许 ~ 转义段' };
    }
    if (operation.op !== 'remove' && operation.value === undefined) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'add / replace 操作必须携带 value',
      };
    }
  }
  return { ok: true };
}

/** 编辑变更校验（回流第②拍）：失败即拒绝回流，不触达写通道（12 §6.5）。 */
export function validateEditorChange(change: BaseCardChange): ChangeValidation {
  if (change.kind === 'replace') {
    const content = readPlainRecord(change.content);
    if (content === null) {
      return {
        ok: false,
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'replace 变更内容必须是对象',
      };
    }
    return validateReplaceContent(content);
  }
  return validatePatchOperations(change.operations);
}

/** 深拷贝 JSON 值（文档模型切片可 JSON 往返；循环引用不在取值内）。 */
function deepCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** JSON 值恰等判定（键序无关；写值与投影重读的发散判定唯一口径）。 */
export function jsonEquals(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((item, index) => jsonEquals(item, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) => key in rightRecord && jsonEquals(leftRecord[key], rightRecord[key])
  );
}

/** 拆分 RFC 6901 相对指针为段（已由校验闸拒绝根指针与 `~` 转义段）。 */
function splitPointer(path: string): string[] {
  return path.slice(1).split('/');
}

/**
 * 由编辑基线与变更装配 `document:write` 内容写值。
 *
 * - `replace`：变更内容全量；基线中插件模型不感知的 §6.1 保留字段 `theme` 保真回填；
 * - `patch`：在基线深拷贝上顺序应用增量；缺失父位按插件契约 emit 形态补建，
 *   中途位为非对象时返回 `null`（由调用方按校验失败处理）。
 */
export function assembleWriteValue(
  baseline: Readonly<Record<string, unknown>>,
  change: BaseCardChange
): Record<string, unknown> | null {
  if (change.kind === 'replace') {
    const value: Record<string, unknown> = { ...change.content };
    if ('theme' in baseline && !('theme' in value)) {
      value['theme'] = baseline['theme'];
    }
    return value;
  }
  const value = deepCloneJson(baseline) as Record<string, unknown>;
  for (const operation of change.operations) {
    const segments = splitPointer(operation.path);
    const lastSegment = segments[segments.length - 1] ?? '';
    let cursor: Record<string, unknown> = value;
    for (const segment of segments.slice(0, -1)) {
      const next = cursor[segment];
      if (next === undefined || next === null) {
        const created: Record<string, unknown> = {};
        cursor[segment] = created;
        cursor = created;
        continue;
      }
      if (typeof next !== 'object' || Array.isArray(next)) {
        return null;
      }
      cursor = next as Record<string, unknown>;
    }
    if (operation.op === 'remove') {
      delete cursor[lastSegment];
      continue;
    }
    cursor[lastSegment] = deepCloneJson(operation.value);
  }
  return value;
}

/** 提交链写通道：接收装配后的写值，执行 `document:write` 并交付修订回执。 */
export type RichTextWriteExecutor = (value: Record<string, unknown>) => Promise<number>;

/** 提交链投影通道：写后 `document:read` 重读宿主模型（不本地拼装第二事实源）。 */
export type RichTextProjectionReader = () => Promise<Record<string, unknown>>;

/** 提交链端口。 */
export interface RichTextCommitPorts {
  readonly readNode: RichTextProjectionReader;
  readonly writeNode: RichTextWriteExecutor;
}

/** 保存链端口：在提交链端口之上追加 `document:save` 落盘入口。 */
export interface RichTextSavePorts extends RichTextCommitPorts {
  readonly save: () => Promise<{ source: string; digest: string }>;
}

/** 提交链结局（界面按状态呈现；错误态携带真实错误码，不吞错）。 */
export type RichTextCommitOutcome =
  | { readonly status: 'no-change' }
  | { readonly status: 'invalid'; readonly errorCode: string; readonly message: string }
  | { readonly status: 'write-failed'; readonly errorCode: string; readonly message: string }
  | { readonly status: 'revision-stale'; readonly received: number; readonly watermark: number }
  | {
      readonly status: 'projection-failed';
      readonly revision: number;
      readonly errorCode: string;
      readonly message: string;
    }
  | { readonly status: 'diverged'; readonly revision: number }
  | { readonly status: 'committed'; readonly revision: number };

/** 保存链结局：回执驱动界面保存态（12 §6.3 规则 6）。 */
export type RichTextCommitBlocker = Extract<
  RichTextCommitOutcome,
  { status: 'invalid' | 'write-failed' | 'revision-stale' | 'projection-failed' }
>;

export type RichTextSaveOutcome =
  | {
      readonly status: 'saved';
      readonly receipt: { readonly source: string; readonly digest: string };
      readonly committedRevision: number | null;
    }
  | { readonly status: 'commit-blocked'; readonly outcome: RichTextCommitBlocker }
  | { readonly status: 'save-failed'; readonly errorCode: string; readonly message: string };

/** 从抛出值提取归一错误（写通道/投影通道共用）：通道错误以 `code` 结构识别，不依赖类型引用。 */
function describeThrownError(
  error: unknown,
  fallbackCode: string
): { errorCode: string; message: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return { errorCode: code, message: error instanceof Error ? error.message : '未知错误' };
    }
  }
  return { errorCode: fallbackCode, message: error instanceof Error ? error.message : '未知错误' };
}

/**
 * 单文档编辑会话：待提交变更持有、修订水位锁与提交链时序的唯一载体。
 *
 * 水位语义（`markCommitted` 与 richtext 基础卡片编辑器句柄同型）：不大于当前水位的修订号
 * 一律忽略，待提交变更不被陈旧回执清空；投影重读与写值发散（外部并发修改）时以宿主真相
 * 重挂基线（`diverged`，界面经重挂载采纳，08 §4.3 会话视图前进口径）。
 */
export class RichTextEditSession {
  public readonly documentId: string;

  public readonly nodeId: string;

  private watermark: number;

  private baseline: Record<string, unknown>;

  private pending: BaseCardChange | null = null;

  private editor: IBaseCardEditor | null = null;

  private changeSubscription: ISubscription | null = null;

  public constructor(documentId: string, nodeId: string, initialRevision = 0) {
    this.documentId = documentId;
    this.nodeId = nodeId;
    this.watermark = initialRevision;
    this.baseline = {};
  }

  /** 当前修订水位（已确认的最近 `{ revision }` 回执；0 = 本会话尚未写入）。 */
  public get revision(): number {
    return this.watermark;
  }

  /** 是否持有待提交变更。 */
  public isDirty(): boolean {
    return this.pending !== null;
  }

  /** 裁决第①拍：取待提交变更（附着编辑器时直读编辑器，否则取会话镜像）。 */
  public getChange(): BaseCardChange | null {
    return this.editor !== null ? this.editor.getChange() : this.pending;
  }

  /** 会话基线（宿主模型内容根的最后确认快照）。 */
  public getBaseline(): Readonly<Record<string, unknown>> {
    return this.baseline;
  }

  /** 装载会话基线（打开/重读投影后调用；视图装配经 `assembleBaseCardView`）。 */
  public setBaseline(content: Record<string, unknown>, revision: number): void {
    this.baseline = content;
    if (Number.isInteger(revision) && revision > this.watermark) {
      this.watermark = revision;
    }
  }

  /** 附着编辑器：订阅 change 事件维护待提交镜像（时序第①拍 `getChange` 留给提交链）。 */
  public attachEditor(editor: IBaseCardEditor): void {
    this.detachEditor();
    this.editor = editor;
    this.changeSubscription = editor.subscribe(
      'change',
      (payload: { change: BaseCardChange }): void => {
        this.pending = payload.change;
      }
    );
  }

  /** 解除编辑器附着：撤销订阅；待提交镜像随编辑面释放清空（08 §4.3 规则 9 同口径）。 */
  public detachEditor(): void {
    this.changeSubscription?.dispose();
    this.changeSubscription = null;
    this.editor = null;
    this.pending = null;
  }

  /** 直接暂存变更（程序化驱动面；与 change 事件同语义）。 */
  public stageChange(change: BaseCardChange): void {
    this.pending = change;
  }

  /** 放弃会话待提交镜像；编辑面草稿经重挂载丢弃（08 §4.3 规则 9）。 */
  public discard(): void {
    this.pending = null;
  }

  /**
   * 提交链（回流唯一时序的应用前端侧落点）：
   * ① `getChange()` → ② 校验 → ③ `document:write`（修订回执）→ ④ 投影重读（update）→
   * ⑤ `markCommitted`。任一前序拍失败即短路：校验失败不触达写通道；写失败不动投影与水位；
   * 回执未严格递增不确认提交；投影失败不确认提交（写已发生但会话视图未证实，可重试）；
   * 投影与写值发散（外部并发修改）时确认提交并报告 `diverged`，界面以宿主真相重挂基线。
   */
  public async commit(ports: RichTextCommitPorts): Promise<RichTextCommitOutcome> {
    const change = this.getChange();
    if (change === null) {
      return { status: 'no-change' };
    }
    const validated = validateEditorChange(change);
    if (!validated.ok) {
      return { status: 'invalid', errorCode: validated.errorCode, message: validated.message };
    }
    const value = assembleWriteValue(this.baseline, change);
    if (value === null) {
      return {
        status: 'invalid',
        errorCode: EDIT_VALIDATION_FAILED,
        message: 'patch 变更在基线上不可应用（中途位非对象）',
      };
    }
    let revision: number;
    try {
      revision = await ports.writeNode(value);
    } catch (error: unknown) {
      const described = describeThrownError(error, 'DOCUMENT_GATEWAY_ERROR');
      return { status: 'write-failed', errorCode: described.errorCode, message: described.message };
    }
    if (!Number.isInteger(revision) || revision <= 0 || revision <= this.watermark) {
      return { status: 'revision-stale', received: revision, watermark: this.watermark };
    }
    let readBack: Record<string, unknown>;
    try {
      readBack = await ports.readNode();
    } catch (error: unknown) {
      const described = describeThrownError(error, 'DOCUMENT_GATEWAY_ERROR');
      return {
        status: 'projection-failed',
        revision,
        errorCode: described.errorCode,
        message: described.message,
      };
    }
    const diverged = !jsonEquals(readBack, value);
    this.editor?.markCommitted(revision);
    this.pending = null;
    this.watermark = revision;
    this.baseline = diverged ? readBack : value;
    return diverged ? { status: 'diverged', revision } : { status: 'committed', revision };
  }

  /**
   * 保存链（12 §6.3 规则 3 / 规则 5）：脏状态先完成当前待提交回流（flush），随后立即
   * `document:save`；干净状态直接保存（幂等）。回流未确认（invalid / write-failed /
   * revision-stale / projection-failed）即阻断保存，不触达落盘入口。
   */
  public async flushAndSave(ports: RichTextSavePorts): Promise<RichTextSaveOutcome> {
    let committedRevision: number | null = null;
    if (this.isDirty()) {
      const outcome = await this.commit(ports);
      if (outcome.status === 'committed' || outcome.status === 'diverged') {
        committedRevision = outcome.revision;
      } else if (outcome.status !== 'no-change') {
        // 到达此分支时 outcome 只能是四类阻断态（其余两类已在上方收口）。
        return { status: 'commit-blocked', outcome };
      }
    }
    try {
      const receipt = await ports.save();
      return { status: 'saved', receipt, committedRevision };
    } catch (error: unknown) {
      const described = describeThrownError(error, 'DOCUMENT_GATEWAY_ERROR');
      return { status: 'save-failed', errorCode: described.errorCode, message: described.message };
    }
  }

  /** 以会话基线与当前水位装配编辑器视图（重挂载/divergence 采纳面）。 */
  public assembleCurrentView(input: { cardId: string; cardName: string }): BaseCardView {
    return assembleBaseCardView({
      nodeId: this.nodeId,
      cardId: input.cardId,
      cardName: input.cardName,
      content: this.baseline,
      revision: this.watermark,
    });
  }
}
