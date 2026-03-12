import type { StandardError } from '../../../src/shared/types';

export type WindowChromeTitleBarStyle = 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';

export interface WindowChromeOverlayOptions {
  color?: string;
  symbolColor?: string;
  height?: number;
}

export interface WindowChromeOptions {
  frame?: boolean;
  transparent?: boolean;
  backgroundColor?: string;
  titleBarStyle?: WindowChromeTitleBarStyle;
  titleBarOverlay?: boolean | WindowChromeOverlayOptions;
}

export interface WindowOptions {
  title: string;
  width: number;
  height: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  url?: string;
  pluginId?: string;
  sessionId?: string;
  permissions?: string[];
  launchParams?: Record<string, unknown>;
  chrome?: WindowChromeOptions;
}

export interface WindowState {
  id: string;
  title: string;
  width: number;
  height: number;
  focused: boolean;
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
  url?: string;
  pluginId?: string;
  sessionId?: string;
  chrome?: WindowChromeOptions;
}

export interface FileReadOptions {
  encoding?: BufferEncoding;
}

export interface FileListOptions {
  recursive?: boolean;
}

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
}

export interface FileWatchEvent {
  type: 'rename' | 'change';
  path: string;
  timestamp: number;
}

export interface FileWatchSubscription {
  id: string;
  close(): Promise<void>;
}

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
}

export interface ScreenInfo {
  id: string;
  width: number;
  height: number;
  scaleFactor: number;
  x: number;
  y: number;
  primary: boolean;
}

export interface DialogFileOptions {
  defaultPath?: string;
  mode?: 'file' | 'directory';
  allowMultiple?: boolean;
  mustExist?: boolean;
  title?: string;
}

export interface DialogSaveOptions {
  defaultPath?: string;
  title?: string;
}

export interface DialogMessageOptions {
  title?: string;
  message: string;
  detail?: string;
}

export interface TrayMenuItem {
  id: string;
  label: string;
}

export interface TrayOptions {
  icon?: string;
  tooltip?: string;
  menu?: TrayMenuItem[];
}

export interface TrayState extends TrayOptions {
  active: boolean;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
}

export interface PowerState {
  idleSeconds: number;
  preventSleep: boolean;
}

export interface PALWindow {
  create(options: WindowOptions): Promise<WindowState>;
  focus(id: string): Promise<void>;
  resize(id: string, width: number, height: number): Promise<void>;
  setState(id: string, state: WindowState['state']): Promise<void>;
  getState(id: string): Promise<WindowState>;
  close(id: string): Promise<void>;
}

export interface PALFileSystem {
  normalize(path: string): string;
  readFile(path: string, options?: FileReadOptions): Promise<string | Buffer>;
  writeFile(path: string, data: string | Buffer): Promise<void>;
  stat(path: string): Promise<FileStat>;
  list(path: string, options?: FileListOptions): Promise<string[]>;
  watch(path: string, onEvent: (event: FileWatchEvent) => void): Promise<FileWatchSubscription>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  delete(path: string, options?: { recursive?: boolean }): Promise<void>;
  copy(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
  move(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
}

export interface PALDialog {
  openFile(options?: DialogFileOptions): Promise<string[] | null>;
  saveFile(options?: DialogSaveOptions): Promise<string | null>;
  showMessage(options: DialogMessageOptions): Promise<number>;
  showConfirm(options: DialogMessageOptions): Promise<boolean>;
}

export type ClipboardFormat = 'text' | 'image' | 'files';

export interface ClipboardImagePayload {
  base64: string;
  mimeType?: string;
}

export type ClipboardPayload = string | ClipboardImagePayload | string[];

export interface PALClipboard {
  read(format?: ClipboardFormat): Promise<ClipboardPayload>;
  write(data: ClipboardPayload, format?: ClipboardFormat): Promise<void>;
}

export interface PALShell {
  openPath(targetPath: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  showItemInFolder(targetPath: string): Promise<void>;
}

export interface PALPlatform {
  getInfo(): Promise<PlatformInfo>;
  getCapabilities(): Promise<string[]>;
}

export interface PALScreen {
  getPrimary(): Promise<ScreenInfo>;
  getAll(): Promise<ScreenInfo[]>;
}

export interface PALTray {
  set(options: TrayOptions): Promise<TrayState>;
  clear(): Promise<void>;
  getState(): Promise<TrayState>;
}

export interface PALNotification {
  show(options: NotificationOptions): Promise<void>;
}

export interface PALShortcut {
  register(accelerator: string, onTrigger?: () => void): Promise<boolean>;
  unregister(accelerator: string): Promise<void>;
  isRegistered(accelerator: string): Promise<boolean>;
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

export type LauncherLocation = 'desktop' | 'launchpad';

export interface LauncherCreateOptions {
  pluginId: string;
  name: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
}

export interface LauncherRecord {
  pluginId: string;
  name: string;
  location: LauncherLocation;
  launcherPath: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
}

export interface PALLauncher {
  getDefaultPath(name: string): Promise<{ launcherPath: string; location: LauncherLocation }>;
  create(options: LauncherCreateOptions & { launcherPath?: string }): Promise<LauncherRecord>;
  getRecord(options: { pluginId: string; name: string; launcherPath?: string }): Promise<LauncherRecord>;
  remove(options: { pluginId: string; name: string; launcherPath?: string }): Promise<{ removed: boolean; launcherPath: string; location: LauncherLocation }>;
}

export interface PALPower {
  getState(): Promise<PowerState>;
  setPreventSleep(prevent: boolean): Promise<boolean>;
}

export type PALIpcTransport = 'named-pipe' | 'unix-socket' | 'shared-memory';

export interface PALIpcCreateOptions {
  name: string;
  transport: PALIpcTransport;
  maxBufferBytes?: number;
}

export interface PALIpcChannelInfo {
  channelId: string;
  name: string;
  transport: PALIpcTransport;
  endpoint?: string;
}

export interface PALIpcReceiveOptions {
  timeoutMs?: number;
}

export interface PALIpcMessage {
  channelId: string;
  transport: PALIpcTransport;
  payload: Buffer;
  receivedAt: number;
}

export interface PALIPC {
  createChannel(options: PALIpcCreateOptions): Promise<PALIpcChannelInfo>;
  send(channelId: string, payload: Buffer | string): Promise<void>;
  receive(channelId: string, options?: PALIpcReceiveOptions): Promise<PALIpcMessage>;
  closeChannel(channelId: string): Promise<void>;
  listChannels(): Promise<PALIpcChannelInfo[]>;
}

export interface PALAdapter {
  window: PALWindow;
  fs: PALFileSystem;
  dialog: PALDialog;
  clipboard: PALClipboard;
  shell: PALShell;
  platform: PALPlatform;
  screen: PALScreen;
  tray: PALTray;
  notification: PALNotification;
  shortcut: PALShortcut;
  launcher: PALLauncher;
  power: PALPower;
  ipc: PALIPC;
}

export interface PALError extends StandardError {
  platform?: string;
}
