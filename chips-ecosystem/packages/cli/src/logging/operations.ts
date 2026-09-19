/**
 * CLI 操作日志与脱敏（[CLI 完整参考] §2.8）。
 *
 * - 每次 CLI/TUI/补全操作写工作区日志：`namespace: "cli"`、`action: "operation.execute"`；
 * - 记录字段：脱敏后的命令行、工作区摘要、退出码、命令 ID、命令路径、目标类型、耗时与错误；
 * - 脱敏键名覆盖 `token` / `secret` / `password` / `credential` / `apiKey`（大小写与 `-` / `_` 变体归一），
 *   `--名=值` 与紧随其后的取值都替换为 `<redacted>`；
 * - 一次用户操作只产生一条主记录；日志写入失败不阻塞命令。
 */

import type { ChipsError } from '../errors.js';
import type { ICliClient, ICliOperationRecord } from '../client/types.js';

/** 操作来源（§2.8）。 */
export type CliOperationSource = 'cli' | 'tui' | 'completion';

/** 敏感键归一集合。 */
const SENSITIVE_KEYS = new Set(['token', 'secret', 'password', 'credential', 'apikey']);

const REDACTED = '<redacted>';

function isSensitiveName(name: string): boolean {
  return SENSITIVE_KEYS.has(name.toLowerCase().replace(/[-_]/g, ''));
}

/** 脱敏命令行；返回新数组，不修改入参。 */
export function redactArgv(argv: readonly string[]): readonly string[] {
  const result = [...argv];
  for (let index = 0; index < result.length; index += 1) {
    const token = result[index];
    if (token === undefined || !token.startsWith('--')) {
      continue;
    }
    const body = token.slice(2);
    const equalsIndex = body.indexOf('=');
    const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
    if (!isSensitiveName(name)) {
      continue;
    }
    if (equalsIndex !== -1) {
      result[index] = `--${name}=${REDACTED}`;
      continue;
    }
    if (index + 1 < result.length) {
      result[index + 1] = REDACTED;
      index += 1;
    }
  }
  return result;
}

/** 主记录字段。 */
export interface ICliOperationInput {
  readonly source: CliOperationSource;
  readonly argv: readonly string[];
  /** 工作区摘要；无法解析（本地命令且无承载环境）时省略。 */
  readonly workspace?: { readonly path: string; readonly kind: 'user' | 'dev' };
  readonly exitCode: number;
  readonly durationMs: number;
  readonly commandId?: string;
  readonly commandPath?: string;
  readonly targetType?: 'app' | 'service' | 'platform';
  readonly error?: ChipsError;
}

/** 操作日志写入器。 */
export interface IOperationLogger {
  record(input: ICliOperationInput): Promise<void>;
}

/** 构造操作日志写入器；经 `client.operations` 写入承载运行时。 */
export function createOperationLogger(client: ICliClient): IOperationLogger {
  return {
    async record(input: ICliOperationInput): Promise<void> {
      const metadata: Record<string, unknown> = {
        source: input.source,
        argv: redactArgv(input.argv),
        workspace: input.workspace,
        exitCode: input.exitCode,
        durationMs: input.durationMs,
      };
      if (input.commandId !== undefined) {
        metadata.commandId = input.commandId;
      }
      if (input.commandPath !== undefined) {
        metadata.commandPath = input.commandPath;
      }
      if (input.targetType !== undefined) {
        metadata.targetType = input.targetType;
      }
      if (input.error !== undefined) {
        metadata.errorCode = input.error.code;
        metadata.error = {
          code: input.error.code,
          message: input.error.message,
          details: input.error.details,
          retryable: input.error.retryable,
        };
      }
      const record: ICliOperationRecord = {
        namespace: 'cli',
        action: 'operation.execute',
        metadata,
      };
      try {
        await client.operations.record(record);
      } catch {
        // 操作日志写入失败不阻塞命令（§2.8）。
      }
    },
  };
}

/** 未接入承载运行时时的空写入器（命令级测试与离线本地命令使用）。 */
export function createNullOperationLogger(): IOperationLogger {
  return {
    async record(): Promise<void> {
      // 无承载环境时无工作区日志可写；行为与写入失败一致，不阻塞命令。
    },
  };
}
