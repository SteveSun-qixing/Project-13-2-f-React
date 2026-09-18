import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createError } from '../../../src/shared/errors';

/**
 * xlsx 引擎服务：承载 GenOffice xlsx-sidecar 原生二进制（calamine 解析 + ironcalc 重算）。
 *
 * 协议为 stdio JSON 行协议：请求 `{version:1, requestId, ...command}`，响应
 * `{version, requestId, ok, result?, error?}`。除 readEntries / saveArchive /
 * convertWorkbook 需要 Host 落临时文件外，其余动作的 result 原样透传——
 * 工作簿形状由插件侧 zod schema（GenOffice desktop-api）校验。
 */

export interface XlsxEngineServiceOptions {
  /** 覆盖二进制定位（调试/测试用）。 */
  binaryPath?: string;
  /** 默认请求超时毫秒。 */
  requestTimeoutMs?: number;
  /** open 类重请求的超时毫秒。 */
  openTimeoutMs?: number;
}

/** sidecar save_archive 的条目内容（内容以 base64 传入，由服务落临时文件）。 */
export interface EngineEntryContent {
  name: string;
  contentBase64: string;
}

export interface EngineSaveArchiveInput {
  sourcePath: string;
  targetPath: string;
  replacements: EngineEntryContent[];
  removals: string[];
  additions: EngineEntryContent[];
}

type PendingResolution = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface SidecarResponse {
  version: number;
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

interface SidecarErrorBody {
  code: string;
  message: string;
}

const PROTOCOL_VERSION = 1;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_OPEN_TIMEOUT_MS = 120_000;

export class XlsxEngineService {
  private child: ReturnType<typeof spawn> | null = null;
  private starting: Promise<void> | null = null;
  private stopped = false;
  private readonly pending = new Map<string, PendingResolution>();
  private stdoutBuffer = '';
  private stderrTail = '';

  public constructor(private readonly options: XlsxEngineServiceOptions = {}) {}

  /** 解析 sidecar 二进制路径：显式配置 > 环境变量 > resources/engines 平台目录。 */
  public resolveBinaryPath(): string {
    if (this.options.binaryPath) {
      return this.options.binaryPath;
    }
    const fromEnv = process.env.CHIPS_XLSX_SIDECAR;
    if (fromEnv && fs.existsSync(fromEnv)) {
      return fromEnv;
    }
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // packages/xlsx-engine-service/src → 仓库根三层向上
    const repoRoot = path.resolve(currentDir, '..', '..', '..');
    const platformDir = `${process.platform}-${process.arch}`;
    const executable = process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar';
    const candidate = path.join(repoRoot, 'resources', 'engines', 'xlsx-sidecar', platformDir, executable);
    if (!fs.existsSync(candidate)) {
      throw createError(
        'OFFICE_ENGINE_BINARY_MISSING',
        `xlsx-sidecar binary not found for ${platformDir}: ${candidate}`,
      );
    }
    return candidate;
  }

  public async open(input: { path: string; locale?: string; shortDateFormat?: string }): Promise<unknown> {
    return this.request('open', input, this.options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS);
  }

  public async readRange(input: { sessionId: string; sheetId: string; range: {
    startRow: number; endRow: number; startColumn: number; endColumn: number;
  } }): Promise<unknown> {
    return this.request('read_range', input);
  }

  public async close(input: { sessionId: string }): Promise<unknown> {
    try {
      return await this.request('close', input);
    } catch (error) {
      // 会话不存在（进程已重启）时 close 视为幂等成功。
      if ((error as { code?: string })?.code === 'OFFICE_ENGINE_SESSION_NOT_FOUND') {
        return { ok: true };
      }
      throw error;
    }
  }

  public async readMedia(input: { sessionId: string; visualId: string }): Promise<unknown> {
    return this.request('read_media', input);
  }

  public async readFormulaCells(input: { sessionId: string; sheetId: string }): Promise<unknown> {
    return this.request('read_formula_cells', input);
  }

  public async cancel(input: { sessionId: string; targetRequestId: string }): Promise<unknown> {
    return this.request('cancel', input);
  }

  public async archiveManifest(input: { path: string }): Promise<unknown> {
    return this.request('archive_manifest', input);
  }

  public async scanEntries(input: { path: string; entries: string[]; needle: string }): Promise<unknown> {
    return this.request('scan_entries', input);
  }

  public async recalcCells(input: { path: string; edits?: unknown[]; reads?: unknown[] }): Promise<unknown> {
    return this.request('recalc_cells', input);
  }

  /** read_entries：Host 建临时目录让 sidecar 抽取，读回内容（base64）后清理。 */
  public async readEntries(input: { path: string; entries: string[] }): Promise<{
    entries: Array<{ name: string; contentBase64: string }>;
  }> {
    if (!Array.isArray(input.entries) || input.entries.length === 0) {
      throw createError('INVALID_ARGUMENT', 'office.engine.readEntries: entries must be a non-empty array.');
    }
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chips-xlsx-read-'));
    try {
      await this.request('read_entries', { path: input.path, entries: input.entries, outputDir: workDir });
      const out = [];
      for (const name of input.entries) {
        const filePath = path.join(workDir, name);
        const content = await fsp.readFile(filePath);
        out.push({ name, contentBase64: content.toString('base64') });
      }
      return { entries: out };
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true });
    }
  }

  /** convertWorkbook：Host 决定目标路径（源同目录同名 .xlsx，重名加后缀）。 */
  public async convertWorkbook(input: { sourcePath: string }): Promise<{ targetPath: string }> {
    const sourcePath = input.sourcePath;
    const directory = path.dirname(sourcePath);
    const extension = path.extname(sourcePath);
    const stem = path.basename(sourcePath, extension);
    let targetPath = path.join(directory, `${stem}.xlsx`);
    for (let index = 2; index < 10000; index += 1) {
      if (!fs.existsSync(targetPath)) {
        break;
      }
      targetPath = path.join(directory, `${stem}-${index}.xlsx`);
    }
    await this.request('convert_workbook', { path: sourcePath, targetPath });
    return { targetPath };
  }

  /** saveArchive：条目内容落临时文件后交给 sidecar 重组 zip。 */
  public async saveArchive(input: EngineSaveArchiveInput): Promise<unknown> {
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'chips-xlsx-save-'));
    try {
      const materialize = async (entry: EngineEntryContent): Promise<{ name: string; contentPath: string }> => {
        const safeName = entry.name.replace(/[\\/]/g, '__');
        const filePath = path.join(workDir, 'entries', safeName);
        await fsp.mkdir(path.dirname(filePath), { recursive: true });
        await fsp.writeFile(filePath, Buffer.from(entry.contentBase64, 'base64'));
        return { name: entry.name, contentPath: filePath };
      };
      const replacements = [];
      for (const entry of input.replacements ?? []) {
        replacements.push(await materialize(entry));
      }
      const additions = [];
      for (const entry of input.additions ?? []) {
        additions.push(await materialize(entry));
      }
      return await this.request('save_archive', {
        sourcePath: input.sourcePath,
        targetPath: input.targetPath,
        replacements,
        removals: input.removals ?? [],
        additions,
      }, this.options.openTimeoutMs ?? DEFAULT_OPEN_TIMEOUT_MS);
    } finally {
      await fsp.rm(workDir, { recursive: true, force: true });
    }
  }

  /** 停止 sidecar 进程（Host 关闭时调用）。停止后不再自动重启。 */
  public async stop(): Promise<void> {
    this.stopped = true;
    const child = this.child;
    this.child = null;
    this.rejectAllPending(createError('OFFICE_ENGINE_FAILED', 'xlsx-sidecar service stopped.'));
    if (!child) {
      return;
    }
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill();
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 2_000);
    });
  }

  private async request(command: string, payload: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    await this.ensureProcess();
    const child = this.child;
    if (!child || !child.stdin.writable) {
      throw createError('OFFICE_ENGINE_FAILED', `xlsx-sidecar stdin is unavailable for ${command}.`);
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(createError('OFFICE_ENGINE_TIMEOUT', `xlsx-sidecar request timed out: ${command}`));
      }, timeoutMs ?? this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timer });
      const request = JSON.stringify({ version: PROTOCOL_VERSION, requestId, command, ...payload });
      child.stdin.write(`${request}\n`);
    });
  }

  private async ensureProcess(): Promise<void> {
    if (this.stopped) {
      throw createError('OFFICE_ENGINE_FAILED', 'xlsx-sidecar service has been stopped.');
    }
    if (this.child) {
      return;
    }
    if (this.starting) {
      await this.starting;
      return;
    }
    this.starting = this.spawnProcess();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private spawnProcess(): Promise<void> {
    const binaryPath = this.resolveBinaryPath();
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let started = false;

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        this.stdoutBuffer += chunk;
        let newlineIndex = this.stdoutBuffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
          if (line) {
            this.handleResponseLine(line);
          }
          newlineIndex = this.stdoutBuffer.indexOf('\n');
        }
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4_000);
      });

      child.on('error', (error) => {
        this.child = null;
        this.rejectAllPending(error);
        if (!started) {
          started = true;
          reject(createError('OFFICE_ENGINE_FAILED', `Unable to spawn xlsx-sidecar: ${String(error)}`));
        }
      });

      child.on('exit', (code, signal) => {
        this.child = null;
        this.rejectAllPending(createError(
          'OFFICE_ENGINE_FAILED',
          code === null
            ? `xlsx-sidecar terminated by signal ${String(signal)}. ${this.stderrTail}`
            : `xlsx-sidecar exited with code ${String(code)}. ${this.stderrTail}`,
        ));
      });

      // stdin 可写即认为进程就绪（sidecar 对无效请求会立即回错误响应）。
      child.stdin.on('error', (error) => {
        if (!started) {
          started = true;
          reject(createError('OFFICE_ENGINE_FAILED', `xlsx-sidecar stdin error: ${String(error)}`));
        }
      });
      child.stdin.write('', () => {
        if (!started) {
          started = true;
          this.child = child;
          resolve();
        }
      });
    });
  }

  private handleResponseLine(line: string): void {
    let response: SidecarResponse;
    try {
      response = JSON.parse(line) as SidecarResponse;
    } catch {
      // 无响应匹配的噪声行（如启动横幅）只记录不中断；进程协议要求 JSON 行。
      this.stderrTail = `${this.stderrTail}\n[unparsed] ${line}`.slice(-4_000);
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(response.requestId);
    clearTimeout(pending.timer);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(createError(
      response.error?.code === 'SESSION_NOT_FOUND' ? 'OFFICE_ENGINE_SESSION_NOT_FOUND' : 'OFFICE_ENGINE_FAILED',
      response.error?.message ?? 'xlsx-sidecar request failed.',
    ));
  }

  private rejectAllPending(error: unknown): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(requestId);
    }
  }
}
