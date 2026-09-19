import { constantName } from './naming.js';
import type { ContractModel, GeneratedFile, SourceRef } from './types.js';

const TOOL_LABEL = 'chips-ecosystem/tools/contract-gen';

function header(title: string, sources: readonly SourceRef[]): string {
  const lines = [`// ${title}`, `// 此文件由 ${TOOL_LABEL} 生成，禁止手写修改。`];
  if (sources.length > 0) {
    lines.push('// 事实源（薯片生态文档库）：');
    lines.push(...sources.map((source) => `//   - ${source.file} §${source.section}`));
  }
  lines.push(`// 重新生成：pnpm --filter @chips/contract-gen run generate`);
  return `${lines.join('\n')}\n\n`;
}

function constObject(
  name: string,
  entries: readonly (readonly [string, string])[],
  docs: string
): string {
  const body = entries.map(([key, value]) => `  ${key}: '${value}',`).join('\n');
  return `${docs}export const ${name} = {\n${body}\n} as const;\n`;
}

function literalArray(
  name: string,
  literals: readonly string[],
  docComment: string,
  satisfies: string
): string {
  const body = literals.map((literal) => `  '${literal}',`).join('\n');
  return `${docComment}export const ${name} = [\n${body}\n] as const satisfies readonly ${satisfies}[];\n`;
}

function emitCapabilityIds(model: ContractModel): string {
  const headerText = header('能力 ID 常量（R19 内置能力）', model.sources.capability);
  const object = constObject(
    'Capability',
    model.capabilities.map((entry) => [constantName(entry.id), entry.id] as const),
    ''
  );
  const type = `export type CapabilityId = (typeof Capability)[keyof typeof Capability];\n`;
  const array = literalArray(
    'CAPABILITY_IDS',
    model.capabilities.map((entry) => entry.id),
    '',
    'CapabilityId'
  );
  return `${headerText}${object}\n${type}\n${array}`;
}

function emitPermissionIds(model: ContractModel): string {
  const headerText = header('权限 ID 常量（内置权限词表）', model.sources.permission);
  const object = constObject(
    'Permission',
    model.permissions.map((entry) => [constantName(entry.id), entry.id] as const),
    ''
  );
  const type = `export type PermissionId = (typeof Permission)[keyof typeof Permission];\n`;
  const array = literalArray(
    'PERMISSION_IDS',
    model.permissions.map((entry) => entry.id),
    '',
    'PermissionId'
  );
  return `${headerText}${object}\n${type}\n${array}`;
}

function emitEventIds(model: ContractModel): string {
  const headerText = header('标准事件 ID 常量', model.sources.event);
  const object = constObject(
    'StandardEvent',
    model.events.map((entry) => [constantName(entry.id), entry.id] as const),
    ''
  );
  const type = `export type EventId = (typeof StandardEvent)[keyof typeof StandardEvent];\n`;
  const array = literalArray(
    'EVENT_IDS',
    model.events.map((entry) => entry.id),
    '',
    'EventId'
  );
  return `${headerText}${object}\n${type}\n${array}`;
}

function emitErrorCodes(model: ContractModel): string {
  const headerText = header('错误码常量（ChipsError.code）', model.sources.error);
  const array = literalArray(
    'ERROR_CODES',
    model.errorCodes.map((entry) => entry.code),
    '',
    'string'
  );
  const type = `\nexport type ErrorCode = (typeof ERROR_CODES)[number];\n`;
  return `${headerText}${array}${type}`;
}

function emitCapabilityPermissions(model: ContractModel): string {
  const headerText = header('能力 → 所需权限映射（R19 §6.2）', model.sources.capability);
  const lines = model.capabilities.map((entry) => {
    const permissions = entry.permissions.map((permission) => `'${permission}'`).join(', ');
    return `  '${entry.id}': [${permissions}],`;
  });
  const imports = [
    `import type { CapabilityId } from './capability-ids.js';`,
    `import type { PermissionId } from './permission-ids.js';`,
  ].join('\n');
  return (
    `${headerText}${imports}\n\n` +
    'export const CAPABILITY_PERMISSIONS: Readonly<Record<CapabilityId, readonly PermissionId[]>> = {\n' +
    `${lines.join('\n')}\n};\n`
  );
}

function emitIndex(): string {
  const headerText = header('契约常量统一导出', []);
  const modules = [
    './capability-ids.js',
    './capability-permissions.js',
    './error-codes.js',
    './event-ids.js',
    './permission-ids.js',
  ];
  return `${headerText}${modules.map((module) => `export * from '${module}';`).join('\n')}\n`;
}

/** 渲染全部生成文件；顺序固定，内容确定（无时间戳）。 */
export function emitContract(model: ContractModel): readonly GeneratedFile[] {
  return [
    { path: 'capability-ids.ts', content: emitCapabilityIds(model) },
    { path: 'capability-permissions.ts', content: emitCapabilityPermissions(model) },
    { path: 'error-codes.ts', content: emitErrorCodes(model) },
    { path: 'event-ids.ts', content: emitEventIds(model) },
    { path: 'permission-ids.ts', content: emitPermissionIds(model) },
    { path: 'index.ts', content: emitIndex() },
  ];
}
