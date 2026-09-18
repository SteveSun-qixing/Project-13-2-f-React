#!/usr/bin/env node
/**
 * 测试夹具：xlsx-sidecar 协议模拟进程。
 *
 * 实现 JSON 行协议的应答语义（version/requestId/ok/result），用于在不含真实
 * Rust 二进制的环境下测试服务的协议层：read_entries 落盘、save_archive 内容
 * 校验、错误映射、退出清理。内存会话仅记录 open 时路径并返回固定会话号。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

const sessions = new Map();

const ok = (requestId, result) => JSON.stringify({ version: 1, requestId, ok: true, result });
const fail = (requestId, code, message) => JSON.stringify({ version: 1, requestId, ok: false, error: { code, message } });

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    process.stdout.write(`${JSON.stringify({ version: 1, requestId: '', ok: false, error: { code: 'invalid_json', message: 'bad json' } })}\n`);
    return;
  }
  const { requestId, command } = request;
  void (async () => {
    try {
      if (command === 'open') {
        const sessionId = 'sess-mock-1';
        sessions.set(sessionId, { path: request.path });
        process.stdout.write(`${ok(requestId, { sessionId, name: path.basename(request.path), sheets: [{ id: 'sheet-1', name: 'Sheet1' }] })}\n`);
        return;
      }
      if (command === 'read_range') {
        sessions.get(request.sessionId) ?? sessions.set(request.sessionId, { path: '' });
        process.stdout.write(`${ok(requestId, { cells: [{ row: 0, column: 0, value: 'mock' }] })}\n`);
        return;
      }
      if (command === 'close') {
        sessions.delete(request.sessionId);
        process.stdout.write(`${ok(requestId, { ack: true })}\n`);
        return;
      }
      if (command === 'read_media') {
        process.stdout.write(`${ok(requestId, { mediaType: 'image/png', base64: Buffer.from('png').toString('base64') })}\n`);
        return;
      }
      if (command === 'read_entries') {
        for (const name of request.entries ?? []) {
          const target = path.join(request.outputDir, name);
          await fsp.mkdir(path.dirname(target), { recursive: true });
          await fsp.writeFile(target, `content-of-${name}`);
        }
        process.stdout.write(`${ok(requestId, { entries: (request.entries ?? []).map((name) => ({ name })) })}\n`);
        return;
      }
      if (command === 'save_archive') {
        const details = [];
        for (const entry of request.replacements ?? []) {
          details.push({ kind: 'replace', name: entry.name, bytes: fs.statSync(entry.contentPath).size });
        }
        for (const entry of request.additions ?? []) {
          details.push({ kind: 'add', name: entry.name, bytes: fs.statSync(entry.contentPath).size });
        }
        fs.copyFileSync(request.sourcePath, request.targetPath);
        process.stdout.write(`${ok(requestId, { touched: details, beforeEntries: [], afterEntries: [] })}\n`);
        return;
      }
      if (command === 'convert_workbook') {
        fs.copyFileSync(request.path, request.targetPath);
        process.stdout.write(`${ok(requestId, { converted: true })}\n`);
        return;
      }
      if (command === 'fail') {
        process.stdout.write(`${fail(requestId, 'SESSION_NOT_FOUND', 'session not found')}\n`);
        return;
      }
      if (command === 'hang') {
        return; // 不应答，触发服务端超时
      }
      process.stdout.write(`${fail(requestId, 'unsupported_command', `unknown command ${String(command)}`)}\n`);
    } catch (error) {
      process.stdout.write(`${fail(requestId, 'mock_failure', String(error))}\n`);
    }
  })();
});
