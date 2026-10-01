/**
 * 笔记编辑会话（写面前端侧，《本轮架构收口裁决》B3 的应用侧对应面）。
 *
 * 回流唯一时序（裁决 B3，08-基础卡片插件接口 §4.3 同源）：`getChange()` → 校验 →
 * `document:write`（输出 `{ revision }`）→ 投影更新（update）→ `markCommitted(revision)`。
 * 应用不落盘（`document:write` 只改宿主内存模型；落盘唯一入口是 `document:save`），
 * 投影以写后 `document:read` 重读为准，不本地拼装第二事实源。
 *
 * 修订锁：`{ revision }` 回执严格递增（`04-能力契约规范` §7.3：从 1 开始，每次成功写入
 * 前进 1）；不大于当前水位的回执一律拒绝（revision-stale），投影与 markCommitted 均不执行。
 *
 * 校验臂错误码与宿主 `validation.ts` 同场景同码镜像：name 空 → `DOCUMENT_METADATA_INVALID`、
 * 内容切片非对象 → `BRIDGE_INVALID_INPUT`；本模块不自造第二套校验码。
 */

import type { BoxMetadata, CardMetadata, ContentNode } from '@chips/sdk';

/** 编辑变更（`getChange()` 回执；一次会话持一份待提交变更，与 IBaseCardEditor 单 pending 同型）。 */
export type NoteEditChange =
  | { readonly facet: 'rename'; readonly nextName: string }
  | { readonly facet: 'description'; readonly nextDescription: string }
  | { readonly facet: 'content'; readonly nodeId: string; readonly nextValue: Record<string, unknown> };

/** 变更校验结果：通过，或携带宿主同码错误与简体中文消息。 */
export type NoteEditValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errorCode: string; readonly message: string };

/** 内容 JSON 文本解析结果。 */
export type ContentJsonParse =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly errorCode: string; readonly message: string };

/**
 * 编辑变更校验（宿主 `validation.ts` 同场景同码镜像；提交链第②拍）。
 *
 * - rename：`name` 必填且为非空字符串（`DOCUMENT_METADATA_INVALID`）；
 * - description：任意字符串（箱子 `description` 为可选字段，空串即清空）；
 * - content：值必须是 JSON 对象（数组拒绝，`BRIDGE_INVALID_INPUT`，与宿主
 *   `invalidSliceValue` 的「内容切片必须是对象」同码）。
 */
export function validateNoteEditChange(change: NoteEditChange): NoteEditValidation {
  if (change.facet === 'rename') {
    if (change.nextName.trim().length === 0) {
      return { ok: false, errorCode: 'DOCUMENT_METADATA_INVALID', message: 'name 必填且为非空字符串' };
    }
    return { ok: true };
  }
  if (change.facet === 'description') {
    return { ok: true };
  }
  if (Array.isArray(change.nextValue)) {
    return { ok: false, errorCode: 'BRIDGE_INVALID_INPUT', message: '内容切片必须是 JSON 对象' };
  }
  return { ok: true };
}

/** 内容 JSON 文本解析：非对象形态（数组、标量、null）与解析失败都以 `BRIDGE_INVALID_INPUT` 如实回码。 */
export function parseContentJsonText(text: string): ContentJsonParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: 'BRIDGE_INVALID_INPUT', message: '内容不是合法的 JSON 文本' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errorCode: 'BRIDGE_INVALID_INPUT', message: '内容必须是 JSON 对象' };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

/**
 * 元数据写切片装配（整体替换语义）：保留其余字段，替换补丁字段并前移 `modified_at`
 * （修改时间是本次编辑的事实，写入时点由编辑链路负责）。
 */
export function buildMetadataWriteSlice<M extends CardMetadata | BoxMetadata>(
  metadata: M,
  patch: { readonly name?: string; readonly description?: string },
  modifiedAt: string,
): M {
  const next: Record<string, unknown> = { ...metadata, modified_at: modifiedAt };
  if (patch.name !== undefined) {
    next.name = patch.name;
  }
  if (patch.description !== undefined) {
    next.description = patch.description;
  }
  return next as M;
}

/** 内容写切片装配（按节点整体替换）：保留 `node_id` / `file` / `card_type`，只换 `value`。 */
export function buildContentWriteSlice(node: ContentNode, nextValue: Record<string, unknown>): ContentNode {
  return { ...node, value: nextValue };
}

/** 提交链写通道：接收待提交变更，执行 `document:write` 并交付修订回执。 */
export type NoteEditWriteExecutor = (change: NoteEditChange) => Promise<number>;

/** 提交链投影更新（裁决第④拍 update 面）：写后重读投影更新，由界面层装配。 */
export type NoteEditProjectionApply = (change: NoteEditChange) => Promise<void>;

/** 提交链结局（界面按状态呈现；错误态携带真实错误码，不吞错）。 */
export type NoteEditCommitOutcome =
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
  | { readonly status: 'committed'; readonly revision: number };

/** 从抛出值提取归一错误（写通道/投影通道共用）：通道错误以 `code` 结构识别，不依赖类型引用。 */
function describeThrownError(error: unknown, fallbackCode: string): { errorCode: string; message: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return {
        errorCode: code,
        message: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
  return { errorCode: fallbackCode, message: error instanceof Error ? error.message : '未知错误' };
}

/**
 * 单文档编辑会话：待提交变更持有、修订水位锁与提交链时序的唯一载体。
 *
 * 水位语义（`markCommitted` / `update` 与 richtext 基础卡片编辑器同型）：
 * 不大于当前水位的修订号一律忽略，待提交变更不被陈旧回执清空。
 */
export class NoteEditSession {
  public readonly documentId: string;

  private watermark: number;

  private pending: NoteEditChange | null = null;

  public constructor(documentId: string, initialRevision = 0) {
    this.documentId = documentId;
    this.watermark = initialRevision;
  }

  /** 当前修订水位（已确认的最近 `{ revision }` 回执；0 = 本会话尚未写入）。 */
  public get revision(): number {
    return this.watermark;
  }

  /** 是否持有待提交变更。 */
  public isDirty(): boolean {
    return this.pending !== null;
  }

  /** 裁决第①拍：取待提交变更（无则为 null）。 */
  public getChange(): NoteEditChange | null {
    return this.pending;
  }

  /** 暂存重命名：与当前名一致（去空白后）即清除待提交。 */
  public stageRename(currentName: string, nextName: string): void {
    const trimmed = nextName.trim();
    if (trimmed === currentName) {
      this.clearPendingOf('rename');
      return;
    }
    this.pending = { facet: 'rename', nextName: trimmed };
  }

  /** 暂存描述修改：与当前描述一致即清除待提交。 */
  public stageDescription(currentDescription: string | undefined, nextDescription: string): void {
    if (nextDescription === (currentDescription ?? '')) {
      this.clearPendingOf('description');
      return;
    }
    this.pending = { facet: 'description', nextDescription };
  }

  /**
   * 暂存内容节点修改：JSON 文本先解析装配（失败如实回码、不产生待提交）；
   * 与当前文本一致（未修改）即清除待提交。
   */
  public stageContent(
    nodeId: string,
    currentJsonText: string,
    nextJsonText: string,
  ): { readonly ok: true } | { readonly ok: false; readonly errorCode: string; readonly message: string } {
    if (nextJsonText === currentJsonText) {
      this.clearPendingOf('content');
      return { ok: true };
    }
    const parsed = parseContentJsonText(nextJsonText);
    if (!parsed.ok) {
      return { ok: false, errorCode: parsed.errorCode, message: parsed.message };
    }
    this.pending = { facet: 'content', nodeId, nextValue: parsed.value };
    return { ok: true };
  }

  /** 放弃待提交变更（不触达写通道）。 */
  public discard(): void {
    this.pending = null;
  }

  /**
   * 裁决第④拍 update 面：外部修订推进（渲染会话/宿主侧 advance 的对应面）。
   * 不大于当前水位的修订号忽略并返回 false。
   */
  public update(revision: number): boolean {
    return this.advanceWatermark(revision);
  }

  /**
   * 裁决第⑤拍：确认提交——推进水位并清空待提交变更；旧修订号忽略（返回 false，待提交保留）。
   */
  public markCommitted(revision: number): boolean {
    if (!this.advanceWatermark(revision)) {
      return false;
    }
    this.pending = null;
    return true;
  }

  /**
   * 提交链（裁决唯一时序的应用前端侧落点）：
   * ① `getChange()` → ② 校验 → ③ `document:write`（写通道回执）→ ④ 投影更新 → ⑤ `markCommitted`。
   *
   * 任一前序拍失败即短路：校验失败不触达写通道；写失败不动投影与水位；
   * 回执未严格递增不确认提交；投影更新失败不确认提交（写已发生但会话视图未证实，可重试）。
   */
  public async commit(
    executor: NoteEditWriteExecutor,
    applyProjection: NoteEditProjectionApply,
  ): Promise<NoteEditCommitOutcome> {
    const change = this.getChange();
    if (change === null) {
      return { status: 'no-change' };
    }
    const validated = validateNoteEditChange(change);
    if (!validated.ok) {
      return { status: 'invalid', errorCode: validated.errorCode, message: validated.message };
    }
    let revision: number;
    try {
      revision = await executor(change);
    } catch (error: unknown) {
      const described = describeThrownError(error, 'DOCUMENT_GATEWAY_ERROR');
      return { status: 'write-failed', errorCode: described.errorCode, message: described.message };
    }
    if (revision <= this.watermark || !Number.isInteger(revision) || revision <= 0) {
      return { status: 'revision-stale', received: revision, watermark: this.watermark };
    }
    try {
      await applyProjection(change);
    } catch (error: unknown) {
      const described = describeThrownError(error, 'DOCUMENT_GATEWAY_ERROR');
      return {
        status: 'projection-failed',
        revision,
        errorCode: described.errorCode,
        message: described.message,
      };
    }
    this.markCommitted(revision);
    return { status: 'committed', revision };
  }

  /** 严格递增水位推进：不大于当前水位（或非正整数）的修订号一律忽略。 */
  private advanceWatermark(revision: number): boolean {
    if (!Number.isInteger(revision) || revision <= 0 || revision <= this.watermark) {
      return false;
    }
    this.watermark = revision;
    return true;
  }

  private clearPendingOf(facet: NoteEditChange['facet']): void {
    if (this.pending?.facet === facet) {
      this.pending = null;
    }
  }
}
