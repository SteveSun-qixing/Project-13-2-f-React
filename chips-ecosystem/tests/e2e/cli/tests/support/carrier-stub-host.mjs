#!/usr/bin/env node
/**
 * 承载协议独立桩宿主（工单039 波 3 e2e 测试资产，任务 #166）。
 *
 * 定位：《17-CLI承载链路契约》的**契约独立实现者**（波 0 纪律同态）——零依赖、零 import
 * `@chips/*`，仅按契约文档字段级条款独立实现：NDJSON 帧分界、首帧握手
 * （`chips-cli-carrier/1`）、Bridge 封套（`requestId`/`capabilityId`/`input` ↔
 * `requestId`/`ok`/`result|error`）、发现文件（§2.4 六字段、0600/0700）、写入方清理权
 * （§2.5-5：SIGTERM 删发现文件与 socket；SIGKILL 残留供陈旧臂消费）、`reason` 词表收口。
 *
 * 用途：真 `chips` bin 与真 UDS/管道端点之间的受控对端，覆盖 §5.1 在册路由面的
 * `cli.command.list` / `cli.task.*` / `command:invoke`，并把逐帧轨迹写入 JSONL 帧日志
 * （bearer token 永不落日志，§2.8）。
 *
 * 用法：node carrier-stub-host.mjs --root <userDataDir> [--socket <path>]
 *   [--token <hex>] [--instance <id>] [--commands <file.json>] [--log <frames.jsonl>]
 *   [--host-version <s>] [--expect-token <hex>]
 *
 * `--expect-token` 与发现文件 token 故意不一致时构造 `token_invalid` 握手场景；
 * `--commands` 文件形如 { "index": {...}, "commands": [ICliCommandView...] }。
 */

import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROTOCOL = 'chips-cli-carrier/1';
const DISCOVERY_FILE_NAME = 'chips-carrier.json';
const REASONS = {
  protocolMismatch: 'protocol_mismatch',
  tokenInvalid: 'token_invalid',
  routeUnregistered: 'route_unregistered',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      out[token.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const root = args.root;
if (typeof root !== 'string' || root.length === 0) {
  process.stderr.write('缺少 --root <userDataDir>\n');
  process.exit(1);
}
const socketPath =
  typeof args.socket === 'string' ? args.socket : path.join(root, 'chips-carrier.sock');
const discoveryFile = path.join(root, DISCOVERY_FILE_NAME);
const instanceId = args.instance ?? `stub-${crypto.randomBytes(4).toString('hex')}`;
const hostVersion = args['host-version'] ?? '0.0.0-stub';
const discoveryToken = args.token ?? crypto.randomBytes(32).toString('hex');
const expectedToken = args['expect-token'] ?? discoveryToken;
const frameLogFile = args.log;
const commandsFile = args.commands;

let scenario = { index: {}, commands: [] };
if (typeof commandsFile === 'string') {
  scenario = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
}

fs.mkdirSync(root, { recursive: true, mode: 0o700 });

/** 帧日志（token 脱敏，《17》§2.8）。 */
function logFrame(direction, frame) {
  if (typeof frameLogFile !== 'string') {
    return;
  }
  const entry = { direction, at: Date.now(), frame: redact(frame) };
  fs.appendFileSync(frameLogFile, `${JSON.stringify(entry)}\n`);
}

function redact(frame) {
  if (frame !== null && typeof frame === 'object' && 'bearerToken' in frame) {
    const { bearerToken, ...rest } = frame;
    return { ...rest, bearerTokenPresent: typeof bearerToken === 'string' };
  }
  return frame;
}

/** 任务存储镜像（07.12 §5.8 记录形状）。 */
const tasks = new Map();
let taskSeq = 0;

function nowMs() {
  return Date.now();
}

function dispatch(capabilityId, input) {
  if (capabilityId === 'cli.command.list') {
    return { ok: true, result: { index: scenario.index ?? {}, commands: scenario.commands ?? [] } };
  }
  if (capabilityId === 'cli.task.create') {
    taskSeq += 1;
    const task = {
      taskId: `task-${String(taskSeq).padStart(4, '0')}`,
      pluginId: input.pluginId,
      commandId: input.commandId,
      status: 'running',
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };
    if (Array.isArray(input.commandPath)) {
      task.commandPath = input.commandPath;
    }
    tasks.set(task.taskId, task);
    return { ok: true, result: { task } };
  }
  if (capabilityId === 'cli.task.bindInvocation') {
    const task = tasks.get(input.taskId);
    if (task === undefined) {
      return notFound(input.taskId);
    }
    const bound = { ...task, updatedAt: nowMs() };
    if (typeof input.invocationId === 'string') {
      bound.invocationId = input.invocationId;
    }
    if (typeof input.sessionId === 'string') {
      bound.sessionId = input.sessionId;
    }
    tasks.set(task.taskId, bound);
    return { ok: true, result: { task: bound } };
  }
  if (capabilityId === 'cli.task.get') {
    const query = input ?? {};
    if (typeof query.taskId === 'string') {
      const task = tasks.get(query.taskId);
      return task === undefined ? notFound(query.taskId) : { ok: true, result: { task } };
    }
    if (typeof query.commandId === 'string' && query.activeOnly === true) {
      let found;
      for (const task of tasks.values()) {
        if (task.commandId === query.commandId && task.status === 'running') {
          found = task;
        }
      }
      return { ok: true, result: found === undefined ? {} : { task: found } };
    }
    return { ok: false, error: wireError('CLI_TASK_INVALID', '任务查询无效') };
  }
  if (capabilityId === 'cli.task.progress') {
    const task = tasks.get(input.taskId);
    if (task === undefined) {
      return notFound(input.taskId);
    }
    const updated = { ...task, progress: input.progress ?? {}, updatedAt: nowMs() };
    tasks.set(task.taskId, updated);
    return { ok: true, result: { task: updated } };
  }
  const terminal = {
    'cli.task.complete': 'completed',
    'cli.task.fail': 'failed',
    'cli.task.cancel': 'cancelled',
  }[capabilityId];
  if (terminal !== undefined) {
    const task = tasks.get(input.taskId);
    if (task === undefined) {
      return notFound(input.taskId);
    }
    const settled = { ...task, status: terminal, updatedAt: nowMs() };
    if (terminal === 'completed') {
      settled.output = input.output;
    }
    if (terminal === 'failed') {
      settled.error = normalizeError(input.error);
    }
    tasks.set(task.taskId, settled);
    return { ok: true, result: { task: settled } };
  }
  if (capabilityId === 'command:invoke') {
    return {
      ok: true,
      result: {
        invocationId: `inv-${crypto.randomBytes(4).toString('hex')}`,
        commandId: input?.commandId ?? 'unknown',
        target: 'main',
        status: 'completed',
      },
    };
  }
  return {
    ok: false,
    error: {
      ...wireError('CLI_TARGET_UNAVAILABLE', `路由未在册：${String(capabilityId)}`),
      details: { reason: REASONS.routeUnregistered },
    },
  };
}

function wireError(code, message) {
  return { code, message, retryable: false };
}

function normalizeError(value) {
  if (value !== null && typeof value === 'object' && typeof value.code === 'string') {
    return value;
  }
  return { code: 'CLI_TASK_FAILED', message: '应用侧任务失败', details: { reported: value } };
}

function notFound(taskId) {
  return { ok: false, error: wireError('CLI_TASK_NOT_FOUND', `任务不存在：${taskId}`) };
}

/** 单连接会话：首帧握手 → 串行封套请求（§3.6 一次连接一个会话）。 */
function handleConnection(socket) {
  let buffer = '';
  let handshakeDone = false;
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length > 0) {
        handleLine(socket, line);
      }
      newline = buffer.indexOf('\n');
    }
  });
  socket.on('error', () => undefined);

  function handleLine(s, line) {
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      s.end(
        `${JSON.stringify({ requestId: '', ok: false, error: wireError('BRIDGE_PROTOCOL_ERROR', '帧非法') })}\n`
      );
      return;
    }
    if (!handshakeDone) {
      respondHandshake(s, frame);
      return;
    }
    logFrame('in', frame);
    const outcome = dispatch(frame.capabilityId, frame.input ?? {});
    const response =
      outcome.ok === true
        ? { requestId: frame.requestId, ok: true, result: outcome.result }
        : { requestId: frame.requestId, ok: false, error: outcome.error };
    logFrame('out', response);
    s.write(`${JSON.stringify(response)}\n`);
  }

  function respondHandshake(s, frame) {
    logFrame('in', frame);
    if (frame?.protocol !== PROTOCOL) {
      const failure = {
        protocol: typeof frame?.protocol === 'string' ? frame.protocol : PROTOCOL,
        negotiated: null,
        error: {
          ...wireError('CLI_TARGET_UNAVAILABLE', '承载协议字面量不匹配'),
          details: { reason: REASONS.protocolMismatch },
        },
      };
      logFrame('out', failure);
      s.end(`${JSON.stringify(failure)}\n`);
      return;
    }
    if (frame.bearerToken !== expectedToken) {
      const failure = {
        protocol: PROTOCOL,
        negotiated: null,
        error: {
          ...wireError('CLI_TARGET_UNAVAILABLE', 'bearer token 校验失败'),
          details: { reason: REASONS.tokenInvalid },
        },
      };
      logFrame('out', failure);
      s.end(`${JSON.stringify(failure)}\n`);
      return;
    }
    handshakeDone = true;
    const success = { protocol: PROTOCOL, negotiated: PROTOCOL, hostVersion, instanceId };
    logFrame('out', success);
    s.write(`${JSON.stringify(success)}\n`);
  }
}

const server = net.createServer(handleConnection);
server.on('error', (error) => {
  process.stderr.write(`stub 端点监听失败：${error.message}\n`);
  cleanup();
  process.exit(1);
});

function writeDiscovery() {
  const record = {
    protocol: PROTOCOL,
    instanceId,
    socketPath,
    pid: process.pid,
    startedAt: nowMs(),
    bearerToken: discoveryToken,
  };
  fs.writeFileSync(discoveryFile, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
}

function cleanup() {
  try {
    fs.rmSync(discoveryFile, { force: true });
  } catch {
    /* 清理尽力而为 */
  }
  if (!socketPath.startsWith('\\\\.\\pipe\\')) {
    try {
      fs.rmSync(socketPath, { force: true });
    } catch {
      /* 同上 */
    }
  }
}

server.listen(socketPath, () => {
  writeDiscovery();
  process.stdout.write(
    `${JSON.stringify({ ready: true, pid: process.pid, instanceId, socketPath })}\n`
  );
});

/** §2.5-5 清理权只属写入方：SIGTERM/SIGINT 优雅收口；SIGKILL 残留供陈旧判据臂。 */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    cleanup();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
process.on('disconnect', () => undefined);
