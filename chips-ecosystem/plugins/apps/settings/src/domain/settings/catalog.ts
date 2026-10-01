/**
 * 生态设置面板：设置模型与分组契约（重写件）。
 *
 * 权威口径：《05-生态设置面板设计》§2.1（九类导航，顺序即展示顺序）、§2.3（注册表驱动，
 * 壳层与切换器只消费注册表）、§3.1/§3.2（偏好项配置键、取值与默认）。
 *
 * 命令 ID 文法按《13-命令系统契约》§2.1 取 `<domain>:<action>`（`settings:open-<sceneId>`）；
 * 设计文档 §2.3 所记 `<面板插件ID>.scene.<sceneId>` 为点号文法旧记法，注册期校验
 * （`COMMAND_DEFINITION_INVALID`）不允许点号，以契约文法为准（随开发日志勘误候裁，不代改文档）。
 *
 * 偏好读写口径：《10-配置系统设计》——偏好写入平台命名空间经 `config:*`；宿主 `config:*`
 * 域处理器已随工单066 第一批翻正为真实现（`packages/host/src/runtime/capabilities/config.ts`），
 * 读写消费面见 `configGateway.ts` 与 `preferenceStore.ts` 的 `ConfigSettingsStore`，
 * 本模块只承载键位/取值/分组的类型化契约。
 */

/** 设置分类标识（九类导航，Scene ID 与设计文档 §2.1 逐字对应）。 */
export type SettingsSceneId =
  | 'appearance'
  | 'behavior'
  | 'workspace'
  | 'plugins'
  | 'permissions'
  | 'shortcuts'
  | 'file-open'
  | 'storage'
  | 'about';

/** 设置分类描述符：注册表驱动壳层与窄屏切换器的唯一数据源。 */
export interface SettingsSceneDescriptor {
  readonly id: SettingsSceneId;
  /** 分类标题（简体中文直写）。 */
  readonly title: string;
  /** 展示顺序（1 起，与设计文档 §2.1 序号一致）。 */
  readonly order: number;
  /** 分类内容摘要。 */
  readonly summary: string;
  /** 页面跳转命令 ID（`settings:open-<sceneId>`，13-契约 §2.1 文法）。 */
  readonly commandId: string;
  /** 该分类页面依赖的宿主域查询能力族（缺位期间页面如实降级呈现）。 */
  readonly requiredDomains: readonly string[];
}

/** 九类导航注册表：顺序即展示顺序（《05-生态设置面板设计》§2.1）。 */
export const SETTINGS_SCENES: readonly SettingsSceneDescriptor[] = [
  {
    id: 'appearance',
    title: '外观',
    order: 1,
    summary: '界面密度、动效偏好、默认窗口宽度',
    commandId: 'settings:open-appearance',
    requiredDomains: [],
  },
  {
    id: 'behavior',
    title: '行为',
    order: 2,
    summary: '系统通知、自动检查更新、日志级别（高级）',
    commandId: 'settings:open-behavior',
    requiredDomains: [],
  },
  {
    id: 'workspace',
    title: '工作区',
    order: 3,
    summary: '当前工作区、切换、打开目录、开发/用户隔离说明',
    commandId: 'settings:open-workspace',
    requiredDomains: ['config:get', 'shell:openExternal'],
  },
  {
    id: 'plugins',
    title: '插件治理',
    order: 4,
    summary: '四角色插件列表与详情、安装、启停、权限审查、更新、卸载、数据清理、快捷方式',
    commandId: 'settings:open-plugins',
    requiredDomains: ['插件治理查询域（安装/启停/卸载清单）'],
  },
  {
    id: 'permissions',
    title: '权限',
    order: 5,
    summary: '授权总览、撤销与恢复、审计记录',
    commandId: 'settings:open-permissions',
    requiredDomains: ['权限治理查询域（授权记录/审计）'],
  },
  {
    id: 'shortcuts',
    title: '快捷键',
    order: 6,
    summary: '命令快捷键查看、重绑、禁用、冲突处理、导入导出',
    commandId: 'settings:open-shortcuts',
    requiredDomains: ['command:list', 'shortcut:register'],
  },
  {
    id: 'file-open',
    title: '文件打开方式',
    order: 7,
    summary: '按扩展名与 MIME 分组的默认处理器治理',
    commandId: 'settings:open-file-open',
    requiredDomains: ['资源打开治理查询域（处理器槽位）'],
  },
  {
    id: 'storage',
    title: '存储缓存',
    order: 8,
    summary: '缓存、日志、备份、更新暂存与插件数据的占用与清理',
    commandId: 'settings:open-storage',
    requiredDomains: ['存储占用查询域（工作区保留区）'],
  },
  {
    id: 'about',
    title: '关于更新',
    order: 9,
    summary: '版本、系统信息、更新通道与状态、许可与致谢',
    commandId: 'settings:open-about',
    requiredDomains: ['system:info'],
  },
];

/** 按展示顺序取分类注册表。 */
export function scenesInOrder(): readonly SettingsSceneDescriptor[] {
  return [...SETTINGS_SCENES].sort((left, right) => left.order - right.order);
}

/** 按标识取分类；未知标识返回 `null`（不静默回退首项）。 */
export function findScene(sceneId: string): SettingsSceneDescriptor | null {
  return SETTINGS_SCENES.find((scene) => scene.id === sceneId) ?? null;
}

/** 偏好项取值种类。 */
export type SettingValueKind = 'enum' | 'boolean' | 'integer';

/** 枚举选项（值 + 展示标签）。 */
export interface SettingEnumOption {
  readonly value: string;
  readonly label: string;
}

/** 偏好项取值。 */
export type SettingValue = string | boolean | number;

/** 偏好项生效层（配置层叠语义的最简呈现：用户层覆盖 / 默认值 / 降级会话内存）。 */
export type SettingEffectLayer = 'user' | 'default' | 'session-memory';

/** 偏好项描述符：键位、分组、取值约束与默认值的类型化契约。 */
export interface SettingDescriptor {
  /** 配置键（与《05-生态设置面板设计》§3.1/§3.2 逐字对应）。 */
  readonly key: string;
  readonly sceneId: Extract<SettingsSceneId, 'appearance' | 'behavior'>;
  /** 分组名（页面内 SettingsGroup 分组标题，简体中文）。 */
  readonly group: string;
  /** 设置项标签（简体中文直写）。 */
  readonly label: string;
  /** 设置项说明。 */
  readonly description: string;
  readonly kind: SettingValueKind;
  readonly defaultValue: SettingValue;
  /** 枚举项集合（kind = enum 必携）。 */
  readonly options?: readonly SettingEnumOption[];
  /** 整数约束（kind = integer 必携下界；上界可选）。 */
  readonly minValue?: number;
  readonly maxValue?: number;
  /** 高级项标记（界面附用途说明，§3.2 日志级别）。 */
  readonly advanced?: boolean;
}

/** 偏好项注册表：偏好域起步臂在册键位（§3.1 外观 + §3.2 行为）。 */
export const SETTING_DESCRIPTORS: readonly SettingDescriptor[] = [
  {
    key: 'platform.appearance.density',
    sceneId: 'appearance',
    group: '界面',
    label: '界面密度',
    description: '切换界面密度语义并即时生效；不改变系统缩放',
    kind: 'enum',
    defaultValue: 'comfortable',
    options: [
      { value: 'comfortable', label: '舒适' },
      { value: 'compact', label: '紧凑' },
    ],
  },
  {
    key: 'platform.appearance.motion',
    sceneId: 'appearance',
    group: '界面',
    label: '动效偏好',
    description: '「跟随系统」遵循操作系统减少动态效果；「减少动效」由平台统一关闭非必要过渡',
    kind: 'enum',
    defaultValue: 'system',
    options: [
      { value: 'system', label: '跟随系统' },
      { value: 'reduced', label: '减少动效' },
    ],
  },
  {
    key: 'platform.window.defaultWidth',
    sceneId: 'appearance',
    group: '窗口',
    label: '默认窗口宽度',
    description: '仅影响后续新创建的应用窗口，不改变已打开窗口',
    kind: 'integer',
    defaultValue: 1200,
    minValue: 640,
  },
  {
    key: 'platform.behavior.notifications',
    sceneId: 'behavior',
    group: '通知与更新',
    label: '系统通知',
    description: '关闭后平台在通知能力出口统一丢弃系统通知；不改变应用内界面提醒',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    key: 'platform.behavior.autoCheckUpdate',
    sceneId: 'behavior',
    group: '通知与更新',
    label: '自动检查更新',
    description: '关闭后停止平台定时更新检查；仍可在「关于更新」页发起手动检查',
    kind: 'boolean',
    defaultValue: true,
  },
  {
    key: 'platform.log.level',
    sceneId: 'behavior',
    group: '高级',
    label: '日志级别',
    description: '调整平台日志输出级别；该键已注册于平台 schema',
    kind: 'enum',
    defaultValue: 'info',
    advanced: true,
    options: [
      { value: 'error', label: '错误' },
      { value: 'warn', label: '警告' },
      { value: 'info', label: '信息' },
      { value: 'debug', label: '调试' },
    ],
  },
];

/** 取指定分类的偏好项（保持注册表顺序）。 */
export function settingsForScene(sceneId: SettingsSceneId): readonly SettingDescriptor[] {
  return SETTING_DESCRIPTORS.filter((item) => item.sceneId === sceneId);
}

/** 按键取偏好项；未知键返回 `null`。 */
export function findSetting(key: string): SettingDescriptor | null {
  return SETTING_DESCRIPTORS.find((item) => item.key === key) ?? null;
}

/**
 * 归一偏好取值：类型不符时回退默认值；枚举值不在集合内回退默认值；整数按界收敛
 * （低于下界取下界，越上界取上界，非整数拒绝）。归一结果可直接入库与回显。
 */
export function normalizeSettingValue(descriptor: SettingDescriptor, value: unknown): SettingValue {
  if (descriptor.kind === 'boolean') {
    return typeof value === 'boolean' ? value : descriptor.defaultValue;
  }
  if (descriptor.kind === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return descriptor.defaultValue;
    }
    const min = descriptor.minValue ?? Number.NEGATIVE_INFINITY;
    const max = descriptor.maxValue ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, value));
  }
  const option = descriptor.options?.find((item) => item.value === value);
  return option === undefined ? descriptor.defaultValue : option.value;
}

/** 判定取值是否与默认一致（「恢复默认」呈现用）。 */
export function isDefaultValue(descriptor: SettingDescriptor, value: SettingValue): boolean {
  return value === descriptor.defaultValue;
}
