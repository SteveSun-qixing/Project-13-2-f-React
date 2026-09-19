/**
 * 文档侧契约模型装载：一次读取全部权威表，供各检查与快照复用。
 */

import type { DocReader } from './reader.js';
import { parseCapabilityModel, type DocCapabilityModel } from './capabilities.js';
import { parsePermissionModel, type DocPermissionModel } from './permissions.js';
import { parseEventModel, type DocEventModel } from './events.js';
import { parseErrorRegistry, type DocErrorRegistry } from './errors.js';
import { parseRoleModel, type DocRoleModel } from './roles.js';
import { parseSdkExportModel, type SdkExportModel } from './sdk.js';
import { parseFrameProtocolModel, type FrameProtocolModel } from './frame.js';

export interface DocModels {
  readonly capabilities: DocCapabilityModel;
  readonly permissions: DocPermissionModel;
  readonly events: DocEventModel;
  readonly errors: DocErrorRegistry;
  readonly roles: DocRoleModel;
  readonly sdk: SdkExportModel;
  readonly frame: FrameProtocolModel;
}

export function loadDocModels(reader: DocReader): DocModels {
  return {
    capabilities: parseCapabilityModel(reader),
    permissions: parsePermissionModel(reader),
    events: parseEventModel(reader),
    errors: parseErrorRegistry(reader),
    roles: parseRoleModel(reader),
    sdk: parseSdkExportModel(reader),
    frame: parseFrameProtocolModel(reader),
  };
}

export { createFileReader, createMemoryReader, docRefLabel, type DocReader, type DocRef } from './reader.js';
export { CAPABILITY_ID_PATTERN, PERMISSION_ID_PATTERN, toBasePermission, type DocCapability, type DocCapabilityModel } from './capabilities.js';
export { type DocPermissionModel } from './permissions.js';
export { EVENT_ID_PATTERN, classifyVisibility, type DocEvent, type DocEventModel, type DocEventPayloadField, type DocReservedDomain, type DocVisibilityKind } from './events.js';
export { ERROR_CODE_PATTERN, domainCodes, errorSourceRef, type DocErrorDomain, type DocErrorRegistry } from './errors.js';
export { type DocExportClaim, type DocRole, type DocRoleDeclaration, type DocRoleModel } from './roles.js';
export { isTypeExported, sdkConcreteTypeNames, type SdkExportModel, type SdkTypeExport, type SdkValueExport } from './sdk.js';
export { type FrameDirection, type FrameMessageDeclaration, type FrameProtocolModel, type FrameTableRow } from './frame.js';
export { ROLE_ENTRY_INTERFACES, type RoleName } from './sources.js';
export type {
  NormalizedDeclaration,
  NormalizedInterface,
  NormalizedMember,
  NormalizedTypeAlias,
} from './ts-declarations.js';
