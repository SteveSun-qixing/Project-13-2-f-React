import type { PortCallContext } from './call.js';

/**
 * 对话框文件过滤器；`extensions` 使用带点号的扩展名（如 `'.card'`）。
 *
 * 权威：`04-能力契约规范` §7.7。
 */
export interface DialogFileFilter {
  /** 过滤器显示名（简体中文）。 */
  readonly name: string;
  /** 扩展名列表（带点号）。 */
  readonly extensions: readonly string[];
}

/** 打开对话框选项。 */
export interface DialogOpenOptions extends PortCallContext {
  /** 对话框标题。 */
  readonly title?: string;
  /** 是否允许多选；默认 `false`。 */
  readonly multiple?: boolean;
  /** 是否选择目录；默认 `false`。 */
  readonly directory?: boolean;
  /** 文件过滤器。 */
  readonly filters?: readonly DialogFileFilter[];
}

/** 保存对话框选项。 */
export interface DialogSaveOptions extends PortCallContext {
  /** 对话框标题。 */
  readonly title?: string;
  /** 默认路径。 */
  readonly defaultPath?: string;
  /** 文件过滤器。 */
  readonly filters?: readonly DialogFileFilter[];
}

/** 打开对话框结果；取消时 `canceled: true` 且 `paths` 为空数组。 */
export interface DialogOpenResult {
  /** 用户是否取消。 */
  readonly canceled: boolean;
  /** 选中的绝对路径列表。 */
  readonly paths: readonly string[];
}

/** 保存对话框结果；取消时 `canceled: true` 且 `path` 为 `null`。 */
export interface DialogSaveResult {
  /** 用户是否取消。 */
  readonly canceled: boolean;
  /** 选中的绝对路径。 */
  readonly path: string | null;
}

/**
 * 对话框端口；方法与非插件可见的 `dialog:*` 能力动作一一对应。
 *
 * 权威：`04-能力契约规范` §7.7。
 *
 * @remarks
 * 用户取消不是错误；用户选择不产生文件系统授权（SB-6），后续读写仍需权限覆盖。
 */
export interface IPalDialogPort {
  /** 展示打开对话框（文件或目录）。 */
  open(options?: DialogOpenOptions): Promise<DialogOpenResult>;
  /** 展示保存对话框。 */
  save(options?: DialogSaveOptions): Promise<DialogSaveResult>;
}
