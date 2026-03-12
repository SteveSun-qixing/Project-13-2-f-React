import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createError } from '../../../src/shared/errors';
import {
  loadElectronModule,
  type ElectronBrowserWindowCtorLike,
  type ElectronBrowserWindowLike
} from '../../../src/main/electron/electron-loader';
import { createId } from '../../../src/shared/utils';
import type {
  ClipboardFormat,
  ClipboardImagePayload,
  ClipboardPayload,
  DialogFileOptions,
  DialogMessageOptions,
  DialogSaveOptions,
  FileWatchEvent,
  FileWatchSubscription,
  FileListOptions,
  FileReadOptions,
  PALAdapter,
  PALClipboard,
  PALDialog,
  PALFileSystem,
  PALIPC,
  PALLauncher,
  PALNotification,
  PALPlatform,
  PALPower,
  PALScreen,
  PALIpcChannelInfo,
  PALIpcCreateOptions,
  PALIpcMessage,
  PALIpcReceiveOptions,
  PALIpcTransport,
  PALShell,
  PALShortcut,
  PALTray,
  PALWindow,
  NotificationOptions,
  PowerState,
  ScreenInfo,
  LauncherCreateOptions,
  LauncherLocation,
  LauncherRecord,
  TrayOptions,
  TrayState,
  WindowChromeOptions,
  WindowOptions,
  WindowState
} from './types';

const quoteAppleScript = (value: string): string => value.replaceAll('"', '\\"');
const quoteShellArg = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const sanitizeLauncherName = (value: string): string => {
  const sanitized = value.replace(/[\\/:*?"<>|]/g, '-').trim();
  return sanitized.length > 0 ? sanitized : 'Chips App';
};

const cloneWindowChromeOptions = (chrome: WindowChromeOptions | undefined): WindowChromeOptions | undefined => {
  if (!chrome) {
    return undefined;
  }

  return {
    ...chrome,
    titleBarOverlay:
      chrome.titleBarOverlay && typeof chrome.titleBarOverlay === 'object'
        ? { ...chrome.titleBarOverlay }
        : chrome.titleBarOverlay
  };
};

const buildElectronWindowChromeOptions = (chrome: WindowChromeOptions | undefined): Record<string, unknown> => {
  if (!chrome) {
    return {};
  }

  const resolved: Record<string, unknown> = {};

  if (typeof chrome.frame === 'boolean') {
    resolved.frame = chrome.frame;
  }
  if (typeof chrome.transparent === 'boolean') {
    resolved.transparent = chrome.transparent;
  }
  if (typeof chrome.backgroundColor === 'string') {
    resolved.backgroundColor = chrome.backgroundColor;
  }
  if (typeof chrome.titleBarStyle === 'string') {
    resolved.titleBarStyle = chrome.titleBarStyle;
  }
  if (typeof chrome.titleBarOverlay !== 'undefined') {
    resolved.titleBarOverlay =
      chrome.titleBarOverlay && typeof chrome.titleBarOverlay === 'object'
        ? { ...chrome.titleBarOverlay }
        : chrome.titleBarOverlay;
  }

  return resolved;
};

const runCommand = async (command: string, args: string[], input?: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      const asError = error as NodeJS.ErrnoException;
      if (asError.code === 'ENOENT') {
        reject(createError('PAL_COMMAND_NOT_FOUND', `Command not found: ${command}`));
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          createError('PAL_COMMAND_FAILED', `Command failed: ${command}`, {
            args,
            code,
            stderr: stderr.trim()
          })
        );
        return;
      }
      resolve(stdout);
    });

    if (typeof input === 'string') {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
};

const commandExists = async (command: string): Promise<boolean> => {
  try {
    if (process.platform === 'win32') {
      await runCommand('where', [command]);
    } else {
      await runCommand('which', [command]);
    }
    return true;
  } catch {
    return false;
  }
};

const statSafe = async (inputPath: string): Promise<{ isFile: boolean; isDirectory: boolean } | null> => {
  try {
    const stats = await fs.stat(inputPath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch {
    return null;
  }
};

const CHIPS_BRIDGE_CONTEXT_ARG_PREFIX = '--chips-bridge-context=';

interface WindowManagerOptions {
  electronPreloadPath?: string;
}

class NodeWindowManager implements PALWindow {
  private readonly windows = new Map<string, WindowState>();
  private readonly electronWindows = new Map<string, ElectronBrowserWindowLike>();
  private readonly electronBrowserWindow?: ElectronBrowserWindowCtorLike;
  private readonly electronPreloadPath?: string;

  public constructor(options?: WindowManagerOptions) {
    const electron = loadElectronModule();
    this.electronBrowserWindow = electron?.BrowserWindow;
    this.electronPreloadPath = options?.electronPreloadPath;
  }

  public async create(options: WindowOptions): Promise<WindowState> {
    const id = createId();
    const title = options.title;
    const width = options.width;
    const height = options.height;
    const state: WindowState = {
      id,
      title,
      width,
      height,
      focused: false,
      state: 'normal',
      url: options.url,
      pluginId: options.pluginId,
      sessionId: options.sessionId,
      chrome: cloneWindowChromeOptions(options.chrome)
    };

    if (this.electronBrowserWindow) {
      const webPreferences: Record<string, unknown> = {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      };
      const additionalArguments = this.buildBridgeArguments(options);
      if (additionalArguments.length > 0) {
        webPreferences.additionalArguments = additionalArguments;
      }
      if (options.pluginId) {
        const preloadPath = this.resolveElectronPreloadPath();
        if (!preloadPath) {
          throw createError(
            'PAL_WINDOW_PRELOAD_MISSING',
            'Electron preload script is required for plugin windows',
            {
              pluginId: options.pluginId
            }
          );
        }
        webPreferences.preload = preloadPath;
      }
      const browserWindow = new this.electronBrowserWindow({
        title,
        width,
        height,
        resizable: options.resizable ?? true,
        alwaysOnTop: options.alwaysOnTop ?? false,
        show: true,
        ...buildElectronWindowChromeOptions(options.chrome),
        webPreferences
      });
      this.electronWindows.set(id, browserWindow);
      browserWindow.on('closed', () => {
        this.electronWindows.delete(id);
        this.windows.delete(id);
      });
      await this.loadWindowContent(browserWindow, options.url);
      state.focused = browserWindow.isFocused();
      state.state = this.resolveWindowState(browserWindow);
    }

    this.windows.set(id, state);
    return state;
  }

  public async focus(id: string): Promise<void> {
    const target = this.getWindowState(id);
    if (!target) {
      throw createError('PAL_WINDOW_NOT_FOUND', `Window not found: ${id}`);
    }

    const browserWindow = this.electronWindows.get(id);
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.focus();
    }

    for (const value of this.windows.values()) {
      value.focused = false;
    }

    target.focused = true;
  }

  public async resize(id: string, width: number, height: number): Promise<void> {
    const target = this.getWindowState(id);
    if (!target) {
      throw createError('PAL_WINDOW_NOT_FOUND', `Window not found: ${id}`);
    }

    const browserWindow = this.electronWindows.get(id);
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.setSize(width, height);
    }

    target.width = width;
    target.height = height;
  }

  public async setState(id: string, state: WindowState['state']): Promise<void> {
    const target = this.getWindowState(id);
    if (!target) {
      throw createError('PAL_WINDOW_NOT_FOUND', `Window not found: ${id}`);
    }

    const browserWindow = this.electronWindows.get(id);
    if (browserWindow && !browserWindow.isDestroyed()) {
      if (state === 'minimized') {
        browserWindow.minimize();
      } else if (state === 'maximized') {
        browserWindow.maximize();
      } else if (state === 'fullscreen') {
        browserWindow.setFullScreen(true);
      } else {
        browserWindow.setFullScreen(false);
        browserWindow.restore();
      }
    }

    target.state = state;
  }

  public async getState(id: string): Promise<WindowState> {
    const target = this.getWindowState(id);
    if (!target) {
      throw createError('PAL_WINDOW_NOT_FOUND', `Window not found: ${id}`);
    }

    const browserWindow = this.electronWindows.get(id);
    if (browserWindow && !browserWindow.isDestroyed()) {
      const bounds = browserWindow.getBounds();
      target.width = bounds.width;
      target.height = bounds.height;
      target.focused = browserWindow.isFocused();
      target.state = this.resolveWindowState(browserWindow);
    }

    return {
      ...target,
      chrome: cloneWindowChromeOptions(target.chrome)
    };
  }

  public async close(id: string): Promise<void> {
    const target = this.getWindowState(id);
    if (!target) {
      throw createError('PAL_WINDOW_NOT_FOUND', `Window not found: ${id}`);
    }

    const browserWindow = this.electronWindows.get(id);
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.close();
      this.electronWindows.delete(id);
    }

    this.windows.delete(id);
  }

  private getWindowState(id: string): WindowState | undefined {
    return this.windows.get(id);
  }

  private resolveWindowState(window: ElectronBrowserWindowLike): WindowState['state'] {
    if (window.isFullScreen()) {
      return 'fullscreen';
    }
    if (window.isMinimized()) {
      return 'minimized';
    }
    if (window.isMaximized()) {
      return 'maximized';
    }
    return 'normal';
  }

  private async loadWindowContent(window: ElectronBrowserWindowLike, url: string | undefined): Promise<void> {
    if (!url || url.length === 0) {
      return;
    }

    if (/^(https?:|file:|chips:)/i.test(url)) {
      await Promise.resolve(window.loadURL(url));
      return;
    }

    const normalizedPath = path.resolve(url);
    if (path.extname(normalizedPath).toLowerCase() === '.html') {
      await Promise.resolve(window.loadFile(normalizedPath));
      return;
    }

    await Promise.resolve(window.loadURL(`file://${normalizedPath}`));
  }

  private resolveElectronPreloadPath(): string | undefined {
    if (!this.electronPreloadPath || this.electronPreloadPath.length === 0) {
      return undefined;
    }

    const normalizedPath = path.resolve(this.electronPreloadPath);
    if (!fsSync.existsSync(normalizedPath)) {
      throw createError('PAL_WINDOW_PRELOAD_NOT_FOUND', `Electron preload not found: ${normalizedPath}`, {
        preloadPath: normalizedPath
      });
    }
    return normalizedPath;
  }

  private buildBridgeArguments(options: WindowOptions): string[] {
    if (!options.pluginId) {
      return [];
    }

    const payload = {
      pluginId: options.pluginId,
      permissions: options.permissions ?? [],
      sessionId: options.sessionId,
      launchParams: options.launchParams ?? {}
    };

    return [
      `${CHIPS_BRIDGE_CONTEXT_ARG_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')}`
    ];
  }
}

class NodeFileSystem implements PALFileSystem {
  public normalize(inputPath: string): string {
    return path.normalize(inputPath);
  }

  public async readFile(inputPath: string, options?: FileReadOptions): Promise<string | Buffer> {
    const normalizedPath = this.normalize(inputPath);
    const encoding = options?.encoding;
    if (encoding) {
      return fs.readFile(normalizedPath, { encoding });
    }
    return fs.readFile(normalizedPath);
  }

  public async writeFile(inputPath: string, data: string | Buffer): Promise<void> {
    const normalizedPath = this.normalize(inputPath);
    await fs.mkdir(path.dirname(normalizedPath), { recursive: true });
    await fs.writeFile(normalizedPath, data);
  }

  public async stat(inputPath: string) {
    const normalizedPath = this.normalize(inputPath);
    const stats = await fs.stat(normalizedPath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtimeMs: stats.mtimeMs
    };
  }

  public async list(inputPath: string, options?: FileListOptions): Promise<string[]> {
    const normalizedPath = this.normalize(inputPath);
    const recursive = options?.recursive ?? false;

    if (!recursive) {
      return fs.readdir(normalizedPath);
    }

    const list: string[] = [];
    const stack = [normalizedPath];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        const relative = path.relative(normalizedPath, fullPath);
        list.push(relative);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        }
      }
    }

    return list;
  }

  public async exists(inputPath: string): Promise<boolean> {
    const normalizedPath = this.normalize(inputPath);
    try {
      await fs.access(normalizedPath);
      return true;
    } catch {
      return false;
    }
  }

  public async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalize(inputPath);
    await fs.mkdir(normalizedPath, { recursive: options?.recursive ?? true });
  }

  public async delete(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalize(inputPath);
    await fs.rm(normalizedPath, {
      recursive: options?.recursive ?? true,
      force: false
    });
  }

  public async copy(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<void> {
    const normalizedSource = this.normalize(sourcePath);
    const normalizedDestination = this.normalize(destinationPath);
    const overwrite = options?.overwrite ?? true;

    await fs.mkdir(path.dirname(normalizedDestination), { recursive: true });
    await fs.cp(normalizedSource, normalizedDestination, {
      force: overwrite,
      errorOnExist: !overwrite,
      recursive: true
    });
  }

  public async move(sourcePath: string, destinationPath: string, options?: { overwrite?: boolean }): Promise<void> {
    const normalizedSource = this.normalize(sourcePath);
    const normalizedDestination = this.normalize(destinationPath);
    const overwrite = options?.overwrite ?? true;

    if (!overwrite) {
      const destinationExists = await this.exists(normalizedDestination);
      if (destinationExists) {
        throw createError('PAL_FS_MOVE_TARGET_EXISTS', `Destination already exists: ${normalizedDestination}`, {
          source: normalizedSource,
          destination: normalizedDestination
        });
      }
    } else if (await this.exists(normalizedDestination)) {
      await fs.rm(normalizedDestination, { recursive: true, force: true });
    }

    await fs.mkdir(path.dirname(normalizedDestination), { recursive: true });

    try {
      await fs.rename(normalizedSource, normalizedDestination);
    } catch (error) {
      await this.copy(normalizedSource, normalizedDestination, { overwrite });
      await this.delete(normalizedSource, { recursive: true });
      if (!(await this.exists(normalizedDestination))) {
        throw error;
      }
    }
  }

  public async watch(inputPath: string, onEvent: (event: FileWatchEvent) => void): Promise<FileWatchSubscription> {
    const normalizedPath = this.normalize(inputPath);
    const watchId = createId();

    let watcher: fsSync.FSWatcher;
    try {
      watcher = fsSync.watch(normalizedPath, { persistent: false }, (eventType, filename) => {
        const resolvedPath =
          typeof filename === 'string' && filename.length > 0
            ? path.join(path.dirname(normalizedPath), filename)
            : normalizedPath;
        onEvent({
          type: eventType === 'rename' ? 'rename' : 'change',
          path: resolvedPath,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      throw createError('PAL_FS_WATCH_FAILED', `Unable to watch path: ${normalizedPath}`, {
        path: normalizedPath,
        reason: String(error)
      });
    }

    return {
      id: watchId,
      close: async () => {
        watcher.close();
      }
    };
  }
}

class NodeDialog implements PALDialog {
  public async openFile(options?: DialogFileOptions): Promise<string[] | null> {
    const normalizedDefault = options?.defaultPath ? path.resolve(options.defaultPath) : undefined;
    const mustExist = options?.mustExist ?? true;
    const mode = options?.mode ?? 'file';

    if (normalizedDefault) {
      const stats = await statSafe(normalizedDefault);
      if (!stats && mustExist) {
        throw createError('PAL_DIALOG_PATH_NOT_FOUND', `Path not found: ${normalizedDefault}`);
      }
      if (stats) {
        if (mode === 'file' && !stats.isFile) {
          throw createError('PAL_DIALOG_EXPECT_FILE', `Expected file path: ${normalizedDefault}`);
        }
        if (mode === 'directory' && !stats.isDirectory) {
          throw createError('PAL_DIALOG_EXPECT_DIRECTORY', `Expected directory path: ${normalizedDefault}`);
        }
      }
      return [normalizedDefault];
    }

    if (process.platform === 'darwin') {
      return this.openFileDarwin(options);
    }
    if (process.platform === 'linux') {
      return this.openFileLinux(options);
    }
    if (process.platform === 'win32') {
      return this.openFileWindows(options);
    }

    throw createError('PAL_DIALOG_UNSUPPORTED', 'Dialog openFile not supported on this platform');
  }

  public async saveFile(options?: DialogSaveOptions): Promise<string | null> {
    const normalizedDefault = options?.defaultPath ? path.resolve(options.defaultPath) : undefined;
    if (normalizedDefault) {
      await fs.mkdir(path.dirname(normalizedDefault), { recursive: true });
      return normalizedDefault;
    }

    if (process.platform === 'darwin') {
      return this.saveFileDarwin(options);
    }
    if (process.platform === 'linux') {
      return this.saveFileLinux(options);
    }
    if (process.platform === 'win32') {
      return this.saveFileWindows(options);
    }

    throw createError('PAL_DIALOG_UNSUPPORTED', 'Dialog saveFile not supported on this platform');
  }

  public async showMessage(options: DialogMessageOptions): Promise<number> {
    const title = options.title ?? 'Chips Host';
    if (process.platform === 'darwin') {
      const script = [`display dialog "${quoteAppleScript(options.message)}" with title "${quoteAppleScript(title)}" buttons {"OK"}`];
      await runCommand('osascript', script.flatMap((line) => ['-e', line]));
      return 0;
    }

    process.stdout.write(`[${title}] ${options.message}${options.detail ? `\n${options.detail}` : ''}\n`);
    return 0;
  }

  public async showConfirm(options: DialogMessageOptions): Promise<boolean> {
    const title = options.title ?? 'Chips Host';
    if (process.platform === 'darwin') {
      const script = [
        `display dialog "${quoteAppleScript(options.message)}" with title "${quoteAppleScript(title)}" buttons {"Cancel", "OK"} default button "OK"`
      ];
      try {
        const output = await runCommand('osascript', script.flatMap((line) => ['-e', line]));
        return output.includes('button returned:OK');
      } catch {
        return false;
      }
    }

    return true;
  }

  private async openFileDarwin(options?: DialogFileOptions): Promise<string[] | null> {
    const allowMultiple = options?.allowMultiple ?? false;
    const mode = options?.mode ?? 'file';
    const title = quoteAppleScript(options?.title ?? 'Select item');

    const selectionExpr = mode === 'directory' ? 'choose folder' : 'choose file';
    const script = allowMultiple
      ? [
          `set selectedItems to ${selectionExpr} with prompt "${title}" with multiple selections allowed true`,
          'set output to ""',
          'repeat with itemPath in selectedItems',
          'set output to output & POSIX path of itemPath & linefeed',
          'end repeat',
          'return output'
        ]
      : [`POSIX path of (${selectionExpr} with prompt "${title}")`];

    try {
      const raw = await runCommand('osascript', script.flatMap((line) => ['-e', line]));
      const paths = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return paths.length > 0 ? paths : null;
    } catch {
      return null;
    }
  }

  private async openFileLinux(options?: DialogFileOptions): Promise<string[] | null> {
    if (!(await commandExists('zenity'))) {
      throw createError('PAL_DIALOG_UNSUPPORTED', 'zenity is required for dialog support on Linux');
    }

    const args = ['--file-selection'];
    if (options?.mode === 'directory') {
      args.push('--directory');
    }
    if (options?.allowMultiple) {
      args.push('--multiple', '--separator=\n');
    }
    if (options?.title) {
      args.push(`--title=${options.title}`);
    }

    try {
      const raw = await runCommand('zenity', args);
      const paths = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return paths.length > 0 ? paths : null;
    } catch {
      return null;
    }
  }

  private async openFileWindows(options?: DialogFileOptions): Promise<string[] | null> {
    const multiple = options?.allowMultiple ? '$dialog.Multiselect = $true;' : '';
    const directoryMode = options?.mode === 'directory';
    const script = directoryMode
      ? [
          'Add-Type -AssemblyName System.Windows.Forms;',
          '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
          '$result = $dialog.ShowDialog();',
          'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }'
        ]
      : [
          'Add-Type -AssemblyName System.Windows.Forms;',
          '$dialog = New-Object System.Windows.Forms.OpenFileDialog;',
          multiple,
          '$result = $dialog.ShowDialog();',
          'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileNames | ForEach-Object { Write-Output $_ } }'
        ];

    try {
      const raw = await runCommand('powershell', ['-NoProfile', '-Command', script.join(' ')]);
      const paths = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      return paths.length > 0 ? paths : null;
    } catch {
      return null;
    }
  }

  private async saveFileDarwin(options?: DialogSaveOptions): Promise<string | null> {
    const title = quoteAppleScript(options?.title ?? 'Save file');
    const script = [`POSIX path of (choose file name with prompt "${title}")`];
    try {
      const result = await runCommand('osascript', script.flatMap((line) => ['-e', line]));
      const normalized = result.trim();
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  private async saveFileLinux(options?: DialogSaveOptions): Promise<string | null> {
    if (!(await commandExists('zenity'))) {
      throw createError('PAL_DIALOG_UNSUPPORTED', 'zenity is required for dialog support on Linux');
    }

    const args = ['--file-selection', '--save', '--confirm-overwrite'];
    if (options?.title) {
      args.push(`--title=${options.title}`);
    }

    try {
      const result = await runCommand('zenity', args);
      const normalized = result.trim();
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  private async saveFileWindows(options?: DialogSaveOptions): Promise<string | null> {
    const script = [
      'Add-Type -AssemblyName System.Windows.Forms;',
      '$dialog = New-Object System.Windows.Forms.SaveFileDialog;',
      options?.title ? `$dialog.Title = "${options.title.replaceAll('"', '`"')}";` : '',
      '$result = $dialog.ShowDialog();',
      'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }'
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const result = await runCommand('powershell', ['-NoProfile', '-Command', script]);
      const normalized = result.trim();
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }
}

class NodeClipboard implements PALClipboard {
  private static readonly filesBufferFormat = 'chips/files';
  private readonly electron = loadElectronModule();

  public async read(format: ClipboardFormat = 'text'): Promise<ClipboardPayload> {
    if (this.electron?.clipboard) {
      if (format === 'text') {
        return this.electron.clipboard.readText();
      }

      if (format === 'image') {
        const image = this.electron.clipboard.readImage();
        const png = image.toPNG();
        return {
          base64: png.toString('base64'),
          mimeType: 'image/png'
        };
      }

      const raw = this.electron.clipboard.readBuffer(NodeClipboard.filesBufferFormat);
      if (raw.length > 0) {
        try {
          const parsed = JSON.parse(raw.toString('utf-8'));
          return NodeClipboard.asFileList(parsed);
        } catch {
          throw createError('PAL_CLIPBOARD_FILE_LIST_INVALID', 'Clipboard file list is corrupted');
        }
      }

      const text = this.electron.clipboard.readText();
      const files: string[] = [];
      for (const candidate of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
        const stats = await statSafe(candidate);
        if (stats) {
          files.push(path.resolve(candidate));
        }
      }
      return files;
    }

    if (format !== 'text') {
      throw createError('PAL_CLIPBOARD_UNSUPPORTED_FORMAT', `Unsupported clipboard format without Electron runtime: ${format}`);
    }

    if (process.platform === 'darwin') {
      return runCommand('pbpaste', []);
    }

    if (process.platform === 'win32') {
      return runCommand('powershell', ['-NoProfile', '-Command', 'Get-Clipboard']);
    }

    if (await commandExists('wl-paste')) {
      return runCommand('wl-paste', ['--no-newline']);
    }
    if (await commandExists('xclip')) {
      return runCommand('xclip', ['-selection', 'clipboard', '-o']);
    }
    if (await commandExists('xsel')) {
      return runCommand('xsel', ['--clipboard', '--output']);
    }

    throw createError('PAL_CLIPBOARD_UNSUPPORTED', 'Clipboard read requires pbpaste, powershell, wl-paste, xclip, or xsel');
  }

  public async write(data: ClipboardPayload, format: ClipboardFormat = 'text'): Promise<void> {
    if (this.electron?.clipboard) {
      if (format === 'text') {
        if (typeof data !== 'string') {
          throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Text clipboard data must be a string');
        }
        this.electron.clipboard.writeText(data);
        return;
      }

      if (format === 'image') {
        const payload = NodeClipboard.asImagePayload(data);
        if (!this.electron.nativeImage) {
          throw createError('PAL_CLIPBOARD_UNSUPPORTED', 'Electron nativeImage is required for image clipboard writes');
        }
        const image = this.electron.nativeImage.createFromBuffer(Buffer.from(payload.base64, 'base64'));
        this.electron.clipboard.writeImage(image);
        return;
      }

      const files = NodeClipboard.asFileList(data).map((item) => path.resolve(item));
      this.electron.clipboard.writeBuffer(NodeClipboard.filesBufferFormat, Buffer.from(JSON.stringify(files), 'utf-8'));
      this.electron.clipboard.writeText(files.join(os.EOL));
      return;
    }

    if (format !== 'text') {
      throw createError('PAL_CLIPBOARD_UNSUPPORTED_FORMAT', `Unsupported clipboard format without Electron runtime: ${format}`);
    }

    if (typeof data !== 'string') {
      throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Text clipboard data must be a string');
    }

    if (process.platform === 'darwin') {
      await runCommand('pbcopy', [], data);
      return;
    }

    if (process.platform === 'win32') {
      const escaped = data.replaceAll('"', '`"');
      await runCommand('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Value "${escaped}"`]);
      return;
    }

    if (await commandExists('wl-copy')) {
      await runCommand('wl-copy', [], data);
      return;
    }
    if (await commandExists('xclip')) {
      await runCommand('xclip', ['-selection', 'clipboard'], data);
      return;
    }
    if (await commandExists('xsel')) {
      await runCommand('xsel', ['--clipboard', '--input'], data);
      return;
    }

    throw createError('PAL_CLIPBOARD_UNSUPPORTED', 'Clipboard write requires pbcopy, powershell, wl-copy, xclip, or xsel');
  }

  private static asImagePayload(data: ClipboardPayload): ClipboardImagePayload {
    if (!data || typeof data !== 'object') {
      throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Image clipboard payload must be object');
    }
    const candidate = data as unknown as Record<string, unknown>;
    if (typeof candidate.base64 !== 'string' || candidate.base64.length === 0) {
      throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Image clipboard payload requires base64');
    }
    return {
      base64: candidate.base64,
      mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : undefined
    };
  }

  private static asFileList(data: unknown): string[] {
    if (!Array.isArray(data)) {
      throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Files clipboard payload must be string[]');
    }
    const files = data.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
    if (files.length !== data.length) {
      throw createError('PAL_CLIPBOARD_INVALID_PAYLOAD', 'Files clipboard payload must contain only non-empty strings');
    }
    return files;
  }
}

class NodeShell implements PALShell {
  public async openPath(targetPath: string): Promise<void> {
    const resolved = path.resolve(targetPath);
    if (process.platform === 'darwin') {
      await runCommand('open', [resolved]);
      return;
    }
    if (process.platform === 'win32') {
      await runCommand('explorer', [resolved]);
      return;
    }
    await runCommand('xdg-open', [resolved]);
  }

  public async openExternal(url: string): Promise<void> {
    if (process.platform === 'darwin') {
      await runCommand('open', [url]);
      return;
    }
    if (process.platform === 'win32') {
      await runCommand('cmd', ['/c', 'start', '', url]);
      return;
    }
    await runCommand('xdg-open', [url]);
  }

  public async showItemInFolder(targetPath: string): Promise<void> {
    const resolved = path.resolve(targetPath);
    if (process.platform === 'darwin') {
      await runCommand('open', ['-R', resolved]);
      return;
    }
    if (process.platform === 'win32') {
      await runCommand('explorer', ['/select,', resolved]);
      return;
    }
    await runCommand('xdg-open', [path.dirname(resolved)]);
  }
}

class NodeTray implements PALTray {
  private readonly electron = loadElectronModule();
  private tray: { setImage(image: string): void; setToolTip(text: string): void; setContextMenu(menu: unknown): void; destroy(): void; isDestroyed?(): boolean } | null = null;
  private state: TrayState = { active: false };

  public async set(options: TrayOptions): Promise<TrayState> {
    this.state = {
      ...this.state,
      ...options,
      menu: options.menu ? [...options.menu] : this.state.menu,
      active: true
    };

    if (this.electron?.Tray) {
      if (!this.tray) {
        if (!options.icon) {
          throw createError('PAL_TRAY_ICON_REQUIRED', 'Tray icon is required when Electron tray is enabled');
        }
        this.tray = new this.electron.Tray(options.icon);
      } else if (options.icon) {
        this.tray.setImage(options.icon);
      }

      if (options.tooltip) {
        this.tray.setToolTip(options.tooltip);
      }

      if (options.menu && this.electron.Menu?.buildFromTemplate) {
        const menu = this.electron.Menu.buildFromTemplate(
          options.menu.map((item) => ({
            id: item.id,
            label: item.label
          }))
        );
        this.tray.setContextMenu(menu);
      }
    }

    return {
      ...this.state,
      menu: this.state.menu ? [...this.state.menu] : undefined
    };
  }

  public async clear(): Promise<void> {
    if (this.tray && !(this.tray.isDestroyed?.() ?? false)) {
      this.tray.destroy();
    }
    this.tray = null;
    this.state = { active: false };
  }

  public async getState(): Promise<TrayState> {
    return {
      ...this.state,
      menu: this.state.menu ? [...this.state.menu] : undefined
    };
  }
}

class NodeNotification implements PALNotification {
  private readonly electron = loadElectronModule();

  public async show(options: NotificationOptions): Promise<void> {
    if (this.electron?.Notification) {
      const notification = new this.electron.Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent ?? false
      });
      notification.show();
      return;
    }

    if (process.platform === 'darwin') {
      const title = quoteAppleScript(options.title);
      const body = quoteAppleScript(options.body);
      await runCommand('osascript', ['-e', `display notification "${body}" with title "${title}"`]);
      return;
    }

    if (process.platform === 'linux' && (await commandExists('notify-send'))) {
      await runCommand('notify-send', [options.title, options.body]);
      return;
    }

    process.stdout.write(`[notification] ${options.title}: ${options.body}\n`);
  }
}

class NodeShortcut implements PALShortcut {
  private readonly electron = loadElectronModule();
  private readonly callbacks = new Map<string, () => void>();

  public async register(accelerator: string, onTrigger?: () => void): Promise<boolean> {
    if (this.electron?.globalShortcut) {
      const registered = this.electron.globalShortcut.register(accelerator, () => {
        const callback = this.callbacks.get(accelerator);
        callback?.();
      });
      if (!registered) {
        return false;
      }
      if (onTrigger) {
        this.callbacks.set(accelerator, onTrigger);
      }
      return true;
    }

    if (onTrigger) {
      this.callbacks.set(accelerator, onTrigger);
    } else if (!this.callbacks.has(accelerator)) {
      this.callbacks.set(accelerator, () => {});
    }
    return true;
  }

  public async unregister(accelerator: string): Promise<void> {
    this.electron?.globalShortcut?.unregister(accelerator);
    this.callbacks.delete(accelerator);
  }

  public async isRegistered(accelerator: string): Promise<boolean> {
    if (this.electron?.globalShortcut) {
      return this.electron.globalShortcut.isRegistered(accelerator);
    }
    return this.callbacks.has(accelerator);
  }

  public async list(): Promise<string[]> {
    return [...this.callbacks.keys()];
  }

  public async clear(): Promise<void> {
    this.electron?.globalShortcut?.unregisterAll();
    this.callbacks.clear();
  }
}

class NodeLauncher implements PALLauncher {
  public async getDefaultPath(name: string): Promise<{ launcherPath: string; location: LauncherLocation }> {
    const normalizedName = sanitizeLauncherName(name);
    if (process.platform === 'win32') {
      const desktopDir = await this.resolveWindowsDesktopDir();
      return {
        launcherPath: path.join(desktopDir, `${normalizedName}.lnk`),
        location: 'desktop'
      };
    }

    if (process.platform === 'darwin') {
      const applicationsDir = path.join(os.homedir(), 'Applications', 'Chips Apps');
      return {
        launcherPath: path.join(applicationsDir, `${normalizedName}.app`),
        location: 'launchpad'
      };
    }

    return {
      launcherPath: path.join(os.homedir(), 'Desktop', `${normalizedName}.desktop`),
      location: 'desktop'
    };
  }

  public async create(options: LauncherCreateOptions & { launcherPath?: string }): Promise<LauncherRecord> {
    const target = options.launcherPath ? await this.resolveExplicitTarget(options.launcherPath) : await this.getDefaultPath(options.name);

    if (process.platform === 'win32') {
      await this.createWindowsLauncher(target.launcherPath, options);
    } else if (process.platform === 'darwin') {
      await this.createDarwinLauncher(target.launcherPath, options);
    } else {
      await this.createFreedesktopLauncher(target.launcherPath, options);
    }

    return this.getRecord({
      pluginId: options.pluginId,
      name: options.name,
      launcherPath: target.launcherPath
    });
  }

  public async getRecord(options: { pluginId: string; name: string; launcherPath?: string }): Promise<LauncherRecord> {
    const target = options.launcherPath ? await this.resolveExplicitTarget(options.launcherPath) : await this.getDefaultPath(options.name);
    const iconPath = await this.resolveExistingIconPath(target.launcherPath);

    return {
      pluginId: options.pluginId,
      name: options.name,
      location: target.location,
      launcherPath: target.launcherPath,
      executablePath: '',
      args: [],
      iconPath
    };
  }

  public async remove(options: {
    pluginId: string;
    name: string;
    launcherPath?: string;
  }): Promise<{ removed: boolean; launcherPath: string; location: LauncherLocation }> {
    const target = options.launcherPath ? await this.resolveExplicitTarget(options.launcherPath) : await this.getDefaultPath(options.name);
    const existing = await statSafe(target.launcherPath);
    if (!existing) {
      return {
        removed: false,
        launcherPath: target.launcherPath,
        location: target.location
      };
    }

    await fs.rm(target.launcherPath, { recursive: true, force: true });
    return {
      removed: true,
      launcherPath: target.launcherPath,
      location: target.location
    };
  }

  private async resolveExplicitTarget(launcherPath: string): Promise<{ launcherPath: string; location: LauncherLocation }> {
    const normalizedPath = path.resolve(launcherPath);
    return {
      launcherPath: normalizedPath,
      location: process.platform === 'darwin' ? 'launchpad' : 'desktop'
    };
  }

  private async resolveWindowsDesktopDir(): Promise<string> {
    const preferred = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : path.join(os.homedir(), 'Desktop');
    if (await statSafe(preferred)) {
      return preferred;
    }

    try {
      const result = await runCommand('powershell', [
        '-NoProfile',
        '-Command',
        '[Environment]::GetFolderPath("Desktop")'
      ]);
      const resolved = result.trim();
      if (resolved.length > 0) {
        return resolved;
      }
    } catch {
      // ignore and fall back to home desktop path
    }

    return preferred;
  }

  private async createWindowsLauncher(launcherPath: string, options: LauncherCreateOptions): Promise<void> {
    await fs.mkdir(path.dirname(launcherPath), { recursive: true });
    const argumentsLiteral = options.args
      .map((item) => (/\s/.test(item) ? `"${item.replaceAll('"', '`"')}"` : item.replaceAll('"', '`"')))
      .join(' ');
    const iconLiteral = options.iconPath ? `\n$shortcut.IconLocation = "${options.iconPath.replaceAll('"', '`"')}";` : '';
    const script = [
      '$wshell = New-Object -ComObject WScript.Shell;',
      `$shortcut = $wshell.CreateShortcut("${launcherPath.replaceAll('"', '`"')}");`,
      `$shortcut.TargetPath = "${options.executablePath.replaceAll('"', '`"')}";`,
      `$shortcut.Arguments = "${argumentsLiteral.replaceAll('"', '`"')}";`,
      `$shortcut.WorkingDirectory = "${path.dirname(options.executablePath).replaceAll('"', '`"')}";`,
      `$shortcut.Description = "${options.name.replaceAll('"', '`"')}";`,
      iconLiteral,
      '$shortcut.Save();'
    ]
      .filter(Boolean)
      .join(' ');

    await runCommand('powershell', ['-NoProfile', '-Command', script]);
  }

  private async createDarwinLauncher(launcherPath: string, options: LauncherCreateOptions): Promise<void> {
    const appName = path.basename(launcherPath, '.app');
    const contentsDir = path.join(launcherPath, 'Contents');
    const macOSDir = path.join(contentsDir, 'MacOS');
    const resourcesDir = path.join(contentsDir, 'Resources');
    const executableName = sanitizeLauncherName(appName).replace(/\s+/g, '-');
    const executablePath = path.join(macOSDir, executableName);
    const bundleId = `chips.launcher.${options.pluginId.replace(/[^a-zA-Z0-9.-]/g, '-')}`;

    await fs.rm(launcherPath, { recursive: true, force: true });
    await fs.mkdir(macOSDir, { recursive: true });
    await fs.mkdir(resourcesDir, { recursive: true });

    let iconFileName = '';
    if (options.iconPath) {
      const copiedIcon = await this.materializeDarwinIcon(options.iconPath, resourcesDir);
      if (copiedIcon) {
        iconFileName = copiedIcon;
      }
    }

    const infoPlist = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0">',
      '<dict>',
      '  <key>CFBundleDevelopmentRegion</key>',
      '  <string>zh_CN</string>',
      '  <key>CFBundleExecutable</key>',
      `  <string>${executableName}</string>`,
      '  <key>CFBundleIdentifier</key>',
      `  <string>${bundleId}</string>`,
      '  <key>CFBundleName</key>',
      `  <string>${appName}</string>`,
      '  <key>CFBundlePackageType</key>',
      '  <string>APPL</string>',
      '  <key>CFBundleVersion</key>',
      '  <string>1</string>',
      '  <key>LSApplicationCategoryType</key>',
      '  <string>public.app-category.productivity</string>',
      iconFileName ? '  <key>CFBundleIconFile</key>' : '',
      iconFileName ? `  <string>${iconFileName}</string>` : '',
      '</dict>',
      '</plist>',
      ''
    ]
      .filter(Boolean)
      .join('\n');
    await fs.writeFile(path.join(contentsDir, 'Info.plist'), infoPlist, 'utf-8');

    const commandArgs = [options.executablePath, ...options.args].map((item) => quoteShellArg(item)).join(' ');
    const shellScript = [
      '#!/bin/sh',
      `exec ${commandArgs} >/dev/null 2>&1 &`,
      ''
    ].join('\n');
    await fs.writeFile(executablePath, shellScript, 'utf-8');
    await fs.chmod(executablePath, 0o755);
  }

  private async createFreedesktopLauncher(launcherPath: string, options: LauncherCreateOptions): Promise<void> {
    await fs.mkdir(path.dirname(launcherPath), { recursive: true });
    const desktopEntry = [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${options.name}`,
      `Exec=${[options.executablePath, ...options.args].map((item) => quoteShellArg(item)).join(' ')}`,
      options.iconPath ? `Icon=${options.iconPath}` : '',
      'Terminal=false',
      ''
    ]
      .filter(Boolean)
      .join('\n');
    await fs.writeFile(launcherPath, desktopEntry, 'utf-8');
    await fs.chmod(launcherPath, 0o755);
  }

  private async materializeDarwinIcon(sourcePath: string, resourcesDir: string): Promise<string | null> {
    const normalizedSource = path.resolve(sourcePath);
    const extension = path.extname(normalizedSource).toLowerCase();
    if (extension === '.icns') {
      const targetName = 'AppIcon.icns';
      await fs.copyFile(normalizedSource, path.join(resourcesDir, targetName));
      return targetName;
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-iconset-'));
    try {
      const iconsetDir = path.join(tempDir, 'AppIcon.iconset');
      await fs.mkdir(iconsetDir, { recursive: true });
      const pngPath = path.join(tempDir, 'AppIcon.png');

      await runCommand('sips', ['-s', 'format', 'png', normalizedSource, '--out', pngPath]);

      const sizes = [
        ['icon_16x16.png', '16'],
        ['icon_16x16@2x.png', '32'],
        ['icon_32x32.png', '32'],
        ['icon_32x32@2x.png', '64'],
        ['icon_128x128.png', '128'],
        ['icon_128x128@2x.png', '256'],
        ['icon_256x256.png', '256'],
        ['icon_256x256@2x.png', '512'],
        ['icon_512x512.png', '512'],
        ['icon_512x512@2x.png', '1024']
      ] as const;

      for (const [fileName, size] of sizes) {
        await runCommand('sips', ['-z', size, size, pngPath, '--out', path.join(iconsetDir, fileName)]);
      }

      const targetName = 'AppIcon.icns';
      await runCommand('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(resourcesDir, targetName)]);
      return targetName;
    } catch {
      return null;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async resolveExistingIconPath(launcherPath: string): Promise<string | undefined> {
    if (process.platform === 'darwin') {
      const iconPath = path.join(launcherPath, 'Contents', 'Resources', 'AppIcon.icns');
      const existing = await statSafe(iconPath);
      return existing?.isFile ? iconPath : undefined;
    }

    return undefined;
  }
}

class NodePower implements PALPower {
  private readonly electron = loadElectronModule();
  private blockerId: number | null = null;
  private preventSleep = false;

  public async getState(): Promise<PowerState> {
    const idleSeconds = this.electron?.powerMonitor?.getSystemIdleTime?.() ?? 0;
    return {
      idleSeconds,
      preventSleep: this.preventSleep
    };
  }

  public async setPreventSleep(prevent: boolean): Promise<boolean> {
    if (!prevent) {
      if (this.blockerId !== null && this.electron?.powerSaveBlocker?.isStarted(this.blockerId)) {
        this.electron.powerSaveBlocker.stop(this.blockerId);
      }
      this.blockerId = null;
      this.preventSleep = false;
      return false;
    }

    if (this.electron?.powerSaveBlocker) {
      if (this.blockerId !== null && this.electron.powerSaveBlocker.isStarted(this.blockerId)) {
        this.preventSleep = true;
        return true;
      }
      this.blockerId = this.electron.powerSaveBlocker.start('prevent-app-suspension');
    }

    this.preventSleep = true;
    return true;
  }
}

class NodePlatform implements PALPlatform {
  public async getInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      release: os.release()
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return ['window', 'file', 'dialog', 'clipboard', 'shell', 'screen', 'tray', 'notification', 'power', 'shortcut', 'ipc'];
  }
}

class NodeScreen implements PALScreen {
  private readonly electron = loadElectronModule();

  public async getPrimary(): Promise<ScreenInfo> {
    const screens = await this.getAll();
    const primary = screens.find((item) => item.primary);
    return primary ?? screens[0]!;
  }

  public async getAll(): Promise<ScreenInfo[]> {
    if (this.electron?.screen?.getAllDisplays) {
      const primaryDisplay = this.electron.screen.getPrimaryDisplay?.();
      return this.electron.screen.getAllDisplays().map((display) => ({
        id: String(display.id),
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor ?? 1,
        x: display.bounds.x,
        y: display.bounds.y,
        primary: primaryDisplay ? display.id === primaryDisplay.id : display.bounds.x === 0 && display.bounds.y === 0
      }));
    }

    return [
      {
        id: 'default-screen',
        width: 0,
        height: 0,
        scaleFactor: 1,
        x: 0,
        y: 0,
        primary: true
      }
    ];
  }
}

interface PendingIpcReceiver {
  resolve: (message: PALIpcMessage) => void;
  reject: (error: unknown) => void;
  timer?: NodeJS.Timeout;
}

interface NodeIpcChannelState {
  info: PALIpcChannelInfo;
  maxBufferBytes: number;
  queue: PALIpcMessage[];
  pending: PendingIpcReceiver[];
  server?: net.Server;
}

class NodeIPC implements PALIPC {
  private readonly channels = new Map<string, NodeIpcChannelState>();

  public async createChannel(options: PALIpcCreateOptions): Promise<PALIpcChannelInfo> {
    const trimmedName = options.name.trim();
    if (trimmedName.length === 0) {
      throw createError('PAL_IPC_INVALID_CHANNEL', 'IPC channel name is required');
    }
    if (options.transport === 'unix-socket' && process.platform === 'win32') {
      throw createError('PAL_IPC_UNSUPPORTED_TRANSPORT', 'Unix domain socket is not supported on Windows');
    }

    const channelId = createId();
    const endpoint = this.createEndpoint(trimmedName, channelId, options.transport);
    const info: PALIpcChannelInfo = {
      channelId,
      name: trimmedName,
      transport: options.transport,
      endpoint
    };
    const state: NodeIpcChannelState = {
      info,
      maxBufferBytes: options.maxBufferBytes ?? 4 * 1024 * 1024,
      queue: [],
      pending: []
    };
    this.channels.set(channelId, state);

    if (options.transport !== 'shared-memory') {
      state.server = await this.createServer(state);
    }

    return { ...info };
  }

  public async send(channelId: string, payload: Buffer | string): Promise<void> {
    const state = this.requireChannel(channelId);
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
    if (body.length > state.maxBufferBytes) {
      throw createError('PAL_IPC_PAYLOAD_TOO_LARGE', `IPC payload exceeds limit for channel: ${state.info.name}`, {
        size: body.length,
        maxBufferBytes: state.maxBufferBytes
      });
    }

    if (state.info.transport === 'shared-memory') {
      this.pushMessage(state, body);
      return;
    }

    const endpoint = state.info.endpoint;
    if (!endpoint) {
      throw createError('PAL_IPC_ENDPOINT_MISSING', `IPC endpoint missing for channel: ${state.info.name}`);
    }

    await new Promise<void>((resolve, reject) => {
      const client = net.createConnection(endpoint);
      client.once('error', (error) => {
        reject(createError('PAL_IPC_SEND_FAILED', `IPC send failed for channel: ${state.info.name}`, { reason: String(error) }));
      });
      client.once('connect', () => {
        client.write(body);
        client.end();
      });
      client.once('close', () => {
        resolve();
      });
    });
  }

  public async receive(channelId: string, options?: PALIpcReceiveOptions): Promise<PALIpcMessage> {
    const state = this.requireChannel(channelId);
    const immediate = state.queue.shift();
    if (immediate) {
      return immediate;
    }

    return new Promise<PALIpcMessage>((resolve, reject) => {
      const pending: PendingIpcReceiver = {
        resolve,
        reject
      };
      const timeoutMs = options?.timeoutMs;
      if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          state.pending = state.pending.filter((item) => item !== pending);
          reject(createError('PAL_IPC_RECEIVE_TIMEOUT', `IPC receive timeout for channel: ${state.info.name}`, { timeoutMs }));
        }, timeoutMs);
      }
      state.pending.push(pending);
    });
  }

  public async closeChannel(channelId: string): Promise<void> {
    const state = this.channels.get(channelId);
    if (!state) {
      return;
    }

    this.channels.delete(channelId);
    for (const pending of state.pending) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.reject(createError('PAL_IPC_CHANNEL_CLOSED', `IPC channel closed: ${state.info.name}`));
    }
    state.pending = [];

    if (state.server) {
      await new Promise<void>((resolve) => {
        state.server!.close(() => resolve());
      });
    }

    if (state.info.endpoint && this.isSocketPath(state.info.endpoint)) {
      await fs.rm(state.info.endpoint, { force: true });
    }
  }

  public async listChannels(): Promise<PALIpcChannelInfo[]> {
    return [...this.channels.values()].map((state) => ({ ...state.info }));
  }

  private requireChannel(channelId: string): NodeIpcChannelState {
    const state = this.channels.get(channelId);
    if (!state) {
      throw createError('PAL_IPC_CHANNEL_NOT_FOUND', `IPC channel not found: ${channelId}`);
    }
    return state;
  }

  private pushMessage(state: NodeIpcChannelState, payload: Buffer): void {
    const message: PALIpcMessage = {
      channelId: state.info.channelId,
      transport: state.info.transport,
      payload,
      receivedAt: Date.now()
    };

    const pending = state.pending.shift();
    if (pending) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.resolve(message);
      return;
    }

    state.queue.push(message);
  }

  private async createServer(state: NodeIpcChannelState): Promise<net.Server> {
    const endpoint = state.info.endpoint;
    if (!endpoint) {
      throw createError('PAL_IPC_ENDPOINT_MISSING', `IPC endpoint missing for channel: ${state.info.name}`);
    }

    if (this.isSocketPath(endpoint)) {
      await fs.rm(endpoint, { force: true });
    }

    const server = net.createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on('data', (chunk) => {
        const nextChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(nextChunk);
      });
      socket.on('end', () => {
        const payload = Buffer.concat(chunks);
        this.pushMessage(state, payload);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: unknown) => {
        server.off('listening', onListening);
        reject(createError('PAL_IPC_BIND_FAILED', `IPC bind failed for channel: ${state.info.name}`, { reason: String(error) }));
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(endpoint);
    });

    server.on('error', () => {});
    return server;
  }

  private createEndpoint(name: string, channelId: string, transport: PALIpcTransport): string | undefined {
    const normalizedName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
    if (transport === 'shared-memory') {
      return undefined;
    }
    if (transport === 'named-pipe' && process.platform === 'win32') {
      return `\\\\.\\pipe\\chips-${normalizedName}-${channelId}`;
    }
    const compactId = channelId.replace(/-/g, '');
    const compactName = normalizedName.slice(0, 12) || 'ipc';
    const socketDir = os.tmpdir().length <= 40 ? os.tmpdir() : '/tmp';
    const socketTag = transport === 'named-pipe' ? 'np' : 'us';
    return path.join(socketDir, `ch-${socketTag}-${compactName}-${compactId}.sock`);
  }

  private isSocketPath(endpoint: string): boolean {
    return !endpoint.startsWith('\\\\.\\pipe\\');
  }
}

export class NodePalAdapter implements PALAdapter {
  public readonly window: PALWindow;
  public readonly fs: PALFileSystem = new NodeFileSystem();
  public readonly dialog: PALDialog = new NodeDialog();
  public readonly clipboard: PALClipboard = new NodeClipboard();
  public readonly shell: PALShell = new NodeShell();
  public readonly platform: PALPlatform = new NodePlatform();
  public readonly screen: PALScreen = new NodeScreen();
  public readonly tray: PALTray = new NodeTray();
  public readonly notification: PALNotification = new NodeNotification();
  public readonly shortcut: PALShortcut = new NodeShortcut();
  public readonly launcher: PALLauncher = new NodeLauncher();
  public readonly power: PALPower = new NodePower();
  public readonly ipc: PALIPC = new NodeIPC();

  public constructor(options?: { window?: WindowManagerOptions }) {
    this.window = new NodeWindowManager(options?.window);
  }
}
