/**
 * `IHandlerPreferencePort` 生产适配器：PAL `config` 端口 → `platform.fileOpen.defaults` 生效值。
 *
 * 权威：`14-资源打开与默认处理器契约` §6.1（偏好存储：平台配置键、生效层覆盖顺序、
 * 值 schema 约束——对象最多 256 项、键匹配槽位文法、值为插件 ID 字符串）。
 *
 * @remarks
 * - 生效值读取走 PAL `config` 端口（宿主侧用户层持久化承载，与 `config:get` 能力同一承载
 *   单点，禁第二配置存储）；键未登记（尚无任何偏好写入）按空偏好表处置——偏好只影响改选，
 *   缺记录即回落平台优先级（§6.1 规则）。
 * - 值 schema 约束在此收口：仅保留键匹配 `mime:` / `ext:` 文法且值为非空插件 ID 字符串的项，
 *   上限 256 项（超限按键序截断，确定性）。
 * - 配置端口的其他读取失败同样按空表处置并诊断留痕（路由不因偏好承载故障失败；
 *   诊断责任在配置承载面，此处只留痕不造第二语义）。
 */

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import { RESOURCE_OPEN_SLOT_EXT_PREFIX, RESOURCE_OPEN_SLOT_MIME_PREFIX } from '../contract.js';
import type { IHandlerPreferencePort } from '../ports.js';

/** 偏好端口依赖。 */
export interface IPalHandlerPreferenceDeps {
  /** PAL 配置端口（与 `config:get` 能力同一承载单点；分面缺位传 `undefined`）。 */
  readonly config:
    | {
        get(input: { readonly namespace: string; readonly key: string }): Promise<{
          readonly value: unknown;
          readonly isDefault: boolean;
        }>;
      }
    | undefined;
  /** 宿主诊断口（读取失败留痕）。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 槽位键文法（§6.1：`mime:<type>/<subtype|*>` 或 `ext:.<小写段>`）。 */
const SLOT_KEY_PATTERN = /^(mime:[a-z0-9!#$&^_.+*/-]+|ext:\.[a-z0-9._+-]+)$/;

/** 偏好项上限（§6.1 值 schema 约束）。 */
const PREFERENCE_MAX_ENTRIES = 256;

/** 校验并收敛偏好值对象（schema 外的项丢弃，确定性按键序截断）。 */
export function normalizePreferenceValue(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => SLOT_KEY_PATTERN.test(key))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, PREFERENCE_MAX_ENTRIES);
  const preferences: Record<string, string> = {};
  for (const key of keys) {
    const pluginId = record[key];
    if (typeof pluginId === 'string' && pluginId.length > 0 && pluginId.length <= 256) {
      preferences[key] = pluginId;
    }
  }
  return preferences;
}

/**
 * 构造默认处理器偏好的生产适配器。
 *
 * @param deps 偏好依赖（PAL 配置端口 + 诊断口）。
 */
export function createPalHandlerPreference(deps: IPalHandlerPreferenceDeps): IHandlerPreferencePort {
  return {
    async defaults(): Promise<Readonly<Record<string, string>>> {
      if (deps.config === undefined) {
        // 配置分面缺位：偏好承载未装配，按空表回落平台优先级（§6.1 规则），不阻断路由。
        return {};
      }
      let value: unknown;
      try {
        const view = await deps.config.get({ namespace: 'platform', key: 'fileOpen.defaults' });
        value = view.value;
      } catch (error) {
        deps.diagnostics?.warn('resource-open', '默认处理器偏好读取失败，按空偏好表回落平台优先级', {
          reason: error instanceof Error ? error.message : typeof error,
        });
        return {};
      }
      return normalizePreferenceValue(value);
    },
  };
}

/** 槽位键文法前缀 re-export（适配器消费方单点引用）。 */
export { RESOURCE_OPEN_SLOT_EXT_PREFIX, RESOURCE_OPEN_SLOT_MIME_PREFIX };
