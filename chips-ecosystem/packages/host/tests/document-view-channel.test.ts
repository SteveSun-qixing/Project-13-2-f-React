/**
 * 宿主内部取视图通道契约单测（工单035 契约先行路，任务 #105）。
 *
 * 权威：《05-渲染引擎设计》§2.3（跨进程时序）/§2.5/§2.6（视图消费与构建口径）、
 * 《03-核心接口规范》§6.6（`CardRenderView` 冻结形状）、《02-Bridge三层设计》§9.1/§9.2
 * （错误归一与 `BRIDGE_*` 码表）、《11-文档服务设计》§十 与《06-文档解析器设计》§8.2
 * （`DOCUMENT_*` 码表）、《05-ID生成规范》§二.1/§七.1（十位 Base62 在册口径）、
 * 《04-能力契约规范》§6.3（精确键集纪律）。
 *
 * 覆盖面：
 * - A 组：错误面逐码在册锁（对照 `@chips/bridge` 常量表与宿主文档域码表，零自造码）；
 * - B 组：请求信封判别全矩阵（每合法形状一例 + 每非法形状逐码断言
 *   `BRIDGE_INVALID_INPUT`，含 documentId 十位 Base62 边界与 kind 判别边界）；
 * - C 组：响应信封判别矩阵（成功臂视图精确键集深校验逐面 `BRIDGE_INTERNAL`、
 *   失败臂逐在册码还原、面外码/非形状载荷归一）；
 * - D 组：错误映射 `normalizeDocumentViewChannelError` 逐臂；
 * - E 组：契约文件 import 面纯净锁（零 IPC / 零进程能力 / 零定时器 / 零订阅副作用）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  BRIDGE_ERROR_CODES,
  BRIDGE_ERROR_MESSAGES,
  ChipsError,
  isChipsError,
} from '@chips/bridge';

import * as documentViewChannel from '../src/renderer/document-view-channel.js';
import {
  DOCUMENT_VIEW_CHANNEL_ERROR_CODES,
  DOCUMENT_VIEW_CHANNEL_KINDS,
  DOCUMENT_VIEW_MESSAGE_TYPES,
  DOCUMENT_VIEW_PROTOCOL,
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  createDocumentViewBuildFailure,
  createDocumentViewBuildRequest,
  createDocumentViewBuildResult,
  guardDocumentViewCardRenderView,
  isDocumentViewBuildFailure,
  isDocumentViewBuildResult,
  isDocumentViewChannelErrorCode,
  normalizeDocumentViewChannelError,
  validateDocumentViewChannelRequest,
  validateDocumentViewChannelResponse,
} from '../src/renderer/document-view-channel.js';
import type {
  DocumentViewBuildResponse,
  IDocumentViewBuildFailure,
  IDocumentViewBuildResult,
  IDocumentViewChannelInput,
} from '../src/renderer/document-view-channel.js';
import {
  DOCUMENT_BUSINESS_ERROR_CODES,
  DOCUMENT_PARSER_ERROR_CODES,
} from '../src/capabilities/document/errors.js';
import { CARD_ID, NODE_ID_ONE, NODE_ID_TWO } from './helpers/document-fake-ports.js';

/* ------------------------------------------------------------------ *
 * 夹具
 * ------------------------------------------------------------------ */

/** 合法输入基线（`documentId` 用《05-ID生成规范》在册十位 Base62 夹具 `CARD_ID`）。 */
function validInput(): IDocumentViewChannelInput {
  return { source: 'chips-resource://workspace-a/我的卡片.card', documentId: CARD_ID, kind: 'card' };
}

/** 合法请求信封基线（每用例独立取用，防串改）。 */
function validRequest(): Record<string, unknown> {
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: 'document-view:build',
    requestId: 'req-0001',
    input: { ...validInput() },
  };
}

/** §6.6 `CardRenderView` 冻结形状基线（与刀3 守门夹具同字段口径）。 */
function wireView(): Record<string, unknown> {
  return {
    kind: 'card',
    revision: 3,
    card_id: CARD_ID,
    name: '视图卡片',
    chip_standards_version: '1.0.0',
    cover_ratio: '3:4',
    tags: ['旅行', ['攻略', 'D4']],
    cover: { entry: '.card/cover.html', ratio: '3:4' },
    content_nodes: [
      { node_id: NODE_ID_ONE, card_type: 'base.image', content: { src: 'image.jpg', alt: null, zoom: 1.5 } },
      { node_id: NODE_ID_TWO, card_type: 'base.richtext', content: { md: 'richtext/a.md', blocks: [{ type: 'p', text: '正文' }] } },
    ],
  };
}

/** 成功回包基线。 */
function validResult(view: unknown = wireView()): Record<string, unknown> {
  return { protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:result', requestId: 'req-0001', view };
}

/** 失败回包基线（`IChipsError` 普通对象形态）。 */
function validFailure(code: string, message = '文档会话不存在，请重新打开文档'): Record<string, unknown> {
  return {
    protocol: DOCUMENT_VIEW_PROTOCOL,
    type: 'document-view:error',
    requestId: 'req-0001',
    error: { code, message, retryable: false, details: { documentId: CARD_ID } },
  };
}

/** 捕获拒绝并断言其为 `ChipsError` 唯一类实例 + 期望码 + 期望闸位。 */
function expectRejection(run: () => unknown, code: string, gate: 'request' | 'response'): ChipsError {
  let caught: unknown;
  try {
    run();
  } catch (error: unknown) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ChipsError);
  const rejection = caught as ChipsError;
  expect(rejection.code).toBe(code);
  expect(isChipsError(rejection)).toBe(true);
  const details = rejection.details as { gate: string };
  expect(details.gate).toBe(gate);
  return rejection;
}

/** 判别窄化为失败臂（臂判别即被测契约，窄化失败即用例失败）。 */
function asFailureArm(response: DocumentViewBuildResponse): IDocumentViewBuildFailure {
  expect(isDocumentViewBuildFailure(response)).toBe(true);
  if (isDocumentViewBuildFailure(response)) {
    return response;
  }
  throw new Error('响应判别联合窄化失败：期望失败臂');
}

/** 判别窄化为成功臂。 */
function asResultArm(response: DocumentViewBuildResponse): IDocumentViewBuildResult {
  expect(isDocumentViewBuildResult(response)).toBe(true);
  if (isDocumentViewBuildResult(response)) {
    return response;
  }
  throw new Error('响应判别联合窄化失败：期望成功臂');
}

/* ------------------------------------------------------------------ *
 * A 组：错误面逐码在册锁
 * ------------------------------------------------------------------ */

describe('文档视图通道 · 错误面在册锁', () => {
  const bridgeCodes = new Set<string>(Object.values(BRIDGE_ERROR_CODES));
  const documentCodes = new Set<string>([
    ...Object.values(DOCUMENT_BUSINESS_ERROR_CODES),
    ...Object.values(DOCUMENT_PARSER_ERROR_CODES),
  ]);

  it('通道常量在册：协议版本、通道名与三臂判别字面量', () => {
    expect(DOCUMENT_VIEW_PROTOCOL).toBe('chips-document-view/1');
    expect(DOCUMENT_VIEW_REQUEST_CHANNEL).toBe('document-view:request');
    expect(DOCUMENT_VIEW_MESSAGE_TYPES).toStrictEqual({
      build: 'document-view:build',
      result: 'document-view:result',
      error: 'document-view:error',
    });
    expect(DOCUMENT_VIEW_CHANNEL_KINDS).toStrictEqual(['card', 'box']);
  });

  it('BRIDGE_* 五码逐值对照 @chips/bridge 常量表（同一字符串身份，零字面量复制）', () => {
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.invalidInput).toBe(BRIDGE_ERROR_CODES.invalidInput);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.sessionUnknown).toBe(BRIDGE_ERROR_CODES.sessionUnknown);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.timeout).toBe(BRIDGE_ERROR_CODES.timeout);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.cancelled).toBe(BRIDGE_ERROR_CODES.cancelled);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.internal).toBe(BRIDGE_ERROR_CODES.internal);
  });

  it('DOCUMENT_* 码逐值对照宿主文档域在册码表（11-文档服务设计 §十 / 06-文档解析器设计 §8.2）', () => {
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen).toBe(DOCUMENT_BUSINESS_ERROR_CODES.notOpen);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.sourceChanged).toBe(DOCUMENT_BUSINESS_ERROR_CODES.sourceChanged);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.idConflict).toBe(DOCUMENT_BUSINESS_ERROR_CODES.idConflict);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.metadataInvalid).toBe(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.structureInvalid).toBe(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid);
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.formatUnknown).toBe(DOCUMENT_PARSER_ERROR_CODES.formatUnknown);
    // §8.2 解析域登记码（宿主侧无公开常量表可 import，字面值与《06-文档解析器设计》§8.2 登记表逐字对齐）。
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notFound).toBe('DOCUMENT_NOT_FOUND');
    expect(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.parseCancelled).toBe('DOCUMENT_PARSE_CANCELLED');
  });

  it('面内每一码：词法合规（<DOMAIN>_<REASON>）且属于 bridge ∪ 文档域在册码集合', () => {
    const registered = new Set<string>([...bridgeCodes, ...documentCodes, 'DOCUMENT_NOT_FOUND', 'DOCUMENT_PARSE_CANCELLED']);
    for (const code of Object.values(DOCUMENT_VIEW_CHANNEL_ERROR_CODES)) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);
      expect(registered.has(code)).toBe(true);
    }
  });

  it('保存/写入域码构造性不入面（本链路无写路径）', () => {
    expect(isDocumentViewChannelErrorCode(DOCUMENT_BUSINESS_ERROR_CODES.saveFailed)).toBe(false);
    expect(isDocumentViewChannelErrorCode(DOCUMENT_BUSINESS_ERROR_CODES.writeConflict)).toBe(false);
    expect(isDocumentViewChannelErrorCode(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported)).toBe(false);
  });

  it('他域在册码不入本通道面（RESOURCE_* / RENDER_* / PERMISSION_* 即接线漂移）', () => {
    for (const code of ['RESOURCE_CROSS_SCOPE', 'RESOURCE_NOT_SUPPORTED', 'RENDER_DOCUMENT_INVALID', 'PERMISSION_UNKNOWN']) {
      expect(isDocumentViewChannelErrorCode(code)).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * B 组：请求信封判别全矩阵
 * ------------------------------------------------------------------ */

describe('文档视图通道 · 请求闸（BRIDGE_INVALID_INPUT 逐面）', () => {
  it('合法 card 请求：判别返回逐字段冻结投影', () => {
    const parsed = validateDocumentViewChannelRequest(validRequest());
    expect(parsed).toStrictEqual({
      protocol: DOCUMENT_VIEW_PROTOCOL,
      type: 'document-view:build',
      requestId: 'req-0001',
      input: validInput(),
    });
  });

  it('合法 box 请求：形状闸受理（当前交付面拒绝在主进程构建侧，通道不提前承载）', () => {
    const request = { ...validRequest(), input: { ...validInput(), kind: 'box' } };
    const parsed = validateDocumentViewChannelRequest(request);
    expect(parsed.input.kind).toBe('box');
  });

  it('构造器产物直通校验闸', () => {
    const request = createDocumentViewBuildRequest('req-9', validInput());
    expect(validateDocumentViewChannelRequest(request)).toStrictEqual(request);
  });

  it.each([
    ['null', null],
    ['字符串标量', 'request'],
    ['数组', [validRequest()]],
    ['协议版本不符', { ...validRequest(), protocol: 'chips-document-view/2' }],
    ['协议缺失', Object.assign({}, validRequest(), { protocol: undefined })],
    ['类型缺失', Object.assign({}, validRequest(), { type: undefined })],
    ['类型未登记', { ...validRequest(), type: 'document-view:ping' }],
    ['响应臂越位（result 作请求）', { ...validRequest(), type: 'document-view:result' }],
    ['响应臂越位（error 作请求）', { ...validRequest(), type: 'document-view:error' }],
    ['requestId 非字符串', { ...validRequest(), requestId: 7 }],
    ['requestId 空串', { ...validRequest(), requestId: '' }],
    ['requestId 缺失', Object.assign({}, validRequest(), { requestId: undefined })],
    ['input 缺失', Object.assign({}, validRequest(), { input: undefined })],
    ['input 非对象', { ...validRequest(), input: 'loc' }],
    ['input 数组', { ...validRequest(), input: [] }],
    ['封套多余字段', { ...validRequest(), extra: true }],
    ['input 多余字段', { ...validRequest(), input: { ...validInput(), part: 'metadata' } }],
    ['source 空串', { ...validRequest(), input: { ...validInput(), source: '' } }],
    ['source 非字符串', { ...validRequest(), input: { ...validInput(), source: 42 } }],
    ['documentId 空串', { ...validRequest(), input: { ...validInput(), documentId: '' } }],
    ['documentId 九位', { ...validRequest(), input: { ...validInput(), documentId: 'Ab3dEf6Gh' } }],
    ['documentId 十一位', { ...validRequest(), input: { ...validInput(), documentId: `${CARD_ID}x` } }],
    ['documentId 含下划线', { ...validRequest(), input: { ...validInput(), documentId: 'Ab3d_E6Gh8' } }],
    ['documentId 含连字符（渲染层历史替身形）', { ...validRequest(), input: { ...validInput(), documentId: 'card-7f3a' } }],
    ['documentId 含非 ASCII', { ...validRequest(), input: { ...validInput(), documentId: 'Ａb3dEf6Gh8' } }],
    ['documentId 非字符串', { ...validRequest(), input: { ...validInput(), documentId: 1234567890 } }],
    ['kind 非判别成员（box-layout）', { ...validRequest(), input: { ...validInput(), kind: 'box-layout' } }],
    ['kind 大小写越界', { ...validRequest(), input: { ...validInput(), kind: 'CARD' } }],
    ['kind 为 null', { ...validRequest(), input: { ...validInput(), kind: null } }],
    ['kind 非字符串', { ...validRequest(), input: { ...validInput(), kind: 0 } }],
    ['kind 缺失', { ...validRequest(), input: Object.assign({}, validInput(), { kind: undefined }) }],
  ] as const)('非法形状逐码：%s → BRIDGE_INVALID_INPUT', (_label, payload) => {
    const rejection = expectRejection(() => validateDocumentViewChannelRequest(payload), BRIDGE_ERROR_CODES.invalidInput, 'request');
    const details = rejection.details as { field: string };
    expect(typeof details.field).toBe('string');
    expect(details.field.length).toBeGreaterThan(0);
  });

  it('documentId 大小写精确：十位 Base62 全字符集合法（数字开头/全数字均受理）', () => {
    for (const id of ['0123456789', 'aB3dEf6Gh8', 'ABCDEFGHIJ', 'zzzzzzzzzz']) {
      expect(validateDocumentViewChannelRequest({ ...validRequest(), input: { ...validInput(), documentId: id } }).input.documentId).toBe(id);
    }
  });
});

/* ------------------------------------------------------------------ *
 * C 组：响应信封判别矩阵
 * ------------------------------------------------------------------ */

describe('文档视图通道 · 响应闸（BRIDGE_INTERNAL 逐面）', () => {
  it('合法成功回包：视图精确键集深校验通过后逐字段全等重建', () => {
    const response = asResultArm(validateDocumentViewChannelResponse(validResult()));
    expect(isDocumentViewBuildResult(response)).toBe(true);
    expect(isDocumentViewBuildFailure(response)).toBe(false);
    expect(response.view).toStrictEqual(wireView());
  });

  it('请求臂越位作响应、类型未登记、协议不符、requestId 非法、封套多余/缺失字段 → BRIDGE_INTERNAL', () => {
    const cases: unknown[] = [
      validRequest(),
      { ...validResult(), type: 'document-view:ping' },
      { ...validResult(), protocol: 'chips-document-view/2' },
      { ...validResult(), requestId: '' },
      { ...validResult(), extra: 1 },
      Object.assign({}, validResult(), { view: undefined, error: validFailure(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen).error }),
      'not-an-envelope',
      null,
    ];
    for (const payload of cases) {
      expectRejection(() => validateDocumentViewChannelResponse(payload), BRIDGE_ERROR_CODES.internal, 'response');
    }
  });

  it('失败臂：在册错误面逐码通过还原（码/message/retryable/details 原样承载）', () => {
    for (const code of Object.values(DOCUMENT_VIEW_CHANNEL_ERROR_CODES)) {
      const response = asFailureArm(validateDocumentViewChannelResponse(validFailure(code, `通道回包-${code}`)));
      expect(isDocumentViewBuildFailure(response)).toBe(true);
      const error = response.error as ChipsError;
      expect(error).toBeInstanceOf(ChipsError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(`通道回包-${code}`);
      expect(error.retryable).toBe(false);
      expect(error.details).toStrictEqual({ documentId: CARD_ID });
    }
  });

  it('失败臂 retryable 缺省按 false 还原（ChipsError 统一类口径）', () => {
    const payload = {
      protocol: DOCUMENT_VIEW_PROTOCOL,
      type: 'document-view:error',
      requestId: 'req-0001',
      error: { code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.timeout, message: '能力调用超时' },
    };
    const response = asFailureArm(validateDocumentViewChannelResponse(payload));
    expect((response.error as ChipsError).retryable).toBe(false);
  });

  it.each([
    ['面外已登记码（RESOURCE_*）', 'RESOURCE_CROSS_SCOPE'],
    ['面外已登记码（RENDER_*）', 'RENDER_FRAME_TIMEOUT'],
    ['他域桥码（PERMISSION_*）', 'PERMISSION_UNKNOWN'],
    ['未登记词法码', 'NOT_A_REGISTERED_CODE'],
    ['全小写垃圾码', 'internal'],
  ] as const)('失败臂面外码逐码归一：%s → BRIDGE_INTERNAL', (_label, code) => {
    const response = asFailureArm(validateDocumentViewChannelResponse(validFailure(code)));
    expect(response.error.code).toBe(BRIDGE_ERROR_CODES.internal);
    if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(code)) {
      expect((response.error as { details?: { cause?: string } }).details?.cause).toBe(code);
    }
  });

  it('失败臂 error 载荷形状非在册（非对象/缺码/码非串/消息缺省/retryable 非布尔）→ BRIDGE_INTERNAL', () => {
    const badErrors: unknown[] = [null, 'oops', 7, [], {}, { code: 7, message: 'x' }, { code: '', message: 'x' }, { code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen }, { code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen, message: 1 }, { code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen, message: 'x', retryable: 'true' }];
    for (const error of badErrors) {
      const payload = { protocol: DOCUMENT_VIEW_PROTOCOL, type: 'document-view:error', requestId: 'req-0001', error };
      expectRejection(() => validateDocumentViewChannelResponse(payload), BRIDGE_ERROR_CODES.internal, 'response');
    }
  });
});

describe('文档视图通道 · 回包视图深校验闸（§6.6 逐面 BRIDGE_INTERNAL）', () => {
  it('成功臂视图违约直接触达响应闸', () => {
    expectRejection(() => validateDocumentViewChannelResponse(validResult({ ...wireView(), revision: -1 })), BRIDGE_ERROR_CODES.internal, 'response');
  });

  const mutations: readonly (readonly [string, (view: Record<string, unknown>) => unknown])[] = [
    ['视图根非对象', () => 'view'],
    ['缺字段（cover_ratio 真实缺失）', (v) => { const copy = { ...v }; delete copy['cover_ratio']; return copy; }],
    ['字段值为 undefined', (v) => Object.assign({}, v, { cover_ratio: undefined })],
    ['多字段（漂移防线）', (v) => ({ ...v, extra: 1 })],
    ['kind 判别非 card', (v) => ({ ...v, kind: 'box' })],
    ['revision 负数', (v) => ({ ...v, revision: -1 })],
    ['revision 小数', (v) => ({ ...v, revision: 1.5 })],
    ['revision NaN', (v) => ({ ...v, revision: Number.NaN })],
    ['revision 字符串', (v) => ({ ...v, revision: '3' })],
    ['card_id 空串', (v) => ({ ...v, card_id: '' })],
    ['name 非字符串（空串合法：requireString 口径）', (v) => ({ ...v, name: 7 })],
    ['chip_standards_version 空串', (v) => ({ ...v, chip_standards_version: '' })],
    ['tags 非数组', (v) => ({ ...v, tags: '旅行' })],
    ['tags 成员非 TagView', (v) => ({ ...v, tags: [3] })],
    ['tags 嵌套成员混型', (v) => ({ ...v, tags: [['攻略', 4]] })],
    ['cover 键集漂移', (v) => ({ ...v, cover: { entry: 'x', ratio: '1:1', extra: true } })],
    ['cover.entry 空串', (v) => ({ ...v, cover: { entry: '', ratio: '3:4' } })],
    ['cover.ratio 非字符串', (v) => ({ ...v, cover: { entry: 'x', ratio: 1 } })],
    ['content_nodes 非数组', (v) => ({ ...v, content_nodes: {} })],
    ['content_nodes 成员缺键', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image' }] })],
    ['content_nodes 成员多键', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: {}, extra: 1 }] })],
    ['node_id 空串', (v) => ({ ...v, content_nodes: [{ node_id: '', card_type: 'base.image', content: {} }] })],
    ['card_type 非字符串', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 2, content: {} }] })],
    ['content 非映射（数组）', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: [] }] })],
    ['content 含函数', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { fn: () => undefined } }] })],
    ['content 含 undefined 成员', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { a: undefined } }] })],
    ['content 含非有限数值', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { n: Number.POSITIVE_INFINITY } }] })],
    ['content 含类实例', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { d: new Date(0) } }] })],
    ['content 含二进制（文件字节不入视图）', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { b: new Uint8Array([1]) } }] })],
    ['content 数组含 undefined 元素', (v) => ({ ...v, content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content: { list: [undefined] } }] })],
  ] as const;

  it.each(mutations)('视图违约逐面：%s → BRIDGE_INTERNAL', (_label, mutate) => {
    const view = mutate({ ...wireView() });
    expectRejection(() => guardDocumentViewCardRenderView(view), BRIDGE_ERROR_CODES.internal, 'response');
    expectRejection(() => validateDocumentViewChannelResponse(validResult(view)), BRIDGE_ERROR_CODES.internal, 'response');
  });

  it('循环引用视图 → BRIDGE_INTERNAL（活性路径检测）', () => {
    const content: Record<string, unknown> = { a: 1 };
    content['self'] = content;
    const view = {
      ...wireView(),
      content_nodes: [{ node_id: NODE_ID_ONE, card_type: 'base.image', content }],
    };
    expectRejection(() => guardDocumentViewCardRenderView(view), BRIDGE_ERROR_CODES.internal, 'response');
  });

  it('共享 DAG（非循环）允许：同一子对象多处引用通过守门', () => {
    const shared = { blocks: [{ type: 'p', text: '共享' }] };
    const view = {
      ...wireView(),
      content_nodes: [
        { node_id: NODE_ID_ONE, card_type: 'base.image', content: shared },
        { node_id: NODE_ID_TWO, card_type: 'base.richtext', content: shared },
      ],
    };
    expect(guardDocumentViewCardRenderView(view).content_nodes[0]?.content).toStrictEqual(shared);
  });

  it('空 tags / 空 content_nodes / 空串 name、cover_ratio 合法（刀3 守门同口径）', () => {
    const view = {
      kind: 'card',
      revision: 0,
      card_id: CARD_ID,
      name: '',
      chip_standards_version: '1.0.0',
      cover_ratio: '',
      tags: [],
      cover: { entry: '.card/cover.html', ratio: '' },
      content_nodes: [],
    };
    expect(guardDocumentViewCardRenderView(view).content_nodes).toHaveLength(0);
  });

  it('守门为投影重建：返回值与入参非同引用、逐字段全等', () => {
    const source = wireView();
    const guarded = guardDocumentViewCardRenderView(source);
    expect(guarded).not.toBe(source);
    expect(guarded).toStrictEqual(source);
  });
});

/* ------------------------------------------------------------------ *
 * D 组：错误映射与构造器
 * ------------------------------------------------------------------ */

describe('文档视图通道 · 错误面映射', () => {
  it('面内 ChipsError 实例原样透传（不重复包装）', () => {
    const original = new ChipsError({ code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.notOpen, message: '文档会话不存在，请重新打开文档', retryable: false });
    expect(normalizeDocumentViewChannelError(original)).toBe(original);
  });

  it('面内 IChipsError 同构普通对象同构还原（工单024 唯一类语义）', () => {
    const restored = normalizeDocumentViewChannelError({
      code: DOCUMENT_VIEW_CHANNEL_ERROR_CODES.parseCancelled,
      message: '解析已取消',
      retryable: true,
      details: { origin: 'chips-parser' },
    });
    expect(restored).toBeInstanceOf(ChipsError);
    expect(restored.code).toBe(DOCUMENT_VIEW_CHANNEL_ERROR_CODES.parseCancelled);
    expect(restored.retryable).toBe(true);
  });

  it('面外已登记码归一 BRIDGE_INTERNAL 且 details.cause 承载原码', () => {
    const mapped = normalizeDocumentViewChannelError({ code: 'RESOURCE_PATH_INVALID', message: '路径非法', retryable: false });
    expect(mapped.code).toBe(BRIDGE_ERROR_CODES.internal);
    expect(mapped.details).toStrictEqual({ cause: 'RESOURCE_PATH_INVALID' });
    expect(mapped.retryable).toBe(false);
    expect(mapped.message).not.toBe('路径非法');
  });

  it('未登记词法与垃圾码不留诊断细节（不采信不可信字符串）', () => {
    expect(normalizeDocumentViewChannelError({ code: 'lowercase_code', message: 'x', retryable: false }).details).toBeUndefined();
    expect(normalizeDocumentViewChannelError({ code: 'ok then', message: 'x', retryable: false }).details).toBeUndefined();
  });

  it('AbortError 归一 BRIDGE_CANCELLED（在册面内）', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const mapped = normalizeDocumentViewChannelError(abort);
    expect(mapped.code).toBe(BRIDGE_ERROR_CODES.cancelled);
    expect(mapped.message).toBe(BRIDGE_ERROR_MESSAGES.BRIDGE_CANCELLED);
  });

  it('裸 Error / 字符串异常归一 BRIDGE_INTERNAL', () => {
    expect(normalizeDocumentViewChannelError(new Error('boom')).code).toBe(BRIDGE_ERROR_CODES.internal);
    expect(normalizeDocumentViewChannelError('boom').code).toBe(BRIDGE_ERROR_CODES.internal);
  });

  it('失败回包构造器：任意异常经映射后以普通对象形态入包（不传输 Error 实例）', () => {
    const failure = createDocumentViewBuildFailure('req-1', new ChipsError({ code: 'DOCUMENT_SAVE_FAILED', message: '文档保存失败', retryable: true }));
    expect(failure.type).toBe(DOCUMENT_VIEW_MESSAGE_TYPES.error);
    expect(failure.requestId).toBe('req-1');
    expect(failure.error).toStrictEqual({
      code: BRIDGE_ERROR_CODES.internal,
      message: failure.error.message,
      retryable: false,
      details: { cause: 'DOCUMENT_SAVE_FAILED' },
    });
    expect(failure.error).not.toBeInstanceOf(Error);
  });

  it('成功回包构造器直通响应闸', () => {
    const guarded = guardDocumentViewCardRenderView(wireView());
    const response = asResultArm(validateDocumentViewChannelResponse(createDocumentViewBuildResult('req-2', guarded)));
    expect(response.requestId).toBe('req-2');
    expect(response.view).toStrictEqual(guarded);
  });
});

/* ------------------------------------------------------------------ *
 * E 组：契约文件纯净锁（零宿主进程副作用）
 * ------------------------------------------------------------------ */

describe('文档视图通道 · import 面纯净（契约零实现体）', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/renderer/document-view-channel.ts', import.meta.url)),
    'utf8'
  );

  /** 全部静态 import 来源（含 type-only）。 */
  const importSpecifiers: readonly string[] = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);

  it('运行期依赖仅 @chips/bridge（纯 TS 协议层）与文档域在册码表', () => {
    expect([...new Set(importSpecifiers)].sort()).toStrictEqual([
      '../capabilities/document/contract.js',
      '../capabilities/document/errors.js',
      './frame-protocol.js',
      '@chips/bridge',
    ]);
  });

  it('零宿主进程能力：无 IPC / DOM / 定时器 / 订阅标识符（import 白名单由上一用例锁定）', () => {
    // 剥离全部块注释与行注释后扫描代码面（头注以散文描述通道 IPC 形态属契约文档，不构成副作用）。
    const codeFace = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of [
      'ipcMain',
      'ipcRenderer',
      'contextBridge',
      'window.',
      'document.',
      'setTimeout',
      'setInterval',
      'addEventListener',
      'postMessage',
      'require(',
      'fetch(',
    ] as const) {
      expect(codeFace).not.toContain(forbidden);
    }
  });

  it('导出面全为纯常量/类型/函数（零类实例、零单例对象）', () => {
    for (const [name, value] of Object.entries(documentViewChannel)) {
      expect(['string', 'function', 'object']).toContain(typeof value);
      expect(value).not.toBeInstanceOf(Error);
      expect(name).toMatch(/^(DOCUMENT_|create|validate|guard|normalize|is)/);
    }
  });

  it('零自有状态：同输入两次校验产出逐字段全等（幂等纯函数）', () => {
    expect(validateDocumentViewChannelRequest(validRequest())).toStrictEqual(validateDocumentViewChannelRequest(validRequest()));
    expect(validateDocumentViewChannelResponse(validResult())).toStrictEqual(validateDocumentViewChannelResponse(validResult()));
  });
});
