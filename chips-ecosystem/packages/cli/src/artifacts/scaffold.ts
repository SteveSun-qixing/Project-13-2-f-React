/**
 * 脚手架落盘（[SDK API 规范] §8.1、§8.3）：模板计划来自 `@chips/sdk/scaffold`（纯函数），
 * `@chips/cli` 只负责目标目录占用判定与文件写入。
 *
 * 模板内容属 SDK 职责，CLI 不复制模板；SDK 不可用时返回 `CLI_TARGET_UNAVAILABLE`。
 */

import { join } from 'node:path';

import { cliError } from '../errors.js';
import type { CliPluginRole, IScaffoldPlan } from '../client/types.js';
import type { IFileSystemPort } from '../args/filesystem.js';

/** 脚手架生成器端口（`@chips/sdk/scaffold` 的 `createScaffoldPlan`）。 */
export interface IScaffoldProvider {
  createPlan(options: {
    readonly role: CliPluginRole;
    readonly pluginId: string;
    readonly name: string;
    readonly targetDir: string;
  }): IScaffoldPlan;
}

const SDK_SCAFFOLD_SPECIFIER = '@chips/sdk/scaffold';

/**
 * 解析 SDK 脚手架生成器。
 *
 * 该模块由 `@chips/sdk` 提供；解析失败（未安装 / 未构建）返回 undefined，由命令层
 * 返回 `CLI_TARGET_UNAVAILABLE`（[CLI 完整参考] §2.5）。
 */
export async function resolveScaffoldProvider(): Promise<IScaffoldProvider | undefined> {
  let loaded: unknown;
  try {
    loaded = (await import(SDK_SCAFFOLD_SPECIFIER)) as unknown;
  } catch {
    return undefined;
  }
  if (typeof loaded !== 'object' || loaded === null) {
    return undefined;
  }
  const candidate = loaded as { createScaffoldPlan?: unknown };
  if (typeof candidate.createScaffoldPlan !== 'function') {
    return undefined;
  }
  const createPlan = candidate.createScaffoldPlan as (options: unknown) => unknown;
  return {
    createPlan: (options): IScaffoldPlan => {
      const plan = createPlan(options);
      return expectScaffoldPlan(plan);
    },
  };
}

function expectScaffoldPlan(value: unknown): IScaffoldPlan {
  if (typeof value !== 'object' || value === null) {
    throw cliError('CLI_COMMAND_FAILED', '脚手架生成器返回的计划结构非法');
  }
  const record = value as { targetDir?: unknown; files?: unknown; manifest?: unknown };
  if (typeof record.targetDir !== 'string' || !Array.isArray(record.files)) {
    throw cliError('CLI_COMMAND_FAILED', '脚手架生成器返回的计划结构非法');
  }
  const files: { path: string; content: string }[] = [];
  for (const item of record.files) {
    if (typeof item !== 'object' || item === null) {
      throw cliError('CLI_COMMAND_FAILED', '脚手架文件计划项结构非法');
    }
    const file = item as { path?: unknown; content?: unknown };
    if (typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw cliError('CLI_COMMAND_FAILED', '脚手架文件计划项结构非法');
    }
    files.push({ path: file.path, content: file.content });
  }
  const manifest = record.manifest as { id?: unknown; version?: unknown; type?: unknown; name?: unknown };
  return {
    targetDir: record.targetDir,
    files,
    manifest: {
      id: typeof manifest?.id === 'string' ? manifest.id : '',
      version: typeof manifest?.version === 'string' ? manifest.version : '',
      type:
        manifest?.type === 'app' || manifest?.type === 'basecard' || manifest?.type === 'boxlayout' || manifest?.type === 'service'
          ? manifest.type
          : 'app',
      name: typeof manifest?.name === 'string' ? manifest.name : '',
    },
  };
}

/** 落盘脚手架计划：目标目录非空或目标文件已存在时拒绝（[CLI 完整参考] §3.5.1）。 */
export function writeScaffoldPlan(
  fileSystem: IFileSystemPort,
  plan: IScaffoldPlan,
): { readonly targetDir: string; readonly files: readonly string[] } {
  const targetDir = plan.targetDir;
  if (fileSystem.exists(targetDir) && fileSystem.kind(targetDir) !== 'directory') {
    throw cliError('CLI_PATH_INVALID', `目标路径不是目录：${targetDir}`, { path: targetDir });
  }
  if (fileSystem.exists(targetDir) && fileSystem.list(targetDir).length > 0) {
    throw cliError('CLI_PATH_INVALID', `目标目录非空：${targetDir}`, { path: targetDir });
  }
  fileSystem.ensureDirectory(targetDir);
  const written: string[] = [];
  for (const file of plan.files) {
    const absolute = join(targetDir, file.path);
    if (fileSystem.exists(absolute)) {
      throw cliError('CLI_PATH_INVALID', `目标文件已存在：${absolute}`, { path: absolute });
    }
    fileSystem.writeText(absolute, file.content);
    written.push(file.path);
  }
  return { targetDir, files: written };
}
