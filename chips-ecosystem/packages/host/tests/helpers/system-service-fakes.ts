/**
 * 系统服务族能力域测试替身（仅测试代码）。
 *
 * @remarks
 * - 覆盖 `dialog` / `clipboard` / `notification` / `shellOpen` / `http` / `power` / `transfer` /
 *   `menu` / `tray` / `shortcut` / `config` 各 PAL 端口的行为可编程替身：记录入参、注入回执
 *   与失败，域逻辑单测离线可测（端口注入形制，与 `fake-pal-host.ts` 同族）。
 * - 生产代码不引用本文件；生产链路由 `createMacPalHost` 交付真实端口。
 */

import type {
  ConfigChange,
  ConfigGetPortInput,
  ConfigResetPortInput,
  ConfigSetPortInput,
  ConfigSnapshotPortInput,
  ConfigView,
  DialogOpenOptions,
  DialogOpenResult,
  DialogSaveOptions,
  DialogSaveResult,
  ConfigWatchSubscription,
  IPalClipboardPort,
  IPalConfigPort,
  IPalDialogPort,
  IPalHttpPort,
  IPalMenuPort,
  IPalNotificationPort,
  IPalPowerPort,
  IPalShellOpenPort,
  IPalShortcutPort,
  IPalTransferPort,
  IPalTrayPort,
  HttpRequestOptions,
  HttpResponse,
  MenuItem,
  MenuTarget,
  NotificationSendOptions,
  PortCallContext,
  PowerState,
  PreventSleepOptions,
  TransferDownloadOptions,
  TransferEvents,
  TrayClickButton,
  TraySetOptions,
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

/** HTTP 端口替身：记录请求选项并回放注入响应（重定向授权回调透传到记录面）。 */
export interface IHttpFakePort extends IPalHttpPort, IProgrammablePort {
  /** `request` 调用记录。 */
  readonly requests: { readonly options: HttpRequestOptions }[];
  /** 注入的响应；未注入时回放 `502` 空体兜底。 */
  response?: HttpResponse;
  /** 注入后是否记录授权回调的逐跳判定结果（`authorizeRedirect` 由替身原样回放）。 */
  readonly redirectDecisions: { readonly target: string; readonly allowed: boolean }[];
}

/** 构造 HTTP 端口替身。 */
export function createHttpFakePort(): IHttpFakePort {
  const requests: { options: HttpRequestOptions }[] = [];
  const redirectDecisions: { target: string; allowed: boolean }[] = [];
  const port: IHttpFakePort = {
    requests,
    redirectDecisions,
    request(options: HttpRequestOptions): Promise<HttpResponse> {
      requests.push({ options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      if (options.authorizeRedirect !== undefined) {
        void options
          .authorizeRedirect('https://redirect.example.com/next')
          .then((allowed) => {
            redirectDecisions.push({ target: 'https://redirect.example.com/next', allowed });
          })
          .catch(() => undefined);
      }
      return Promise.resolve(port.response ?? { status: 502, headers: {}, body: new Uint8Array() });
    },
  };
  return port;
}

/** 电源端口替身：记录查询与抑制开关调用并回放注入失败。 */
export interface IPowerFakePort extends IPalPowerPort, IProgrammablePort {
  /** `query` 调用记录。 */
  readonly queries: { readonly call: PortCallContext | undefined }[];
  /** `setPreventSleep` 调用记录（最终开关状态序列）。 */
  readonly preventSleepCalls: { readonly enabled: boolean; readonly options: PreventSleepOptions | undefined }[];
  /** 注入的查询回执。 */
  queryResult?: PowerState;
}

/** 构造电源端口替身。 */
export function createPowerFakePort(): IPowerFakePort {
  const queries: { call: PortCallContext | undefined }[] = [];
  const preventSleepCalls: { enabled: boolean; options: PreventSleepOptions | undefined }[] = [];
  const port: IPowerFakePort = {
    queries,
    preventSleepCalls,
    query(call?: PortCallContext): Promise<PowerState> {
      queries.push({ call });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve(
        port.queryResult ?? {
          onBattery: false,
          batteryLevel: null,
          charging: true,
          idleState: 'active',
          thermalState: 'nominal',
        },
      );
    },
    setPreventSleep(enabled: boolean, options?: PreventSleepOptions): Promise<void> {
      preventSleepCalls.push({ enabled, options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}

/** 传输端口替身：记录下载/取消入参，事件回调可在测试中直接触发。 */
export interface ITransferFakePort extends IPalTransferPort, IProgrammablePort {
  /** `download` 调用记录。 */
  readonly downloads: { readonly options: TransferDownloadOptions; readonly events: TransferEvents }[];
  /** `cancel` 调用记录。 */
  readonly cancels: { readonly transferId: string }[];
  /** 已交付的任务 ID（测试可覆写）；`download` 回放该 ID。 */
  nextTransferId: string;
}

/** 构造传输端口替身。 */
export function createTransferFakePort(): ITransferFakePort {
  const downloads: { options: TransferDownloadOptions; events: TransferEvents }[] = [];
  const cancels: { transferId: string }[] = [];
  const port: ITransferFakePort = {
    downloads,
    cancels,
    nextTransferId: 'transfer-0001',
    download(options: TransferDownloadOptions, events: TransferEvents): Promise<{ readonly transferId: string }> {
      downloads.push({ options, events });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve({ transferId: port.nextTransferId });
    },
    cancel(transferId: string): Promise<void> {
      cancels.push({ transferId });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}

/** 菜单端口替身：记录整表替换调用并回放注入失败。 */
export interface IMenuFakePort extends IPalMenuPort, IProgrammablePort {
  /** `set` 调用记录。 */
  readonly sets: { readonly target: MenuTarget; readonly items: readonly MenuItem[] }[];
}

/** 构造菜单端口替身。 */
export function createMenuFakePort(): IMenuFakePort {
  const sets: { target: MenuTarget; items: readonly MenuItem[] }[] = [];
  const port: IMenuFakePort = {
    sets,
    set(target: MenuTarget, items: readonly MenuItem[]): Promise<void> {
      sets.push({ target, items });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
  };
  return port;
}

/** 托盘端口替身：记录设置调用、可手动触发点击信号并回放注入失败。 */
export interface ITrayFakePort extends IPalTrayPort, IProgrammablePort {
  /** `set` 调用记录。 */
  readonly sets: { readonly options: TraySetOptions }[];
  /** 已注册的点击监听（测试手动触发）。 */
  readonly clickListeners: readonly ((button: TrayClickButton) => void)[];
  /** 注入的点击触发。 */
  emitClick(button: TrayClickButton): void;
}

/** 构造托盘端口替身。 */
export function createTrayFakePort(): ITrayFakePort {
  const sets: { options: TraySetOptions }[] = [];
  const clickListeners: ((button: TrayClickButton) => void)[] = [];
  const port: ITrayFakePort = {
    sets,
    clickListeners,
    set(options: TraySetOptions): Promise<void> {
      sets.push({ options });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      return Promise.resolve();
    },
    onClicked(listener: (button: TrayClickButton) => void): { dispose(): void } {
      clickListeners.push(listener);
      return {
        dispose(): void {
          const index = clickListeners.indexOf(listener);
          if (index >= 0) {
            clickListeners.splice(index, 1);
          }
        },
      };
    },
    emitClick(button: TrayClickButton): void {
      for (const listener of [...clickListeners]) {
        listener(button);
      }
    },
  };
  return port;
}

/** 快捷键端口替身：记录注册/注销并保留触发回调（测试手动触发）。 */
export interface IShortcutFakePort extends IPalShortcutPort, IProgrammablePort {
  /** `register` 调用记录。 */
  readonly registrations: {
    readonly shortcutId: string;
    readonly accelerator: string;
    readonly onTrigger: () => void;
    readonly call: PortCallContext | undefined;
  }[];
  /** `unregister` 调用记录。 */
  readonly unregistrations: { readonly shortcutId: string; readonly call: PortCallContext | undefined }[];
  /** 触发指定快捷键（未注册即忽略）。 */
  trigger(shortcutId: string): void;
}

/** 构造快捷键端口替身。 */
export function createShortcutFakePort(): IShortcutFakePort {
  const registrations: {
    shortcutId: string;
    accelerator: string;
    onTrigger: () => void;
    call: PortCallContext | undefined;
  }[] = [];
  const unregistrations: { shortcutId: string; call: PortCallContext | undefined }[] = [];
  const triggers = new Map<string, () => void>();
  const port: IShortcutFakePort = {
    registrations,
    unregistrations,
    register(shortcutId: string, accelerator: string, onTrigger: () => void, call?: PortCallContext): Promise<void> {
      registrations.push({ shortcutId, accelerator, onTrigger, call });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      triggers.set(shortcutId, onTrigger);
      return Promise.resolve();
    },
    unregister(shortcutId: string, call?: PortCallContext): Promise<void> {
      unregistrations.push({ shortcutId, call });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      triggers.delete(shortcutId);
      return Promise.resolve();
    },
    trigger(shortcutId: string): void {
      triggers.get(shortcutId)?.();
    },
  };
  return port;
}

/** 配置端口替身：内存值集承载 `get` / `set` / `reset` / `snapshot`，记录入参并回放注入失败。 */
export interface IConfigFakePort extends IPalConfigPort, IProgrammablePort {
  /** `get` 调用记录。 */
  readonly gets: { readonly input: ConfigGetPortInput }[];
  /** `set` 调用记录（含能力层注入的 `callerId`）。 */
  readonly sets: { readonly input: ConfigSetPortInput }[];
  /** `reset` 调用记录。 */
  readonly resets: { readonly input: ConfigResetPortInput }[];
  /** `snapshot` 调用记录。 */
  readonly snapshots: { readonly input: ConfigSnapshotPortInput }[];
  /** 内存值集（完整配置键 → 生效值）。 */
  readonly values: Map<string, unknown>;
  /** 已投递的变更。 */
  readonly changes: ConfigChange[];
  /** 注入的 `get` 回执。 */
  getResult?: ConfigView;
}

/** 构造配置端口替身。 */
export function createConfigFakePort(): IConfigFakePort {
  const gets: { input: ConfigGetPortInput }[] = [];
  const sets: { input: ConfigSetPortInput }[] = [];
  const resets: { input: ConfigResetPortInput }[] = [];
  const snapshots: { input: ConfigSnapshotPortInput }[] = [];
  const values = new Map<string, unknown>();
  const changes: ConfigChange[] = [];
  const port: IConfigFakePort = {
    gets,
    sets,
    resets,
    snapshots,
    values,
    changes,
    get(input: ConfigGetPortInput): Promise<ConfigView> {
      gets.push({ input });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      if (port.getResult !== undefined) {
        return Promise.resolve(port.getResult);
      }
      const key = `${input.namespace}.${input.key}`;
      if (!values.has(key)) {
        return Promise.reject(new Error(`CONFIG_KEY_UNKNOWN:${key}`));
      }
      return Promise.resolve({ key, value: values.get(key), layer: 'user', isDefault: false });
    },
    set(input: ConfigSetPortInput): Promise<void> {
      sets.push({ input });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      const key = `${input.namespace}.${input.key}`;
      values.set(key, input.value);
      changes.push({
        key,
        layer: 'user',
        value: input.value,
        effectiveValue: input.value,
        isDefault: false,
        origin: input.callerId === 'platform' ? 'platform' : `plugin:${input.callerId}`,
      });
      return Promise.resolve();
    },
    reset(input: ConfigResetPortInput): Promise<void> {
      resets.push({ input });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      for (const relativeKey of input.keys) {
        values.delete(`${input.namespace}.${relativeKey}`);
      }
      return Promise.resolve();
    },
    snapshot(input: ConfigSnapshotPortInput): Promise<Record<string, unknown>> {
      snapshots.push({ input });
      if (port.error !== undefined) {
        return Promise.reject(port.error);
      }
      const prefix = `${input.namespace}.${input.prefix}`;
      const result: Record<string, unknown> = {};
      for (const [key, value] of values) {
        if (key.startsWith(prefix)) {
          result[key] = value;
        }
      }
      return Promise.resolve(result);
    },
    watch(prefix: string, onChange: (change: ConfigChange) => void): ConfigWatchSubscription {
      void prefix;
      void onChange;
      return { dispose: () => undefined };
    },
  };
  return port;
}
