/**
 * `document:*` 输入守卫与模型切片校验单测（`04-能力契约规范` §7.3 / §5.4、`11-文档服务设计` §4.3、§4.4、
 * `01-卡片文件格式` §4.1、§5.1、§5.3、`02-箱子文件格式` §4.2、§5.3、§十三）。
 *
 * 覆盖：四动作输入的形状恢复与逐项诊断码、未声明字段拒绝、`kind`/`part`/`nodeId`/`range` 组合矩阵、
 * metadata 与 structure 切片的字段级规则、序列化产物路径安全。
 */

import { describe, expect, it } from 'vitest';

import {
  assertOpenInput,
  assertPartCombination,
  assertReadInput,
  assertSerializedMemberPaths,
  assertWriteInput,
  cardStructureNodeIds,
  isDocumentValue,
  isPlainRecord,
  readArrayField,
  requireDocumentId,
  validateEntriesSlice,
  validateMetadataSlice,
  validateStructureSlice,
} from '../src/capabilities/document/validation.js';
import {
  DOCUMENT_BUSINESS_ERROR_CODES,
  DOCUMENT_CHANNEL_ERROR_CODES,
  DocumentCapabilityError,
} from '../src/capabilities/document/errors.js';

/** 10 位 Base62 成员编号（`05-ID生成规范` §一）。 */
const NODE_ID = 'Ab3dEf6Gh8';
const OTHER_ID = 'Zz9Yy8Xx7W';

/** 合法卡片 metadata。 */
function cardMetadata(): Record<string, unknown> {
  return {
    chip_standards_version: '1.0.0',
    card_id: NODE_ID,
    name: '示例卡片',
    created_at: '2026-01-02T03:04:05Z',
    modified_at: '2026-01-02T03:04:05Z',
  };
}

/** 合法箱子 metadata（`active_layout_type` 必填）。 */
function boxMetadata(): Record<string, unknown> {
  return { ...cardMetadata(), box_id: NODE_ID, active_layout_type: 'grid' };
}

/** 合法卡片 structure 切片（含 manifest 计数）。 */
function cardStructure(): Record<string, unknown> {
  return {
    structure: [{ id: NODE_ID, type: 'text' }],
    manifest: { card_count: 1, resource_count: 0, resources: [] },
  };
}

/** 执行动作并捕获抛出的文档能力错误。 */
function captureError(action: () => unknown): DocumentCapabilityError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DocumentCapabilityError);
    return error as DocumentCapabilityError;
  }
  throw new Error('预期抛出错误，实际未抛出');
}

/** 断言错误的通道码与 `capabilityId` 详情。 */
function expectInvalidInput(error: DocumentCapabilityError, capabilityId: string): void {
  expect(error.code).toBe(DOCUMENT_CHANNEL_ERROR_CODES.invalidInput);
  expect(error.details?.capabilityId).toBe(capabilityId);
  expect(typeof error.details?.reason).toBe('string');
  expect(error.retryable).toBe(false);
}

describe('输入形状守卫', () => {
  it('isPlainRecord 与 isDocumentValue 区分对象、数组与标量', () => {
    expect(isPlainRecord({})).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
    expect(isDocumentValue([])).toBe(true);
    expect(isDocumentValue('x')).toBe(false);
  });

  it('readArrayField 只在字段为数组时返回值', () => {
    expect(readArrayField({ entries: [1, 2] }, 'entries')).toEqual([1, 2]);
    expect(readArrayField({ entries: 'x' }, 'entries')).toBeNull();
    expect(readArrayField({}, 'entries')).toBeNull();
    expect(readArrayField([1, 2], 'entries')).toBeNull();
  });
});

describe('document:open 输入守卫', () => {
  it('接受仅 source 的最小输入并把 kind 归一为 null', () => {
    expect(assertOpenInput({ source: 'chips-resource://a/card/Ab3dEf6Gh8.card' })).toEqual({
      source: 'chips-resource://a/card/Ab3dEf6Gh8.card',
      kind: null,
    });
  });

  it('接受显式 kind', () => {
    expect(assertOpenInput({ source: 'x.card', kind: 'card' })).toEqual({ source: 'x.card', kind: 'card' });
    expect(assertOpenInput({ source: 'x.box', kind: 'box' })).toEqual({ source: 'x.box', kind: 'box' });
  });

  it('拒绝非对象输入', () => {
    for (const input of [null, undefined, 'x', 42, []]) {
      expectInvalidInput(
        captureError(() => assertOpenInput(input)),
        'document:open',
      );
    }
  });

  it('拒绝缺失或空 source', () => {
    expectInvalidInput(
      captureError(() => assertOpenInput({})),
      'document:open',
    );
    expectInvalidInput(
      captureError(() => assertOpenInput({ source: '' })),
      'document:open',
    );
    expectInvalidInput(
      captureError(() => assertOpenInput({ source: 7 })),
      'document:open',
    );
  });

  it('拒绝非 card/box 的 kind', () => {
    expectInvalidInput(
      captureError(() => assertOpenInput({ source: 'x', kind: 'cardd' })),
      'document:open',
    );
    expectInvalidInput(
      captureError(() => assertOpenInput({ source: 'x', kind: 1 })),
      'document:open',
    );
  });

  it('拒绝 schema 未声明字段（additionalProperties: false 同口径）', () => {
    const error = captureError(() => assertOpenInput({ source: 'x', extra: 1 }));
    expectInvalidInput(error, 'document:open');
    expect(error.details?.reason).toContain('extra');
  });
});

describe('document:read 输入守卫', () => {
  it('接受带 nodeId 与 range 的完整输入', () => {
    expect(assertReadInput({ documentId: NODE_ID, part: 'entries', range: { offset: 0, limit: 10 } })).toEqual({
      documentId: NODE_ID,
      part: 'entries',
      nodeId: null,
      range: { offset: 0, limit: 10 },
    });
  });

  it('requireDocumentId 复用同一守卫并拒绝空标识', () => {
    expect(requireDocumentId('document:save', { documentId: NODE_ID })).toBe(NODE_ID);
    expectInvalidInput(
      captureError(() => requireDocumentId('document:save', { documentId: '' })),
      'document:save',
    );
    expectInvalidInput(
      captureError(() => requireDocumentId('document:save', {})),
      'document:save',
    );
  });

  it('拒绝 part 缺失与越界取值', () => {
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID })),
      'document:read',
    );
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'layout' })),
      'document:read',
    );
  });

  it('拒绝空 nodeId', () => {
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'content', nodeId: '' })),
      'document:read',
    );
  });

  it('拒绝非对象 range 与越界 offset/limit', () => {
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'entries', range: 'x' })),
      'document:read',
    );
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'entries', range: { offset: -1, limit: 10 } })),
      'document:read',
    );
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'entries', range: { offset: 0.5, limit: 10 } })),
      'document:read',
    );
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'entries', range: { offset: 0, limit: 0 } })),
      'document:read',
    );
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'entries', range: { offset: 0, limit: 1001 } })),
      'document:read',
    );
  });

  it('拒绝未声明字段', () => {
    expectInvalidInput(
      captureError(() => assertReadInput({ documentId: NODE_ID, part: 'metadata', nope: 1 })),
      'document:read',
    );
  });
});

describe('document:write 输入守卫', () => {
  it('接受对象、数组与 null 三种 value 形态', () => {
    expect(assertWriteInput({ documentId: NODE_ID, part: 'metadata', value: { a: 1 } })).toEqual({
      documentId: NODE_ID,
      part: 'metadata',
      nodeId: null,
      value: { a: 1 },
    });
    expect(assertWriteInput({ documentId: NODE_ID, part: 'content', nodeId: NODE_ID, value: null }).nodeId).toBe(
      NODE_ID,
    );
    expect(assertWriteInput({ documentId: NODE_ID, part: 'entries', value: [] }).value).toEqual([]);
  });

  it('缺少 value 键即拒绝（value: null 是合法删除标记）', () => {
    expectInvalidInput(
      captureError(() => assertWriteInput({ documentId: NODE_ID, part: 'metadata' })),
      'document:write',
    );
  });

  it('拒绝标量 value', () => {
    expectInvalidInput(
      captureError(() => assertWriteInput({ documentId: NODE_ID, part: 'metadata', value: 3 })),
      'document:write',
    );
    expectInvalidInput(
      captureError(() => assertWriteInput({ documentId: NODE_ID, part: 'metadata', value: 'x' })),
      'document:write',
    );
  });

  it('nodeId 与非 content 切片组合在输入守卫即拒绝', () => {
    expectInvalidInput(
      captureError(() => assertWriteInput({ documentId: NODE_ID, part: 'structure', nodeId: NODE_ID, value: {} })),
      'document:write',
    );
    expectInvalidInput(
      captureError(() => assertWriteInput({ documentId: NODE_ID, part: 'metadata', value: null })),
      'document:write',
    );
  });

  it('nodeId 不符合 10 位 Base62 时按业务码拒绝（非输入码）', () => {
    const error = captureError(() =>
      assertWriteInput({ documentId: NODE_ID, part: 'content', nodeId: 'short', value: {} }),
    );
    expect(error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported);
    expect(error.details?.nodeId).toBe('short');
  });
});

describe('切片组合矩阵（§4.3）', () => {
  it('卡片支持 metadata / structure / content(带 nodeId)', () => {
    expect(() => assertPartCombination('card', 'metadata', null, null, 'document:read')).not.toThrow();
    expect(() => assertPartCombination('card', 'structure', null, null, 'document:read')).not.toThrow();
    expect(() => assertPartCombination('card', 'content', NODE_ID, null, 'document:read')).not.toThrow();
  });

  it('卡片不支持 entries 切片', () => {
    const error = captureError(() => assertPartCombination('card', 'entries', null, null, 'document:read'));
    expect(error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.partUnsupported);
    expect(error.details?.reason).toContain('卡片不支持 entries 切片');
  });

  it('卡片 content 切片必须携带 nodeId', () => {
    expect(
      captureError(() => assertPartCombination('card', 'content', null, null, 'document:read')).details?.reason,
    ).toContain('必须携带 nodeId');
  });

  it('箱子 content 切片是布局配置，不接受 nodeId', () => {
    expect(
      captureError(() => assertPartCombination('box', 'content', NODE_ID, null, 'document:read')).details?.reason,
    ).toContain('不接受 nodeId');
  });

  it('箱子支持 metadata / structure / content / entries', () => {
    for (const part of ['metadata', 'structure', 'content', 'entries'] as const) {
      expect(() => assertPartCombination('box', part, null, null, 'document:read')).not.toThrow();
    }
  });

  it('range 仅适用于 entries 切片', () => {
    expect(
      captureError(() => assertPartCombination('box', 'structure', null, { offset: 0, limit: 1 }, 'document:read'))
        .details?.reason,
    ).toContain('range 仅适用于 entries 切片');
    expect(() => assertPartCombination('box', 'entries', null, { offset: 0, limit: 1 }, 'document:read')).not.toThrow();
  });

  it('nodeId 仅适用于 content 切片', () => {
    expect(
      captureError(() => assertPartCombination('box', 'metadata', NODE_ID, null, 'document:read')).details?.reason,
    ).toContain('nodeId 仅适用于 content 切片');
  });
});

describe('metadata 切片校验', () => {
  it('接受合法卡片与箱子 metadata', () => {
    expect(() => validateMetadataSlice('card', cardMetadata())).not.toThrow();
    expect(() => validateMetadataSlice('box', boxMetadata())).not.toThrow();
  });

  it('拒绝数组形态', () => {
    expect(captureError(() => validateMetadataSlice('card', [])).code).toBe(
      DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid,
    );
  });

  it('拒绝非严格三段式标准版本', () => {
    for (const version of ['1.0', '1.0.0-beta', '1.0.0+build', 'v1.0.0', 1]) {
      const error = captureError(() =>
        validateMetadataSlice('card', { ...cardMetadata(), chip_standards_version: version }),
      );
      expect(error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.metadataInvalid);
      expect(error.details?.pointer).toBe('chip_standards_version');
    }
  });

  it('拒绝非 10 位 Base62 的稳定标识', () => {
    for (const id of ['shortid', '12345678901', 'Ab3dEf6Gh!', '']) {
      const error = captureError(() => validateMetadataSlice('card', { ...cardMetadata(), card_id: id }));
      expect(error.details?.pointer).toBe('card_id');
    }
  });

  it('箱子按 box_id 校验稳定标识', () => {
    const error = captureError(() => validateMetadataSlice('box', { ...boxMetadata(), box_id: 'bad' }));
    expect(error.details?.pointer).toBe('box_id');
  });

  it('拒绝缺失或空 name', () => {
    expect(captureError(() => validateMetadataSlice('card', { ...cardMetadata(), name: '' })).details?.pointer).toBe(
      'name',
    );
    expect(
      captureError(() => validateMetadataSlice('card', { ...cardMetadata(), name: undefined })).details?.pointer,
    ).toBe('name');
  });

  it('拒绝非 ISO 8601 UTC 时间戳', () => {
    for (const stamp of ['2026-01-02', '2026-01-02T03:04:05', '2026-01-02T03:04:05+08:00', 1735000000000]) {
      expect(
        captureError(() => validateMetadataSlice('card', { ...cardMetadata(), created_at: stamp })).details?.pointer,
      ).toBe('created_at');
      expect(
        captureError(() => validateMetadataSlice('card', { ...cardMetadata(), modified_at: stamp })).details?.pointer,
      ).toBe('modified_at');
    }
  });

  it('接受带小数秒的 UTC 时间戳', () => {
    expect(() =>
      validateMetadataSlice('card', { ...cardMetadata(), created_at: '2026-01-02T03:04:05.123456789Z' }),
    ).not.toThrow();
  });

  it('箱子必须有 active_layout_type', () => {
    const metadata = boxMetadata();
    delete metadata.active_layout_type;
    const error = captureError(() => validateMetadataSlice('box', metadata));
    expect(error.details?.pointer).toBe('active_layout_type');
  });
});

describe('structure 切片校验', () => {
  it('接受合法卡片结构与 manifest 计数', () => {
    expect(() => validateStructureSlice('card', cardStructure())).not.toThrow();
  });

  it('接受合法箱子条目（url 与 enabled 齐备）', () => {
    expect(() =>
      validateStructureSlice('box', {
        entries: [{ entry_id: NODE_ID, url: 'chips-resource://a/card/Ab3dEf6Gh8.card', enabled: true }],
      }),
    ).not.toThrow();
  });

  it('卡片缺 structure 数组即拒绝', () => {
    const error = captureError(() => validateStructureSlice('card', { manifest: { card_count: 0 } }));
    expect(error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid);
    expect(error.details?.reason).toContain('缺少 structure 数组');
  });

  it('箱子缺 entries 数组即拒绝', () => {
    expect(captureError(() => validateStructureSlice('box', {})).details?.reason).toContain('缺少 entries 数组');
  });

  it('结构成员必须是对象', () => {
    expect(
      captureError(() => validateStructureSlice('card', { structure: ['x'], manifest: { card_count: 1 } })).details
        ?.reason,
    ).toContain('结构成员必须是对象');
  });

  it('结构成员编号必须为 10 位 Base62 且唯一', () => {
    expect(
      captureError(() =>
        validateStructureSlice('card', { structure: [{ id: 'bad', type: 'text' }], manifest: { card_count: 1 } }),
      ).details?.reason,
    ).toContain('10 位 Base62');
    expect(
      captureError(() =>
        validateStructureSlice('card', {
          structure: [
            { id: NODE_ID, type: 'text' },
            { id: NODE_ID, type: 'text' },
          ],
          manifest: { card_count: 2 },
        }),
      ).details?.reason,
    ).toContain('编号重复');
  });

  it('卡片结构成员必须有非空 type', () => {
    expect(
      captureError(() => validateStructureSlice('card', { structure: [{ id: NODE_ID }], manifest: { card_count: 1 } }))
        .details?.reason,
    ).toContain('type');
  });

  it('卡片结构必须携带 manifest', () => {
    expect(captureError(() => validateStructureSlice('card', { structure: [] })).details?.reason).toContain('manifest');
  });

  it('manifest.card_count 必须等于结构长度', () => {
    expect(
      captureError(() =>
        validateStructureSlice('card', { structure: [{ id: NODE_ID, type: 'text' }], manifest: { card_count: 2 } }),
      ).details?.reason,
    ).toContain('card_count');
  });

  it('manifest.resource_count 必须等于 resources 条目数', () => {
    expect(
      captureError(() =>
        validateStructureSlice('card', {
          structure: [{ id: NODE_ID, type: 'text' }],
          manifest: { card_count: 1, resource_count: 2, resources: ['a.png'] },
        }),
      ).details?.reason,
    ).toContain('resource_count');
  });

  it('箱子条目必须携带 url 与 enabled', () => {
    expect(
      captureError(() => validateStructureSlice('box', { entries: [{ entry_id: NODE_ID, enabled: true }] })).details
        ?.reason,
    ).toContain('url');
    expect(
      captureError(() => validateStructureSlice('box', { entries: [{ entry_id: NODE_ID, url: 'x' }] })).details?.reason,
    ).toContain('enabled');
    expect(
      captureError(() =>
        validateStructureSlice('box', {
          entries: [
            { entry_id: NODE_ID, url: 'x', enabled: true },
            { entry_id: NODE_ID, url: 'y', enabled: false },
          ],
        }),
      ).details?.reason,
    ).toContain('编号重复');
  });
});

describe('entries 切片校验与序列化产物路径', () => {
  it('entries 必须是数组并复用箱子结构规则', () => {
    expect(captureError(() => validateEntriesSlice({})).code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid);
    expect(() => validateEntriesSlice([{ entry_id: NODE_ID, url: 'x', enabled: false }])).not.toThrow();
  });

  it('序列化产物的包内路径逐个过安全闸', () => {
    expect(() => assertSerializedMemberPaths(['structure.yaml', 'content/a.yaml'])).not.toThrow();
    const error = captureError(() => assertSerializedMemberPaths(['../escape.yaml']));
    expect(error.code).toBe(DOCUMENT_BUSINESS_ERROR_CODES.structureInvalid);
    expect(error.details?.reason).toContain('escape.yaml');
  });
});

describe('cardStructureNodeIds', () => {
  it('按声明顺序提取结构编号', () => {
    expect(
      cardStructureNodeIds({
        structure: [
          { id: OTHER_ID, type: 'text' },
          { id: NODE_ID, type: 'image' },
        ],
        manifest: { card_count: 2 },
      }),
    ).toEqual([OTHER_ID, NODE_ID]);
  });

  it('缺失结构数组或形态异常时返回空集', () => {
    expect(cardStructureNodeIds({})).toEqual([]);
    expect(cardStructureNodeIds([])).toEqual([]);
    expect(cardStructureNodeIds({ structure: [{ type: 'text' }] })).toEqual([]);
  });
});
