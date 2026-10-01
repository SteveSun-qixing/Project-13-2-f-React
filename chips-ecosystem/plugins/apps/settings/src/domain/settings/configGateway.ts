/**
 * 生态设置面板：配置域消费面（工单066 翻正第一批真实现）。
 *
 * 权威链路：`config:snapshot` / `config:set` / `config:reset` 已由 G6 第二批翻正为宿主
 * 真实现（`packages/host/src/runtime/capabilities/config.ts`，PAL 用户层持久化承载），
 * 本网关是插件侧唯一配置读写入口——经 `chips.request` / `chips.subscribe` 正式面调用，
 * 不私建存储、不直连宿主内部（《04-能力契约规范》§7.11；《05-生态设置面板设计》§8.1/§8.2）。
 *
 * 消费映射（§8.6 逐条）：
 * - 命名空间固定 `platform`（偏好为平台键，完整键 `platform.<相对键>`；§8.1 表：
 *   读取 `config:get`/`config:snapshot`、写入 `config:set`/`config:reset`，权限
 *   `config:read:platform` / `config:write:platform`，manifest 随本臂声明）；
 * - 写入层固定 `user`（§8.6：偏好写入只允许 user 与 workspace 层，面板产品面取用户层）；
 * - 变更一致性走 `config:changed` 事件面（05-事件契约规范 §4.5；能力面无 `config:watch`，
 *   以事件契约为准），载荷以 `effectiveValue` 为准刷新（§8.2）。
 *
 * 插件侧防御性复核码（与在册 `CONFIG_*` / `BRIDGE_*` 码分列，仅用于通道回执形态异常）：
 * - `SETTINGS_SNAPSHOT_RECEIPT_INVALID`：快照回包缺 `values` 生效视图记录；
 * - `SETTINGS_KEY_OUT_OF_NAMESPACE`：完整配置键不带 `platform.` 前缀（注册表缺陷）；
 * - `SETTINGS_GATEWAY_ERROR`：无错误码抛出值的兜底归一。
 */

import { chips } from '@chips/sdk';
import type { IConfigChange, IConfigSnapshotOutput } from '@chips/sdk';

/** 偏好命名空间常量（§7.11 namespace 文法 `platform` 分支；§8.6 面板只访问 platform 与自身命名空间）。 */
export const CONFIG_NAMESPACE = 'platform';

/** 命名空间前缀（完整配置键 = `platform.` + 相对键；§7.11 输出 `key` 为完整键）。 */
const NAMESPACE_PREFIX = `${CONFIG_NAMESPACE}.`;

/** 插件侧防御性复核码：快照回包形态异常。 */
export const SETTINGS_SNAPSHOT_RECEIPT_INVALID = 'SETTINGS_SNAPSHOT_RECEIPT_INVALID';

/** 插件侧防御性复核码：配置键越出偏好命名空间（注册表缺陷，快速失败）。 */
export const SETTINGS_KEY_OUT_OF_NAMESPACE = 'SETTINGS_KEY_OUT_OF_NAMESPACE';

/** 插件侧防御性复核码：无错误码抛出值的兜底归一。 */
export const SETTINGS_GATEWAY_ERROR = 'SETTINGS_GATEWAY_ERROR';

/** 配置域错误：携带 Bridge/配置域归一错误码，界面按码分支呈现（禁止匹配错误文本）。 */
export class SettingsConfigError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'SettingsConfigError';
    this.code = code;
  }
}

function toSettingsConfigError(error: unknown): SettingsConfigError {
  if (error instanceof SettingsConfigError) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return new SettingsConfigError(code, error instanceof Error ? error.message : '未知错误');
    }
  }
  return new SettingsConfigError(SETTINGS_GATEWAY_ERROR, error instanceof Error ? error.message : '未知错误');
}

/** 从抛出值提取归一错误码与消息（读写通道与变更订阅共用）。 */
export function describeConfigError(error: unknown): { code: string; message: string } {
  const normalized = toSettingsConfigError(error);
  return { code: normalized.code, message: normalized.message };
}

/** 判定完整配置键是否落在偏好命名空间内（变更订阅过滤用，不抛出）。 */
export function isPlatformFullKey(fullKey: string): boolean {
  return fullKey.startsWith(NAMESPACE_PREFIX);
}

/** 完整配置键剥出命名空间前缀得相对键（§7.11 输入 `key` 为相对键）。 */
export function toRelativeKey(fullKey: string): string {
  if (!isPlatformFullKey(fullKey)) {
    throw new SettingsConfigError(
      SETTINGS_KEY_OUT_OF_NAMESPACE,
      `配置键 ${fullKey} 不属于 ${CONFIG_NAMESPACE} 命名空间`,
    );
  }
  return fullKey.slice(NAMESPACE_PREFIX.length);
}

/**
 * 配置域错误的行内处置指引（简体中文；错误码本体始终随提示呈现，不吞错）。
 *
 * 文案口径：《05-生态设置面板设计》§8.2/§8.6 写入被拒分支与 §8.3 权限引导
 * （CONFIG_* 十-配置系统设计 §4.4 在册码；BRIDGE_PERMISSION_DENIED 按 §8.3 引导授权）。
 */
export function configErrorGuidance(code: string): string {
  if (code === 'CONFIG_POLICY_LOCKED') {
    return '该键由平台策略管理，不可在此修改';
  }
  if (code === 'CONFIG_KEY_UNKNOWN') {
    return '该键未在平台配置注册，请刷新视图；若持续出现属于面板缺陷';
  }
  if (code === 'CONFIG_VALUE_INVALID') {
    return '取值不符合该键的配置约束，请重新选择';
  }
  if (code === 'CONFIG_NAMESPACE_DENIED') {
    return '缺少 platform 命名空间配置授权，请在权限设置中核查';
  }
  if (code === 'CONFIG_SCOPE_INVALID') {
    return '当前写入层不可用，请刷新视图后重试';
  }
  if (code === 'CONFIG_EXTERNAL_MODIFIED') {
    return '配置文件被外部修改，请刷新视图后重试';
  }
  if (code === 'CONFIG_WRITE_FAILED') {
    return '配置落盘失败，请重试';
  }
  if (code === 'BRIDGE_PERMISSION_DENIED') {
    return '缺少配置读写授权（config:write:platform），请核查应用权限';
  }
  return '配置通道异常，请刷新视图重试';
}

/** 配置域变更订阅句柄；`dispose` 幂等。 */
export interface ConfigChangeSubscription {
  dispose(): void;
}

/** 配置域消费面：平台命名空间的类型化读写与变更订阅（插件侧唯一入口）。 */
export interface PreferenceConfigGateway {
  /** 读取平台命名空间完整生效视图（键为完整配置键；§7.11 `config:snapshot`）。 */
  loadPlatformSnapshot(): Promise<Readonly<Record<string, unknown>>>;
  /** 在用户层写入覆盖（§7.11 `config:set`；`scope` 固定 `user`）。 */
  writePlatformValue(relativeKey: string, value: unknown): Promise<void>;
  /** 移除用户层覆盖（§7.11 `config:reset`；一次调用提交全部键）。 */
  resetPlatformKeys(relativeKeys: readonly string[]): Promise<void>;
  /** 订阅配置变更（05-事件契约 §4.5 `config:changed`；载荷以 `effectiveValue` 为准）。 */
  subscribePlatformChanges(handler: (change: IConfigChange) => void): ConfigChangeSubscription;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 快照回包守卫：`values` 必须为普通对象记录（不白信通道）。 */
function assertSnapshotReceipt(output: IConfigSnapshotOutput): Readonly<Record<string, unknown>> {
  if (!isRecord(output) || !isRecord(output.values)) {
    throw new SettingsConfigError(SETTINGS_SNAPSHOT_RECEIPT_INVALID, '配置快照回执缺少生效视图记录');
  }
  return output.values;
}

function createChipsConfigGateway(): PreferenceConfigGateway {
  return {
    async loadPlatformSnapshot(): Promise<Readonly<Record<string, unknown>>> {
      let output: IConfigSnapshotOutput;
      try {
        output = await chips.request<IConfigSnapshotOutput>('config:snapshot', {
          namespace: CONFIG_NAMESPACE,
          prefix: '',
        });
      } catch (error: unknown) {
        throw toSettingsConfigError(error);
      }
      return assertSnapshotReceipt(output);
    },

    async writePlatformValue(relativeKey: string, value: unknown): Promise<void> {
      try {
        await chips.request<void>('config:set', {
          namespace: CONFIG_NAMESPACE,
          key: relativeKey,
          value,
          scope: 'user',
        });
      } catch (error: unknown) {
        throw toSettingsConfigError(error);
      }
    },

    async resetPlatformKeys(relativeKeys: readonly string[]): Promise<void> {
      try {
        await chips.request<void>('config:reset', {
          namespace: CONFIG_NAMESPACE,
          keys: [...relativeKeys],
          scope: 'user',
        });
      } catch (error: unknown) {
        throw toSettingsConfigError(error);
      }
    },

    subscribePlatformChanges(handler: (change: IConfigChange) => void): ConfigChangeSubscription {
      const subscription = chips.subscribe('config:changed', (payload: unknown) => {
        handler(payload as IConfigChange);
      });
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          subscription.dispose();
        },
      };
    },
  };
}

/**
 * 窗口会话默认配置网关：渲染上下文内共享（组合根消费）；测试经
 * `createIsolatedConfigGateway` 建立隔离实例（`chips.request` 由测试桥替换）。
 */
const windowGateway = createChipsConfigGateway();

export function createIsolatedConfigGateway(): PreferenceConfigGateway {
  return createChipsConfigGateway();
}

export function getPreferenceConfigGateway(): PreferenceConfigGateway {
  return windowGateway;
}
