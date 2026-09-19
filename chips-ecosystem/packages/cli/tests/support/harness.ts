/**
 * 命令级测试基座：捕获 stdout/stderr、固定时钟与零等待 sleep，注入假客户端与内存文件系统。
 */

import type { ICliClient } from '../../src/client/types.js';
import type { ICliRunDependencies } from '../../src/run.js';
import { runCli, runDevCli } from '../../src/run.js';
import type { IOutputSink } from '../../src/output/io.js';
import { MemoryFileSystem } from './memory-file-system.js';
import { FakeCliClient } from './fake-client.js';

/** 一次执行的结果。 */
export interface IRunOutcome {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  json(): unknown;
  jsonLines(): readonly unknown[];
}

/** 执行选项。 */
export interface IRunOptions {
  /**
   * 注入的 `ICliClient` 替身：默认 `new FakeCliClient()`。
   *
   * 以端口类型而非替身类为约束，测试可用 `{ ...fake, cliCommand: {...} }` 派生只改一个命名空间的
   * 客户端（对象展开会丢掉替身类的私有成员，因此派生结果只在结构上满足 `ICliClient`）。
   */
  readonly client?: ICliClient;
  readonly fileSystem?: MemoryFileSystem;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly tty?: boolean;
  readonly signal?: AbortSignal;
}

function createCaptureSink(tty: boolean): { sink: IOutputSink; outcome: () => { stdout: string; stderr: string } } {
  let stdout = '';
  let stderr = '';
  return {
    sink: {
      get isTTY(): boolean {
        return tty;
      },
      writeOut(text: string): void {
        stdout += text;
      },
      writeErr(text: string): void {
        stderr += text;
      },
    },
    outcome: () => ({ stdout, stderr }),
  };
}

/**
 * 从 stdout 取出结果 JSON 文档。
 *
 * stdout 只承载最终结果（[CLI 完整参考] §2.4.1）：默认整段即 JSON；`output.mode: human` 的命令
 * 在六段式摘要之后追加同一结果的 JSON 文档（§2.4.5 的摘要 + 信封），因此按顶层开括号定位文档，
 * 摘要行内联的紧凑 `output` 片段不参与解析。
 */
function parseResultDocument(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as unknown;
  }
  const lines = stdout.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '{' || line === '[') {
      return JSON.parse(lines.slice(index).join('\n')) as unknown;
    }
  }
  return JSON.parse(trimmed) as unknown;
}

function toOutcome(exitCode: number, capture: () => { stdout: string; stderr: string }): IRunOutcome {
  const { stdout, stderr } = capture();
  return {
    exitCode,
    stdout,
    stderr,
    json(): unknown {
      return parseResultDocument(stdout);
    },
    jsonLines(): readonly unknown[] {
      return stdout
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as unknown);
    },
  };
}

function buildDeps(options: IRunOptions, capture: ReturnType<typeof createCaptureSink>): ICliRunDependencies {
  const client = options.client ?? new FakeCliClient();
  const deps: ICliRunDependencies = {
    client,
    io: capture.sink,
    env: options.env ?? {},
    cwd: options.cwd ?? '/work',
    fileSystem: options.fileSystem ?? new MemoryFileSystem(),
    now: () => 1000,
    sleep: async (): Promise<void> => undefined,
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
  return deps;
}

/** 运行用户侧入口。 */
export async function runUser(argv: readonly string[], options: IRunOptions = {}): Promise<IRunOutcome> {
  const capture = createCaptureSink(options.tty === true);
  const deps = buildDeps(options, capture);
  const exitCode = await runCli(argv, deps);
  return toOutcome(exitCode, capture.outcome);
}

/** 运行开发侧入口。 */
export async function runDev(argv: readonly string[], options: IRunOptions = {}): Promise<IRunOutcome> {
  const capture = createCaptureSink(options.tty === true);
  const deps = buildDeps(options, capture);
  const exitCode = await runDevCli(argv, deps);
  return toOutcome(exitCode, capture.outcome);
}

export { FakeCliClient, MemoryFileSystem };
