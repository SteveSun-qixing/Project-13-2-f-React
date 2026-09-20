/**
 * 帧协议契约面与渲染错误码漂移锁单测。
 *
 * 权威：`05-渲染引擎设计` §9.2（封套与消息清单）、§9.3（约束）、§11（错误模型九码）。
 *
 * @remarks
 * - 文档漂移锁沿 `document-capability-contract.test.ts` 先例：读取文档库分册原文比对，
 *   任一侧漂移即红（`chips-frame/1`、§11 九码与 retryable 口径）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  FRAME_ACTION_TIMEOUT_MS,
  FRAME_DISPOSE_ACK_TIMEOUT_MS,
  FRAME_PROTOCOL,
  FRAME_READY_TIMEOUT_MS,
  createFrameEnvelope,
  createHandshakeTransfer,
  envelopeMatchesSession,
  asFrameAction,
  asFrameHeight,
  isFrameDisposeAck,
  isFrameEntryRequest,
  parseFrameEnvelope,
} from '../src/renderer/frame-protocol.js';
import {
  RENDER_ERROR_CODES,
  RENDER_ERROR_MESSAGES,
  RENDER_ERROR_RETRYABLE,
  createRenderError,
  isRenderErrorCode,
} from '../src/renderer/codes.js';
import { ChipsError } from '../src/preload/chips-error.js';

/** 读取文档库分册原文（不建立包依赖边，只读比对）。 */
function readDocSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

const DOC_05_11 = readDocSource('../../../../薯片生态文档库/01-架构设计/01-子系统设计/05.11-05-渲染引擎设计-十一、错误模型.md');
const DOC_05_09 = readDocSource('../../../../薯片生态文档库/01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md');

/** 一条 `frame:ready` 入站封套基线（host:* 为父帧出站方向，不在端口入站清单内）。 */
function readyEnvelope(sessionId = 'session-1', frameId = 'frame-1'): unknown {
  return createFrameEnvelope(sessionId, frameId, {
    type: 'frame:ready',
    payload: { capabilities: ['measure'] },
  });
}

describe('帧协议封套（05.09 §9.2）', () => {
  it('协议常量与文档分册逐字一致（漂移锁）', () => {
    expect(FRAME_PROTOCOL).toBe('chips-frame/1');
    expect(DOC_05_09).toContain(`const FRAME_PROTOCOL = '${FRAME_PROTOCOL}';`);
  });

  it('超时常量与 §9.5 表一致', () => {
    expect(FRAME_READY_TIMEOUT_MS).toBe(5_000);
    expect(FRAME_ACTION_TIMEOUT_MS).toBe(5_000);
    expect(FRAME_DISPOSE_ACK_TIMEOUT_MS).toBe(1_000);
  });

  it('封套携带协议号与会话登记', () => {
    const envelope = createFrameEnvelope('s', 'f', { type: 'frame:ready', payload: { capabilities: ['measure'] } });
    expect(envelope).toEqual({
      protocol: 'chips-frame/1',
      sessionId: 's',
      frameId: 'f',
      message: { type: 'frame:ready', payload: { capabilities: ['measure'] } },
    });
  });

  it('合法封套解析通过并保留消息', () => {
    const parsed = parseFrameEnvelope(readyEnvelope());
    expect(parsed).not.toBeNull();
    expect(parsed?.message.type).toBe('frame:ready');
    expect(envelopeMatchesSession(parsed as never, 'session-1', 'frame-1')).toBe(true);
    expect(envelopeMatchesSession(parsed as never, 'session-2', 'frame-1')).toBe(false);
    expect(envelopeMatchesSession(parsed as never, 'session-1', 'frame-2')).toBe(false);
  });

  it('协议号不符、封套缺字段、未知消息类型、载荷缺失均判不合法', () => {
    const wrongProtocol = readyEnvelope() as { protocol: string };
    wrongProtocol.protocol = 'chips-frame/2';
    expect(parseFrameEnvelope(wrongProtocol)).toBeNull();

    // 非 dispose-ack 消息的载荷缺失（null）判不合法。
    expect(
      parseFrameEnvelope({
        protocol: FRAME_PROTOCOL,
        sessionId: 's',
        frameId: 'f',
        message: { type: 'frame:ready', payload: null },
      })
    ).toBeNull();
    expect(parseFrameEnvelope(readyEnvelope('s1', 'f1'))).not.toBeNull();

    const unknownType = createFrameEnvelope('s', 'f', { type: 'frame:future', payload: {} } as never);
    expect(parseFrameEnvelope(unknownType)).toBeNull();

    const missingPayload = { protocol: FRAME_PROTOCOL, sessionId: 's', frameId: 'f', message: { type: 'frame:ready' } };
    expect(parseFrameEnvelope(missingPayload)).toBeNull();
  });

  it('frame:dispose-ack 允许 null 载荷（§9.2 消息清单）', () => {
    const ack = parseFrameEnvelope(
      createFrameEnvelope('session-1', 'frame-1', { type: 'frame:dispose-ack', payload: null })
    );
    expect(ack).not.toBeNull();
    expect(isFrameDisposeAck(ack?.message as never)).toBe(true);
  });

  it('握手转移消息携带一次性令牌', () => {
    const transfer = createHandshakeTransfer('s', 'f', 'token-1');
    expect(transfer).toEqual({ protocol: 'chips-frame/1', type: 'host:handshake', sessionId: 's', frameId: 'f', token: 'token-1' });
  });

  it('高度与动作载荷提取按形状收口', () => {
    const heightEnvelope = parseFrameEnvelope(
      createFrameEnvelope('s', 'f', { type: 'frame:height', payload: { height: 320, epoch: 2 } })
    );
    expect(asFrameHeight(heightEnvelope?.message as never)).toEqual({ height: 320, epoch: 2 });

    const badHeight = parseFrameEnvelope(
      createFrameEnvelope('s', 'f', { type: 'frame:height', payload: { height: '320', epoch: 2 } })
    );
    expect(asFrameHeight(badHeight?.message as never)).toBeNull();

    const actionEnvelope = parseFrameEnvelope(
      createFrameEnvelope('s', 'f', {
        type: 'frame:action',
        payload: { requestId: 'req-1', action: { kind: 'copy-text', text: '文本' } },
      })
    );
    expect(asFrameAction(actionEnvelope?.message as never)?.requestId).toBe('req-1');
    expect(isFrameEntryRequest({ type: 'frame:entry-request', payload: {} } as never)).toBe(true);
  });
});

describe('渲染错误码（05.11 §十一，漂移锁）', () => {
  it('九码与文档分册逐码一致（漂移锁）', () => {
    const documentedCodes = [...DOC_05_11.matchAll(/`(RENDER_[A-Z_]+)`/g)].map((match) => match[1] ?? '');
    expect(documentedCodes.length).toBeGreaterThanOrEqual(9);
    expect(new Set(documentedCodes)).toEqual(new Set(Object.values(RENDER_ERROR_CODES)));
  });

  it('retryable 口径与 §11 表格逐行一致（漂移锁）', () => {
    const table = new Map<string, boolean>();
    for (const match of DOC_05_11.matchAll(/^\|\s*`(RENDER_[A-Z_]+)`\s*\|[^|]*\|\s*([^|]*?)\s*\|/gm)) {
      table.set(match[1] ?? '', (match[2] ?? '').trim() === '是');
    }
    expect(table.size).toBe(9);
    for (const [code, retryable] of table) {
      expect(RENDER_ERROR_RETRYABLE[code as keyof typeof RENDER_ERROR_RETRYABLE]).toBe(retryable);
    }
  });

  it('每码都有非空简体中文文案', () => {
    for (const code of Object.values(RENDER_ERROR_CODES)) {
      expect(RENDER_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      expect(isRenderErrorCode(code)).toBe(true);
    }
    expect(isRenderErrorCode('NOT_A_RENDER_CODE')).toBe(false);
  });

  it('createRenderError 产出携带登记码与 retryable 的 ChipsError', () => {
    const retryableError = createRenderError({ code: 'RENDER_FRAME_TIMEOUT' });
    expect(retryableError).toBeInstanceOf(ChipsError);
    expect(retryableError.retryable).toBe(true);

    const fatal = createRenderError({ code: 'RENDER_PROTOCOL_VIOLATION', details: { reason: 'x' } });
    expect(fatal.retryable).toBe(false);
    expect(fatal.details).toEqual({ reason: 'x' });
  });
});
