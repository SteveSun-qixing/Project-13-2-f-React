import { ScaffoldError } from './errors.js';
import type { IScaffoldDerived, NormalizedScaffoldOptions, PluginRole } from './types.js';

/** 四个合法角色。 */
export const PLUGIN_ROLES: readonly PluginRole[] = ['basecard', 'boxlayout', 'app', 'service'];

/** 角色对应的官方命名空间（`chips.*` 前缀）。 */
const OFFICIAL_NAMESPACE_BY_ROLE: Readonly<Record<PluginRole, string>> = {
  app: 'chips.official.',
  basecard: 'chips.basecard.',
  boxlayout: 'chips.layout.',
  service: 'chips.service.',
};

/** 作废的旧式 ID 前缀与后缀，命中即拒绝。 */
const LEGACY_ID_PREFIXES: readonly string[] = ['com.chips.', 'chips-official.', 'chips.module.'];
const LEGACY_ID_SUFFIX = '.blp';

/** 反向域名：至少两段，段内小写字母、数字与连字符，段首尾必须为字母或数字。 */
const PLUGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const MAX_PLUGIN_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 64;

function fail(message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new ScaffoldError(message, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 校验并归一角色。 */
export function normalizeRole(value: unknown): PluginRole {
  if (typeof value !== 'string' || !(PLUGIN_ROLES as readonly string[]).includes(value)) {
    fail(`不支持的角色：${String(value)}；可选值为 basecard、boxlayout、app、service`, {
      role: value,
      allowed: PLUGIN_ROLES,
    });
  }
  return value as PluginRole;
}

/** 校验插件 ID：反向域名文法、长度、命名空间与角色的对应关系、旧式 ID 拒绝。 */
export function normalizePluginId(role: PluginRole, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail('pluginId 不能为空', { pluginId: value });
  }
  if (value.length > MAX_PLUGIN_ID_LENGTH) {
    fail(`pluginId 长度不得超过 ${MAX_PLUGIN_ID_LENGTH} 个字符`, { pluginId: value });
  }
  if (!PLUGIN_ID_PATTERN.test(value)) {
    fail('pluginId 必须是反向域名形式（小写字母、数字、点与连字符，如 chips.basecard.markdown）', {
      pluginId: value,
    });
  }
  for (const prefix of LEGACY_ID_PREFIXES) {
    if (value.startsWith(prefix)) {
      fail(`pluginId 不得使用作废的旧式命名空间：${prefix}`, { pluginId: value });
    }
  }
  if (value.endsWith(LEGACY_ID_SUFFIX)) {
    fail(`pluginId 不得使用作废的 .blp 后缀`, { pluginId: value });
  }
  for (const candidate of PLUGIN_ROLES) {
    const namespace = OFFICIAL_NAMESPACE_BY_ROLE[candidate];
    if (value.startsWith(namespace) && candidate !== role) {
      fail(`插件 ID 命名空间与角色不一致：${namespace} 属于 ${candidate}，当前角色为 ${role}`, {
        pluginId: value,
        role,
        expectedRole: candidate,
      });
    }
  }
  return value;
}

/** 校验显示名：非空、无换行与控制字符、长度受限。 */
export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') {
    fail('name 必须是非空简体中文显示名', { name: value });
  }
  const name = value.trim();
  if (name.length === 0) {
    fail('name 必须是非空简体中文显示名', { name: value });
  }
  if (name.length > MAX_NAME_LENGTH) {
    fail(`name 长度不得超过 ${MAX_NAME_LENGTH} 个字符`, { name });
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    fail('name 不得包含换行或控制字符', { name });
  }
  return name;
}

/** 校验可选文本字段。 */
function normalizeOptionalText(field: string, value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} 必须是非空字符串`, { [field]: value });
  }
  const text = value.trim();
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) {
    fail(`${field} 不得包含换行或控制字符`, { [field]: value });
  }
  return text;
}

/** 校验目标目录：非空、无空字节、归一为 POSIX 形式。 */
export function normalizeTargetDir(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('targetDir 必须是非空路径', { targetDir: value });
  }
  if (value.includes('\u0000')) {
    fail('targetDir 不得包含空字节', { targetDir: value });
  }
  const normalized = value.trim().replaceAll('\\', '/').replace(/\/+$/, '');
  if (normalized.length === 0) {
    fail('targetDir 必须是非空路径', { targetDir: value });
  }
  return normalized;
}

/** 取路径末段。 */
export function lastPathSegment(path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  return segments.length > 0 ? (segments[segments.length - 1] as string) : '';
}

/** 把任意文本归一为小写 kebab-case 片段。 */
export function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 由插件 ID 末段派生资源命名基；ID 文法已保证其为合法片段。 */
export function deriveAssetSlug(pluginId: string): string {
  const segment = lastPathSegment(pluginId.replaceAll('.', '/'));
  if (segment.length === 0) {
    fail('无法从 pluginId 派生资源命名基', { pluginId });
  }
  return segment;
}

/** 由目标目录派生 npm 包名末段；无法派生时回退插件 ID 末段。 */
export function derivePackageSlug(targetDir: string, pluginId: string): string {
  const fromDir = toKebabCase(lastPathSegment(targetDir));
  const slug = fromDir.length > 0 ? fromDir : deriveAssetSlug(pluginId);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    fail('无法从 targetDir 或 pluginId 派生合法的包名片段', { targetDir, pluginId });
  }
  return slug;
}

/**
 * 计算相对目标目录的 `tsconfig.base.json` 继承路径。
 *
 * 约定 `targetDir` 为相对工作区根目录的路径（如 `plugins/hello`、`examples/plugins/hello`）；
 * 绝对路径无法推导深度，回退为 `../../tsconfig.base.json` 并要求调用方在落盘后核对。
 */
export function deriveTsconfigExtends(targetDir: string): string {
  if (targetDir.startsWith('/') || /^[A-Za-z]:/.test(targetDir)) {
    return '../../tsconfig.base.json';
  }
  const depth = targetDir.split('/').filter((segment) => segment.length > 0).length;
  return `${'../'.repeat(Math.max(depth, 1))}tsconfig.base.json`;
}

/** 由角色与资源命名基派生卡片类型 ID 或布局类型 ID。 */
export function deriveCapabilityId(role: PluginRole, assetSlug: string): string {
  switch (role) {
    case 'basecard':
      return `base.${assetSlug}`;
    case 'boxlayout':
      return `chips.layout.${assetSlug}`;
    case 'app':
    case 'service':
      return assetSlug;
  }
}

/** 归一后的选项与派生信息；manifest 由 `buildManifest` 基于二者生成。 */
export interface INormalizedScaffoldInput {
  readonly options: NormalizedScaffoldOptions;
  readonly derived: IScaffoldDerived;
}

/** 校验并归一完整选项，产出模板上下文所需的全部派生值。 */
export function normalizeScaffoldOptions(options: unknown): INormalizedScaffoldInput {
  if (!isRecord(options)) {
    fail('选项必须是对象', { options });
  }
  const role = normalizeRole(options.role);
  const pluginId = normalizePluginId(role, options.pluginId);
  const name = normalizeName(options.name);
  const targetDir = normalizeTargetDir(options.targetDir);
  const description = normalizeOptionalText('description', options.description);
  const author = normalizeOptionalText('author', options.author);
  const license = normalizeOptionalText('license', options.license) ?? 'MIT';

  const assetSlug = deriveAssetSlug(pluginId);
  const packageSlug = derivePackageSlug(targetDir, pluginId);
  return {
    options: {
      role,
      pluginId,
      name,
      targetDir,
      license,
      ...(description === undefined ? {} : { description }),
      ...(author === undefined ? {} : { author }),
    },
    derived: {
      assetSlug,
      packageSlug,
      packageName: `@chips/plugin-${packageSlug}`,
      tsconfigExtends: deriveTsconfigExtends(targetDir),
      capabilityId: deriveCapabilityId(role, assetSlug),
    },
  };
}
