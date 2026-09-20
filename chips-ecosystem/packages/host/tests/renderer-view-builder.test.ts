/**
 * `DocumentView` 文档视图构建器正式绑定单测（W2 金链路刀3，集成缝 1）。
 *
 * 权威：《05-渲染引擎设计》§2.6（构建器输入句柄+会话、无自有缓存、确定性、只做字段投影与
 * 不透明值保留）、《03-核心接口规范》§6.4（`buildDocumentView(handle, session)` /
 * `documentReadResource(handle, path, range?)` 导出名与参数位次）与 §6.6（九导出类型冻结形状、
 * 可结构化克隆、资源引用保持原样）、《06-资源协议规范》§2.6（URI 归一）与 §7.2（错误码）、
 * 工单024（`@chips/bridge` `normalizeError` 唯一类还原，backing 契约码透传）。
 *
 * 覆盖面：
 * - 正向：卡片视图 DTO 逐字段对 §6.6、无自有缓存（逐调用触达 backing）、不透明值原样保留、
 *   资源臂 URI 归一与窗口逐位转发；
 * - 负向：非 card kind 拒绝、空定位字段拒绝、非法 sessionId 拒绝、解析入口失败透传、
 *   句柄失效（backing `DOCUMENT_NOT_FOUND`）、native 抛 `IChipsError` 结构对象还原、
 *   视图形状违约（缺字段/多字段/非法 revision/函数/循环引用/类实例）逐面 `BRIDGE_INTERNAL`、
 *   跨作用域与 external 起源拒绝、URI 语法码透传、缺导出 fail-closed 装载拒绝。
 */

import { describe, expect, it } from 'vitest';
import { ChipsError, isChipsError } from '@chips/bridge';

import { createDocumentViewBuilder } from '../src/renderer/document-view-builder.js';
import type {
  IDocumentViewBuildInput,
  IDocumentViewBuilderService,
  IDocumentViewSessionBinding,
  INativeDocumentViewHandle,
  INativeDocumentViewModule,
} from '../src/renderer/document-view-builder.js';
import type { IDocumentViewBuilder } from '../src/renderer/render-engine.js';
import { CARD_ID, NODE_ID_ONE, NODE_ID_TWO } from './helpers/document-fake-ports.js';

/** 调用日志项。 */
interface IFakeCall {
  readonly fn: string;
  readonly args: readonly unknown[];
}

/** 替身注入面夹具面。 */
interface IFakeNativeTrack {
  readonly module: INativeDocumentViewModule;
  readonly calls: IFakeCall[];
  readonly handle: INativeDocumentViewHandle;
  /** 置位后两臂一律以句柄失效码拒绝（模拟文档记录已释放）。 */
  invalidateHandle(): void;
  /** 覆盖 `buildDocumentView` 返回值（形状违约用例）。 */
  setView(value: unknown): void;
  /** 覆盖 `documentReadResource` 返回字节。 */
  setResource(bytes: Uint8Array): void;
  /** 注入指定导出的失败（backing 抛错用例）。 */
  failWith(exportName: 'buildDocumentView' | 'documentReadResource', error: unknown): void;
}

/** §6.6 `CardRenderView` 冻结形状的替身产出（snake_case 逐字段在册）。 */
function baseView(): Record<string, unknown> {
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

/** §12.2 同构错误：`Error` 自有属性 `code` / `message` / `details` / `retryable`。 */
function bindingError(
  code: string,
  message: string,
  extra: { readonly details?: unknown; readonly retryable?: boolean } = {}
): Error {
  return Object.assign(new Error(message), {
    code,
    details: extra.details ?? { origin: 'chips-parser' },
    retryable: extra.retryable ?? false,
  });
}

/** 构造视图构建域替身注入面（两臂调用日志 + 失败/返回值注入面板）。 */
function createFakeNativeViewModule(): IFakeNativeTrack {
  const calls: IFakeCall[] = [];
  const handle = { nativeDocumentHandleBrand: 'chips-native.document' } as const satisfies INativeDocumentViewHandle;
  const panel: { view: unknown; resource: Uint8Array; failure: Record<string, unknown>; invalidated: boolean } = {
    view: baseView(),
    resource: new Uint8Array([1, 2, 3]),
    failure: {},
    invalidated: false,
  };

  function dispatch<T>(fn: string, args: readonly unknown[], produce: () => T): Promise<T> {
    calls.push({ fn, args });
    if (panel.invalidated) {
      throw bindingError('DOCUMENT_NOT_FOUND', '解析句柄不存在或已释放');
    }
    const failure = panel.failure[fn];
    if (failure !== undefined) {
      throw failure;
    }
    return Promise.resolve(produce());
  }

  const module: INativeDocumentViewModule = {
    buildDocumentView(handleArg, session) {
      return dispatch('buildDocumentView', [handleArg, session], () => panel.view as Record<string, unknown>);
    },
    documentReadResource(handleArg, path, range) {
      return dispatch(
        'documentReadResource',
        [handleArg, path, ...(range === undefined ? [] : [range])],
        () => panel.resource
      );
    },
  };

  return {
    module,
    calls,
    handle,
    invalidateHandle() {
      panel.invalidated = true;
    },
    setView(value) {
      panel.view = value;
    },
    setResource(bytes) {
      panel.resource = bytes;
    },
    failWith(exportName, error) {
      panel.failure[exportName] = error;
    },
  };
}

/** 构建器夹具面。 */
interface IBuilderFixture {
  readonly builder: IDocumentViewBuilderService;
  readonly native: IFakeNativeTrack;
  readonly sessionCalls: IDocumentViewBuildInput[];
  setBinding(binding: Partial<IDocumentViewSessionBinding> | null): void;
  failResolver(error: unknown): void;
}

/** 会话绑定基线（测试侧替身解析入口；生产由刀4 组合根绑定文档服务）。 */
function defaultBinding(handle: INativeDocumentViewHandle): IDocumentViewSessionBinding {
  return { handle, sessionId: 42, managedScope: 'card-7f3a' };
}

/** 构造「真实现 + 替身注入面 + 替身解析入口」夹具。 */
function createBuilderFixture(): IBuilderFixture {
  const native = createFakeNativeViewModule();
  const sessionCalls: IDocumentViewBuildInput[] = [];
  let binding: IDocumentViewSessionBinding | null = defaultBinding(native.handle);
  let resolverFailure: unknown;
  const builder = createDocumentViewBuilder({
    native: native.module,
    resolveSession: (input) => {
      sessionCalls.push(input);
      if (resolverFailure !== undefined) {
        return Promise.reject(resolverFailure);
      }
      if (binding === null) {
        return Promise.reject(bindingError('DOCUMENT_NOT_OPEN', '文档未打开'));
      }
      return Promise.resolve(binding);
    },
  });
  return {
    builder,
    native,
    sessionCalls,
    setBinding(next) {
      binding = next === null ? null : { ...defaultBinding(native.handle), ...next };
    },
    failResolver(error) {
      resolverFailure = error;
    },
  };
}

/** 捕获拒绝值（未抛错即失败）。 */
async function captureRejection(run: Promise<unknown>): Promise<unknown> {
  try {
    await run;
  } catch (error) {
    return error;
  }
  throw new Error('预期以登记码拒绝，实际正常完成');
}

/** 断言拒绝为唯一类 `ChipsError` 并返回（工单024：跨边界还原后一律唯一类实例）。 */
async function expectChipsError(run: Promise<unknown>, code: string): Promise<ChipsError> {
  const error = await captureRejection(run);
  expect(error).toBeInstanceOf(ChipsError);
  expect((error as ChipsError).code).toBe(code);
  return error as ChipsError;
}

const CARD_INPUT = { source: `chips-resource://card-7f3a/${CARD_ID}.card`, documentId: CARD_ID, kind: 'card' } as const;

describe('正向：卡片视图构建（§6.6 / §2.6）', () => {
  it('DTO 逐字段对 §6.6：字段集精确、值原样投影、可结构化克隆', async () => {
    const fixture = createBuilderFixture();
    const expected = {
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
    } as const;
    const view = await fixture.builder.buildView(CARD_INPUT);
    expect(view).toStrictEqual(expected);
    expect(Object.keys(view).sort()).toStrictEqual(
      ['card_id', 'chip_standards_version', 'content_nodes', 'cover', 'cover_ratio', 'kind', 'name', 'revision', 'tags']
    );
    // 可结构化克隆（§6.6 规则 3）：克隆往返与本体逐字段一致。
    expect(structuredClone(view)).toStrictEqual(view);
    // 逐调用把句柄与数值会话按 §6.4 位次交 backing。
    expect(fixture.native.calls).toStrictEqual([{ fn: 'buildDocumentView', args: [fixture.native.handle, 42] }]);
  });

  it('构建器无自有缓存：两次构建各触达 backing 一次且输出确定（§2.6）', async () => {
    const fixture = createBuilderFixture();
    const first = await fixture.builder.buildView(CARD_INPUT);
    const second = await fixture.builder.buildView(CARD_INPUT);
    expect(second).toStrictEqual(first);
    expect(fixture.native.calls.map((call) => call.fn)).toStrictEqual(['buildDocumentView', 'buildDocumentView']);
  });

  it('不透明值原样保留：content 嵌套结构不解释、不改写（§2.6 构建规则）', async () => {
    const fixture = createBuilderFixture();
    const view = await fixture.builder.buildView(CARD_INPUT);
    expect(view.content_nodes[1]?.content).toStrictEqual({
      md: 'richtext/a.md',
      blocks: [{ type: 'p', text: '正文' }],
    });
    // 视图不携带文件字节：资源引用保持包内相对路径原样。
    expect(view.content_nodes[0]?.content['src']).toBe('image.jpg');
  });

  it('资源臂：受管 URI 归一为包内路径（大小写作用域 + 一次百分号解码）后逐位交 backing', async () => {
    const fixture = createBuilderFixture();
    const bytes = new Uint8Array([9, 8, 7]);
    fixture.native.setResource(bytes);
    const result = await fixture.builder.readResource({
      ...CARD_INPUT,
      reference: 'chips-resource://Card-7F3A/resources/%69mage.jpg',
    });
    expect(result).toBe(bytes);
    expect(fixture.native.calls).toStrictEqual([
      { fn: 'documentReadResource', args: [fixture.native.handle, 'resources/image.jpg'] },
    ]);
    expect(fixture.sessionCalls).toHaveLength(1);
  });

  it('资源臂：包内相对路径原样透传，字节窗口按 §12.1 {offset,length} 转发', async () => {
    const fixture = createBuilderFixture();
    await fixture.builder.readResource({ ...CARD_INPUT, reference: 'video.mp4', range: { offset: 10, length: 20 } });
    expect(fixture.native.calls[0]).toStrictEqual({
      fn: 'documentReadResource',
      args: [fixture.native.handle, 'video.mp4', { offset: 10, length: 20 }],
    });
  });
});

describe('负向：输入与会话闸', () => {
  it('非 card kind 输入以 BRIDGE_INVALID_INPUT 拒绝，零触达 backing', async () => {
    const fixture = createBuilderFixture();
    await expectChipsError(
      fixture.builder.buildView({ source: CARD_INPUT.source, documentId: 'Zz9Yy8Xx7W', kind: 'box' }),
      'BRIDGE_INVALID_INPUT'
    );
    expect(fixture.native.calls).toHaveLength(0);
  });

  it('空来源 / 空文档标识以 BRIDGE_INVALID_INPUT 拒绝', async () => {
    const fixture = createBuilderFixture();
    await expectChipsError(fixture.builder.buildView({ ...CARD_INPUT, source: '' }), 'BRIDGE_INVALID_INPUT');
    await expectChipsError(fixture.builder.buildView({ ...CARD_INPUT, documentId: '' }), 'BRIDGE_INVALID_INPUT');
    expect(fixture.native.calls).toHaveLength(0);
  });

  it('非法 sessionId（小数 / 负数 / 超 2^53-1）在触达 backing 前拒绝（§6.4 u64 数值面）', async () => {
    for (const sessionId of [1.5, -1, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
      const fixture = createBuilderFixture();
      fixture.setBinding({ sessionId });
      const error = await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'BRIDGE_INVALID_INPUT');
      expect(error.details).toMatchObject({ sessionId });
      expect(fixture.native.calls).toHaveLength(0);
    }
  });

  it('解析入口抛 §12.2 同构错误：还原唯一类并透传登记码（不发明映射）', async () => {
    const fixture = createBuilderFixture();
    fixture.failResolver(bindingError('DOCUMENT_NOT_OPEN', '文档未打开'));
    await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'DOCUMENT_NOT_OPEN');
    // 绑定形状违约（句柄缺位）归 BRIDGE_INTERNAL。
    const broken = createBuilderFixture();
    broken.setBinding({ handle: null as unknown as INativeDocumentViewHandle });
    await expectChipsError(broken.builder.buildView(CARD_INPUT), 'BRIDGE_INTERNAL');
  });
});

describe('负向：backing 错误还原与视图守门', () => {
  it('句柄失效：backing 抛 DOCUMENT_NOT_FOUND 同构错误，码/消息/details/retryable 原样还原透传', async () => {
    const fixture = createBuilderFixture();
    fixture.native.invalidateHandle();
    const error = await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'DOCUMENT_NOT_FOUND');
    expect(error.message).toBe('解析句柄不存在或已释放');
    expect(error.details).toStrictEqual({ origin: 'chips-parser' });
    expect(error.retryable).toBe(false);
  });

  it('native 抛 IChipsError 结构对象（非 Error 实例）：还原为唯一类实例，retryable=true 保留', async () => {
    const fixture = createBuilderFixture();
    fixture.native.failWith('buildDocumentView', {
      code: 'DOCUMENT_PARSE_CANCELLED',
      message: '解析已取消',
      retryable: true,
      details: { stage: 'view' },
    });
    const error = await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'DOCUMENT_PARSE_CANCELLED');
    expect(isChipsError(error)).toBe(true);
    expect(error.retryable).toBe(true);
    expect(error.details).toStrictEqual({ stage: 'view' });
  });

  it('backing 返回非 card 判别视图（kind=box）以 BRIDGE_INTERNAL 契约违约拒绝', async () => {
    const fixture = createBuilderFixture();
    // 键集与 CardRenderView 冻结形状一致、仅判别字段为 box：确保拒绝点是 kind 判别闸而非键集闸。
    const boxFlavored = baseView();
    boxFlavored['kind'] = 'box';
    fixture.native.setView(boxFlavored);
    const error = await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'BRIDGE_INTERNAL');
    expect(error.details).toMatchObject({ source: 'buildDocumentView', kind: 'box' });
  });

  it('视图形状违约逐面拒绝：缺字段 / 多字段 / 非法 revision / 节点键集漂移 / cover 键集漂移', async () => {
    const mutations: readonly { readonly name: string; readonly mutate: (view: Record<string, unknown>) => void }[] = [
      { name: '缺 card_id', mutate: (view) => { delete view['card_id']; } },
      { name: '多未知字段', mutate: (view) => { view['extra'] = 1; } },
      { name: 'revision 非整数', mutate: (view) => { view['revision'] = 1.5; } },
      { name: 'revision 超安全整数（u64 越界）', mutate: (view) => { view['revision'] = 2 ** 53; } },
      { name: '节点多出未知键', mutate: (view) => { (view['content_nodes'] as Record<string, unknown>[])[0]!['drift'] = true; } },
      { name: 'cover 缺 ratio', mutate: (view) => { delete (view['cover'] as Record<string, unknown>)['ratio']; } },
      { name: 'tags 成员非法', mutate: (view) => { view['tags'] = [{ bad: 1 }]; } },
      { name: 'name 非字符串', mutate: (view) => { view['name'] = 42; } },
    ];
    for (const mutation of mutations) {
      const fixture = createBuilderFixture();
      const view = baseView();
      mutation.mutate(view);
      fixture.native.setView(view);
      const error = await expectChipsError(
        fixture.builder.buildView(CARD_INPUT),
        'BRIDGE_INTERNAL'
      );
      expect(error.details, mutation.name).toMatchObject({ source: 'buildDocumentView' });
    }
  });

  it('可结构化克隆红线：函数成员 / 循环引用 / 类实例入视图一律 BRIDGE_INTERNAL（§6.6 规则 3）', async () => {
    const fn: Record<string, unknown> = baseView();
    (fn['content_nodes'] as Record<string, unknown>[])[0]!['content'] = { bad: () => 1 };

    const cyclic = baseView();
    const cycleContent: Record<string, unknown> = { a: 1 };
    cycleContent['self'] = cycleContent;
    (cyclic['content_nodes'] as Record<string, unknown>[])[0]!['content'] = cycleContent;

    const classed = baseView();
    (classed['content_nodes'] as Record<string, unknown>[])[0]!['content'] = { when: new Date() };

    for (const view of [fn, cyclic, classed]) {
      const fixture = createBuilderFixture();
      fixture.native.setView(view);
      await expectChipsError(fixture.builder.buildView(CARD_INPUT), 'BRIDGE_INTERNAL');
    }
  });
});

describe('负向：资源臂 URI 与作用域闸', () => {
  it('跨作用域受管 URI 以 RESOURCE_CROSS_SCOPE 拒绝；external 起源以 RESOURCE_NOT_SUPPORTED 拒绝', async () => {
    const fixture = createBuilderFixture();
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'chips-resource://box-2c91/.box/cover.html' }),
      'RESOURCE_CROSS_SCOPE'
    );
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'chips-resource://external/https/example.com/a.png' }),
      'RESOURCE_NOT_SUPPORTED'
    );
    expect(fixture.native.calls).toHaveLength(0);
  });

  it('URI 语法非法透传登记码（RESOURCE_INVALID_URI）；包内路径非法段以 RESOURCE_PATH_INVALID 拒绝', async () => {
    const fixture = createBuilderFixture();
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'chips-resource://card-7f3a/../../etc/passwd' }),
      'RESOURCE_PATH_INVALID'
    );
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'content/../secret.yaml' }),
      'RESOURCE_PATH_INVALID'
    );
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'chips-resource://card-7f3a' }),
      'RESOURCE_PATH_INVALID'
    );
    const invalidUri = await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'CHIPS-RESOURCE://card-7f3a/%ZZ.png' }),
      'RESOURCE_INVALID_URI'
    );
    expect(invalidUri.details).toMatchObject({ reason: 'invalid_encoding' });
    expect(fixture.native.calls).toHaveLength(0);
  });

  it('字节窗口非法以 BRIDGE_INVALID_INPUT 拒绝；backing 读失败登记码透传', async () => {
    const fixture = createBuilderFixture();
    await expectChipsError(
      fixture.builder.readResource({ ...CARD_INPUT, reference: 'video.mp4', range: { offset: -1, length: 10 } }),
      'BRIDGE_INVALID_INPUT'
    );
    fixture.native.failWith('documentReadResource', bindingError('RESOURCE_NOT_FOUND', '包内成员不存在'));
    await expectChipsError(fixture.builder.readResource({ ...CARD_INPUT, reference: 'gone.png' }), 'RESOURCE_NOT_FOUND');
  });

  it('backing 读资源返回非字节以 BRIDGE_INTERNAL 违约拒绝', async () => {
    const fixture = createBuilderFixture();
    const broken = createDocumentViewBuilder({
      native: {
        buildDocumentView: () => Promise.resolve(baseView()),
        documentReadResource: () => Promise.resolve('not-bytes' as unknown as Uint8Array),
      },
      resolveSession: () => Promise.resolve(defaultBinding(fixture.native.handle)),
    });
    await expectChipsError(broken.readResource({ ...CARD_INPUT, reference: 'video.mp4' }), 'BRIDGE_INTERNAL');
  });
});

describe('负向：注入面缺导出 fail-closed（刀2 装载闸同范式）', () => {
  it('缺任一 §6.4 冻结导出或解析入口非函数：构造即拒绝，点名缺失项', () => {
    const native = createFakeNativeViewModule();

    const missingRead = { ...native.module, documentReadResource: undefined } as unknown as INativeDocumentViewModule;
    let error = createBuilderError({ native: missingRead, resolveSession: () => Promise.resolve(defaultBinding(native.handle)) });
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(error.details).toStrictEqual({ export: 'documentReadResource' });

    const missingBuild = { ...native.module, buildDocumentView: undefined } as unknown as INativeDocumentViewModule;
    error = createBuilderError({ native: missingBuild, resolveSession: () => Promise.resolve(defaultBinding(native.handle)) });
    expect(error.details).toStrictEqual({ export: 'buildDocumentView' });

    error = createBuilderError({ native: native.module, resolveSession: undefined as never });
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(error.details).toStrictEqual({ port: 'resolveSession' });
  });

  it('构建器返回值即渲染端口的正式实现（IDocumentViewBuilder 结构满足）', async () => {
    const fixture = createBuilderFixture();
    const port: IDocumentViewBuilder = fixture.builder;
    const view = await port.buildView(CARD_INPUT);
    expect(view.kind).toBe('card');
  });
});

/** 捕获构造期同步拒绝的 `ChipsError`。 */
function createBuilderError(options: Parameters<typeof createDocumentViewBuilder>[0]): ChipsError {
  try {
    createDocumentViewBuilder(options);
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    return error as ChipsError;
  }
  throw new Error('预期构造期 fail-closed 拒绝，实际构造成功');
}
