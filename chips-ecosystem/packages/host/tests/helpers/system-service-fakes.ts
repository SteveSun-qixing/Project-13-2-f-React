/**
 * 系统服务族能力域测试替身（仅测试代码）。
 *
 * @remarks
 * - 覆盖 `dialog` / `clipboard` / `notification` / `shellOpen` 四个 PAL 端口的行为可编程替身：
 *   记录入参、注入回执与失败，域逻辑单测离线可测（端口注入形制，与 `fake-pal-host.ts` 同族）。
 * - 生产代码不引用本文件；生产链路由 `createMacPalHost` 交付真实端口。
 */

import type {
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
  IPalClipboardPort,
  IPalDialogPort,
  IPalNotificationPort,
  IPalShellOpenPort,
  NotificationSendOptions,
  PortCallContext,
} from '../../src/platform/contracts/index.js';

/** 可编程回执的测试端口公共形状。 */
interface IProgrammablePort {
  /** 注入的失败；下次调用抛出（须为 `Error` 对象）。 */
  error?: Error;
}

/** 对话框端口替身：记录 `open` / `save` 入参并回放注入结果。 */
export interface IDialogFakePort extends IPalDialogPort, IProgrammablePort {
  /** `open` 调用记录（选项与端口调用上下文）。 */
  readonly opens: { readonly options: DialogOpenOptions | undefined }[];
  /** `save` 调用记录。 */
  readonly saves: { readonly options: DialogSaveOptions | undefined }[];
  /** 注入的 `open` 回执。 */
  openResult?: DialogOpenResult;
  /** 注入的 `save` 回执。 */
  saveResult?: DialogSaveResult;
}

/** 构造对话框端口替身。 */
export function createDialogFakePort(): IDialogFakePort {
  const opens: { options: DialogOpenOptions | undefined }[] = [];
  const saves: { options: DialogSaveOptions | undefined }[] = [];
  const port: IDialogFakePort = {
    opens,
    saves,
    open(options?: DialogOpenOptions): Promise<DialogOpenResult> {
      opens.push({ options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve(port.openResult ?? { canceled: true, paths: [] });
    },
    save(options?: DialogSaveOptions): Promise<DialogSaveResult> {
      saves.push({ options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve(port.saveResult ?? { canceled: true, path: null });
    },
  };
  return port;
}

/** 剪贴板端口替身：记录读写并回放注入结果（契约无调用上下文参数）。 */
export interface IClipboardFakePort extends IPalClipboardPort, IProgrammablePort {
  /** `readText` 调用次数。 */
  readCount: number;
  /** `writeText` 调用记录。 */
  readonly writes: { readonly text: string }[];
  /** 注入的读取回执。 */
  readResult?: string | null;
}

/** 构造剪贴板端口替身。 */
export function createClipboardFakePort(): IClipboardFakePort {
  const writes: { text: string }[] = [];
  const port: IClipboardFakePort = {
    readCount: 0,
    writes,
    readText(): Promise<string | null> {
      port.readCount += 1;
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve(port.readResult ?? null);
    },
    writeText(text: string): Promise<void> {
      writes.push({ text });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}

/** 通知端口替身：记录发送入参并回放注入失败。 */
export interface INotificationFakePort extends IPalNotificationPort, IProgrammablePort {
  /** `send` 调用记录。 */
  readonly sends: { readonly options: NotificationSendOptions }[];
}

/** 构造通知端口替身。 */
export function createNotificationFakePort(): INotificationFakePort {
  const sends: { options: NotificationSendOptions }[] = [];
  const port: INotificationFakePort = {
    sends,
    send(options: NotificationSendOptions): Promise<void> {
      sends.push({ options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}

/** 外部打开端口替身：记录 `openExternal` 入参并回放注入失败。 */
export interface IShellOpenFakePort extends IPalShellOpenPort, IProgrammablePort {
  /** `openExternal` 调用记录。 */
  readonly opens: { readonly url: string; readonly call: PortCallContext | undefined }[];
}

/** 构造外部打开端口替身。 */
export function createShellOpenFakePort(): IShellOpenFakePort {
  const opens: { url: string; call: PortCallContext | undefined }[] = [];
  const port: IShellOpenFakePort = {
    opens,
    openExternal(url: string, call?: PortCallContext): Promise<void> {
      opens.push({ url, call });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}
