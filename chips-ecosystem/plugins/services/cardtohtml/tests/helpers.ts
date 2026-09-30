/**
 * 测试夹具：在册卡片文档模型 + 可编程伪 Bridge（不触真库、不触宿主）。
 *
 * 伪 Bridge 只实现转换链消费的能力（document:open/read、file:list/delete/mkdir/copy/write），
 * 形状与 `@chips/sdk` 能力契约类型一致；未实现能力被调用即失败，防测试假绿。
 */

import { ChipsError } from '@chips/sdk';
import type { IServiceBridge } from '@chips/sdk';

export interface IFakeDocumentFixture {
  readonly documentId: string;
  readonly kind: 'card' | 'box';
  readonly digest: string;
  readonly metadata: Record<string, unknown>;
  readonly structure: readonly { id: string; type: string }[];
  readonly manifest: { resources?: readonly unknown[] };
  readonly contentByNode: Readonly<Record<string, Record<string, unknown>>>;
}

export const DOCUMENT_FIXTURE: IFakeDocumentFixture = {
  documentId: 'card-20260924000001',
  kind: 'card',
  digest: 'digest-fix-001',
  metadata: {
    card_id: 'card-20260924000001',
    name: '测试卡片',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-09-24T00:00:00Z',
    theme: 'default',
    tags: ['示例', ['尺寸', '大']],
  },
  structure: [
    { id: 'node-1', type: 'content' },
    { id: 'node-2', type: 'content' },
  ],
  manifest: {
    resources: [
      { path: 'resources/pictures/photo.png', type: 'image/png', width: 100, height: 50 },
      { path: 'resources/files/notes.txt', type: 'text/plain' },
    ],
  },
  contentByNode: {
    'node-1': {
      card_type: 'demo.text',
      title: '正文段',
      picture: 'resources/pictures/photo.png',
      note: '第一行\n第二行',
    },
    'node-2': {
      card_type: 'demo.list',
      items: [1, true, ['深', '层'], { 嵌套: '值', 空: null }],
      attachment: 'resources/files/notes.txt',
    },
  },
};

export const SOURCE_PATH = '/docs/cards/demo.card';
export const OUTPUT_PATH = '/exports/demo-html';

export interface IFakeBridgeState {
  outputExists: boolean;
  readonly writes: { path: string; data: string }[];
  readonly copies: { source: string; target: string }[];
  readonly mkdirs: string[];
  readonly deletes: { path: string; recursive?: boolean }[];
  readonly lists: string[];
  readonly missingResources: Set<string>;
}

export interface IFakeBridgeOptions {
  readonly fixture?: IFakeDocumentFixture;
  readonly outputExists?: boolean;
  readonly missingResources?: readonly string[];
  readonly failOpenWith?: ChipsError;
}

export interface IFakeBridge {
  readonly bridge: IServiceBridge;
  readonly state: IFakeBridgeState;
}

export function createFakeBridge(options: IFakeBridgeOptions = {}): IFakeBridge {
  const fixture = options.fixture ?? DOCUMENT_FIXTURE;
  const state: IFakeBridgeState = {
    outputExists: options.outputExists ?? false,
    writes: [],
    copies: [],
    mkdirs: [],
    deletes: [],
    lists: [],
    missingResources: new Set(options.missingResources ?? []),
  };

  /** 按能力分发假响应：返回值即成功载荷，抛出即失败（经 request 包裹为 rejected Promise）。 */
  const respondTo = <TOutput>(capabilityId: string, input?: unknown): TOutput => {
    const respond = (value: unknown): TOutput => value as TOutput;
    const record = (input ?? {}) as Record<string, unknown>;
      switch (capabilityId) {
        case 'document:open': {
          if (options.failOpenWith) {
            throw options.failOpenWith;
          }
          return respond({
            documentId: fixture.documentId,
            source: record.source,
            kind: fixture.kind,
            digest: fixture.digest,
          });
        }
        case 'document:read': {
          if (record.part === 'metadata') {
            return respond({ part: 'metadata', value: fixture.metadata, diagnostics: [] });
          }
          if (record.part === 'structure') {
            return respond({
              part: 'structure',
              value: { structure: fixture.structure, manifest: fixture.manifest },
              diagnostics: [],
            });
          }
          if (record.part === 'content') {
            const nodeId = typeof record.nodeId === 'string' ? record.nodeId : '';
            const value = fixture.contentByNode[nodeId];
            if (!value) {
              throw new ChipsError({ code: 'DOCUMENT_NOT_FOUND', message: '文档节点不存在' });
            }
            return respond({ part: 'content', value, diagnostics: [] });
          }
          throw new ChipsError({ code: 'DOCUMENT_PART_UNSUPPORTED', message: '切片不支持' });
        }
        case 'file:list': {
          state.lists.push(typeof record.directory === 'string' ? record.directory : '');
          return respond({ entries: state.outputExists ? [OUTPUT_PATH] : [] });
        }
        case 'file:delete': {
          state.deletes.push({ path: String(record.path), recursive: record.recursive === true });
          if (String(record.path) === OUTPUT_PATH) {
            state.outputExists = false;
          }
          return respond(undefined);
        }
        case 'file:mkdir': {
          state.mkdirs.push(String(record.path));
          return respond(undefined);
        }
        case 'file:copy': {
          const source = String(record.source);
          if (state.missingResources.has(source)) {
            throw new ChipsError({ code: 'FILE_NOT_FOUND', message: '目标不存在' });
          }
          state.copies.push({ source, target: String(record.target) });
          return respond(undefined);
        }
        case 'file:write': {
          state.writes.push({ path: String(record.path), data: String(record.data) });
          return respond(undefined);
        }
        default:
          throw new ChipsError({
            code: 'BRIDGE_CAPABILITY_NOT_FOUND',
            message: `测试未实现能力：${capabilityId}`,
          });
      }
    };

  const bridge: IServiceBridge = {
    request: <TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> =>
      Promise.resolve().then(() => respondTo<TOutput>(capabilityId, input)),
    resource: () => {
      throw new ChipsError({ code: 'BRIDGE_CAPABILITY_NOT_FOUND', message: '资源句柄不在测试面' });
    },
  };

  return { bridge, state };
}

export function errorCodeOf(error: unknown): string | undefined {
  if (error instanceof ChipsError) {
    return error.code;
  }
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}

/** 标准导出输入（可局部覆盖）。 */
export function baseInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: SOURCE_PATH,
    output: { path: OUTPUT_PATH, packageMode: 'directory', overwrite: false },
    options: { includeAssets: true, includeManifest: true },
    ...overrides,
  };
}
