import type { PortCallContext } from './call.js';

/**
 * 配置层；与 `10-配置系统设计` §2.2 层级标识一致。
 */
export type ConfigLayer = 'platform' | 'user' | 'workspace' | 'plugin';

/** `config:get` 端口输入（10-配置系统设计 §11.1 `NativeConfigGetInput`，不含 caller——调用方归属判定归能力层）。 */
export interface ConfigGetPortInput {
  /** `platform` 或 `plugins.<pluginId>`。 */
  readonly namespace: string;
  /** 命名空间内的相对键。 */
  readonly key: string;
}

/** `config:set` 端口输入（§11.1 `NativeConfigSetInput`；`callerId` 为变更来源，由能力层注入）。 */
export interface ConfigSetPortInput {
  /** 调用方标识（插件 ID 或 `platform`）；落盘变更事件 `origin` 的取值来源。 */
  readonly callerId: string;
  /** `platform` 或 `plugins.<pluginId>`。 */
  readonly namespace: string;
  /** 命名空间内的相对键。 */
  readonly key: string;
  /** 覆盖值（JSON 值）。 */
  readonly value: unknown;
  /** 写入层；`user` / `workspace`。 */
  readonly scope: 'user' | 'workspace';
}

/** `config:reset` 端口输入（§11.1 `NativeConfigResetInput`）。 */
export interface ConfigResetPortInput {
  /** 调用方标识（插件 ID 或 `platform`）。 */
  readonly callerId: string;
  /** `platform` 或 `plugins.<pluginId>`。 */
  readonly namespace: string;
  /** 要移除覆盖的相对键数组。 */
  readonly keys: readonly string[];
  /** 移除层；`user` / `workspace`。 */
  readonly scope: 'user' | 'workspace';
}

/** `config:snapshot` 端口输入（§11.1 `NativeConfigSnapshotInput`）。 */
export interface ConfigSnapshotPortInput {
  /** `platform` 或 `plugins.<pluginId>`。 */
  readonly namespace: string;
  /** 键前缀（相对键形式；空串表示全量）。 */
  readonly prefix: string;
}

/** 单条配置的生效视图（§11.1 `NativeConfigView`；`key` 为完整配置键）。 */
export interface ConfigView {
  /** 完整配置键（`platform.<key>` 或 `plugins.<pluginId>.<key>`）。 */
  readonly key: string;
  /** 生效值。 */
  readonly value: unknown;
  /** 生效值所在层。 */
  readonly layer: ConfigLayer;
  /** 是否来自 schema 声明默认值。 */
  readonly isDefault: boolean;
}

/** 配置变更（§11.1 `NativeConfigChange`；`05-事件契约规范` §4.5 `config:changed` 载荷同源）。 */
export interface ConfigChange {
  /** 完整配置键。 */
  readonly key: string;
  /** 本次变化影响的层。 */
  readonly layer: ConfigLayer;
  /** 该层当前值；`null` 表示该层覆盖被移除。 */
  readonly value: unknown;
  /** 变化后的生效值。 */
  readonly effectiveValue: unknown;
  /** 生效值是否来自默认值。 */
  readonly isDefault: boolean;
  /** 变更来源：`platform` / `migration` / `external` / `plugin:<pluginId>`（§4.5 ConfigOrigin）。 */
  readonly origin: string;
}

/** 配置变更订阅句柄；`dispose` 幂等。 */
export interface ConfigWatchSubscription {
  dispose(): void;
}

/**
 * 配置端口；方法与 `config:*` 能力动作一一对应，另提供壳侧变更订阅面。
 *
 * 权威：`04-能力契约规范` §7.11、`10-配置系统设计` §11.1/§11.3、`05-事件契约规范` §4.5。
 *
 * @remarks
 * - 端口是配置系统的 PAL 承载缝隙：宿主侧交付用户层持久化承载（`10-配置系统设计` §3.1 用户级目录布局、
 *   §3.3 文件结构、§9.3 原子替换），内核 `ConfigStore`（§10～§11 Neon 绑定）交付后由集成任务按同契约
 *   切换承载，端口形状不变。
 * - 键格式非法返回 `CONFIG_KEY_INVALID`；值不可 JSON 序列化返回 `CONFIG_VALUE_INVALID`；
 *   `workspace` 层在宿主承载缺位（无工作区绑定）时返回 `CONFIG_SCOPE_INVALID`；
 *   目标文件不可解析或 `schemaVersion` 越界时进入外部修改保护——写入返回 `CONFIG_EXTERNAL_MODIFIED`、
 *   `CONFIG_VERSION_UNSUPPORTED`，同层 `reset` 重建文件解除保护（§9.5）。
 * - 变更事件在提交成功后逐键投递给 watch 订阅方（§9.2 步骤 6）；同值写入与缺失覆盖的 reset
 *   视为空操作，不落盘、不投递（§2.3）。
 */
export interface IPalConfigPort {
  /** 读取单条配置的生效视图。 */
  get(input: ConfigGetPortInput, call?: PortCallContext): Promise<ConfigView>;
  /** 在指定层写入覆盖；成功后逐键投递变更。 */
  set(input: ConfigSetPortInput, call?: PortCallContext): Promise<void>;
  /** 移除指定层上的覆盖；成功后逐键投递变更。 */
  reset(input: ConfigResetPortInput, call?: PortCallContext): Promise<void>;
  /** 读取命名空间下前缀匹配的完整生效视图（键为完整配置键）。 */
  snapshot(input: ConfigSnapshotPortInput, call?: PortCallContext): Promise<Record<string, unknown>>;
  /** 订阅配置变更；`prefix` 为完整键前缀（空串表示全量）。 */
  watch(prefix: string, onChange: (change: ConfigChange) => void): ConfigWatchSubscription;
}
