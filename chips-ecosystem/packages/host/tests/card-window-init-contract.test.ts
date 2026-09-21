/**
 * 卡片窗口装载输入投递契约单测（刀7 前置契约，任务 #119 契约先行）。
 *
 * 权威：工单035 裁定一（宿主内部壳进程↔主进程 IPC 契约，非插件能力）与 §九/§十（本契约
 * 冻结与待裁随账腿）；《05-渲染引擎设计》05.02 §2.3 承载段（05.02:89「装载投递细节归宿主
 * 实现」）、05.09 §9.3 帧消息在册清单（零交集漂移锁）；《04-能力契约规范》§6.3（精确键集）
 * /§7.4（windowId = webContents.id）/§十一（在册码词法）；《02-Bridge三层设计》§9.1/§9.2
 * （错误归一与码表）；《11-文档服务设计》§十；《05-ID生成规范》§二.1/§七.1。
 *
 * 覆盖面：
 * - A 组：通道常量与消息类型逐值锁、与在册帧消息清单/在册 IPC 通道名/取视图通道世界键
 *   的零碰撞漂移锁；
 * - B 组：错误面逐码在册锁（对照 `@chips/bridge` 码表与文档域码表，零自造码）与归一函数
 *   逐臂；
 * - C 组：请求封套闸矩阵（逐字段拒绝码 `BRIDGE_INVALID_INPUT`，含「请求不携带 windowId」
 *   身份取证锁）；
 * - D 组：装载输入 payload 闸逐字段正反例（source 词法镜像、documentId 十位 Base62 边界、
 *   pluginEntries/tokens 映射闸）；
 * - E 组：响应三臂封套闸矩阵（就绪/空载/失败、requestId 关联锁、windowId 正安全整数锁、
 *   面外码归一）；
 * - F 组：与 `renderer/entries/card.ts` `ICardWindowInit` 消费形状的编译期互赋锁 +
 *   源文本键集漂移锁；
 * - G 组：契约文件 import 面纯净锁（零 Electron / 零 IPC / 零 DOM / 零定时器）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { BRIDGE_ERROR_CODES, BRIDGE_ERROR_MESSAGES, ChipsError, createBridgeError } from '@chips/bridge';

import {
  CARD_WINDOW_INIT_CHANNEL_ERROR_CODES,
  CARD_WINDOW_INIT_MESSAGE_TYPES,
  CARD_WINDOW_INIT_PAYLOAD_FIELDS,
  CARD_WINDOW_INIT_PROTOCOL,
  CARD_WINDOW_INIT_REQUEST_CHANNEL,
  CARD_WINDOW_INIT_SURFACE_KEY,
  createCardWindowInitFailure,
  createCardWindowInitFetchRequest,
  createCardWindowInitPending,
  createCardWindowInitResult,
  isCardWindowInitChannelErrorCode,
  isCardWindowInitFailure,
  isCardWindowInitPending,
  isCardWindowInitResult,
  normalizeCardWindowInitError,
  validateCardWindowInitPayload,
  validateCardWindowInitRequest,
  validateCardWindowInitResponse,
} from '../src/shared/card-window-init-surface.js';
import type {
  CardWindowInitResponse,
  ICardWindowInitPayload,
} from '../src/shared/card-window-init-surface.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../src/shared/host-view-channel-surface.js';
import {
  BRIDGE_REQUEST_CHANNEL,
  BRIDGE_RESOURCE_CHANNEL,
  EVENT_CONTROL_CHANNEL,
  SESSION_PERMISSIONS_CHANNEL,
} from '../src/protocol/channels.js';
import { DOCUMENT_VIEW_REQUEST_CHANNEL } from '../src/renderer/document-view-channel.js';
import { DOCUMENT_BUSINESS_ERROR_CODES } from '../src/capabilities/document/errors.js';
import type { ICardWindowInit } from '../src/renderer/entries/card.js';
import { CARD_ID } from './helpers/document-fake-ports.js';

/* ------------------------------------------------------------------ *
 * 夹具
 * ------------------------------------------------------------------ */

/** 合法装载输入基线（source 过编排器同口径词法闸；documentId 用在册十位 Base62 夹具）。 */
function validPayload(): ICardWindowInitPayload {
  return {
    source: 'chips-resource://workspace-a/我的卡片.card',
    documentId: CARD_ID,
    resourceBase: 'chips-resource://workspace-a/card-assets/',
    pluginEntries: { 'basecard.text': 'chips-resource://platform/plugins/basecard-text/index.js' },
    tokens: { '--chips-color-primary': '#1677ff' },
  };
}

/** 捕获闸拒绝的 ChipsError（断言 code 与 details 闸位）。 */
function captureRejection(fn: () => unknown): ChipsError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    return error as ChipsError;
  }
  throw new Error('预期闸拒绝但未抛出');
}

/* ------------------------------------------------------------------ *
 * A 组：常量逐值锁与零碰撞漂移锁
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · 常量与漂移锁（#119 契约冻结）', () => {
  it('协议版本与通道名逐字锁（升级走版本号协商，改名即红）', () => {
    expect(CARD_WINDOW_INIT_PROTOCOL).toBe('chips-card-window-init/1');
    expect(CARD_WINDOW_INIT_REQUEST_CHANNEL).toBe('card-window-init:request');
  });

  it('消息类型四臂全恰四键且逐值锁定', () => {
    expect(CARD_WINDOW_INIT_MESSAGE_TYPES).toEqual({
      fetch: 'card-window-init:fetch',
      result: 'card-window-init:result',
      pending: 'card-window-init:pending',
      error: 'card-window-init:error',
    });
    expect(Object.keys(CARD_WINDOW_INIT_MESSAGE_TYPES)).toHaveLength(4);
    for (const typeName of Object.values(CARD_WINDOW_INIT_MESSAGE_TYPES)) {
      expect(typeName.startsWith('card-window-init:'), typeName).toBe(true);
    }
  });

  it('payload 字段名清单与 ICardWindowInit 消费五字段逐字一致', () => {
    expect([...CARD_WINDOW_INIT_PAYLOAD_FIELDS]).toEqual(['source', 'documentId', 'resourceBase', 'pluginEntries', 'tokens']);
  });

  /**
   * 《05-渲染引擎设计》05.09 §9.3 帧生命周期消息在册清单（分件
   * `05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md` 表行 155–167，
   * 登记于 2026-09-21 版 v1.0.0）。本通道是窗口级宿主内部 IPC，不属于帧协议消息面——
   * 零交集即不与在册清单冲突，无需 §9.3 扩展位登记。
   */
  const REGISTERED_FRAME_MESSAGES: readonly string[] = [
    'host:init',
    'frame:ready',
    'frame:height',
    'host:height-ack',
    'frame:entry-request',
    'host:entries',
    'frame:action',
    'host:action-error',
    'frame:error',
    'host:update',
    'host:dispose',
    'frame:dispose-ack',
  ];

  it('四个消息名与 §9.3 在册帧消息清单零交集（帧协议面漂移锁）', () => {
    for (const name of Object.values(CARD_WINDOW_INIT_MESSAGE_TYPES)) {
      expect(REGISTERED_FRAME_MESSAGES, name).not.toContain(name);
    }
  });

  /** 在册宿主内部/桥 IPC 通道名（`src/protocol/channels.ts` §7.1 三通道+权限下行、
   *  #105 取视图通道）。新通道名不得与任何在册通道撞名。 */
  const REGISTERED_CHANNELS: readonly string[] = [
    BRIDGE_REQUEST_CHANNEL,
    BRIDGE_RESOURCE_CHANNEL,
    EVENT_CONTROL_CHANNEL,
    SESSION_PERMISSIONS_CHANNEL,
    DOCUMENT_VIEW_REQUEST_CHANNEL,
  ];

  it('通道名与在册 IPC 通道零碰撞', () => {
    expect(REGISTERED_CHANNELS).not.toContain(CARD_WINDOW_INIT_REQUEST_CHANNEL);
    expect(REGISTERED_CHANNELS.every((name) => !name.startsWith('card-window-init:'))).toBe(true);
  });

  it('窗口装载层全局键独立于取视图通道世界与 window.chips（第二世界隔离锁）', () => {
    expect(CARD_WINDOW_INIT_SURFACE_KEY).toBe('__chipsCardWindowInit');
    expect(CARD_WINDOW_INIT_SURFACE_KEY).not.toBe(HOST_VIEW_CHANNEL_SURFACE_KEY);
    expect(CARD_WINDOW_INIT_SURFACE_KEY).not.toBe('chips');
    expect(CARD_WINDOW_INIT_SURFACE_KEY.startsWith('__chips'), '双下划线前缀=宿主内部口径').toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：错误面在册锁与归一
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · 在册错误面（零自造码）', () => {
  const bridgeCodeSet: ReadonlySet<string> = new Set<string>(Object.values(BRIDGE_ERROR_CODES));
  const documentCodeSet: ReadonlySet<string> = new Set<string>(Object.values(DOCUMENT_BUSINESS_ERROR_CODES));

  it('错误面逐值取自在册码表常量（BRIDGE_* 与 DOCUMENT_NOT_OPEN）', () => {
    expect(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES).toEqual({
      invalidInput: 'BRIDGE_INVALID_INPUT',
      sessionUnknown: 'BRIDGE_SESSION_UNKNOWN',
      documentNotOpen: 'DOCUMENT_NOT_OPEN',
      internal: 'BRIDGE_INTERNAL',
    });
    expect(bridgeCodeSet.has(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.invalidInput)).toBe(true);
    expect(bridgeCodeSet.has(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.sessionUnknown)).toBe(true);
    expect(bridgeCodeSet.has(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.internal)).toBe(true);
    expect(documentCodeSet.has(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.documentNotOpen)).toBe(true);
    expect(documentCodeSet.has(DOCUMENT_BUSINESS_ERROR_CODES.notOpen)).toBe(true);
  });

  it('面内/面外码判别（isCardWindowInitChannelErrorCode）', () => {
    expect(isCardWindowInitChannelErrorCode('BRIDGE_INVALID_INPUT')).toBe(true);
    expect(isCardWindowInitChannelErrorCode('DOCUMENT_NOT_OPEN')).toBe(true);
    expect(isCardWindowInitChannelErrorCode('DOCUMENT_SAVE_FAILED')).toBe(false);
    expect(isCardWindowInitChannelErrorCode('BRIDGE_CANCELLED')).toBe(false);
    expect(isCardWindowInitChannelErrorCode('RESOURCE_NOT_FOUND')).toBe(false);
  });

  it('归一：面内码原样透传（ChipsError 实例与 IChipsError 同构普通对象两形态）', () => {
    const instance = createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown);
    expect(normalizeCardWindowInitError(instance)).toBe(instance);
    const plain = createBridgeError(BRIDGE_ERROR_CODES.invalidInput).toPlain();
    const normalized = normalizeCardWindowInitError(plain);
    expect(normalized.code).toBe('BRIDGE_INVALID_INPUT');
    expect(normalized).toBeInstanceOf(ChipsError);
  });

  it('归一：面外已登记码 → BRIDGE_INTERNAL 且 details.cause 承载原码；非 ChipsError → BRIDGE_INTERNAL 不携原文', () => {
    const outside = createBridgeError(BRIDGE_ERROR_CODES.cancelled);
    const mapped = normalizeCardWindowInitError(outside);
    expect(mapped.code).toBe('BRIDGE_INTERNAL');
    expect(mapped.details).toEqual({ cause: 'BRIDGE_CANCELLED' });

    const raw = new Error('内部堆栈与路径不得外泄');
    const folded = normalizeCardWindowInitError(raw);
    expect(folded.code).toBe('BRIDGE_INTERNAL');
    expect(folded.message).not.toContain('内部堆栈');
  });

  it('在册码的默认文案为简体中文（02-Bridge §9.2 消息表口径）', () => {
    const internalMessage = BRIDGE_ERROR_MESSAGES[BRIDGE_ERROR_CODES.internal];
    expect(internalMessage).toBeTypeOf('string');
    expect(/[一-龥]/.test(internalMessage)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * C 组：请求封套闸矩阵
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · 请求闸（BRIDGE_INVALID_INPUT 逐位点名）', () => {
  function validRequest(): Record<string, unknown> {
    return { protocol: CARD_WINDOW_INIT_PROTOCOL, type: 'card-window-init:fetch', requestId: 'init-req-0001' };
  }

  it('合法请求往返：构造器产物过闸原样收敛', () => {
    const built = createCardWindowInitFetchRequest('init-req-0001');
    expect(validateCardWindowInitRequest(built)).toEqual(built);
  });

  it('逐字段拒绝矩阵全部以 BRIDGE_INVALID_INPUT 交付且 details 点名闸位', () => {
    const cases: ReadonlyArray<readonly [string, unknown]> = [
      ['非对象封套', null],
      ['数组封套', []],
      ['协议版本不符', { ...validRequest(), protocol: 'chips-card-window-init/2' }],
      ['消息类型不符', { ...validRequest(), type: 'card-window-init:result' }],
      ['requestId 空串', { ...validRequest(), requestId: '' }],
      ['requestId 非字符串', { ...validRequest(), requestId: 7 }],
      ['缺字段', { protocol: CARD_WINDOW_INIT_PROTOCOL, type: 'card-window-init:fetch' }],
      ['多字段（精确键集纪律）', { ...validRequest(), extra: 1 }],
      ['渲染侧自报 windowId 被拒（身份由主进程 sender 取证）', { ...validRequest(), windowId: 42 }],
    ];
    for (const [label, data] of cases) {
      const rejection = captureRejection(() => validateCardWindowInitRequest(data));
      expect(rejection.code, label).toBe('BRIDGE_INVALID_INPUT');
      expect(rejection.retryable, label).toBe(false);
      expect((rejection.details as { gate?: string }).gate, label).toBe('request');
    }
  });
});

/* ------------------------------------------------------------------ *
 * D 组：payload 闸逐字段正反例
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · payload 闸（消费形状逐字段锁，拒绝码 BRIDGE_INTERNAL）', () => {
  it('合法基线过闸后逐字段原样保留（不裁剪、不改写、投影为普通对象）', () => {
    const payload = validPayload();
    const validated = validateCardWindowInitPayload({ ...payload });
    expect(validated).toEqual(payload);
    expect(validated.pluginEntries['basecard.text']).toBe(payload.pluginEntries['basecard.text']);
  });

  it('source 词法闸与编排器 assertSource 同口径镜像（空/空白/超长拒绝，4096 边界通过）', () => {
    for (const bad of ['', '   ', 'a b', 'chips-resource://a b/c', 'tail\n']) {
      const rejection = captureRejection(() =>
        validateCardWindowInitPayload({ ...validPayload(), source: bad })
      );
      expect(rejection.code, `source=${JSON.stringify(bad)}`).toBe('BRIDGE_INTERNAL');
      expect(rejection.details).toMatchObject({ gate: 'response', field: 'source' });
    }
    expect(validateCardWindowInitPayload({ ...validPayload(), source: 'x'.repeat(4096) }).source).toHaveLength(4096);
    const tooLong = captureRejection(() =>
      validateCardWindowInitPayload({ ...validPayload(), source: 'x'.repeat(4097) })
    );
    expect(tooLong.details).toMatchObject({ field: 'source' });
  });

  it('documentId 十位 Base62 边界（9 位 / 11 位 / 非 Base62 字符拒绝；大小写字母+数字通过）', () => {
    for (const bad of ['Ab3dEf6Gh', 'Ab3dEf6Gh89', 'Ab3dEf6Gh_', '短标识0123456789ab']) {
      const rejection = captureRejection(() =>
        validateCardWindowInitPayload({ ...validPayload(), documentId: bad })
      );
      expect(rejection.details, `documentId=${bad}`).toMatchObject({ field: 'documentId' });
    }
    expect(validateCardWindowInitPayload({ ...validPayload(), documentId: '0000000000' }).documentId).toBe('0000000000');
    expect(validateCardWindowInitPayload({ ...validPayload(), documentId: 'zzzzZZZZ99' }).documentId).toBe('zzzzZZZZ99');
  });

  it('resourceBase 非空字符串闸（语法权威在资源协议侧，本闸不解析 URI）', () => {
    const rejection = captureRejection(() => validateCardWindowInitPayload({ ...validPayload(), resourceBase: '' }));
    expect(rejection.details).toMatchObject({ field: 'resourceBase' });
    expect(validateCardWindowInitPayload({ ...validPayload(), resourceBase: '/' }).resourceBase).toBe('/');
  });

  it('pluginEntries 映射闸：非普通对象 / 非字符串值 / 空串值 / 空键拒绝；空映射合法', () => {
    for (const bad of [null, [], ['a'], { k: 1 }, { '': 'v' }, { k: '' }, { k: 'v', k2: 3 }]) {
      const rejection = captureRejection(() =>
        validateCardWindowInitPayload({ ...validPayload(), pluginEntries: bad as unknown as Record<string, string> })
      );
      expect(rejection.details).toMatchObject({ gate: 'response', field: 'pluginEntries' });
    }
    expect(validateCardWindowInitPayload({ ...validPayload(), pluginEntries: {} }).pluginEntries).toEqual({});
  });

  it('tokens 映射闸：键必须 `--` 前缀、值必须字符串；空集合法（CSS 变量表口径）', () => {
    for (const bad of [{ color: 'red' }, { '--chips-x': 1 }, null, 'x']) {
      const rejection = captureRejection(() =>
        validateCardWindowInitPayload({ ...validPayload(), tokens: bad as unknown as Record<string, string> })
      );
      expect(rejection.details).toMatchObject({ field: 'tokens' });
    }
    expect(validateCardWindowInitPayload({ ...validPayload(), tokens: {} }).tokens).toEqual({});
  });

  it('payload 精确键集：缺字段与多字段均拒（additionalProperties: false 纪律）', () => {
    for (const bad of [
      { ...validPayload(), windowId: 42 },
      { source: 'a', documentId: CARD_ID, resourceBase: 'r', pluginEntries: {} },
    ]) {
      const rejection = captureRejection(() => validateCardWindowInitPayload(bad));
      expect(rejection.code).toBe('BRIDGE_INTERNAL');
      expect(String((rejection.details as { reason?: string }).reason)).toContain('payload 字段集');
    }
  });
});

/* ------------------------------------------------------------------ *
 * E 组：响应三臂封套闸矩阵
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · 响应闸（result / pending / error 三臂）', () => {
  const REQUEST_ID = 'init-req-0001';
  const WINDOW_ID = 42;

  function asResult(response: CardWindowInitResponse): { payload: ICardWindowInitPayload; windowId: number } {
    expect(isCardWindowInitResult(response)).toBe(true);
    expect(isCardWindowInitPending(response)).toBe(false);
    expect(isCardWindowInitFailure(response)).toBe(false);
    return response as { payload: ICardWindowInitPayload; windowId: number };
  }

  it('就绪臂：构造器产物过闸，windowId 与 payload 原样收敛（windowId↔init 一致性锁的响应侧承载）', () => {
    const payload = validPayload();
    const built = createCardWindowInitResult(REQUEST_ID, WINDOW_ID, payload);
    const validated = validateCardWindowInitResponse(built, REQUEST_ID);
    expect(asResult(validated).windowId).toBe(WINDOW_ID);
    expect(asResult(validated).payload).toEqual(payload);
  });

  it('空载臂：合法瞬态竞态回包无负载字段，过闸判别 pending', () => {
    const built = createCardWindowInitPending(REQUEST_ID, WINDOW_ID);
    const validated = validateCardWindowInitResponse(built, REQUEST_ID);
    expect(isCardWindowInitPending(validated)).toBe(true);
    expect(validated).toEqual(built);
  });

  it('失败臂：在册码逐码经普通对象形态还原（销毁竞态 / 绑定未就绪 / 非法请求转化腿）', () => {
    for (const code of Object.values(CARD_WINDOW_INIT_CHANNEL_ERROR_CODES)) {
      const built = createCardWindowInitFailure(REQUEST_ID, WINDOW_ID, { code, message: '装载输入投递失败', retryable: false });
      // 线上形态纪律：构造器入包必须是跨边界普通对象（不得传输 Error 实例，《01-Bridge-API规范》§2.5）。
      expect(built.error, code).not.toBeInstanceOf(Error);
      const validated = validateCardWindowInitResponse(built, REQUEST_ID);
      expect(isCardWindowInitFailure(validated), code).toBe(true);
      const failure = validated as { error: { code: string; retryable: boolean } };
      expect(failure.error.code, code).toBe(code);
      expect(failure.error.retryable, code).toBe(false);
    }
  });

  it('失败臂：面外码回包经归一落 BRIDGE_INTERNAL（details.cause 留原码）', () => {
    const built = createCardWindowInitFailure(REQUEST_ID, WINDOW_ID, createBridgeError(BRIDGE_ERROR_CODES.timeout));
    const validated = validateCardWindowInitResponse(built, REQUEST_ID);
    if (!isCardWindowInitFailure(validated)) {
      throw new Error('失败臂判别异常');
    }
    expect(validated.error.code).toBe('BRIDGE_INTERNAL');
    expect(validated.error.details).toEqual({ cause: 'BRIDGE_TIMEOUT' });
  });

  it('封套级拒绝矩阵全部以 BRIDGE_INTERNAL 交付（主进程回包违约口径）', () => {
    const result = createCardWindowInitResult(REQUEST_ID, WINDOW_ID, validPayload());
    const cases: ReadonlyArray<readonly [string, unknown]> = [
      ['非对象', 'x'],
      ['协议版本不符', { ...result, protocol: 'other/9' }],
      ['请求侧未回 requestId 一致（关联锁）', { ...result, requestId: 'other-id' }],
      ['消息类型不是响应臂（fetch 混入）', { ...result, type: 'card-window-init:fetch' }],
      ['消息类型未知', { ...result, type: 'card-window:init' }],
      ['就绪臂缺 payload', { protocol: CARD_WINDOW_INIT_PROTOCOL, type: 'card-window-init:result', requestId: REQUEST_ID, windowId: WINDOW_ID }],
      ['就绪臂多字段', { ...result, extra: true }],
      ['空载臂带 payload', { ...createCardWindowInitPending(REQUEST_ID, WINDOW_ID), payload: validPayload() }],
      ['失败臂 error 非 IChipsError 同构', { ...result, type: 'card-window-init:error', error: { code: 1 } }],
    ];
    for (const [label, data] of cases) {
      const rejection = captureRejection(() => validateCardWindowInitResponse(data, REQUEST_ID));
      expect(rejection.code, label).toBe('BRIDGE_INTERNAL');
      expect((rejection.details as { gate?: string }).gate, label).toBe('response');
    }
  });

  it('windowId 正安全整数闸（§7.4 webContents.id；0/负数/小数/NaN/字符串全拒）', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, '42', Number.MAX_SAFE_INTEGER + 1]) {
      const rejection = captureRejection(() =>
        validateCardWindowInitResponse({ ...createCardWindowInitPending(REQUEST_ID, WINDOW_ID), windowId: bad }, REQUEST_ID)
      );
      expect(rejection.code).toBe('BRIDGE_INTERNAL');
      expect(rejection.details).toMatchObject({ field: 'windowId' });
    }
  });

  it('expectedRequestId 自身非法即拒（关联锁前置防线）', () => {
    for (const bad of ['', 7]) {
      const rejection = captureRejection(() =>
        validateCardWindowInitResponse(createCardWindowInitPending(REQUEST_ID, WINDOW_ID), bad as string)
      );
      expect(rejection.code).toBe('BRIDGE_INTERNAL');
    }
  });

  it('就绪臂 payload 违约以 BRIDGE_INTERNAL 交付（回包契约闸统一码）', () => {
    const rejection = captureRejection(() =>
      validateCardWindowInitResponse(
        createCardWindowInitResult(REQUEST_ID, WINDOW_ID, { ...validPayload(), documentId: 'bad' }),
        REQUEST_ID
      )
    );
    expect(rejection.code).toBe('BRIDGE_INTERNAL');
  });
});

/* ------------------------------------------------------------------ *
 * F 组：消费形状一致性锁（shared 契约 ↔ card.ts ICardWindowInit）
 * ------------------------------------------------------------------ */

/** 编译期恒等断言助手（与 loader-contract 测试同纪律；漂移时包级 tsc 闸红）。 */
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

/** 编译期互赋锁：投递 payload 与渲染消费形状双向可赋值且键集恒等（不 import 渲染运行时代码进 shared）。 */
export type PayloadAssignableToCardWindowInit = Expect<ICardWindowInitPayload extends ICardWindowInit ? true : false>;
export type CardWindowInitAssignableToPayload = Expect<ICardWindowInit extends ICardWindowInitPayload ? true : false>;
export type PayloadKeysIdenticalLock = Expect<Equal<keyof ICardWindowInitPayload, keyof ICardWindowInit>>;
/** 编译期键集锁：窗口装载层最小面只暴露单方法 `requestInit`（新独立世界键集冻结）。 */
export type SurfaceKeySetLock = Expect<Equal<keyof import('../src/shared/card-window-init-surface.js').ICardWindowInitSurface, 'requestInit'>>;

describe('卡片窗口装载输入投递 · 消费形状与键集漂移锁', () => {
  it('card.ts `ICardWindowInit` 源文本字段面与 payload 键集清单逐字一致', () => {
    const source = readFileSync(fileURLToPath(new URL('../src/renderer/entries/card.ts', import.meta.url)), 'utf8');
    const block = source.match(/export interface ICardWindowInit \{[\s\S]*?\n\}/);
    expect(block, 'card.ts 中 ICardWindowInit 接口块必须存在（改名/删除即投递契约漂移）').not.toBeNull();
    const fieldNames = [...block![0].matchAll(/^\s{2}readonly (\w+):/gm)].map((match) => match[1] as string);
    expect([...fieldNames].sort()).toEqual([...CARD_WINDOW_INIT_PAYLOAD_FIELDS].sort());
  });

  it('运行期同形探针：合法 payload 直接满足 ICardWindowInit 消费输入（构造零适配）', () => {
    const init: ICardWindowInit = validPayload();
    expect(init.documentId).toBe(CARD_ID);
  });
});

/* ------------------------------------------------------------------ *
 * G 组：契约文件 import 面纯净锁
 * ------------------------------------------------------------------ */

describe('卡片窗口装载输入投递 · import 面纯净（契约零实现体）', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/shared/card-window-init-surface.ts', import.meta.url)),
    'utf8'
  );

  /** 全部静态 import 来源（含 type-only）。 */
  const importSpecifiers: readonly string[] = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);

  it('运行期依赖仅 @chips/bridge（错误归一）与文档域在册码表常量', () => {
    expect([...new Set(importSpecifiers)].sort()).toStrictEqual(['../capabilities/document/errors.js', '@chips/bridge']);
  });

  it('零宿主进程能力：无 IPC / DOM / 定时器 / 订阅标识符（import 白名单由上一用例锁定）', () => {
    const codeFace = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of [
      'ipcMain',
      'ipcRenderer',
      'contextBridge',
      'window.',
      'document.',
      'webContents',
      'setTimeout',
      'setInterval',
      'addEventListener',
      'postMessage',
      'require(',
      'fetch(',
    ] as const) {
      expect(codeFace, forbidden).not.toContain(forbidden);
    }
  });

  it('导出面全为纯常量/类型/函数（零类实例、零单例对象、错误实例不外泄）', () => {
    const surface = {
      CARD_WINDOW_INIT_PROTOCOL,
      CARD_WINDOW_INIT_REQUEST_CHANNEL,
      CARD_WINDOW_INIT_SURFACE_KEY,
      CARD_WINDOW_INIT_MESSAGE_TYPES,
      CARD_WINDOW_INIT_PAYLOAD_FIELDS,
      CARD_WINDOW_INIT_CHANNEL_ERROR_CODES,
    };
    for (const [name, value] of Object.entries(surface)) {
      expect(['string', 'object'], name).toContain(typeof value);
      expect(value, name).not.toBeInstanceOf(Error);
    }
    for (const fn of [
      createCardWindowInitFetchRequest,
      createCardWindowInitResult,
      createCardWindowInitPending,
      createCardWindowInitFailure,
      validateCardWindowInitRequest,
      validateCardWindowInitResponse,
      validateCardWindowInitPayload,
      normalizeCardWindowInitError,
      isCardWindowInitChannelErrorCode,
    ]) {
      expect(typeof fn).toBe('function');
    }
  });
});
