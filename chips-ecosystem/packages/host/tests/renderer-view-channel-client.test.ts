/**
 * 金链路刀5 段B：宿主内部取视图通道·渲染进程侧消费臂单测（Node 环境，注入传输替身）。
 *
 * 权威：`src/renderer/document-view-channel.ts`（任务 #105 冻结契约件——封套、两侧闸与
 * 在册错误面唯一权威）、`05-渲染引擎设计` §2.3/§2.6（渲染侧经取视图通道消费视图）、
 * 工单035 裁定一（宿主内部 IPC、非插件能力）、工单024（`ChipsError` 唯一类）。
 *
 * @remarks
 * - 逐臂逐码断言：出站封套逐字段锁定（通道名钉定、requestId 铸造与回交）、发送侧自检
 *   全非法面零触达 IPC、成功臂守门重建（非同引用）、失败臂 13 在册码逐码透传、面外码
 *   归一（`details.cause` 承载原码）、词法违规码不留细节、回包契约违约逐面
 *   `BRIDGE_INTERNAL`、关联标识失配防线、传输层异常归一（裸异常/`AbortError`/同构对象）。
 * - 零 skip、零放宽：全部用例真实断言抛出类型、码、闸位与调用次数。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '@chips/bridge';

import {
  DOCUMENT_VIEW_CHANNEL_ERROR_CODES,
  DOCUMENT_VIEW_PROTOCOL,
  DOCUMENT_VIEW_REQUEST_CHANNEL,
} from '../src/renderer/document-view-channel.js';
import type { IDocumentViewChannelInput } from '../src/renderer/document-view-channel.js';
import { createDocumentViewChannelBuilder } from '../src/renderer/document-view-channel-client.js';
import type { IDocumentViewChannelInvoke } from '../src/renderer/document-view-channel-client.js';
import { CARD_ID, NODE_ID_ONE } from './helpers/document-fake-ports.js';

const SOURCE = 'chips-resource://workspace-a/我的卡片.card';

/* ------------------------------------------------------------------ *
 * 夹具
 * ------------------------------------------------------------------ */

/** 合法输入基线（`documentId` 十位 Base62 在册夹具）。 */
function validInput(): IDocumentViewChannelInput {
  return { source: SOURCE, documentId: CARD_ID, kind: 'card' };
}

/** §6.6 CardRenderView 冻结形状基线（回包成功臂载荷）。 */
function wireView(revision = 3): Record<string, unknown> {
  return {
    kind: 'card',
    revision,
    card_id: CARD_ID,
    name: '示例卡片',
    chip_standards_version: '1.0',
    cover_ratio: '4:3',
    tags: ['旅行', ['组', '标签']],
    cover: { entry: 'chips-resource://workspace-a/cover/a.png', ratio: '4:3' },
    content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'basic.note', content: { text: '你好，薯片' } }],
  };
}

/** 成功回包封套。 */
function resultEnvelope(requestId: string, view: unknown = wireView()): Record<string, unknown> {
  return { protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:result', requestId, view };
}

/** 失败回包封套（`error` 为 `IChipsError` 普通对象形态）。 */
function failureEnvelope(requestId: string, code: string, message = '通道回包失败臂'): Record<string, unknown> {
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: 'document-view:error',
    requestId,
    error: { code, message, retryable: false },
  };
}

/** 传输替身：按脚本逐次交付响应或拒绝，并记录出站调用。 */
interface InvokeRecorder {
  readonly invoke: IDocumentViewChannelInvoke;
  readonly calls: Array<{ channel: string; payload: unknown }>;
}

function createInvoke(
  script: Array<(payload: unknown) => unknown>
): InvokeRecorder {
  const calls: Array<{ channel: string; payload: unknown }> = [];
  let index = 0;
  return {
    calls,
    invoke: {
      invoke(channel: string, payload: unknown): Promise<unknown> {
        calls.push({ channel, payload });
        const step = script[index] ?? script[script.length - 1];
        index += 1;
        if (step === undefined) {
          return Promise.reject(new Error('测试脚本未配置该次调用'));
        }
        return Promise.resolve(step(payload));
      },
    },
  };
}

/** 请求封套取 `requestId`（回包关联用）。 */
function requestIdOf(payload: unknown): string {
  const record = payload as { requestId: unknown };
  if (typeof record.requestId !== 'string') {
    throw new Error('测试夹具：出站封套缺 requestId');
  }
  return record.requestId;
}

/** 断言 `ChipsError` 拒绝并回传实例（逐码/逐闸位细断言由各用例补充）。 */
async function expectChannelRejection(
  run: () => Promise<unknown>,
  code: string
): Promise<ChipsError> {
  const error = await run().then(
    () => null,
    (rejection: unknown) => rejection
  );
  expect(error).toBeInstanceOf(ChipsError);
  const chipsError = error as ChipsError;
  expect(chipsError.code).toBe(code);
  return chipsError;
}

/* ------------------------------------------------------------------ *
 * A 组：出站封套与发送侧自检
 * ------------------------------------------------------------------ */

describe('取视图通道消费臂·出站封套', () => {
  it('合法输入：通道名钉定契约常量，出站封套逐字段符合 #105 请求契约', async () => {
    const recorder = createInvoke([(payload) => resultEnvelope(requestIdOf(payload))]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await builder.buildView(validInput());
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]?.channel).toBe(DOCUMENT_VIEW_REQUEST_CHANNEL);
    const outbound = recorder.calls[0]?.payload;
    // requestId 以出站实际值回填：键集合必须恰为契约四键（多一键即 toEqual 失败）；
    // requestId 缺失或非字符串时 requestIdOf 直接抛掷致案失败。
    expect(outbound).toEqual({
      protocol: 'chips-document-view/1',
      type: 'document-view:build',
      requestId: requestIdOf(outbound),
      input: { source: SOURCE, documentId: CARD_ID, kind: 'card' },
    });
  });

  it('requestId 经注入铸造口逐调用取用并随封套出站', async () => {
    let counter = 0;
    const recorder = createInvoke([
      (payload) => resultEnvelope(requestIdOf(payload)),
      (payload) => resultEnvelope(requestIdOf(payload)),
    ]);
    const builder = createDocumentViewChannelBuilder({
      invoke: recorder.invoke,
      createRequestId: () => `dv-${String(++counter)}`,
    });
    await builder.buildView(validInput());
    await builder.buildView(validInput());
    expect((recorder.calls[0]?.payload as { requestId: string }).requestId).toBe('dv-1');
    expect((recorder.calls[1]?.payload as { requestId: string }).requestId).toBe('dv-2');
  });

  it('缺省铸造口产出非空唯一关联标识', async () => {
    const recorder = createInvoke([
      (payload) => resultEnvelope(requestIdOf(payload)),
      (payload) => resultEnvelope(requestIdOf(payload)),
    ]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await builder.buildView(validInput());
    await builder.buildView(validInput());
    const first = (recorder.calls[0]?.payload as { requestId: string }).requestId;
    const second = (recorder.calls[1]?.payload as { requestId: string }).requestId;
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });

  it('铸造口产出空串：发送侧自检拒绝，零触达 IPC', async () => {
    const recorder = createInvoke([]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke, createRequestId: () => '' });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INVALID_INPUT');
    expect(recorder.calls).toHaveLength(0);
  });

  const illegalInputs: ReadonlyArray<[string, unknown]> = [
    ['来源空串', { ...validInput(), source: '' }],
    ['来源非字符串', { ...validInput(), source: 42 }],
    ['documentId 九位', { ...validInput(), documentId: 'Ab3dEf6Gh' }],
    ['documentId 十一位', { ...validInput(), documentId: `${CARD_ID}x` }],
    ['documentId 连字符替身', { ...validInput(), documentId: 'card-7f3a' }],
    ['kind 不在判别联合', { ...validInput(), kind: 'note' }],
    ['kind 缺席', { source: SOURCE, documentId: CARD_ID }],
    ['input 多余键', { ...validInput(), extra: true }],
  ];

  it.each(illegalInputs)('发送侧自检·%s：BRIDGE_INVALID_INPUT 拒绝且零触达 IPC', async (_label, input) => {
    const recorder = createInvoke([]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const error = await expectChannelRejection(
      () => builder.buildView(input as IDocumentViewChannelInput),
      'BRIDGE_INVALID_INPUT'
    );
    expect(error.details).toSatisfy(
      (details: unknown) =>
        typeof details === 'object' &&
        details !== null &&
        (details as { gate: unknown }).gate === 'request'
    );
    expect(recorder.calls).toHaveLength(0);
  });

  it('box 请求形状合法（契约不提前承载拒绝）：照常出站，拒绝语义由主进程回包臂透传', async () => {
    const recorder = createInvoke([(payload) => failureEnvelope(requestIdOf(payload), 'BRIDGE_INVALID_INPUT', '当前交付面仅支持卡片视图')]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(
      () => builder.buildView({ ...validInput(), kind: 'box' }),
      'BRIDGE_INVALID_INPUT'
    );
    expect(recorder.calls).toHaveLength(1);
    expect((recorder.calls[0]?.payload as { input: { kind: string } }).input.kind).toBe('box');
  });
});

/* ------------------------------------------------------------------ *
 * B 组：成功臂与到达侧防线
 * ------------------------------------------------------------------ */

describe('取视图通道消费臂·成功臂', () => {
  it('回包视图守门重建后交付（等值非同引用，§6.6 冻结投影）', async () => {
    const view = wireView();
    const recorder = createInvoke([(payload) => resultEnvelope(requestIdOf(payload), view)]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const built = await builder.buildView(validInput());
    expect(built).toEqual(view as never);
    expect(built).not.toBe(view);
    expect(built.kind).toBe('card');
    expect(built.revision).toBe(3);
  });

  it('requestId 关联失配：回包契约违约 BRIDGE_INTERNAL', async () => {
    const recorder = createInvoke([() => resultEnvelope('dv-其他请求')]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const error = await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
    expect(error.details).toEqual({ gate: 'response', reason: 'request_id_mismatch' });
  });

  const brokenResponses: ReadonlyArray<[string, unknown]> = [
    ['回包非对象', 'text'],
    ['回包为数组', []],
    ['协议版本不符', { ...resultEnvelope('r'), protocol: 'chips-document-view/2' }],
    ['类型不是响应臂', { ...resultEnvelope('r'), type: 'document-view:build' }],
    ['requestId 空串', resultEnvelope('')],
    ['成功臂多余键', { ...resultEnvelope('r'), extra: 1 }],
    ['视图缺失字段', { ...wireView(), name: undefined }],
    ['视图 kind 非 card', { ...wireView(), kind: 'box' }],
    ['视图 revision 负数', { ...wireView(), revision: -1 }],
  ];

  it.each(brokenResponses)('回包契约违约·%s：BRIDGE_INTERNAL（响应闸在册口径）', async (_label, raw) => {
    const recorder = createInvoke([() => raw]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });

  it('视图 content 含函数成员：可结构化克隆深校验拒绝', async () => {
    const recorder = createInvoke([() => resultEnvelope('r1', {
      ...wireView(),
      content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'basic.note', content: { fn: (): number => 1 } }],
    })]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });

  it('视图含循环引用：可结构化克隆深校验拒绝', async () => {
    const cyclic = wireView();
    (cyclic['content_nodes'] as unknown[])[0] = {
      node_id: NODE_ID_ONE,
      card_type: 'basic.note',
      content: { self: cyclic },
    };
    const recorder = createInvoke([() => resultEnvelope('r1', cyclic)]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });
});

/* ------------------------------------------------------------------ *
 * C 组：失败臂逐码与错误面归一
 * ------------------------------------------------------------------ */

describe('取视图通道消费臂·失败臂错误面', () => {
  const channelCodes: readonly string[] = Object.values(DOCUMENT_VIEW_CHANNEL_ERROR_CODES);

  it('在册错误面恰为 13 码（消费臂逐码透传的断言全集）', () => {
    expect(channelCodes).toHaveLength(13);
  });

  it.each(channelCodes)('失败臂在册码 %s：唯一类实例原码透传（不发明映射）', async (code) => {
    const recorder = createInvoke([(payload) => failureEnvelope(requestIdOf(payload), code)]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const error = await expectChannelRejection(() => builder.buildView(validInput()), code);
    expect(error.message).toBe('通道回包失败臂');
  });

  const outsideCodes: ReadonlyArray<[string, string]> = [
    ['保存域面外码（本链路构造性不可达）', 'DOCUMENT_SAVE_FAILED'],
    ['写入租约面外码', 'DOCUMENT_WRITE_CONFLICT'],
    ['资源域登记码', 'RESOURCE_CROSS_SCOPE'],
    ['渲染域登记码', 'RENDER_UPDATE_FAILED'],
    ['Bridge 面外码', 'BRIDGE_PERMISSION_DENIED'],
  ];

  it.each(outsideCodes)('面外码归一·%s：BRIDGE_INTERNAL + details.cause 承载原码', async (_label, code) => {
    const recorder = createInvoke([(payload) => failureEnvelope(requestIdOf(payload), code)]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const error = await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
    expect(error.details).toSatisfy(
      (details: unknown) =>
        typeof details === 'object' && details !== null && (details as { cause: unknown }).cause === code
    );
  });

  it('词法违规码：BRIDGE_INTERNAL 且不承载 details 原码（不采信不可信字符串）', async () => {
    const recorder = createInvoke([(payload) => failureEnvelope(requestIdOf(payload), 'oops-lowercase')]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    const error = await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
    expect(error.details).toSatisfy(
      (details: unknown) =>
        !(typeof details === 'object' && details !== null && 'cause' in (details as Record<string, unknown>))
    );
  });

  it('error 载荷非 IChipsError 同构形状（缺 code）：回包契约违约 BRIDGE_INTERNAL', async () => {
    const recorder = createInvoke([
      () => ({ protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:error', requestId: 'r', error: { message: '没有码' } }),
    ]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });
});

/* ------------------------------------------------------------------ *
 * D 组：传输层归一与零缓存
 * ------------------------------------------------------------------ */

describe('取视图通道消费臂·传输层与确定性', () => {
  it('传输裸异常：归一 BRIDGE_INTERNAL（不裸抛非契约异常）', async () => {
    const recorder = createInvoke([() => {
      throw new Error('Error invoking remote method document-view:request: 通道未注册');
    }]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });

  it('传输 AbortError：归一 BRIDGE_CANCELLED（在册口径）', async () => {
    const recorder = createInvoke([() => {
      const abort = new Error('已取消');
      abort.name = 'AbortError';
      throw abort;
    }]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_CANCELLED');
  });

  it('传输拒绝携同构在册码（BRIDGE_TIMEOUT）：原码透传', async () => {
    // 拒绝值为非 `ChipsError` 实例的同构错误面：走 `isChipsError` 宽判 →
    // `fromPlain` 同构还原臂，在册码原样透传（不走 instanceof 直通）。
    const plainTimeout = Object.assign(new Error('视图构建超时'), {
      code: 'BRIDGE_TIMEOUT',
      retryable: true,
    });
    const recorder = createInvoke([() => Promise.reject(plainTimeout)]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_TIMEOUT');
  });

  it('回包 undefined（主进程处理函数无返回）：响应闸拒绝 BRIDGE_INTERNAL', async () => {
    const recorder = createInvoke([() => undefined]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await expectChannelRejection(() => builder.buildView(validInput()), 'BRIDGE_INTERNAL');
  });

  it('无自有缓存（§2.6）：逐调用完整触达通道一次', async () => {
    const recorder = createInvoke([(payload) => resultEnvelope(requestIdOf(payload))]);
    const builder = createDocumentViewChannelBuilder({ invoke: recorder.invoke });
    await builder.buildView(validInput());
    await builder.buildView(validInput());
    await builder.buildView(validInput());
    expect(recorder.calls).toHaveLength(3);
  });
});
