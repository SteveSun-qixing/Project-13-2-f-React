import type { PortCallContext } from './call.js';

/** 传输任务 ID。 */
export type TransferId = string;

/** 传输失败信息。 */
export interface TransferFailure {
  /** 归一错误码（能力契约 §11.4 中的 `TRANSFER_*` / `HTTP_*` / `BRIDGE_*` 等已登记码）。 */
  readonly code: string;
  /** 面向用户的简体中文错误消息。 */
  readonly message: string;
  /** 是否可重试；与失败码的登记语义一致（能力契约 §11.4）。 */
  readonly retryable: boolean;
  /** 是否为调用方取消导致。 */
  readonly cancelled: boolean;
  /** 结构化诊断（不含输入原文、凭证与内部路径）。 */
  readonly details?: Readonly<Record<string, unknown>>;
}

/** `transfer:download` 选项。 */
export interface TransferDownloadOptions extends PortCallContext {
  /** `http(s)` 绝对 URL。 */
  readonly url: string;
  /** 目标路径（绝对路径，由核心完成权限判定）。 */
  readonly target: string;
  /** 期望摘要（`sha256:<hex>`）；提供时校验不匹配即失败。 */
  readonly expectedDigest?: string;
  /** 目标已存在时是否覆盖；默认 `false`。 */
  readonly overwrite?: boolean;
  /**
   * 逐跳重定向授权回调；返回 `false` 时以 `HTTP_REDIRECT_DENIED` 终止。
   *
   * 核心在回调内重新执行协议、地址与域名限定值判定（资源管理设计 §8.2、权限设计 §7.4）。
   */
  readonly authorizeRedirect?: (url: string) => Promise<boolean>;
}

/** 传输进度；对应 `transfer:progress` 载荷。 */
export interface TransferProgress {
  /** 已传输字节数。 */
  readonly transferredBytes: number;
  /** 总字节数；响应未提供 `Content-Length` 时为 `null`。 */
  readonly totalBytes: number | null;
}

/** 传输完成信息；对应 `transfer:completed` 载荷。 */
export interface TransferCompleted {
  /** 目标路径。 */
  readonly target: string;
  /** 产物摘要（`sha256:<hex>`）。 */
  readonly digest: string;
}

/** 传输事件回调；壳据此发布 `transfer:progress` / `transfer:completed` / `transfer:failed`。 */
export interface TransferEvents {
  /** 进度回调；端口内已按事件契约限流（最小间隔 200ms）。 */
  onProgress(event: TransferProgress): void;
  /** 完成回调；临时文件已原子替换到目标路径。 */
  onCompleted(event: TransferCompleted): void;
  /** 失败或取消回调；临时物已清理、目标路径未被修改。 */
  onFailed(event: TransferFailure): void;
}

/**
 * 传输端口；方法与非插件可见的 `transfer:*` 能力动作一一对应。
 *
 * 权威：`04-能力契约规范` §7.15、`05-事件契约规范` §4.10。
 *
 * @remarks
 * - `download` 启动异步任务并立即返回任务 ID；进度与结果经 `TransferEvents` 交给壳。
 * - 写入使用同目录临时文件 + 原子替换；失败/取消清理临时物。
 * - 重定向最多 5 跳且逐跳经 `authorizeRedirect` 授权；跨源重定向剥离 `Authorization`。
 * - `cancel` 幂等；已结束或不存在的任务视为成功。
 */
export interface IPalTransferPort {
  /** 启动下载任务。 */
  download(options: TransferDownloadOptions, events: TransferEvents): Promise<{ readonly transferId: TransferId }>;
  /** 取消下载任务；幂等。 */
  cancel(transferId: TransferId): Promise<void>;
}
