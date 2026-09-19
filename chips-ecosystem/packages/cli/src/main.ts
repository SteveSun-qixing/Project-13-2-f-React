/**
 * 可执行入口：入口识别（用户侧 / 开发侧）、客户端组装与 `SIGINT` 中断收敛。
 */

import type { CliEntryKind } from './args/global-options.js';
import type { ICliClient } from './client/types.js';
import { createNodeOutputSink, type IOutputSink } from './output/io.js';
import { createLocalClient, type ILocalClientOptions } from './runtime/local-client.js';
import { runCli, runDevCli } from './run.js';

/** 可执行入口选项。 */
export interface ICliMainOptions {
  /** 显式注入的客户端（测试与平台嵌入）。 */
  readonly client?: ICliClient;
  readonly clientFactory?: () => Promise<ICliClient>;
  readonly io?: IOutputSink;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  /** 缺省客户端的组装选项（承载适配器注入）。 */
  readonly clientOptions?: ILocalClientOptions;
}

/**
 * 识别入口与命令 token：全局选项可出现在 `dev` 前后（[CLI 完整参考] §2.1、§2.2）。
 */
export function detectEntry(argv: readonly string[]): { readonly entry: CliEntryKind; readonly argv: readonly string[] } {
  const rest: string[] = [];
  let skipNext = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (skipNext) {
      skipNext = false;
      rest.push(token);
      continue;
    }
    if (token === '--plugin' || token === '--workspace') {
      skipNext = true;
      rest.push(token);
      continue;
    }
    if (token.startsWith('-')) {
      rest.push(token);
      continue;
    }
    if (token === 'dev') {
      return { entry: 'dev', argv: [...argv.slice(0, index), ...argv.slice(index + 1)] };
    }
    return { entry: 'user', argv: [...argv] };
  }
  return { entry: 'user', argv: [...argv] };
}

/** 进程入口。 */
export async function main(argv: readonly string[], options: ICliMainOptions = {}): Promise<number> {
  const { entry, argv: entryArgv } = detectEntry(argv);
  const client =
    options.client ??
    (options.clientFactory === undefined
      ? createLocalClient(options.clientOptions ?? {})
      : await options.clientFactory());
  const io = options.io ?? createNodeOutputSink();
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  const controller = new AbortController();
  const onSignal = (): void => {
    controller.abort();
  };
  process.on('SIGINT', onSignal);
  try {
    const deps = { client, io, env, cwd, signal: controller.signal };
    return entry === 'dev' ? await runDevCli(entryArgv, deps) : await runCli(entryArgv, deps);
  } finally {
    process.off('SIGINT', onSignal);
  }
}
