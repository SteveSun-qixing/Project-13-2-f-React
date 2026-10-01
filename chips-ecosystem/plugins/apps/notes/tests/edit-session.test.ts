import { describe, expect, it } from 'vitest';
import type { BoxMetadata, CardMetadata, ContentNode } from '@chips/sdk';
import {
  NoteEditSession,
  buildContentWriteSlice,
  buildMetadataWriteSlice,
  parseContentJsonText,
  validateNoteEditChange,
} from '../src/domain/notes/editSession';

/**
 * 编辑会话时序测试（纯领域层）：锁定《本轮架构收口裁决》B3 编辑回流唯一时序的
 * 应用前端侧对应面——`getChange()` → 校验 → `document:write` → 投影更新（update）→
 * `markCommitted(revision)`；以及 `{ revision }` 回执的严格递增水位锁。
 *
 * 校验臂错误码与宿主 `validation.ts` 同场景同码镜像（name 空 → `DOCUMENT_METADATA_INVALID`、
 * 内容切片非对象 → `BRIDGE_INVALID_INPUT`），不自造第二套码。
 */

const CARD_METADATA: CardMetadata = {
  chip_standards_version: '1.0.0',
  card_id: 'card000001',
  name: '示例笔记',
  created_at: '2026-10-01T08:00:00.000Z',
  modified_at: '2026-10-01T09:00:00.000Z',
  tags: ['随笔'],
};

const BOX_METADATA: BoxMetadata = {
  chip_standards_version: '1.0.0',
  box_id: 'box0000001',
  name: '工作笔记',
  created_at: '2026-10-01T08:00:00.000Z',
  modified_at: '2026-10-01T09:00:00.000Z',
  active_layout_type: 'chips.layout.grid',
  description: '日常记录',
};

const CONTENT_NODE: ContentNode = {
  node_id: 'node000001',
  file: 'content/node000001.yaml',
  card_type: 'base.richtext',
  value: { text: '初稿' },
  diagnostics: [],
};

describe('编辑变更校验（宿主同场景同码镜像）', () => {
  it('重命名：空白名称拒绝并携带 DOCUMENT_METADATA_INVALID，合法名称通过', () => {
    expect(validateNoteEditChange({ facet: 'rename', nextName: '   ' })).toEqual({
      ok: false,
      errorCode: 'DOCUMENT_METADATA_INVALID',
      message: 'name 必填且为非空字符串',
    });
    expect(validateNoteEditChange({ facet: 'rename', nextName: '会议记录' })).toEqual({ ok: true });
  });

  it('描述修改：任意字符串（含空串清空）通过校验', () => {
    expect(validateNoteEditChange({ facet: 'description', nextDescription: '' })).toEqual({ ok: true });
    expect(validateNoteEditChange({ facet: 'description', nextDescription: '新描述' })).toEqual({ ok: true });
  });

  it('内容修改：非对象值（数组）拒绝并携带 BRIDGE_INVALID_INPUT，对象值通过', () => {
    // 通道可能递送类型面之外的数组形态（宿主 `invalidSliceValue` 同场景）；运行时守卫如实拒绝。
    expect(
      validateNoteEditChange({ facet: 'content', nodeId: 'node000001', nextValue: [1, 2] as unknown as Record<string, unknown> }),
    ).toEqual({
      ok: false,
      errorCode: 'BRIDGE_INVALID_INPUT',
      message: '内容切片必须是 JSON 对象',
    });
    expect(validateNoteEditChange({ facet: 'content', nodeId: 'node000001', nextValue: { text: '定稿' } })).toEqual({
      ok: true,
    });
  });
});

describe('内容 JSON 装配', () => {
  it('合法 JSON 对象文本解析为对象值', () => {
    const parsed = parseContentJsonText('{"text":"定稿"}');
    expect(parsed).toEqual({ ok: true, value: { text: '定稿' } });
  });

  it('非法 JSON 文本拒绝并携带 BRIDGE_INVALID_INPUT', () => {
    const parsed = parseContentJsonText('{text:定稿');
    expect(parsed.ok).toBe(false);
    expect(parsed).toMatchObject({ errorCode: 'BRIDGE_INVALID_INPUT' });
  });

  it('JSON 数组与标量拒绝（内容必须是 JSON 对象）', () => {
    expect(parseContentJsonText('[1,2]')).toMatchObject({ ok: false, errorCode: 'BRIDGE_INVALID_INPUT' });
    expect(parseContentJsonText('"文本"')).toMatchObject({ ok: false, errorCode: 'BRIDGE_INVALID_INPUT' });
    expect(parseContentJsonText('null')).toMatchObject({ ok: false, errorCode: 'BRIDGE_INVALID_INPUT' });
  });
});

describe('写切片装配（整体替换语义）', () => {
  it('元数据切片保留其余字段、替换 name 并前移 modified_at', () => {
    const slice = buildMetadataWriteSlice(CARD_METADATA, { name: '会议记录' }, '2026-10-01T10:00:00.000Z');
    expect(slice).toEqual({
      ...CARD_METADATA,
      name: '会议记录',
      modified_at: '2026-10-01T10:00:00.000Z',
    });
  });

  it('箱子描述切片保留 active_layout_type 等字段、替换 description', () => {
    const slice = buildMetadataWriteSlice(BOX_METADATA, { description: '新描述' }, '2026-10-01T10:00:00.000Z');
    expect(slice).toMatchObject({
      box_id: 'box0000001',
      active_layout_type: 'chips.layout.grid',
      description: '新描述',
      modified_at: '2026-10-01T10:00:00.000Z',
    });
  });

  it('内容切片按节点整体替换：保留 node_id/file/card_type，只换 value', () => {
    const slice = buildContentWriteSlice(CONTENT_NODE, { text: '定稿' });
    expect(slice).toEqual({
      node_id: 'node000001',
      file: 'content/node000001.yaml',
      card_type: 'base.richtext',
      value: { text: '定稿' },
      diagnostics: [],
    });
  });
});

describe('暂存臂（getChange 的待提交来源）', () => {
  it('与当前值同名不产生待提交，不同名产生 rename 待提交', () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '  示例笔记  ');
    expect(session.getChange()).toBeNull();
    expect(session.isDirty()).toBe(false);
    session.stageRename('示例笔记', '会议记录');
    expect(session.getChange()).toEqual({ facet: 'rename', nextName: '会议记录' });
    expect(session.isDirty()).toBe(true);
  });

  it('内容暂存：非法 JSON 不产生待提交并如实回码；合法且不同产生 content 待提交', () => {
    const session = new NoteEditSession('card000001');
    const invalid = session.stageContent('node000001', '{"text":"初稿"}', '{text:初稿');
    expect(invalid).toMatchObject({ ok: false, errorCode: 'BRIDGE_INVALID_INPUT' });
    expect(session.getChange()).toBeNull();
    const staged = session.stageContent('node000001', '{"text":"初稿"}', '{"text":"定稿"}');
    expect(staged).toEqual({ ok: true });
    expect(session.getChange()).toEqual({
      facet: 'content',
      nodeId: 'node000001',
      nextValue: { text: '定稿' },
    });
  });

  it('内容暂存回退为原文时清除待提交', () => {
    const session = new NoteEditSession('card000001');
    session.stageContent('node000001', '{"text":"初稿"}', '{"text":"定稿"}');
    expect(session.isDirty()).toBe(true);
    session.stageContent('node000001', '{"text":"初稿"}', '{"text":"初稿"}');
    expect(session.getChange()).toBeNull();
  });

  it('描述暂存：不同值产生 description 待提交，discard 清空待提交', () => {
    const session = new NoteEditSession('box0000001');
    session.stageDescription('日常记录', '项目记录');
    expect(session.getChange()).toEqual({ facet: 'description', nextDescription: '项目记录' });
    session.discard();
    expect(session.getChange()).toBeNull();
    expect(session.isDirty()).toBe(false);
  });
});

describe('修订水位严格递增锁（{ revision } 回执驱动）', () => {
  it('update/markCommitted 收到不大于当前水位的修订号时忽略，水位不回退', () => {
    const session = new NoteEditSession('card000001');
    expect(session.markCommitted(1)).toBe(true);
    expect(session.revision).toBe(1);
    expect(session.update(1)).toBe(false);
    expect(session.markCommitted(0)).toBe(false);
    expect(session.revision).toBe(1);
  });

  it('markCommitted 新修订号推进水位并清空待提交；旧修订号不清待提交', () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '会议记录');
    expect(session.markCommitted(1)).toBe(true);
    expect(session.getChange()).toBeNull();
    session.stageRename('会议记录', '周记');
    expect(session.markCommitted(1)).toBe(false);
    expect(session.getChange()).toEqual({ facet: 'rename', nextName: '周记' });
  });
});

describe('提交链（getChange → 校验 → write → 投影更新 → markCommitted）', () => {
  it('无待提交变更时返回 no-change 且不触达写通道', async () => {
    const session = new NoteEditSession('card000001');
    let writes = 0;
    const outcome = await session.commit(
      () => {
        writes += 1;
        return Promise.resolve(1);
      },
      () => Promise.resolve(undefined),
    );
    expect(outcome).toEqual({ status: 'no-change' });
    expect(writes).toBe(0);
  });

  it('校验失败时按宿主同码返回 invalid，不触达写通道且待提交保留', async () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '   ');
    let writes = 0;
    const outcome = await session.commit(
      () => {
        writes += 1;
        return Promise.resolve(1);
      },
      () => Promise.resolve(undefined),
    );
    expect(outcome).toEqual({
      status: 'invalid',
      errorCode: 'DOCUMENT_METADATA_INVALID',
      message: 'name 必填且为非空字符串',
    });
    expect(writes).toBe(0);
    expect(session.getChange()).not.toBeNull();
  });

  it('写失败时返回 write-failed 携带通道错误码，待提交与水位保持不变', async () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '会议记录');
    const outcome = await session.commit(
      () => Promise.reject(Object.assign(new Error('拒绝写入'), { code: 'DOCUMENT_WRITE_CONFLICT' })),
      () => Promise.resolve(undefined),
    );
    expect(outcome).toEqual({ status: 'write-failed', errorCode: 'DOCUMENT_WRITE_CONFLICT', message: '拒绝写入' });
    expect(session.getChange()).toEqual({ facet: 'rename', nextName: '会议记录' });
    expect(session.revision).toBe(0);
  });

  it('成功链严格按序执行：write → 投影更新 → markCommitted，回执推进水位并清空待提交', async () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '会议记录');
    const journal: string[] = [];
    const outcome = await session.commit(
      (change) => {
        journal.push(`write:${change.facet}`);
        return Promise.resolve(1);
      },
      (change) => {
        journal.push(`projection:${change.facet}`);
        return Promise.resolve();
      },
    );
    expect(outcome).toEqual({ status: 'committed', revision: 1 });
    expect(journal).toEqual(['write:rename', 'projection:rename']);
    expect(session.revision).toBe(1);
    expect(session.getChange()).toBeNull();
  });

  it('回执修订号未严格递增时拒绝提交（revision-stale），投影与 markCommitted 均不执行', async () => {
    const session = new NoteEditSession('card000001');
    expect(session.markCommitted(2)).toBe(true);
    session.stageRename('示例笔记', '会议记录');
    const journal: string[] = [];
    const outcome = await session.commit(
      (change) => {
        journal.push(`write:${change.facet}`);
        return Promise.resolve(2);
      },
      () => {
        journal.push('projection');
        return Promise.resolve();
      },
    );
    expect(outcome).toEqual({ status: 'revision-stale', received: 2, watermark: 2 });
    expect(journal).toEqual(['write:rename']);
    expect(session.getChange()).not.toBeNull();
    expect(session.revision).toBe(2);
  });

  it('投影更新失败时返回 projection-failed：写已发生但会话不确认提交，水位与待提交保持', async () => {
    const session = new NoteEditSession('card000001');
    session.stageRename('示例笔记', '会议记录');
    const outcome = await session.commit(
      () => Promise.resolve(1),
      () => Promise.reject(Object.assign(new Error('重读失败'), { code: 'DOCUMENT_NOT_OPEN' })),
    );
    expect(outcome).toEqual({ status: 'projection-failed', revision: 1, errorCode: 'DOCUMENT_NOT_OPEN', message: '重读失败' });
    expect(session.revision).toBe(0);
    expect(session.getChange()).not.toBeNull();
  });
});
