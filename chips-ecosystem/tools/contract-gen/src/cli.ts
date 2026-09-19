import { fileURLToPath } from 'node:url';

import { checkContract, generateContract } from './generate.js';
import { createFileReader } from './load.js';
import { parseContract } from './parse.js';
import { DEFAULT_DOCS_ROOT, DEFAULT_OUT_DIR, contractSources } from './sources.js';
import type { ContractModel, ValidationIssue } from './types.js';
import { validateContract } from './validate.js';

type Command = 'generate' | 'check' | 'validate';

interface CliOptions {
  readonly command: Command;
  readonly docsRoot: string;
  readonly outDir: string;
}

const USAGE = `用法：chips-contract-gen <generate|check|validate> [选项]

命令：
  generate   从文档库生成契约常量并写入 @chips/sdk 生成目录
  check      门禁校验：文档↔生成物一致性（不一致时退出码 1）
  validate   仅解析与校验文档库契约（不比对生成物）

选项：
  --docs-root <目录>   文档库根目录（默认：${DEFAULT_DOCS_ROOT}）
  --out-dir <目录>     生成目录（默认：${DEFAULT_OUT_DIR}）
  --help               显示帮助
`;

function parseArgs(argv: readonly string[]): CliOptions | 'help' {
  const [command, ...rest] = argv;
  if (command === undefined || command === '--help' || command === '-h') {
    return 'help';
  }
  if (command !== 'generate' && command !== 'check' && command !== 'validate') {
    throw new Error(`未知命令：${command}`);
  }
  let docsRoot = DEFAULT_DOCS_ROOT;
  let outDir = DEFAULT_OUT_DIR;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === '--docs-root' && value !== undefined) {
      docsRoot = value;
      index += 1;
      continue;
    }
    if (flag === '--out-dir' && value !== undefined) {
      outDir = value;
      index += 1;
      continue;
    }
    throw new Error(`未知参数：${String(flag)}`);
  }
  return { command, docsRoot, outDir };
}

function counts(model: ContractModel): string {
  return `能力 ${model.capabilities.length}、权限 ${model.permissions.length}、事件 ${model.events.length}、错误码 ${model.errorCodes.length}`;
}

function printIssues(issues: readonly ValidationIssue[]): void {
  for (const issue of issues) {
    process.stderr.write(`✗ [${issue.rule}] ${issue.message}\n`);
  }
  process.stderr.write(`契约门禁失败：${issues.length} 项问题\n`);
}

/** CLI 入口；返回进程退出码。 */
export function runCli(argv: readonly string[]): number {
  let options: CliOptions | 'help';
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    return 2;
  }
  if (options === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  const reader = createFileReader(options.docsRoot);
  try {
    if (options.command === 'validate') {
      const parsed = parseContract(reader, contractSources);
      const issues = validateContract(parsed);
      if (issues.length > 0) {
        printIssues(issues);
        return 1;
      }
      process.stdout.write(
        `契约解析校验通过：能力 ${parsed.capabilities.length}、权限 ${parsed.permissions.length}、事件 ${parsed.events.length}、错误码 ${parsed.errorCodes.length}\n`
      );
      return 0;
    }

    if (options.command === 'generate') {
      const { build, result } = generateContract({
        reader,
        sources: contractSources,
        outDir: options.outDir,
      });
      process.stdout.write(`契约生成完成：${counts(build.model)}\n`);
      process.stdout.write(
        `写入 ${result.written.length} 个文件，未变化 ${result.unchanged.length} 个（输出目录：${options.outDir}）\n`
      );
      return 0;
    }

    const result = checkContract({ reader, sources: contractSources, outDir: options.outDir });
    if (!result.ok) {
      printIssues(result.issues);
      return 1;
    }
    process.stdout.write(`契约门禁通过：文档库与生成物一致（${counts(result.build.model)}）\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  process.exitCode = runCli(process.argv.slice(2));
}
