/**
 * 快照数据构造：把文档模型投影为快照 JSON 的 `data` 部分。
 *
 * 投影规则：
 * - 角色：四角色逐一记录入口接口、来源与全部声明（同名且内容相同的重复声明去重）；
 * - SDK：包入口、值导出、类型导出（分类内保持文档顺序）与 testing 导出；
 * - 帧协议：协议常量、封套、消息声明、联合类型与消息清单表。
 */

import type { DocEventModel } from './docs/events.js';
import type { FrameProtocolModel } from './docs/frame.js';
import type { DocRole, DocRoleModel } from './docs/roles.js';
import type { SdkExportModel } from './docs/sdk.js';
import type { NormalizedDeclaration } from './docs/ts-declarations.js';
import { ROLE_ENTRY_INTERFACES } from './docs/sources.js';

export interface EventSnapshotEntry {
  readonly id: string;
  readonly payload: DocEventModel['events'][number]['payload'];
  readonly trigger: string;
  readonly visibility: string;
  readonly visibilityKind: string;
  readonly file: string;
}

/** 事件契约快照数据：按事件 ID 升序，payload/触发时机/可见性逐项锁定。 */
export function buildEventSnapshotData(model: DocEventModel): readonly EventSnapshotEntry[] {
  return [...model.events]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((event) => ({
      id: event.id,
      payload: event.payload,
      trigger: event.trigger,
      visibility: event.visibilityText,
      visibilityKind: event.visibilityKind,
      file: event.ref.file,
    }));
}

export interface RoleSnapshotEntry {
  readonly entry: string;
  readonly refs: readonly { readonly file: string; readonly section: string }[];
  readonly declarations: readonly NormalizedDeclaration[];
}

export function buildRoleSnapshotData(model: DocRoleModel): Record<string, RoleSnapshotEntry> {
  const data: Record<string, RoleSnapshotEntry> = {};
  for (const role of model.roles) {
    data[role.role] = {
      entry: ROLE_ENTRY_INTERFACES[role.role],
      refs: role.refs.map((ref) => ({ file: ref.file, section: ref.section })),
      declarations: uniqueDeclarations(role),
    };
  }
  return data;
}

function uniqueDeclarations(role: DocRole): readonly NormalizedDeclaration[] {
  const seen = new Map<string, string>();
  const declarations: NormalizedDeclaration[] = [];
  for (const entry of role.declarations) {
    const serialized = JSON.stringify(entry.declaration);
    const previous = seen.get(entry.declaration.name);
    if (previous !== undefined) {
      continue;
    }
    seen.set(entry.declaration.name, serialized);
    declarations.push(entry.declaration);
  }
  return declarations;
}

export interface SdkSnapshotData {
  readonly entries: SdkExportModel['entries'];
  readonly values: SdkExportModel['values'];
  readonly types: SdkExportModel['types'];
  readonly testing: SdkExportModel['testing'];
}

export function buildSdkSnapshotData(model: SdkExportModel): SdkSnapshotData {
  return { entries: model.entries, values: model.values, types: model.types, testing: model.testing };
}

export interface FrameSnapshotData {
  readonly protocol: string;
  readonly envelope: FrameProtocolModel['envelope'];
  readonly messages: FrameProtocolModel['messages'];
  readonly outboundUnions: FrameProtocolModel['outboundUnions'];
  readonly payloadTypes: FrameProtocolModel['payloadTypes'];
  readonly table: FrameProtocolModel['table'];
}

export function buildFrameSnapshotData(model: FrameProtocolModel): FrameSnapshotData {
  return {
    protocol: model.protocol,
    envelope: model.envelope,
    messages: model.messages,
    outboundUnions: model.outboundUnions,
    payloadTypes: model.payloadTypes,
    table: model.table,
  };
}
