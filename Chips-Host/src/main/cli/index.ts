#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import childProcess from 'node:child_process';
import { HostApplication } from '../core/host-application';
import { openAssociatedFile } from '../core/file-association';
import { RuntimeClient } from '../../renderer/runtime-client';
import { createError, toStandardError } from '../../shared/errors';
import type { LogEntry, StandardError } from '../../shared/types';
import { createId } from '../../shared/utils';
import { runInteractiveSession, type InteractiveCliCommandView } from './interactive';
import {
  BUILTIN_COMPLETION_TREE,
  BUILTIN_INTERACTIVE_COMMANDS,
  FIXED_COMMANDS,
  GLOBAL_COMPLETION_OPTIONS
} from './builtin-commands';
import type {
  CliCommandManifestMeta,
  CliCommandParameterManifestMeta,
  CliCommandTargetManifestMeta
} from '../../runtime';
import {
  ELECTRON_APP_CLI_ERROR_PREFIX,
  ELECTRON_APP_CLI_REQUEST_PREFIX,
  ELECTRON_APP_CLI_RESULT_PREFIX,
  encodeElectronAppCliPayload,
  decodeElectronAppCliPayload,
  type ElectronAppCliCommandRequest
} from '../electron/cli-app-command-protocol';

interface CliCommandConflictView {
  commandPathKey: string;
  enabledCommandIds: string[];
  allCommandIds: string[];
}

interface CliCommandView {
  commandId: string;
  commandPath: string[];
  commandPathKey: string;
  owner: {
    pluginId: string;
    pluginType: 'app' | 'card' | 'layout' | 'module' | 'theme';
    pluginName: string;
    pluginVersion: string;
    source?: 'official' | 'third-party' | 'local';
  };
  enabled: boolean;
  declaration: CliCommandManifestMeta;
  conflicts: CliCommandConflictView[];
}

interface CliCommandListResponse {
  commands: CliCommandView[];
}

interface PluginRuntimeView {
  id: string;
  name?: string;
  version?: string;
  type?: string;
  installPath?: string;
  manifestPath?: string;
  enabled?: boolean;
  capabilities?: string[];
}

interface CliCommandResolveResponse {
  command?: CliCommandView;
  conflicts: CliCommandConflictView[];
}

type CompletionShell = 'bash' | 'zsh' | 'fish';
type CompletionCommandName = 'chips' | 'chipsdev-r' | 'chipsdev-r';

interface ParsedGlobalOptions {
  json: boolean;
  pluginId?: string;
  tokens: string[];
}

interface MatchedCliCommand {
  command: CliCommandView;
  commandTokens: string[];
  invocationTokens: string[];
}

interface ParsedInvocation {
  payload: Record<string, unknown>;
  raw: Record<string, unknown>;
  skippedOutputs: CliSkippedOutput[];
}

interface CliOutputContext {
  json?: boolean;
  command?: CliCommandView;
}

interface CliJobWaitOptions {
  cancelOnInterrupt?: boolean;
  onProgress?: (job: CliProgressRecord) => void;
}

interface CliSkippedOutput {
  parameter: string;
  path: string;
  original: string;
  policy: 'skip';
  reason: 'exists';
}

interface CliParameterCoerceOptions {
  cwd: string;
  overwriteRequested?: boolean;
}

interface CliResolvedPathValue {
  path: string;
  skipped?: CliSkippedOutput;
}

type CliOperationSource = 'cli' | 'tui' | 'completion';

interface CliOperationLogInput {
  source: CliOperationSource;
  argv: string[];
  code: number;
  startedAt: number;
  commandLine?: string;
  pluginId?: string;
  commandId?: string;
  commandPath?: string[];
  targetType?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

const pluginCliLoggedErrors = new WeakSet<object>();

interface ModuleJobView {
  jobId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: StandardError;
}

interface CliTaskView {
  taskId: string;
  pluginId: string;
  commandId: string;
  commandPath?: string[];
  invocationId?: string;
  surfaceId?: string;
  sessionId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  progress?: Record<string, unknown>;
  output?: unknown;
  error?: StandardError;
}

type CliProgressRecord =
  Pick<ModuleJobView, 'status' | 'progress'> &
    Partial<Pick<ModuleJobView, 'jobId'>> &
    Partial<Pick<CliTaskView, 'taskId'>>;

interface ElectronCliAppCommandResultEnvelope {
  ok: boolean;
  result?: unknown;
  error?: StandardError;
}

interface ExecuteCliCommandTargetOptions {
  workspace?: string;
  isElectronRuntime?: boolean;
  executeAppCliCommandInElectron?: (
    workspace: string,
    command: CliCommandView,
    payload: Record<string, unknown>
  ) => Promise<unknown>;
}

const stateFile = (workspace: string) => path.join(workspace, 'host-state.json');
const pluginFile = (workspace: string) => path.join(workspace, 'plugins.json');
const hostLogFile = (workspace: string) => path.join(workspace, 'host-logs.jsonl');
const getWorkspace = (): string => process.env.CHIPS_HOME ?? path.join(os.homedir(), '.chips-host');
const getWorkspaceKind = (): 'user' | 'dev' => (process.env.CHIPS_WORKSPACE_KIND === 'dev' ? 'dev' : 'user');
const getWorkspaceSummary = (workspace: string) => ({
  kind: getWorkspaceKind(),
  path: workspace
});

const ensureWorkspace = async (workspace: string): Promise<void> => {
  await fs.mkdir(workspace, { recursive: true });
};

const readJson = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const normalizePluginSourcePath = (manifestPath: string): string => path.resolve(manifestPath);

const CLI_JOB_TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const COMPLETION_SHELLS = new Set<CompletionShell>(['bash', 'zsh', 'fish']);
const COMPLETION_COMMANDS = new Set<CompletionCommandName>(['chips', 'chipsdev-r', 'chipsdev-r']);
const ELECTRON_APP_CLI_TIMEOUT_MS = 20_000;
const ELECTRON_APP_CLI_TERMINATE_GRACE_MS = 1_000;

const delay = (timeoutMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, timeoutMs));

const isElectronRuntime = (): boolean => Boolean((process as NodeJS.Process & { versions?: NodeJS.ProcessVersions }).versions?.electron);

const CLI_JOB_PROGRESS_BAR_WIDTH = 24;

const normalizeCliJobProgressPercent = (progress: Record<string, unknown>): number | undefined => {
  if (typeof progress.percent !== 'number' || !Number.isFinite(progress.percent)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, progress.percent));
};

const formatCliJobProgressBar = (percent: number): string => {
  const filled = Math.round((percent / 100) * CLI_JOB_PROGRESS_BAR_WIDTH);
  return `[${'#'.repeat(filled)}${'-'.repeat(CLI_JOB_PROGRESS_BAR_WIDTH - filled)}]`;
};

const formatCliJobProgress = (progress: Record<string, unknown>): string => {
  const stage = typeof progress.stage === 'string' ? progress.stage : undefined;
  const percent = normalizeCliJobProgressPercent(progress);
  const percentLabel = typeof percent === 'number' ? `${Math.round(percent)}%` : undefined;
  const progressBar = typeof percent === 'number' ? formatCliJobProgressBar(percent) : undefined;
  const label = [stage, percentLabel, progressBar].filter(Boolean).join(' ');
  return label.length > 0 ? label : JSON.stringify(progress);
};

const shouldPrintCliJobProgress = (): boolean => {
  return process.stderr.isTTY === true || process.env.CHIPS_CLI_JOB_PROGRESS === '1';
};

const shouldRenderCliJobProgressInline = (): boolean => {
  return process.stderr.isTTY === true && process.env.CHIPS_CLI_JOB_PROGRESS !== '1';
};

const createCliJobProgressReporter = (): { onProgress(job: CliProgressRecord): void; finish(): void } | undefined => {
  if (!shouldPrintCliJobProgress()) {
    return undefined;
  }

  const inline = shouldRenderCliJobProgressInline();
  let lastLineLength = 0;

  return {
    onProgress(job) {
      if (!job.progress) {
        return;
      }
      const label = job.taskId ? `CLI task ${job.taskId}` : `CLI job ${job.jobId}`;
      const line = `${label}: ${formatCliJobProgress(job.progress)}`;
      if (!inline) {
        process.stderr.write(`${line}\n`);
        return;
      }
      const paddedLine = line.padEnd(lastLineLength, ' ');
      lastLineLength = Math.max(lastLineLength, line.length);
      process.stderr.write(`\r${paddedLine}`);
    },
    finish() {
      if (inline && lastLineLength > 0) {
        process.stderr.write('\n');
      }
    }
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const isSensitiveCliKey = (value: string): boolean => /(token|secret|password|credential|api[-_.]?key|access[-_.]?key)/i.test(value);

const sanitizeCliLogValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeCliLogValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = isSensitiveCliKey(key) ? '<redacted>' : sanitizeCliLogValue(item);
  }
  return next;
};

const redactCliArgv = (argv: string[]): string[] => {
  const redacted = [...argv];
  for (let index = 0; index < redacted.length; index += 1) {
    const token = redacted[index]!;
    if (token.startsWith('--')) {
      const [name = '', value] = token.slice(2).split(/=(.*)/s, 2);
      if (isSensitiveCliKey(name)) {
        redacted[index] = typeof value === 'string' ? `--${name}=<redacted>` : token;
        if (typeof value !== 'string' && redacted[index + 1] && !redacted[index + 1]!.startsWith('-')) {
          redacted[index + 1] = '<redacted>';
        }
      }
      continue;
    }
    if (index >= 3 && redacted[0] === 'config' && redacted[1] === 'set' && isSensitiveCliKey(redacted[2] ?? '')) {
      redacted[index] = '<redacted>';
    }
  }
  return redacted;
};

const quoteCliLogToken = (token: string): string => {
  if (/^[A-Za-z0-9._/:=@%+,-]+$/.test(token)) {
    return token;
  }
  return JSON.stringify(token);
};

const formatCliLogCommandLine = (argv: string[]): string => ['chips', ...redactCliArgv(argv)].map(quoteCliLogToken).join(' ');

const appendPersistentLogEntry = async (workspace: string, entry: LogEntry): Promise<void> => {
  await fs.mkdir(workspace, { recursive: true });
  await fs.appendFile(hostLogFile(workspace), `${JSON.stringify(entry)}\n`, 'utf-8');
};

const recordCliOperationLog = async (workspace: string, input: CliOperationLogInput): Promise<void> => {
  const standard = input.error ? toStandardError(input.error, 'CLI_COMMAND_FAILED') : undefined;
  const durationMs = Math.max(0, Date.now() - input.startedAt);
  const result = standard || input.code !== 0 ? 'error' : 'success';
  const sanitizedMetadata = sanitizeCliLogValue(input.metadata);
  const entry: LogEntry = {
    traceId: createId(),
    requestId: createId(),
    pluginId: input.pluginId,
    namespace: 'cli',
    action: 'operation.execute',
    durationMs,
    result,
    errorCode: standard?.code,
    level: result === 'success' ? 'info' : 'error',
    message: result === 'success' ? 'CLI operation completed' : 'CLI operation failed',
    timestamp: Date.now(),
    metadata: {
      source: input.source,
      commandLine: input.commandLine ?? formatCliLogCommandLine(input.argv),
      argv: redactCliArgv(input.argv),
      workspace: getWorkspaceSummary(workspace),
      exitCode: input.code,
      commandId: input.commandId,
      commandPath: input.commandPath,
      targetType: input.targetType,
      error: standard
        ? {
            code: standard.code,
            message: standard.message,
            details: sanitizeCliLogValue(standard.details),
            retryable: standard.retryable
          }
        : undefined,
      ...(isRecord(sanitizedMetadata) ? sanitizedMetadata : {})
    }
  };
  await appendPersistentLogEntry(workspace, entry);
};

const safeRecordCliOperationLog = async (workspace: string, input: CliOperationLogInput): Promise<void> => {
  try {
    await recordCliOperationLog(workspace, input);
  } catch {
    // CLI logging must never change command behavior.
  }
};

const markPluginCliOperationLogged = (error: unknown): void => {
  if (typeof error === 'object' && error !== null) {
    pluginCliLoggedErrors.add(error);
  }
};

const isPluginCliOperationLogged = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && pluginCliLoggedErrors.has(error);
};

const isOptionToken = (token: string): boolean => token.startsWith('-') && token !== '-';

const uniqueSorted = (items: string[]): string[] => [...new Set(items)].sort((left, right) => left.localeCompare(right));

const filterCompletionCandidates = (items: string[], partial: string): string[] => {
  const normalizedPartial = partial.toLowerCase();
  return uniqueSorted(items).filter((item) => item.toLowerCase().startsWith(normalizedPartial));
};

const parseGlobalOptions = (argv: string[]): ParsedGlobalOptions => {
  const tokens: string[] = [];
  let json = false;
  let pluginId: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === '--json') {
      json = true;
      continue;
    }
    if (token === '--plugin') {
      const next = argv[index + 1];
      if (!next || isOptionToken(next)) {
        throw createError('CLI_ARGUMENT_INVALID', '--plugin requires plugin id', { option: '--plugin' });
      }
      pluginId = next;
      index += 1;
      continue;
    }
    if (token.startsWith('--plugin=')) {
      const value = token.slice('--plugin='.length).trim();
      if (!value) {
        throw createError('CLI_ARGUMENT_INVALID', '--plugin requires plugin id', { option: '--plugin' });
      }
      pluginId = value;
      continue;
    }
    tokens.push(token);
  }

  return { json, pluginId, tokens };
};

const parseCliLocalOverwriteRequest = (
  tokens: string[],
  declaration: CliCommandManifestMeta
): { tokens: string[]; overwriteRequested: boolean } => {
  const commandDeclaresOverwrite = declaration.options.some((parameter) => parameter.name === 'overwrite');
  const nextTokens: string[] = [];
  let overwriteRequested = false;
  let optionParsingEnabled = true;
  for (const token of tokens) {
    if (optionParsingEnabled && token === '--') {
      optionParsingEnabled = false;
      nextTokens.push(token);
      continue;
    }
    if (optionParsingEnabled && token === '--overwrite') {
      overwriteRequested = true;
      if (commandDeclaresOverwrite) {
        nextTokens.push(token);
      }
      continue;
    }
    if (optionParsingEnabled && token.startsWith('--overwrite=')) {
      const value = token.slice('--overwrite='.length).trim().toLowerCase();
      overwriteRequested = ['true', '1', 'yes', 'y', 'on'].includes(value);
      if (commandDeclaresOverwrite) {
        nextTokens.push(token);
      }
      continue;
    }
    nextTokens.push(token);
  }
  return {
    tokens: nextTokens,
    overwriteRequested
  };
};

const normalizeCommandPathKey = (segments: string[]): string => {
  return segments.map((segment) => segment.trim().toLowerCase()).filter((segment) => segment.length > 0).join(' ');
};

const tokensMatchCommandPath = (tokens: string[], commandPath: string[]): boolean => {
  if (tokens.length < commandPath.length) {
    return false;
  }
  return commandPath.every((segment, index) => tokens[index]?.toLowerCase() === segment.toLowerCase());
};

const findCliCommandMatch = async (
  runtime: RuntimeClient,
  tokens: string[],
  pluginId?: string
): Promise<MatchedCliCommand | undefined> => {
  if (tokens.length === 0) {
    return undefined;
  }

  const listed = await runtime.invoke<CliCommandListResponse>('cli.command.list', {});
  const candidates = listed.commands
    .filter((command) => command.enabled && (!pluginId || command.owner.pluginId === pluginId))
    .filter((command) => tokensMatchCommandPath(tokens, command.commandPath))
    .sort((left, right) => right.commandPath.length - left.commandPath.length || left.commandId.localeCompare(right.commandId));

  const longest = candidates[0];
  if (!longest) {
    return undefined;
  }

  const longestKey = normalizeCommandPathKey(longest.commandPath);
  const samePath = candidates.filter((candidate) => normalizeCommandPathKey(candidate.commandPath) === longestKey);
  if (samePath.length > 1 && !pluginId) {
    const resolved = await runtime.invoke<CliCommandResolveResponse>('cli.command.resolve', {
      commandPath: longest.commandPath
    });
    throw createError('CLI_COMMAND_CONFLICT', 'Multiple CLI commands match the requested command path', {
      commandPath: longest.commandPath,
      conflicts: resolved.conflicts,
      matches: samePath.map((command) => ({
        commandId: command.commandId,
        ownerPluginId: command.owner.pluginId,
        commandPath: command.commandPath
      }))
    });
  }

  return {
    command: longest,
    commandTokens: tokens.slice(0, longest.commandPath.length),
    invocationTokens: tokens.slice(longest.commandPath.length)
  };
};

const getCommandTokensForCompletion = (tokens: string[]): { prefix: string[]; partial: string } => {
  if (tokens.length === 0) {
    return { prefix: [], partial: '' };
  }
  if (tokens[tokens.length - 1] === '') {
    return { prefix: tokens.slice(0, -1), partial: '' };
  }
  return {
    prefix: tokens.slice(0, -1),
    partial: tokens[tokens.length - 1] ?? ''
  };
};

const getPluginCommandsForCompletion = async (
  runtime: RuntimeClient,
  pluginId?: string
): Promise<CliCommandView[]> => {
  const listed = await runtime.invoke<CliCommandListResponse>('cli.command.list', {});
  return listed.commands.filter((command) => command.enabled && (!pluginId || command.owner.pluginId === pluginId));
};

const getPluginCompletionCandidates = (
  commands: CliCommandView[],
  tokens: string[]
): string[] => {
  const { prefix, partial } = getCommandTokensForCompletion(tokens);
  if (prefix.length > 0 && FIXED_COMMANDS.has(prefix[0]!.toLowerCase())) {
    return [];
  }
  const candidates: string[] = [];
  for (const command of commands) {
    if (prefix.length > command.commandPath.length) {
      continue;
    }
    if (!prefix.every((segment, index) => command.commandPath[index]?.toLowerCase() === segment.toLowerCase())) {
      continue;
    }
    const next = command.commandPath[prefix.length];
    if (!next) {
      continue;
    }
    candidates.push(next);
  }
  return filterCompletionCandidates(candidates, partial);
};

const getBuiltinCompletionCandidates = (tokens: string[]): string[] => {
  const { prefix, partial } = getCommandTokensForCompletion(tokens);
  if (prefix.length === 0) {
    return filterCompletionCandidates([...BUILTIN_COMPLETION_TREE.keys(), ...GLOBAL_COMPLETION_OPTIONS], partial);
  }

  const root = prefix[0]!;
  const builtin = BUILTIN_COMPLETION_TREE.get(root);
  if (!builtin) {
    return [];
  }
  if (prefix.length === 1) {
    return filterCompletionCandidates([...(builtin.subcommands ?? []), ...(builtin.options ?? [])], partial);
  }
  return filterCompletionCandidates(builtin.options ?? [], partial);
};

const getOptionCompletionCandidates = (
  commands: CliCommandView[],
  tokens: string[]
): string[] => {
  const { prefix, partial } = getCommandTokensForCompletion(tokens);
  if (prefix.length === 0) {
    return filterCompletionCandidates(GLOBAL_COMPLETION_OPTIONS, partial);
  }
  const root = prefix[0];
  if (root && FIXED_COMMANDS.has(root.toLowerCase())) {
    return filterCompletionCandidates(BUILTIN_COMPLETION_TREE.get(root)?.options ?? [], partial);
  }
  const exactCommands = commands.filter((command) => tokensMatchCommandPath(prefix, command.commandPath));
  const options = exactCommands.flatMap((command) => {
    const declared = command.declaration.options.flatMap((parameter) => {
      const aliases = [`--${parameter.name}`];
      if (parameter.short) {
        aliases.push(`-${parameter.short}`);
      }
      if (parameter.type === 'boolean') {
        aliases.push(`--no-${parameter.name}`);
      }
      return aliases;
    });
    return [...declared, '--overwrite'];
  });
  return filterCompletionCandidates(options, partial);
};

const resolveCompletionCandidates = async (
  workspace: string,
  argv: string[]
): Promise<string[]> => {
  const global = parseGlobalOptions(argv);
  const tokens = global.tokens;
  const lastToken = tokens[tokens.length - 1] ?? '';
  const completingOption = lastToken.startsWith('-') && lastToken !== '-';

  return withHost(workspace, async (runtime) => {
    const pluginCommands = await getPluginCommandsForCompletion(runtime, global.pluginId);
    if (completingOption) {
      return getOptionCompletionCandidates(pluginCommands, tokens);
    }
    const pluginCandidates = getPluginCompletionCandidates(pluginCommands, tokens);
    if (tokens.length > 0 && FIXED_COMMANDS.has((tokens[0] ?? '').toLowerCase())) {
      return getBuiltinCompletionCandidates(tokens);
    }
    return uniqueSorted([...getBuiltinCompletionCandidates(tokens), ...pluginCandidates]);
  });
};

const renderCompletionScript = (shell: CompletionShell, commandName: CompletionCommandName = 'chips'): string => {
  const functionName = commandName === 'chips' ? '_chips' : commandName === 'chipsdev-r' ? '_chipsdev_r' : '_chipsdev';
  const helperName = commandName === 'chips' ? '__chips_complete' : commandName === 'chipsdev-r' ? '__chipsdev_r_complete' : '__chipsdev_complete';
  const bashFunctionName = commandName === 'chips' ? '_chips_completion' : commandName === 'chipsdev-r' ? '_chipsdev_r_completion' : '_chipsdev_completion';
  if (shell === 'fish') {
    return [
      `function ${helperName}`,
      '  set -l tokens (commandline -opc)',
      '  set -l current (commandline -ct)',
      '  if test -n "$current"',
      '    set tokens $tokens $current',
      '  else',
      '    set tokens $tokens ""',
      '  end',
      `  ${commandName} __complete $tokens`,
      'end',
      `complete -c ${commandName} -f -a "(${helperName})"`,
      ''
    ].join('\n');
  }

  if (shell === 'zsh') {
    return [
      `#compdef ${commandName}`,
      `${functionName}() {`,
      '  local -a completions',
      `  completions=("\${(@f)$(${commandName} __complete "\${words[@]:1}")}")`,
      '  compadd -- "${completions[@]}"',
      '}',
      `compdef ${functionName} ${commandName}`,
      ''
    ].join('\n');
  }

  return [
    `${bashFunctionName}() {`,
    '  local IFS=$\'\\n\'',
    '  local -a completions',
    `  mapfile -t completions < <(${commandName} __complete "\${COMP_WORDS[@]:1}")`,
    '  COMPREPLY=($(compgen -W "${completions[*]}" -- "${COMP_WORDS[COMP_CWORD]}"))',
    '}',
    `complete -F ${bashFunctionName} ${commandName}`,
    ''
  ].join('\n');
};

const collectParameterAliases = (
  parameters: CliCommandParameterManifestMeta[]
): {
  byLongName: Map<string, CliCommandParameterManifestMeta>;
  byShortName: Map<string, CliCommandParameterManifestMeta>;
} => {
  const byLongName = new Map<string, CliCommandParameterManifestMeta>();
  const byShortName = new Map<string, CliCommandParameterManifestMeta>();
  for (const parameter of parameters) {
    byLongName.set(parameter.name, parameter);
    if (parameter.short) {
      byShortName.set(parameter.short, parameter);
    }
  }
  return { byLongName, byShortName };
};

const collectInvocationTokens = (
  parameters: CliCommandParameterManifestMeta[],
  tokens: string[]
): {
  optionValues: Map<string, string[]>;
  positional: string[];
} => {
  const { byLongName, byShortName } = collectParameterAliases(parameters);
  const optionValues = new Map<string, string[]>();
  const positional: string[] = [];
  let optionParsingEnabled = true;

  const addOptionValue = (parameter: CliCommandParameterManifestMeta, value: string): void => {
    const values = optionValues.get(parameter.name) ?? [];
    values.push(value);
    optionValues.set(parameter.name, values);
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (optionParsingEnabled && token === '--') {
      optionParsingEnabled = false;
      continue;
    }

    if (optionParsingEnabled && token.startsWith('--no-')) {
      const name = token.slice('--no-'.length);
      const parameter = byLongName.get(name);
      if (!parameter) {
        throw createError('CLI_ARGUMENT_INVALID', `Unknown option: --no-${name}`, { option: name });
      }
      if (parameter.type !== 'boolean') {
        throw createError('CLI_ARGUMENT_INVALID', `Option does not support --no- prefix: --${name}`, { option: name });
      }
      addOptionValue(parameter, 'false');
      continue;
    }

    if (optionParsingEnabled && token.startsWith('--')) {
      const [rawName = '', inlineValue] = token.slice(2).split(/=(.*)/s, 2);
      const parameter = byLongName.get(rawName);
      if (!parameter) {
        throw createError('CLI_ARGUMENT_INVALID', `Unknown option: --${rawName}`, { option: rawName });
      }
      if (typeof inlineValue === 'string') {
        addOptionValue(parameter, inlineValue);
        continue;
      }
      if (parameter.type === 'boolean') {
        addOptionValue(parameter, 'true');
        continue;
      }
      const next = tokens[index + 1];
      if (!next || isOptionToken(next)) {
        throw createError('CLI_ARGUMENT_INVALID', `Option requires value: --${parameter.name}`, { option: parameter.name });
      }
      addOptionValue(parameter, next);
      index += 1;
      continue;
    }

    if (optionParsingEnabled && token.startsWith('-') && token.length > 1) {
      const raw = token.slice(1);
      const shortName = raw[0] ?? '';
      const inlineValue = raw.length > 1 ? raw.slice(1) : undefined;
      const parameter = byShortName.get(shortName);
      if (!parameter) {
        throw createError('CLI_ARGUMENT_INVALID', `Unknown option: -${shortName}`, { option: shortName });
      }
      if (parameter.type === 'boolean') {
        if (inlineValue) {
          addOptionValue(parameter, inlineValue);
        } else {
          addOptionValue(parameter, 'true');
        }
        continue;
      }
      if (inlineValue) {
        addOptionValue(parameter, inlineValue);
        continue;
      }
      const next = tokens[index + 1];
      if (!next || isOptionToken(next)) {
        throw createError('CLI_ARGUMENT_INVALID', `Option requires value: -${shortName}`, { option: shortName });
      }
      addOptionValue(parameter, next);
      index += 1;
      continue;
    }

    positional.push(token);
  }

  return { optionValues, positional };
};

const parseBoolean = (value: string, parameterName: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  throw createError('CLI_ARGUMENT_INVALID', `Invalid boolean value for ${parameterName}: ${value}`, {
    parameter: parameterName,
    value
  });
};

const assertChoice = (parameter: CliCommandParameterManifestMeta, value: unknown): void => {
  const choices = parameter.choices ?? parameter.ui?.choices;
  if (!choices || choices.length === 0) {
    return;
  }
  if (!choices.some((choice) => choice === value)) {
    throw createError('CLI_ARGUMENT_INVALID', `Invalid value for ${parameter.name}: ${String(value)}`, {
      parameter: parameter.name,
      value,
      choices
    });
  }
};

const assertValidation = (parameter: CliCommandParameterManifestMeta, value: unknown): void => {
  const validation = parameter.validation;
  if (!validation) {
    return;
  }
  if (typeof value === 'number') {
    if (typeof validation.min === 'number' && value < validation.min) {
      throw createError('CLI_ARGUMENT_INVALID', `${parameter.name} must be greater than or equal to ${validation.min}`, {
        parameter: parameter.name,
        min: validation.min,
        value
      });
    }
    if (typeof validation.max === 'number' && value > validation.max) {
      throw createError('CLI_ARGUMENT_INVALID', `${parameter.name} must be less than or equal to ${validation.max}`, {
        parameter: parameter.name,
        max: validation.max,
        value
      });
    }
  }
  if (typeof value === 'string') {
    if (typeof validation.minLength === 'number' && value.length < validation.minLength) {
      throw createError('CLI_ARGUMENT_INVALID', `${parameter.name} is shorter than ${validation.minLength}`, {
        parameter: parameter.name,
        minLength: validation.minLength
      });
    }
    if (typeof validation.maxLength === 'number' && value.length > validation.maxLength) {
      throw createError('CLI_ARGUMENT_INVALID', `${parameter.name} is longer than ${validation.maxLength}`, {
        parameter: parameter.name,
        maxLength: validation.maxLength
      });
    }
    if (validation.pattern) {
      const pattern = new RegExp(validation.pattern);
      if (!pattern.test(value)) {
        throw createError('CLI_ARGUMENT_INVALID', `${parameter.name} does not match required pattern`, {
          parameter: parameter.name,
          pattern: validation.pattern
        });
      }
    }
  }
};

const validatePathRule = async (
  parameter: CliCommandParameterManifestMeta,
  resolvedPath: string,
  originalValue: string,
  options: { overwriteRequested?: boolean } = {}
): Promise<CliSkippedOutput | undefined> => {
  const rule = parameter.path;
  if (!rule) {
    return undefined;
  }
  const stats = await fs.stat(resolvedPath).catch(() => null);
  const isOutputPath = rule.role === 'output';
  const overwritePolicy = options.overwriteRequested ? 'overwrite' : (rule.overwrite ?? 'fail');
  let skippedOutput: CliSkippedOutput | undefined;
  if (isOutputPath) {
    if (stats && overwritePolicy === 'fail') {
      throw createError('CLI_OUTPUT_EXISTS', `Output path already exists: ${resolvedPath}`, {
        parameter: parameter.name,
        path: resolvedPath,
        original: originalValue,
        overwrite: overwritePolicy
      });
    }
    if (stats && overwritePolicy === 'skip') {
      skippedOutput = {
        parameter: parameter.name,
        path: resolvedPath,
        original: originalValue,
        policy: 'skip',
        reason: 'exists'
      };
    }
  }
  if (rule.exists === true && !stats) {
    throw createError('CLI_PATH_NOT_FOUND', `Path does not exist: ${resolvedPath}`, {
      parameter: parameter.name,
      path: resolvedPath,
      original: originalValue
    });
  }
  if (stats && rule.kind === 'file' && !stats.isFile()) {
    throw createError('CLI_PATH_INVALID', `Path must be a file: ${resolvedPath}`, {
      parameter: parameter.name,
      path: resolvedPath
    });
  }
  if (stats && rule.kind === 'directory' && !stats.isDirectory()) {
    throw createError('CLI_PATH_INVALID', `Path must be a directory: ${resolvedPath}`, {
      parameter: parameter.name,
      path: resolvedPath
    });
  }
  if (!stats && rule.create === true) {
    if (rule.kind === 'directory') {
      await fs.mkdir(resolvedPath, { recursive: true });
    } else if (isOutputPath) {
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    }
  }
  if (rule.extensions && rule.extensions.length > 0) {
    const extension = path.extname(resolvedPath).replace(/^\./, '').toLowerCase();
    const allowed = rule.extensions.map((item) => item.replace(/^\./, '').toLowerCase());
    if (!allowed.includes(extension)) {
      throw createError('CLI_PATH_INVALID', `Path extension is not allowed: ${resolvedPath}`, {
        parameter: parameter.name,
        path: resolvedPath,
        extensions: rule.extensions
      });
    }
  }
  return skippedOutput;
};

const validateBatchItemPathRule = async (
  parameter: CliCommandParameterManifestMeta,
  rule: NonNullable<NonNullable<CliCommandParameterManifestMeta['batch']>['itemPath']>,
  resolvedPath: string,
  originalValue: string,
  itemIndex: number
): Promise<void> => {
  const stats = await fs.stat(resolvedPath).catch(() => null);
  if (rule.exists === true && !stats) {
    throw createError('CLI_BATCH_INVALID', `Batch item path does not exist: ${resolvedPath}`, {
      parameter: parameter.name,
      itemIndex,
      path: resolvedPath,
      original: originalValue
    });
  }
  if (stats && rule.kind === 'file' && !stats.isFile()) {
    throw createError('CLI_BATCH_INVALID', `Batch item path must be a file: ${resolvedPath}`, {
      parameter: parameter.name,
      itemIndex,
      path: resolvedPath
    });
  }
  if (stats && rule.kind === 'directory' && !stats.isDirectory()) {
    throw createError('CLI_BATCH_INVALID', `Batch item path must be a directory: ${resolvedPath}`, {
      parameter: parameter.name,
      itemIndex,
      path: resolvedPath
    });
  }
  if (!stats && rule.create === true && rule.kind === 'directory') {
    await fs.mkdir(resolvedPath, { recursive: true });
  }
  if (rule.extensions && rule.extensions.length > 0) {
    const extension = path.extname(resolvedPath).replace(/^\./, '').toLowerCase();
    const allowed = rule.extensions.map((item) => item.replace(/^\./, '').toLowerCase());
    if (!allowed.includes(extension)) {
      throw createError('CLI_BATCH_INVALID', `Batch item path extension is not allowed: ${resolvedPath}`, {
        parameter: parameter.name,
        itemIndex,
        path: resolvedPath,
        extensions: rule.extensions
      });
    }
  }
};

const normalizeBatchValue = async (
  parameter: CliCommandParameterManifestMeta,
  value: unknown,
  cwd: string
): Promise<unknown[]> => {
  const batch = parameter.batch;
  if (!batch) {
    return Array.isArray(value) ? value : [value];
  }
  let items: unknown[];
  if (batch.format === 'lines') {
    if (typeof value !== 'string') {
      throw createError('CLI_BATCH_INVALID', `Batch parameter ${parameter.name} must read text content`, {
        parameter: parameter.name,
        format: batch.format
      });
    }
    items = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } else if (batch.format === 'json-array') {
    if (!Array.isArray(value)) {
      throw createError('CLI_BATCH_INVALID', `Batch parameter ${parameter.name} must contain a JSON array`, {
        parameter: parameter.name,
        format: batch.format
      });
    }
    items = value;
  } else {
    throw createError('CLI_BATCH_INVALID', `Unsupported batch format for ${parameter.name}`, {
      parameter: parameter.name,
      format: batch.format
    });
  }

  if (batch.itemType === 'path') {
    const normalized: string[] = [];
    for (const [itemIndex, item] of items.entries()) {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw createError('CLI_BATCH_INVALID', `Batch item ${itemIndex} must be a non-empty path string`, {
          parameter: parameter.name,
          itemIndex,
          value: item
        });
      }
      const resolved = path.resolve(cwd, item);
      if (batch.itemPath) {
        await validateBatchItemPathRule(parameter, batch.itemPath, resolved, item, itemIndex);
      }
      normalized.push(resolved);
    }
    return normalized;
  }

  return items;
};

const splitOutputPathName = (filePath: string): { dir: string; base: string; ext: string } => {
  const parsed = path.parse(filePath);
  return {
    dir: parsed.dir,
    base: parsed.name,
    ext: parsed.ext
  };
};

const resolveRenamedOutputPath = async (requestedPath: string): Promise<string> => {
  const { dir, base, ext } = splitOutputPathName(requestedPath);
  for (let index = 1; index < 10_000; index += 1) {
    const candidate = path.join(dir, `${base}-${index}${ext}`);
    const stats = await fs.stat(candidate).catch(() => null);
    if (!stats) {
      return candidate;
    }
  }
  throw createError('CLI_OUTPUT_RENAME_EXHAUSTED', `Cannot find available output path for ${requestedPath}`, {
    path: requestedPath
  });
};

const resolveCliPathParameterValue = async (
  parameter: CliCommandParameterManifestMeta,
  rawValue: string,
  options: CliParameterCoerceOptions
): Promise<CliResolvedPathValue> => {
  let resolved = path.resolve(options.cwd, rawValue);
  const rule = parameter.path;
  if (rule?.role === 'output' && !options.overwriteRequested && (rule.overwrite ?? 'fail') === 'rename') {
    const stats = await fs.stat(resolved).catch(() => null);
    if (stats) {
      resolved = await resolveRenamedOutputPath(resolved);
    }
  }
  const skipped = await validatePathRule(parameter, resolved, rawValue, {
    overwriteRequested: options.overwriteRequested
  });
  assertValidation(parameter, resolved);
  return {
    path: resolved,
    skipped
  };
};

const coerceParameterValue = async (
  parameter: CliCommandParameterManifestMeta,
  rawValues: string[],
  options: CliParameterCoerceOptions
): Promise<unknown> => {
  const rawValue = rawValues[rawValues.length - 1];
  if (typeof rawValue === 'undefined') {
    return undefined;
  }

  switch (parameter.type) {
    case 'string':
    case 'text':
      assertChoice(parameter, rawValue);
      assertValidation(parameter, rawValue);
      return rawValue;
    case 'stringList': {
      const values = rawValues.flatMap((value) => value.split(',').map((item) => item.trim()).filter((item) => item.length > 0));
      for (const value of values) {
        assertChoice(parameter, value);
        assertValidation(parameter, value);
      }
      return values;
    }
    case 'number': {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        throw createError('CLI_ARGUMENT_INVALID', `Invalid number for ${parameter.name}: ${rawValue}`, {
          parameter: parameter.name,
          value: rawValue
        });
      }
      assertValidation(parameter, value);
      return value;
    }
    case 'integer': {
      const value = Number(rawValue);
      if (!Number.isInteger(value)) {
        throw createError('CLI_ARGUMENT_INVALID', `Invalid integer for ${parameter.name}: ${rawValue}`, {
          parameter: parameter.name,
          value: rawValue
        });
      }
      assertValidation(parameter, value);
      return value;
    }
    case 'boolean': {
      const value = parseBoolean(rawValue, parameter.name);
      assertValidation(parameter, value);
      return value;
    }
    case 'enum':
      assertChoice(parameter, rawValue);
      assertValidation(parameter, rawValue);
      return rawValue;
    case 'path': {
      const resolved = await resolveCliPathParameterValue(parameter, rawValue, options);
      return resolved.skipped ? resolved : resolved.path;
    }
    case 'json':
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        throw createError('CLI_ARGUMENT_INVALID', `Invalid JSON for ${parameter.name}`, {
          parameter: parameter.name,
          value: rawValue,
          error: String(error)
        });
      }
    case 'jsonFile': {
      const resolved = path.resolve(options.cwd, rawValue);
      await validatePathRule(parameter, resolved, rawValue, {
        overwriteRequested: options.overwriteRequested
      });
      try {
        const parsed = JSON.parse(await fs.readFile(resolved, 'utf-8'));
        return parameter.batch ? normalizeBatchValue(parameter, parsed, options.cwd) : parsed;
      } catch (error) {
        throw createError('CLI_ARGUMENT_INVALID', `Invalid JSON file for ${parameter.name}`, {
          parameter: parameter.name,
          path: resolved,
          error: String(error)
        });
      }
    }
    case 'textFile': {
      const resolved = path.resolve(options.cwd, rawValue);
      await validatePathRule(parameter, resolved, rawValue, {
        overwriteRequested: options.overwriteRequested
      });
      const content = await fs.readFile(resolved, 'utf-8');
      return parameter.batch ? normalizeBatchValue(parameter, content, options.cwd) : content;
    }
    default:
      throw createError('CLI_ARGUMENT_INVALID', `Unsupported parameter type: ${String(parameter.type)}`, {
        parameter: parameter.name,
        type: parameter.type
      });
  }
};

const setPayloadValue = (payload: Record<string, unknown>, mapsTo: string, value: unknown): void => {
  const parts = mapsTo.split('.').filter((part) => part.length > 0);
  let cursor: Record<string, unknown> = payload;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    const next = cursor[part];
    if (!isRecord(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
};

const parseCliCommandInvocation = async (
  declaration: CliCommandManifestMeta,
  tokens: string[],
  options: CliParameterCoerceOptions
): Promise<ParsedInvocation> => {
  const argumentParameters = [...declaration.arguments].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const optionParameters = declaration.options;
  const { optionValues, positional } = collectInvocationTokens(optionParameters, tokens);
  const raw: Record<string, unknown> = {};
  const payload: Record<string, unknown> = {};
  const skippedOutputs: CliSkippedOutput[] = [];

  const assignParameterValue = (parameter: CliCommandParameterManifestMeta, value: unknown): void => {
    let payloadValue = value;
    if (parameter.type === 'path' && isRecord(value) && typeof value.path === 'string' && isRecord(value.skipped)) {
      const skipped = value.skipped as unknown as CliSkippedOutput;
      skippedOutputs.push(skipped);
      payloadValue = value.path;
    }
    raw[parameter.name] = payloadValue;
    setPayloadValue(payload, parameter.mapsTo ?? parameter.name, payloadValue);
  };

  if (positional.length > argumentParameters.length) {
    throw createError('CLI_ARGUMENT_INVALID', 'Too many positional arguments', {
      expected: argumentParameters.map((parameter) => parameter.name),
      received: positional
    });
  }

  for (const parameter of argumentParameters) {
    const position = parameter.position ?? argumentParameters.indexOf(parameter);
    const rawValue = positional[position];
    const hasValue = typeof rawValue !== 'undefined';
    const rawValues = hasValue ? [rawValue] : [];
    let value: unknown;
    if (hasValue) {
      value = await coerceParameterValue(parameter, rawValues, options);
    } else if (typeof parameter.default !== 'undefined') {
      value = parameter.default;
    } else if (parameter.required) {
      throw createError('CLI_ARGUMENT_INVALID', `Missing required argument: ${parameter.name}`, {
        argument: parameter.name
      });
    } else {
      continue;
    }
    assignParameterValue(parameter, value);
  }

  for (const parameter of optionParameters) {
    const rawValues = optionValues.get(parameter.name);
    let value: unknown;
    if (rawValues && rawValues.length > 0) {
      value = await coerceParameterValue(parameter, parameter.multiple ? rawValues : [rawValues[rawValues.length - 1]!], options);
    } else if (typeof parameter.default !== 'undefined') {
      value = parameter.default;
    } else if (parameter.required) {
      throw createError('CLI_ARGUMENT_INVALID', `Missing required option: --${parameter.name}`, {
        option: parameter.name
      });
    } else {
      continue;
    }
    assignParameterValue(parameter, value);
  }

  return { payload, raw, skippedOutputs };
};

const waitForCliModuleJob = async (
  runtime: RuntimeClient,
  jobId: string,
  options: CliJobWaitOptions = {}
): Promise<{ job: ModuleJobView }> => {
  let lastProgressKey: string | undefined;
  let cancelRequested = false;
  const onSigint = (): void => {
    if (!options.cancelOnInterrupt || cancelRequested) {
      return;
    }
    cancelRequested = true;
    void runtime.invoke('module.job.cancel', { jobId }).catch(() => undefined);
  };

  if (options.cancelOnInterrupt) {
    process.once('SIGINT', onSigint);
  }

  try {
    for (;;) {
      const snapshot = await runtime.invoke<{ job: ModuleJobView }>('module.job.get', { jobId });
      if (snapshot.job.progress) {
        const progressKey = JSON.stringify(snapshot.job.progress);
        if (progressKey !== lastProgressKey) {
          lastProgressKey = progressKey;
          options.onProgress?.(snapshot.job);
        }
      }
      if (CLI_JOB_TERMINAL_STATUSES.has(snapshot.job.status)) {
        return snapshot;
      }
      await delay(100);
    }
  } finally {
    if (options.cancelOnInterrupt) {
      process.off('SIGINT', onSigint);
    }
  }
};

const waitForCliTask = async (
  runtime: RuntimeClient,
  taskId: string,
  options: CliJobWaitOptions = {}
): Promise<{ task: CliTaskView }> => {
  let lastProgressKey: string | undefined;
  let cancelRequested = false;
  const onSigint = (): void => {
    if (!options.cancelOnInterrupt || cancelRequested) {
      return;
    }
    cancelRequested = true;
    void runtime.invoke('cli.task.cancel', { taskId }).catch(() => undefined);
  };

  if (options.cancelOnInterrupt) {
    process.once('SIGINT', onSigint);
  }

  try {
    for (;;) {
      const snapshot = await runtime.invoke<{ task: CliTaskView }>('cli.task.get', { taskId });
      if (snapshot.task.progress) {
        const progressKey = JSON.stringify(snapshot.task.progress);
        if (progressKey !== lastProgressKey) {
          lastProgressKey = progressKey;
          options.onProgress?.(snapshot.task);
        }
      }
      if (CLI_JOB_TERMINAL_STATUSES.has(snapshot.task.status)) {
        return snapshot;
      }
      await delay(100);
    }
  } finally {
    if (options.cancelOnInterrupt) {
      process.off('SIGINT', onSigint);
    }
  }
};

const waitForCommandReady = async (
  runtime: RuntimeClient,
  commandId: string,
  options: {
    pluginId?: string;
    sceneId?: string;
    surfaceId?: string;
    timeoutMs?: number;
  } = {}
): Promise<void> => {
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);
  let lastError: unknown;
  for (;;) {
    try {
      const result = await runtime.invoke<{ command?: unknown }>('command.get', {
        commandId,
        scope: {
          kind: 'app',
          appId: options.pluginId
        },
        source: 'cli',
        sceneId: options.sceneId,
        surfaceId: options.surfaceId,
        includeDisabled: true,
        includeHidden: true
      });
      if (isRecord(result.command)) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      throw createError('CLI_COMMAND_NOT_READY', 'Application command was not registered before CLI timeout', {
        commandId,
        pluginId: options.pluginId,
        timeoutMs: options.timeoutMs ?? 5_000,
        lastError: lastError ? toStandardError(lastError, 'COMMAND_GET_FAILED') : undefined
      });
    }
    await delay(100);
  }
};

const executeModuleCliCommand = async (
  runtime: RuntimeClient,
  command: CliCommandView,
  target: Extract<CliCommandTargetManifestMeta, { type: 'module' }>,
  payload: Record<string, unknown>,
  skippedOutputs: CliSkippedOutput[] = []
): Promise<unknown> => {
  void skippedOutputs;

  const result = await runtime.invokeWithTimeout<
    { mode: 'sync'; output: unknown } | { mode: 'job'; jobId: string }
  >(
    'module.invoke',
    {
      capability: target.capability,
      method: target.method,
      input: payload,
      pluginId: target.pluginId,
      timeoutMs: target.timeoutMs
    },
    target.timeoutMs ?? 30_000
  );

  if (result.mode === 'sync') {
    return {
      ok: true,
      commandId: command.commandId,
      commandPath: command.commandPath.join(' '),
      target: {
        type: 'module',
        capability: target.capability,
        method: target.method,
        pluginId: target.pluginId
      },
      output: result.output
    };
  }

  if (command.declaration.job?.wait === false) {
    return {
      ok: true,
      commandId: command.commandId,
      commandPath: command.commandPath.join(' '),
      target: {
        type: 'module',
        capability: target.capability,
        method: target.method,
        pluginId: target.pluginId
      },
      job: {
        jobId: result.jobId,
        status: 'running'
      }
    };
  }

  const progressReporter = createCliJobProgressReporter();
  const completed = await (async (): Promise<{ job: ModuleJobView }> => {
    try {
      return await waitForCliModuleJob(runtime, result.jobId, {
        cancelOnInterrupt: command.declaration.job?.cancelOnInterrupt === true,
        onProgress: progressReporter?.onProgress
      });
    } finally {
      progressReporter?.finish();
    }
  })();
  if (completed.job.status === 'failed') {
    throw createError('CLI_JOB_FAILED', 'CLI module job failed', {
      commandId: command.commandId,
      job: completed.job
    });
  }
  if (completed.job.status === 'cancelled') {
    throw createError('CLI_JOB_CANCELLED', 'CLI module job was cancelled', {
      commandId: command.commandId,
      job: completed.job
    });
  }
  return {
    ok: true,
    commandId: command.commandId,
    commandPath: command.commandPath.join(' '),
    target: {
      type: 'module',
      capability: target.capability,
      method: target.method,
      pluginId: target.pluginId
    },
    job: completed.job,
    output: completed.job.output
  };
};

const buildAppLaunchParams = (
  target: Extract<CliCommandTargetManifestMeta, { type: 'app' }>,
  payload: Record<string, unknown>,
  task?: CliTaskView
): Record<string, unknown> => ({
  ...(target.launchParams ?? {}),
  source: 'cli',
  cli: {
    payload,
    taskId: task?.taskId,
    commandId: target.commandId,
    commandPath: task?.commandPath
  }
});

const findSurfaceForSession = async (
  runtime: RuntimeClient,
  sessionId?: string
): Promise<{ id?: string; context?: { sceneId?: string; surfaceId?: string; sessionId?: string } } | undefined> => {
  if (!sessionId) {
    return undefined;
  }
  const listed = await runtime.invoke<{ surfaces: Array<{ id?: string; sessionId?: string; context?: { sceneId?: string; surfaceId?: string; sessionId?: string } }> }>('surface.list', {});
  return listed.surfaces.find((surface) => surface.sessionId === sessionId || surface.context?.sessionId === sessionId);
};

export const executeAppCliCommand = async (
  runtime: RuntimeClient,
  command: CliCommandView,
  target: Extract<CliCommandTargetManifestMeta, { type: 'app' }>,
  payload: Record<string, unknown>
): Promise<unknown> => {
  const shouldWaitForTask = Boolean(target.commandId) && command.declaration.job?.wait !== false;
  const createdTask = shouldWaitForTask
    ? (await runtime.invoke<{ task: CliTaskView }>('cli.task.create', {
        pluginId: target.pluginId,
        commandId: command.commandId,
        commandPath: command.commandPath
      })).task
    : undefined;
  const launchParams = buildAppLaunchParams(target, payload, createdTask);
  const commandContext = {
    commandId: command.commandId,
    source: 'cli',
    payload,
    taskId: createdTask?.taskId
  };
  const useBackgroundSurface = Boolean(target.commandId);
  const presentation = useBackgroundSurface
    ? {
        visible: false
      }
    : undefined;
  let openedSurface: { id?: string; context?: { sceneId?: string; surfaceId?: string; sessionId?: string } } | undefined;
  let launched: unknown;

  if (target.surface?.open === true || useBackgroundSurface) {
    const opened = await runtime.invoke<{
      surface: {
        id?: string;
        context?: { sceneId?: string; surfaceId?: string; sessionId?: string };
      };
    }>('surface.open', {
      request: {
        kind: 'window',
        target: {
          type: 'plugin',
          pluginId: target.pluginId,
          launchParams
        },
        presentation
      }
    });
    openedSurface = opened.surface;
    launched = opened;
  } else {
    const opened = await runtime.invoke<{
      window?: { id?: string };
      session?: { sessionId?: string };
    }>('plugin.launch', {
      pluginId: target.pluginId,
      launchParams
    });
    openedSurface = await findSurfaceForSession(runtime, opened.session?.sessionId);
    launched = opened;
  }

  if (!useBackgroundSurface && target.surface?.reuse === 'always' && openedSurface?.id) {
    await runtime.invoke('surface.setState', {
      surfaceId: openedSurface.id,
      state: 'normal'
    });
  }

  let commandInvocation: unknown;
  if (target.commandId) {
    await waitForCommandReady(runtime, target.commandId, {
      pluginId: target.pluginId,
      sceneId: openedSurface?.context?.sceneId,
      surfaceId: openedSurface?.id ?? openedSurface?.context?.surfaceId
    });
    commandInvocation = await runtime.invoke('command.invoke', {
      commandId: target.commandId,
      source: 'cli',
      payload,
      context: {
        pluginId: target.pluginId,
        sceneId: openedSurface?.context?.sceneId,
        surfaceId: openedSurface?.id ?? openedSurface?.context?.surfaceId,
        taskId: createdTask?.taskId,
        command: commandContext,
        data: {
          source: 'cli',
          taskId: createdTask?.taskId
        }
      }
    });
    if (createdTask) {
      const invocationId = isRecord(commandInvocation) && typeof commandInvocation.invocationId === 'string'
        ? commandInvocation.invocationId
        : undefined;
      await runtime.invoke('cli.task.bindInvocation', {
        taskId: createdTask.taskId,
        invocationId,
        surfaceId: openedSurface?.id ?? openedSurface?.context?.surfaceId,
        sessionId: openedSurface?.context?.sessionId
      });
    }
  }

  if (!useBackgroundSurface && target.surface?.focus === true && openedSurface?.id) {
    await runtime.invoke('surface.focus', { surfaceId: openedSurface.id });
  }

  if (!createdTask) {
    return {
      ok: true,
      commandId: command.commandId,
      commandPath: command.commandPath.join(' '),
      target: {
        type: 'app',
        pluginId: target.pluginId,
        commandId: target.commandId
      },
      commandContext,
      surface: openedSurface,
      launched,
      commandInvocation
    };
  }

  const progressReporter = createCliJobProgressReporter();
  const completed = await (async (): Promise<{ task: CliTaskView }> => {
    try {
      return await waitForCliTask(runtime, createdTask.taskId, {
        cancelOnInterrupt: command.declaration.job?.cancelOnInterrupt === true,
        onProgress: progressReporter?.onProgress
      });
    } finally {
      progressReporter?.finish();
    }
  })();
  if (completed.task.status === 'failed') {
    throw createError('CLI_TASK_FAILED', 'CLI application task failed', {
      commandId: command.commandId,
      task: completed.task
    });
  }
  if (completed.task.status === 'cancelled') {
    throw createError('CLI_TASK_CANCELLED', 'CLI application task was cancelled', {
      commandId: command.commandId,
      task: completed.task
    });
  }

  return {
    ok: true,
    commandId: command.commandId,
    commandPath: command.commandPath.join(' '),
    target: {
      type: 'app',
      pluginId: target.pluginId,
      commandId: target.commandId
    },
    commandContext,
    task: completed.task,
    output: completed.task.output,
    surface: openedSurface,
    launched,
    commandInvocation
  };
};

const resolveElectronExecutableForCli = (): string => {
  try {
    const scopedRequire = require('node:module').createRequire(__filename) as NodeJS.Require & {
      resolve(request: string, options?: { paths?: string[] }): string;
    };
    const electronExecutable = scopedRequire('electron');
    if (typeof electronExecutable === 'string' && electronExecutable.length > 0) {
      return electronExecutable;
    }
  } catch {
    // Fall through to the local package probe for source-tree execution.
  }

  const candidates = [
    path.resolve(__dirname, '../../../../node_modules/electron'),
    path.resolve(process.cwd(), 'node_modules/electron')
  ];
  for (const candidate of candidates) {
    try {
      const electronExecutable = require(candidate) as unknown;
      if (typeof electronExecutable === 'string' && electronExecutable.length > 0) {
        return electronExecutable;
      }
    } catch {
      // Continue probing.
    }
  }

  throw createError('CLI_ELECTRON_RUNTIME_UNAVAILABLE', 'Electron runtime is required to execute application CLI commands', {
    candidates
  });
};

const resolveElectronAppEntryForCli = (): string => {
  const candidates = [
    path.resolve(__dirname, '../electron/cli-app-command-runner.js'),
    path.resolve(__dirname, '../electron/cli-app-command-runner.ts')
  ];
  for (const candidate of candidates) {
    try {
      const stats = require('node:fs').statSync(candidate) as { isFile(): boolean };
      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Continue probing.
    }
  }
  throw createError('CLI_ELECTRON_APP_RUNNER_NOT_FOUND', 'Application CLI runner entry is unavailable', { candidates });
};

const createElectronAppCliRequest = (
  workspace: string,
  command: CliCommandView,
  payload: Record<string, unknown>
): ElectronAppCliCommandRequest => ({
  workspacePath: workspace,
  command,
  payload
});

const findElectronAppCliOutput = (stdout: string): ElectronCliAppCommandResultEnvelope | undefined => {
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(ELECTRON_APP_CLI_RESULT_PREFIX)) {
      return {
        ok: true,
        result: decodeElectronAppCliPayload(line.slice(ELECTRON_APP_CLI_RESULT_PREFIX.length))
      };
    }
    if (line.startsWith(ELECTRON_APP_CLI_ERROR_PREFIX)) {
      return {
        ok: false,
        error: decodeElectronAppCliPayload<StandardError>(line.slice(ELECTRON_APP_CLI_ERROR_PREFIX.length))
      };
    }
  }

  return undefined;
};

const parseElectronAppCliOutput = (stdout: string): ElectronCliAppCommandResultEnvelope => {
  const envelope = findElectronAppCliOutput(stdout);
  if (envelope) {
    return envelope;
  }

  throw createError('CLI_ELECTRON_APP_RESULT_MISSING', 'Application CLI runner did not return a structured result', {
    stdout: stdout.trim()
  });
};

const executeAppCliCommandInElectron = async (
  workspace: string,
  command: CliCommandView,
  payload: Record<string, unknown>
): Promise<unknown> => {
  const electronExecutable = resolveElectronExecutableForCli();
  const appEntry = resolveElectronAppEntryForCli();
  const encodedRequest = encodeElectronAppCliPayload(createElectronAppCliRequest(workspace, command, payload));

  return new Promise((resolve, reject) => {
    let settled = false;
    let exited = false;
    let timeout: NodeJS.Timeout | undefined;
    let forceKillTimeout: NodeJS.Timeout | undefined;

    const clearTimers = (): void => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      if (forceKillTimeout) {
        clearTimeout(forceKillTimeout);
        forceKillTimeout = undefined;
      }
    };

    const terminateChild = (): void => {
      if (exited || child.killed) {
        return;
      }
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        if (!exited) {
          child.kill('SIGKILL');
        }
      }, ELECTRON_APP_CLI_TERMINATE_GRACE_MS);
    };

    const settleFromEnvelope = (envelope: ElectronCliAppCommandResultEnvelope): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      if (envelope.ok) {
        resolve(envelope.result);
      } else {
        reject(envelope.error ?? createError('CLI_ELECTRON_APP_FAILED', 'Application CLI runner failed'));
      }
      terminateChild();
    };

    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      terminateChild();
      reject(error);
    };

    const child = childProcess.spawn(electronExecutable, [
      appEntry,
      `${ELECTRON_APP_CLI_REQUEST_PREFIX}${encodedRequest}`
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CHIPS_HOME: workspace
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const envelope = findElectronAppCliOutput(stdout);
      if (envelope) {
        settleFromEnvelope(envelope);
      }
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on('error', rejectOnce);
    child.on('exit', (code, signal) => {
      exited = true;
      clearTimers();
      if (settled) {
        return;
      }
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      try {
        const envelope = parseElectronAppCliOutput(stdout);
        if (envelope.ok) {
          settled = true;
          resolve(envelope.result);
          return;
        }
        settled = true;
        reject(envelope.error ?? createError('CLI_ELECTRON_APP_FAILED', 'Application CLI runner failed'));
      } catch (error) {
        settled = true;
        reject(createError('CLI_ELECTRON_APP_FAILED', 'Application CLI runner failed', {
          exitCode: code,
          signal,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          cause: toStandardError(error, 'CLI_ELECTRON_APP_RESULT_INVALID')
        }));
      }
    });

    timeout = setTimeout(() => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');
      rejectOnce(createError('CLI_ELECTRON_APP_TIMEOUT', 'Application CLI runner timed out', {
        timeoutMs: ELECTRON_APP_CLI_TIMEOUT_MS,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      }));
    }, ELECTRON_APP_CLI_TIMEOUT_MS);
  });
};

const executeCliCommandTarget = async (
  runtime: RuntimeClient,
  command: CliCommandView,
  payload: Record<string, unknown>,
  skippedOutputs: CliSkippedOutput[] = [],
  options: ExecuteCliCommandTargetOptions = {}
): Promise<unknown> => {
  const target = command.declaration.target;
  if (skippedOutputs.length > 0) {
    return {
      ok: true,
      skipped: true,
      commandId: command.commandId,
      commandPath: command.commandPath.join(' '),
      target,
      output: {
        skipped: skippedOutputs
      }
    };
  }
  if (target.type === 'module') {
    return executeModuleCliCommand(runtime, command, target, payload, skippedOutputs);
  }
  if (target.type === 'app') {
    const runningInElectron = options.isElectronRuntime ?? isElectronRuntime();
    if (target.commandId && options.workspace && !runningInElectron) {
      const executeInElectron = options.executeAppCliCommandInElectron ?? executeAppCliCommandInElectron;
      return executeInElectron(options.workspace, command, payload);
    }
    return executeAppCliCommand(runtime, command, target, payload);
  }
  throw createError('CLI_TARGET_UNAVAILABLE', `Unsupported CLI target: ${String((target as { type?: unknown }).type)}`, {
    commandId: command.commandId,
    target
  });
};

export const __cliTestHooks = {
  executeAppCliCommand,
  executeCliCommandTarget
};

const getCliExitCode = (error: unknown): number => {
  const standard = toStandardError(error, 'CLI_COMMAND_FAILED');
  if (standard.code === 'CLI_ARGUMENT_INVALID') {
    return 2;
  }
  if (standard.code === 'CLI_COMMAND_NOT_FOUND' || standard.code === 'CLI_COMMAND_CONFLICT') {
    return 3;
  }
  if (standard.code === 'PERMISSION_DENIED' || standard.code === 'CLI_PERMISSION_DENIED') {
    return 4;
  }
  if (
    standard.code.startsWith('CLI_PATH_') ||
    standard.code.startsWith('CLI_OUTPUT_') ||
    standard.code === 'CLI_BATCH_INVALID' ||
    standard.code === 'FILE_ASSOCIATION_TARGET_INVALID'
  ) {
    return 5;
  }
  if (
    standard.code === 'PLUGIN_NOT_FOUND' ||
    standard.code === 'PLUGIN_DISABLED' ||
    standard.code === 'MODULE_PROVIDER_NOT_FOUND' ||
    standard.code === 'COMMAND_NOT_FOUND' ||
    standard.code === 'CLI_TARGET_UNAVAILABLE'
  ) {
    return 6;
  }
  if (standard.code === 'CLI_JOB_FAILED' || standard.code === 'MODULE_JOB_FAILED' || standard.code === 'CLI_TASK_FAILED') {
    return 7;
  }
  if (standard.code === 'CLI_JOB_CANCELLED' || standard.code === 'MODULE_JOB_CANCELLED' || standard.code === 'CLI_TASK_CANCELLED') {
    return 8;
  }
  if (standard.code === 'CLI_TIMEOUT' || standard.code === 'RUNTIME_TIMEOUT' || standard.code === 'MODULE_TIMEOUT') {
    return 9;
  }
  return 1;
};

const tryRunPluginCliCommand = async (
  workspace: string,
  argv: string[],
  source: CliOperationSource = 'cli',
  commandLine?: string
): Promise<{ handled: boolean; code: number }> => {
  const startedAt = Date.now();
  const global = parseGlobalOptions(argv);
  if (global.tokens.length === 0) {
    return { handled: false, code: 0 };
  }
  if (FIXED_COMMANDS.has(global.tokens[0]!)) {
    return { handled: false, code: 0 };
  }

  return withHost(workspace, async (runtime) => {
    let matched: MatchedCliCommand | undefined;
    try {
      matched = await findCliCommandMatch(runtime, global.tokens, global.pluginId);
      if (!matched) {
        if (global.pluginId) {
          throw createError('CLI_COMMAND_NOT_FOUND', 'No plugin CLI command matches the requested command path', {
            pluginId: global.pluginId,
            commandPath: global.tokens
          });
        }
        return { handled: false, code: 0 };
      }
      const local = parseCliLocalOverwriteRequest(matched.invocationTokens, matched.command.declaration);
      const parsed = await parseCliCommandInvocation(
        matched.command.declaration,
        local.tokens,
        {
          cwd: process.cwd(),
          overwriteRequested: local.overwriteRequested
        }
      );
      const result = await executeCliCommandTarget(runtime, matched.command, parsed.payload, parsed.skippedOutputs, {
        workspace
      });
      printCliResult(result, { json: global.json, command: matched.command });
      await safeRecordCliOperationLog(workspace, {
        source,
        argv,
        code: 0,
        startedAt,
        commandLine,
        pluginId: matched.command.owner.pluginId,
        commandId: matched.command.commandId,
        commandPath: matched.command.commandPath,
        targetType: matched.command.declaration.target.type,
        metadata: {
          invocationTokens: redactCliArgv(matched.invocationTokens),
          outputMode: global.json ? 'json' : (matched.command.declaration.output?.mode ?? 'json'),
          skippedOutputs: parsed.skippedOutputs.length
        }
      });
      return { handled: true, code: 0 };
    } catch (error) {
      const code = getCliExitCode(error);
      await safeRecordCliOperationLog(workspace, {
        source,
        argv,
        code,
        startedAt,
        commandLine,
        pluginId: matched?.command.owner.pluginId ?? global.pluginId,
        commandId: matched?.command.commandId,
        commandPath: matched?.command.commandPath ?? global.tokens,
        targetType: matched?.command.declaration.target.type,
        error,
        metadata: {
          invocationTokens: matched ? redactCliArgv(matched.invocationTokens) : undefined
        }
      });
      markPluginCliOperationLogged(error);
      throw error;
    }
  });
};

const captureCliOutput = async <T>(
  run: () => Promise<T>,
  listeners: {
    onOutput?: (chunk: string) => void;
    onErrorOutput?: (chunk: string) => void;
  } = {}
): Promise<{ result: T; output: string; errorOutput: string }> => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    stdoutChunks.push(text);
    listeners.onOutput?.(text);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
    stderrChunks.push(text);
    listeners.onErrorOutput?.(text);
    return true;
  }) as typeof process.stderr.write;

  try {
    const result = await run();
    return {
      result,
      output: stdoutChunks.join(''),
      errorOutput: stderrChunks.join('')
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
};

const runInteractiveCliCommand = async (
  workspace: string,
  tokens: string[],
  pluginId?: string,
  commandLine?: string,
  signal?: AbortSignal,
  onOutput?: (chunk: string) => void,
  onErrorOutput?: (chunk: string) => void
): Promise<{ code: number; output: string; errorOutput?: string }> => {
  if (!pluginId && tokens[0] && FIXED_COMMANDS.has(tokens[0].toLowerCase())) {
    const startedAt = Date.now();
    if (signal?.aborted) {
      return { code: 130, output: '', errorOutput: 'Operation aborted before execution.' };
    }
    const onAbort = (): void => {
      process.emit('SIGINT');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const captured = await captureCliOutput(async () => {
      try {
        return await runCliCommand(workspace, tokens);
      } catch (error) {
        printCliError(error);
        return getCliExitCode(error);
      }
    }, { onOutput, onErrorOutput });
    signal?.removeEventListener('abort', onAbort);
    const code = captured.result;
    await safeRecordCliOperationLog(workspace, {
      source: 'tui',
      argv: tokens,
      code,
      startedAt,
      commandLine,
      commandPath: tokens,
      targetType: 'system',
      metadata: {
        commandRoot: tokens[0],
        subcommand: tokens[1]
      }
    });
    return {
      code,
      output: captured.output.trimEnd(),
      errorOutput: captured.errorOutput.trimEnd()
    };
  }

  const argv = pluginId ? ['--plugin', pluginId, ...tokens] : tokens;
  if (signal?.aborted) {
    return { code: 130, output: '', errorOutput: 'Operation aborted before execution.' };
  }
  const onAbort = (): void => {
    process.emit('SIGINT');
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  const captured = await captureCliOutput(async () => {
    try {
      return await tryRunPluginCliCommand(workspace, argv, 'tui', commandLine);
    } catch (error) {
      printCliError(error);
      return {
        handled: true,
        code: getCliExitCode(error)
      };
    }
  }, { onOutput, onErrorOutput });
  signal?.removeEventListener('abort', onAbort);

  if (!captured.result.handled) {
    return {
      code: 3,
      output: JSON.stringify(
        {
          error: 'No plugin CLI command matches the requested command path',
          code: 'CLI_COMMAND_NOT_FOUND',
          details: { commandPath: tokens, pluginId },
          retryable: false
        },
        null,
        2
      ),
      errorOutput: captured.errorOutput.trimEnd()
    };
  }

  return {
    code: captured.result.code,
    output: captured.output.trimEnd(),
    errorOutput: captured.errorOutput.trimEnd()
  };
};

const runInteractiveCli = async (workspace: string, explicit = false): Promise<number> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    print({
      error: 'Chips TUI requires an interactive terminal.',
      hint: 'Run `chips help` for plain text commands, or run `chips` directly from a terminal.'
    });
    return explicit ? 1 : 0;
  }

  const commands = await withHost(workspace, async (runtime) => {
    const listed = await runtime.invoke<CliCommandListResponse>('cli.command.list', {});
    return listed.commands as InteractiveCliCommandView[];
  });

  return runInteractiveSession({
    commands,
    builtinCommands: BUILTIN_INTERACTIVE_COMMANDS,
    stdin: process.stdin,
    stdout: process.stdout,
    execute: async ({ tokens, pluginId, commandLine, signal, onOutput, onErrorOutput }) => {
      return runInteractiveCliCommand(workspace, tokens, pluginId, commandLine, signal, onOutput, onErrorOutput);
    }
  });
};

const print = (value: unknown): void => {
  if (typeof value === 'string') {
    process.stdout.write(value + '\n');
    return;
  }

  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
};

const isSuccessfulCliResult = (value: unknown): value is Record<string, unknown> => {
  return isRecord(value) && value.ok === true;
};

const formatCliTargetHuman = (target: unknown): string | undefined => {
  if (!isRecord(target) || typeof target.type !== 'string') {
    return undefined;
  }
  if (target.type === 'module') {
    const capability = typeof target.capability === 'string' ? target.capability : undefined;
    const method = typeof target.method === 'string' ? target.method : undefined;
    return ['module', capability, method].filter(Boolean).join(' ');
  }
  if (target.type === 'app') {
    const pluginId = typeof target.pluginId === 'string' ? target.pluginId : undefined;
    const commandId = typeof target.commandId === 'string' ? target.commandId : undefined;
    return ['app', pluginId, commandId].filter(Boolean).join(' ');
  }
  return target.type;
};

const collectCliArtifactValues = (result: Record<string, unknown>, command?: CliCommandView): string[] => {
  const artifactPaths = command?.declaration.output?.artifacts ?? [];
  const values: string[] = [];
  const readPath = (source: unknown, mapsTo: string): unknown => {
    const parts = mapsTo.split('.').filter((part) => part.length > 0);
    let cursor = source;
    for (const part of parts) {
      if (!isRecord(cursor)) {
        return undefined;
      }
      cursor = cursor[part];
    }
    return cursor;
  };
  for (const artifactPath of artifactPaths) {
    const value = readPath(result, artifactPath);
    if (typeof value === 'string') {
      values.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          values.push(item);
        }
      }
    }
  }
  return uniqueSorted(values);
};

const formatCliHumanResult = (value: unknown, command?: CliCommandView): string | undefined => {
  if (!isSuccessfulCliResult(value)) {
    return undefined;
  }
  const lines = ['完成'];
  const commandPath = typeof value.commandPath === 'string' ? value.commandPath : command?.commandPath.join(' ');
  if (commandPath) {
    lines.push(`命令: ${commandPath}`);
  }
  const target = formatCliTargetHuman(value.target);
  if (target) {
    lines.push(`目标: ${target}`);
  }
  if (value.skipped === true) {
    lines.push('结果: 已跳过');
  }
  if (isRecord(value.job) && typeof value.job.status === 'string') {
    lines.push(`任务: ${value.job.status}`);
  }
  if (isRecord(value.task) && typeof value.task.status === 'string') {
    lines.push(`任务: ${value.task.status}`);
  }
  const artifacts = collectCliArtifactValues(value, command);
  if (artifacts.length > 0) {
    lines.push('产物:');
    for (const artifact of artifacts) {
      lines.push(`- ${artifact}`);
    }
  }
  if (typeof value.output !== 'undefined' && artifacts.length === 0) {
    lines.push('输出:');
    lines.push(typeof value.output === 'string' ? value.output : JSON.stringify(value.output, null, 2));
  }
  return lines.join('\n');
};

const printCliResult = (value: unknown, context: CliOutputContext = {}): void => {
  if (context.json || context.command?.declaration.output?.mode !== 'human') {
    print(value);
    return;
  }
  print(formatCliHumanResult(value, context.command) ?? value);
};

const printCliError = (error: unknown): void => {
  const standard = toStandardError(error, 'CLI_COMMAND_FAILED');
  print({
    error: standard.message,
    code: standard.code,
    details: standard.details,
    retryable: standard.retryable
  });
};

const withHost = async <T>(workspace: string, run: (runtime: RuntimeClient) => Promise<T>): Promise<T> => {
  const app = new HostApplication({ workspacePath: workspace });
  await app.start();
  const bridge = app.createBridge();
  const runtime = new RuntimeClient(bridge);
  try {
    return await run(runtime);
  } finally {
    await app.stop();
  }
};

const parseArgs = (argv: string[]): { command: string; subcommand?: string; args: string[] } => {
  const [command = 'help', subcommand, ...args] = argv;
  return { command, subcommand, args };
};

const shouldRecordTopLevelCliOperation = (argv: string[], code: number): boolean => {
  const root = argv[0];
  if (root === '__complete') {
    return false;
  }
  if (!root || root === '--interactive' || root === 'host') {
    return true;
  }
  return FIXED_COMMANDS.has(root) || code !== 0;
};

const shouldRecordTopLevelCliErrorOperation = (argv: string[], code: number, error: unknown): boolean => {
  if (isPluginCliOperationLogged(error)) {
    return false;
  }
  return shouldRecordTopLevelCliOperation(argv, code);
};

const runCliCommand = async (workspace: string, argv: string[]): Promise<number> => {
  await ensureWorkspace(workspace);

    if (argv.length === 0) {
      return runInteractiveCli(workspace);
    }
    if (argv.length === 1 && argv[0] === '--interactive') {
      return runInteractiveCli(workspace, true);
    }

    const { command, subcommand, args } = parseArgs(argv);

    if (command === '__complete') {
      const startedAt = Date.now();
      try {
        const candidates = await resolveCompletionCandidates(workspace, argv.slice(1));
        process.stdout.write(candidates.join('\n'));
        if (candidates.length > 0) {
          process.stdout.write('\n');
        }
        await safeRecordCliOperationLog(workspace, {
          source: 'completion',
          argv,
          code: 0,
          startedAt,
          metadata: {
            candidates: candidates.length
          }
        });
      } catch {
        process.stdout.write('');
      }
      return 0;
    }

    if (command === 'host') {
      print({
        error: 'chips 不再使用 host 二级指令。',
        hint: '请直接使用 `chips help`、`chips start`、`chips plugin install <path>` 等命令。'
      });
      return 1;
    }

    if (command === 'help') {
      print('chips [--interactive] <start|stop|status|config|logs|plugin|theme|update|doctor|open|completion|--plugin <pluginId> <plugin command>>');
      return 0;
    }

    if (command === 'completion') {
      const shell = subcommand as CompletionShell | undefined;
      const commandName = args[0] as CompletionCommandName | undefined;
      if (!shell || !COMPLETION_SHELLS.has(shell)) {
        print({
          error: 'completion requires shell name',
          supported: [...COMPLETION_SHELLS]
        });
        return 2;
      }
      if (commandName && !COMPLETION_COMMANDS.has(commandName)) {
        print({
          error: 'completion command name must be chips, chipsdev-r or chipsdev-r',
          supported: [...COMPLETION_COMMANDS]
        });
        return 2;
      }
      process.stdout.write(renderCompletionScript(shell, commandName ?? 'chips'));
      return 0;
    }

    if (command === 'start') {
      const state = {
        running: true,
        pid: process.pid,
        startedAt: new Date().toISOString()
      };
      await writeJson(stateFile(workspace), state);
      print(state);
      return 0;
    }

    if (command === 'stop') {
      await fs.rm(stateFile(workspace), { force: true });
      print({ running: false });
      return 0;
    }

    if (command === 'status') {
      const state = await readJson(stateFile(workspace), { running: false });
      print({
        workspace: getWorkspaceSummary(workspace),
        state
      });
      return 0;
    }

    if (command === 'config') {
      if (subcommand === 'list') {
        const config = await readJson(path.join(workspace, 'config.json'), {});
        print(config);
        return 0;
      }

      if (subcommand === 'set') {
        const [key, value] = args;
        if (!key) {
          print({ error: 'config set requires key and value' });
          return 1;
        }

        await withHost(workspace, async (runtime) => {
          await runtime.invoke('config.set', { key, value });
        });
        print({ ok: true });
        return 0;
      }

      if (subcommand === 'reset') {
        const [key] = args;
        await withHost(workspace, async (runtime) => {
          await runtime.invoke('config.reset', { key });
        });
        print({ ok: true });
        return 0;
      }

      print({ error: 'unsupported config command' });
      return 1;
    }

    if (command === 'logs') {
      const exported = await withHost(workspace, async (runtime) => runtime.invoke('log.export', {}));
      print(exported);
      return 0;
    }

    if (command === 'theme') {
      if (subcommand === 'list') {
        const result = await withHost(workspace, async (runtime) => runtime.invoke('theme.list', {}));
        print(result);
        return 0;
      }

      if (subcommand === 'current') {
        const result = await withHost(workspace, async (runtime) => runtime.invoke('theme.getCurrent', {}));
        print(result);
        return 0;
      }

      if (subcommand === 'apply') {
        const [id] = args;
        if (!id) {
          print({ error: 'theme apply requires theme id' });
          return 1;
        }

        await withHost(workspace, async (runtime) => {
          await runtime.invoke('theme.apply', { id });
        });
        print({ ok: true });
        return 0;
      }

      if (subcommand === 'resolve') {
        const [id] = args;
        const result = await withHost(workspace, async (runtime) => {
          const chain = id ? [id] : [];
          return runtime.invoke('theme.resolve', { chain });
        });
        print(result);
        return 0;
      }

      if (subcommand === 'contract') {
        const [component] = args;
        const result = await withHost(workspace, async (runtime) => {
          return runtime.invoke('theme.contract.get', component ? { component } : {});
        });
        print(result);
        return 0;
      }

      if (subcommand === 'validate') {
        const summary = await withHost(workspace, async (runtime) => {
          const { themes } = await runtime.invoke<{
            themes: Array<{ id: string }>;
          }>('theme.list', {});

          const results: Array<{ id: string; ok: boolean; error?: unknown }> = [];

          for (const theme of themes) {
            try {
              await runtime.invoke('theme.apply', { id: theme.id });
              await runtime.invoke('theme.resolve', { chain: [theme.id] });
              results.push({ id: theme.id, ok: true });
            } catch (error) {
              results.push({
                id: theme.id,
                ok: false,
                error
              });
            }
          }

          return { themes: results };
        });

        print(summary);
        return 0;
      }

      print({ error: 'unsupported theme command' });
      return 1;
    }

    if (command === 'plugin') {
      const plugins = await readJson<Array<{ id: string; manifestPath: string; enabled: boolean }>>(pluginFile(workspace), []);

      if (subcommand === 'list') {
        const result = await withHost(workspace, async (runtime) => {
          return runtime.invoke<{ plugins: PluginRuntimeView[] }>('plugin.query', {});
        });
        print(result.plugins);
        return 0;
      }

      if (subcommand === 'install') {
        const [manifestPath] = args;
        if (!manifestPath) {
          print({ error: 'plugin install requires manifest path' });
          return 1;
        }

        const normalizedManifestPath = normalizePluginSourcePath(manifestPath);

        const result = await withHost(workspace, async (runtime) => {
          return runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: normalizedManifestPath });
        });

        const existing = plugins.find((plugin) => plugin.id === result.pluginId);
        if (existing) {
          existing.manifestPath = normalizedManifestPath;
        } else {
          plugins.push({ id: result.pluginId, manifestPath: normalizedManifestPath, enabled: false });
        }
        await writeJson(pluginFile(workspace), plugins);
        print(result);
        return 0;
      }

      if (subcommand === 'uninstall') {
        const [pluginId] = args;
        if (!pluginId) {
          print({ error: 'plugin uninstall requires plugin id' });
          return 1;
        }

        await withHost(workspace, async (runtime) => {
          await runtime.invoke('plugin.uninstall', { pluginId });
        });

        const next = plugins.filter((plugin) => plugin.id !== pluginId);
        await writeJson(pluginFile(workspace), next);
        print({ ok: true });
        return 0;
      }

      if (subcommand === 'enable') {
        const [pluginId] = args;
        if (!pluginId) {
          print({ error: 'plugin enable requires plugin id' });
          return 1;
        }
        await withHost(workspace, async (runtime) => {
          await runtime.invoke('plugin.enable', { pluginId });
        });
        const plugin = plugins.find((item) => item.id === pluginId);
        if (plugin) {
          plugin.enabled = true;
        }
        await writeJson(pluginFile(workspace), plugins);
        print({ ok: true });
        return 0;
      }

      if (subcommand === 'disable') {
        const [pluginId] = args;
        if (!pluginId) {
          print({ error: 'plugin disable requires plugin id' });
          return 1;
        }
        await withHost(workspace, async (runtime) => {
          await runtime.invoke('plugin.disable', { pluginId });
        });
        const plugin = plugins.find((item) => item.id === pluginId);
        if (plugin) {
          plugin.enabled = false;
        }
        await writeJson(pluginFile(workspace), plugins);
        print({ ok: true });
        return 0;
      }

      if (subcommand === 'query') {
        const [type, capability] = args;
        const result = await withHost(workspace, async (runtime) => {
          return runtime.invoke('plugin.query', { type, capability });
        });
        print(result);
        return 0;
      }

      print({ error: 'unsupported plugin command' });
      return 1;
    }

    if (command === 'update') {
      if (subcommand === 'check') {
        print({
          currentVersion: '0.1.0',
          latestVersion: '0.1.0',
          updateAvailable: false,
          provider: 'local',
          message: 'No external update provider is configured for this workspace.'
        });
        return 0;
      }

      if (subcommand === 'install') {
        print({
          installed: false,
          version: '0.1.0',
          provider: 'local',
          message: 'No external update provider is configured for this workspace.'
        });
        return 0;
      }

      print({ error: 'unsupported update command' });
      return 1;
    }

    if (command === 'doctor') {
      const checks = {
        workspaceExists: true,
        workspaceWritable: true,
        stateFileExists: await fs
          .access(stateFile(workspace))
          .then(() => true)
          .catch(() => false),
        pluginStoreExists: await fs
          .access(pluginFile(workspace))
          .then(() => true)
          .catch(() => false)
      };
      print({
        workspace: getWorkspaceSummary(workspace),
        checks
      });
      return 0;
    }

    if (command === 'open') {
      const targetPath = subcommand ?? args[0];
      if (!targetPath) {
        print({ error: 'open requires target file path' });
        return 1;
      }

      const result = await withHost(workspace, async (runtime) => openAssociatedFile(runtime, targetPath));
      print(result);
      return 0;
    }

    const pluginCommand = await tryRunPluginCliCommand(workspace, argv);
    if (pluginCommand.handled) {
      return pluginCommand.code;
    }

    print({ error: `unknown command: ${command}` });
    return 3;
};

export const runCli = async (argv: string[]): Promise<number> => {
  const workspace = getWorkspace();
  const startedAt = Date.now();
  try {
    const code = await runCliCommand(workspace, argv);
    if (shouldRecordTopLevelCliOperation(argv, code)) {
      await safeRecordCliOperationLog(workspace, {
        source: argv.length === 0 || argv[0] === '--interactive' ? 'tui' : 'cli',
        argv,
        code,
        startedAt,
        metadata: {
          commandRoot: argv[0] ?? 'interactive',
          subcommand: argv[1]
        }
      });
    }
    return code;
    } catch (error) {
      printCliError(error);
      const code = getCliExitCode(error);
      if (shouldRecordTopLevelCliErrorOperation(argv, code, error)) {
        await safeRecordCliOperationLog(workspace, {
          source: argv.length === 0 || argv[0] === '--interactive' ? 'tui' : 'cli',
          argv,
        code,
        startedAt,
        error,
        metadata: {
          commandRoot: argv[0] ?? 'interactive',
          subcommand: argv[1]
        }
      });
    }
    return code;
  }
};

if (require.main === module) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      printCliError(error);
      process.exitCode = 1;
    });
}
