import { describe, expect, it } from 'vitest';
import type { BaseCardChange, BaseCardView, IBaseCardEditor, ISubscription } from '@chips/sdk';
import { validateConfig } from '@chips/plugin-richtext';
import { parse } from 'yaml';
import {
  assembleWriteValue,
  RichTextEditSession,
  validateEditorChange,
  type RichTextCommitPorts,
  type RichTextSavePorts,
} from '../src/domain/editor/editSession';
import { parseCompositeRichTextCard } from '../src/domain/card/card-document';
import { VALID_COMPOSITE_CARD_FILES, VALID_INLINE_CONTENT_YAML } from './fixtures/composite-card';

/**
 * 编辑会话时序测试（纯领域层）：锁定编辑回流唯一时序（08-基础卡片插件接口 §4.3 规则 1、
 * 12-编辑引擎设计 §6.1）的应用前端侧落点——`getChange()` → 编辑链路校验 → `document:write`
 * → 投影更新（update）→ `markCommitted(revision)`；以及 `{ revision }` 回执的严格递增水位锁
 * （04-能力契约规范 §7.3：从 1 开始，每次成功写入前进 1）。
 *
 * 校验臂错误码使用生成契约常量 `EDIT_VALIDATION_FAILED`（12 §6.5 / §9.2），不自造第二套码。
 * 链路侧步骤记入 chain journal（document:write / document:read / document:save），
 * 编辑器侧调用记入 editor journal（getChange / markCommitted / update）——两个 journal
 * 逐位锁定，任何次序交换即翻红。
 */

type ReplaceChange = Extract<BaseCardChange, { kind: 'replace' }>;

const INLINE_BASELINE: Record<string, unknown> = {
  card_type: 'base.richtext',
  theme: '',
  locale: 'zh-CN',
  content_format: 'markdown',
  content_source: 'inline',
  content_text: '# 标题\n\n正文内容',
  markdown_capabilities: {
    commonmark: true,
    gfm: true,
    math: true,
    highlight: true,
    underline: true,
    superscript: true,
    subscript: true,
  },
};

function replaceChange(
  contentText: string,
  baseline: Record<string, unknown> = INLINE_BASELINE
): ReplaceChange {
  const next: Record<string, unknown> = { ...baseline, content_text: contentText };
  // 模拟插件编辑器 emit 形态：正文位更新；插件模型不感知的 §6.1 保留字段（theme）不出现在变更里。
  const pluginForm: Record<string, unknown> = { ...next };
  delete pluginForm['theme'];
  return { kind: 'replace', content: pluginForm };
}

function withContent(change: ReplaceChange, patch: Record<string, unknown>): ReplaceChange {
  return { kind: 'replace', content: { ...change.content, ...patch } };
}

/** fake 编辑句柄：以受控面模拟 IBaseCardEditor 的契约成员（editor journal 记录调用次序）。 */
class FakeEditor implements IBaseCardEditor {
  public state: 'active' | 'disposed' = 'active';

  public readonly journal: string[] = [];

  private pending: BaseCardChange | null = null;

  private readonly changeHandlers = new Set<(payload: { change: BaseCardChange }) => void>();

  public isDirty(): boolean {
    return this.pending !== null;
  }

  public getChange(): BaseCardChange | null {
    this.journal.push('editor:getChange');
    return this.pending;
  }

  public markCommitted(revision: number): void {
    this.journal.push(`editor:markCommitted:${String(revision)}`);
    this.pending = null;
  }

  public update(_basecard: BaseCardView, revision: number): void {
    this.journal.push(`editor:update:${String(revision)}`);
    this.pending = null;
  }

  public subscribe<TEvent extends 'change' | 'dirty'>(
    event: TEvent,
    _handler: (payload: never) => void
  ): ISubscription {
    if (event === 'change') {
      const typed = _handler as unknown as (payload: { change: BaseCardChange }) => void;
      this.changeHandlers.add(typed);
    }
    return { dispose: (): void => undefined };
  }

  public focus(): void {
    this.journal.push('editor:focus');
  }

  public dispose(): void {
    this.state = 'disposed';
  }

  /** 测试驱动面：模拟编辑器发布一次变更（与真实句柄 change 事件同形）。 */
  public emit(change: BaseCardChange): void {
    this.pending = change;
    for (const handler of this.changeHandlers) {
      handler({ change });
    }
  }
}

interface PortsOptions {
  readonly revisions?: readonly number[];
  readonly readBack?:
    Record<string, unknown> | ((value: Record<string, unknown>) => Record<string, unknown>);
}

function createPorts(
  journal: string[],
  options: PortsOptions = {}
): RichTextCommitPorts & { writes: Array<{ value: Record<string, unknown> }> } {
  const writes: Array<{ value: Record<string, unknown> }> = [];
  const queue = options.revisions ?? [2, 3, 4, 5];
  let cursor = 0;
  return {
    writes,
    readNode: () => {
      journal.push('chain:document:read');
      const last = writes[writes.length - 1]?.value;
      if (typeof options.readBack === 'function') {
        return Promise.resolve(last === undefined ? {} : options.readBack(last));
      }
      if (options.readBack !== undefined) {
        return Promise.resolve(options.readBack);
      }
      return Promise.resolve(last ?? {});
    },
    writeNode: (value) => {
      journal.push('chain:document:write');
      writes.push({ value });
      const revision = queue[cursor];
      cursor += 1;
      return Promise.resolve(revision ?? writes.length + 1);
    },
  };
}

describe('编辑变更校验闸（回流第②拍；错误码 EDIT_VALIDATION_FAILED）', () => {
  it('合法 replace 变更通过校验（含插件 validateConfig 同口径 config 闸）', () => {
    const change = withContent(replaceChange('# 新标题'), {
      config: { fontSize: 16, lineHeight: 1.6 },
    });
    expect(validateEditorChange(change)).toEqual({ ok: true });
    expect(validateConfig({ fontSize: 16, lineHeight: 1.6 })).toBe(true);
  });

  it('card_type 非 base.richtext 的 replace 变更拒绝', () => {
    const change = withContent(replaceChange('# 新标题'), { card_type: 'base.image' });
    expect(validateEditorChange(change)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });
  });

  it('inline 来源携带 content_file 或空正文的 replace 变更拒绝（§6.6 互斥口径）', () => {
    const withFile = withContent(replaceChange('# 新标题'), { content_file: 'richtext/a.md' });
    expect(validateEditorChange(withFile)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });

    const emptyText = replaceChange('   ');
    expect(validateEditorChange(emptyText)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });
  });

  it('file 来源缺合法 .md 相对路径或携带非空 content_text 的 replace 变更拒绝', () => {
    const fileBaseline: Record<string, unknown> = {
      ...INLINE_BASELINE,
      content_source: 'file',
      content_file: 'richtext/note.md',
    };
    delete fileBaseline['content_text'];
    expect(validateEditorChange(replaceChange('# x', fileBaseline))).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });

    const withText = withContent(replaceChange('# x', fileBaseline), { content_text: '# x' });
    expect(validateEditorChange(withText)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });
  });

  it('能力矩阵缺失或非布尔的 replace 变更拒绝', () => {
    const change = withContent(replaceChange('# 新标题'), {
      markdown_capabilities: { commonmark: true },
    });
    expect(validateEditorChange(change)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });
  });

  it('展示 config 越界（插件 validateConfig 拒绝）的 replace 变更拒绝', () => {
    const change = withContent(replaceChange('# 新标题'), { config: { fontSize: 8 } });
    expect(validateEditorChange(change)).toMatchObject({
      ok: false,
      errorCode: 'EDIT_VALIDATION_FAILED',
    });
  });

  it('patch 变更：合法 /config 指针通过；根指针、转义段与缺 value 的 add/replace 拒绝', () => {
    expect(
      validateEditorChange({
        kind: 'patch',
        operations: [{ op: 'replace', path: '/config/fontSize', value: 20 }],
      })
    ).toEqual({ ok: true });
    expect(
      validateEditorChange({ kind: 'patch', operations: [{ op: 'replace', path: '', value: {} }] })
    ).toMatchObject({ ok: false, errorCode: 'EDIT_VALIDATION_FAILED' });
    expect(
      validateEditorChange({
        kind: 'patch',
        operations: [{ op: 'remove', path: '/config/font~1Size' }],
      })
    ).toMatchObject({ ok: false, errorCode: 'EDIT_VALIDATION_FAILED' });
    expect(
      validateEditorChange({
        kind: 'patch',
        operations: [{ op: 'add', path: '/config/lineHeight' }],
      })
    ).toMatchObject({ ok: false, errorCode: 'EDIT_VALIDATION_FAILED' });
  });
});

describe('写值装配（replace 全量 + §6.1 保留字段保真 / patch 增量）', () => {
  it('replace 装配为变更内容全量，并保真基线中插件模型不感知的 theme 保留字段', () => {
    const value = assembleWriteValue(INLINE_BASELINE, replaceChange('# 新标题'));
    expect(value).toEqual({ ...INLINE_BASELINE, content_text: '# 新标题' });
    expect(value?.['theme']).toBe('');
  });

  it('基线无 theme 时装配不添加该字段', () => {
    const baseline: Record<string, unknown> = { ...INLINE_BASELINE };
    delete baseline['theme'];
    const value = assembleWriteValue(baseline, replaceChange('# 新标题'));
    expect(value).toEqual({ ...baseline, content_text: '# 新标题' });
    expect('theme' in (value as Record<string, unknown>)).toBe(false);
  });

  it('patch 装配在基线上应用增量（缺失父位按插件契约 emit 形态补建）', () => {
    const value = assembleWriteValue(INLINE_BASELINE, {
      kind: 'patch',
      operations: [
        { op: 'replace', path: '/config/fontSize', value: 20 },
        { op: 'replace', path: '/config/lineHeight', value: 2 },
      ],
    });
    expect(value).toEqual({ ...INLINE_BASELINE, config: { fontSize: 20, lineHeight: 2 } });
  });

  it('patch 装配命中非对象中途位时返回 null（校验闸如实拒绝）', () => {
    expect(
      assembleWriteValue(
        { ...INLINE_BASELINE, config: '非对象' },
        { kind: 'patch', operations: [{ op: 'replace', path: '/config/fontSize', value: 20 }] }
      )
    ).toBeNull();
  });
});

describe('回流唯一时序（fake 编辑句柄 + fake 文档端口 journal 锁测）', () => {
  it('全时序：getChange → 校验 → document:write → 投影重读 → markCommitted，双 journal 逐位锁定', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 新标题'));

    const chainJournal: string[] = [];
    const ports = createPorts(chainJournal);
    const outcome = await session.commit(ports);

    expect(outcome).toEqual({ status: 'committed', revision: 2 });
    expect(chainJournal).toEqual(['chain:document:write', 'chain:document:read']);
    expect(editor.journal).toEqual(['editor:getChange', 'editor:markCommitted:2']);
    expect(ports.writes[0]?.value['content_text']).toBe('# 新标题');
    expect(session.revision).toBe(2);
    expect(session.isDirty()).toBe(false);
  });

  it('无待提交变更时 no-change：不触达写通道与投影', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    const chainJournal: string[] = [];
    const outcome = await session.commit(createPorts(chainJournal));
    expect(outcome).toEqual({ status: 'no-change' });
    expect(chainJournal).toEqual([]);
    expect(editor.journal).toEqual(['editor:getChange']);
  });

  it('校验不过闸：不写文档、不推进水位，编辑器保持待提交变更', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('   '));

    const chainJournal: string[] = [];
    const ports = createPorts(chainJournal);
    const outcome = await session.commit(ports);

    expect(outcome).toMatchObject({ status: 'invalid', errorCode: 'EDIT_VALIDATION_FAILED' });
    expect(chainJournal).toEqual([]);
    expect(ports.writes).toEqual([]);
    expect(session.revision).toBe(0);
    expect(editor.isDirty()).toBe(true);
  });

  it('写入失败：保留待提交变更与水位，可重试', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 新标题'));

    const failing: RichTextCommitPorts = {
      readNode: () => Promise.resolve({}),
      writeNode: () =>
        Promise.reject(Object.assign(new Error('冲突'), { code: 'DOCUMENT_WRITE_CONFLICT' })),
    };
    const outcome = await session.commit(failing);
    expect(outcome).toMatchObject({ status: 'write-failed', errorCode: 'DOCUMENT_WRITE_CONFLICT' });
    expect(session.revision).toBe(0);
    expect(editor.isDirty()).toBe(true);
  });

  it('修订回执未严格递增：revision-stale，不投影、不 markCommitted', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 第一轮'));
    const firstJournal: string[] = [];
    await session.commit(createPorts(firstJournal, { revisions: [2] }));
    expect(session.revision).toBe(2);

    editor.emit(replaceChange('# 第二轮'));
    const stale = await session.commit(createPorts([], { revisions: [2] }));
    expect(stale).toEqual({ status: 'revision-stale', received: 2, watermark: 2 });
    expect(session.revision).toBe(2);
    expect(editor.isDirty()).toBe(true);
    expect(editor.journal).toEqual([
      'editor:getChange',
      'editor:markCommitted:2',
      'editor:getChange',
    ]);
  });

  it('投影重读失败：projection-failed（写已发生但不确认提交），可重试', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 新标题'));

    const ports: RichTextCommitPorts = {
      readNode: () =>
        Promise.reject(Object.assign(new Error('读取失败'), { code: 'DOCUMENT_READ_FAILED' })),
      writeNode: () => Promise.resolve(2),
    };
    const outcome = await session.commit(ports);
    expect(outcome).toMatchObject({ status: 'projection-failed', revision: 2 });
    expect(session.revision).toBe(0);
    expect(editor.journal).not.toContain('editor:markCommitted:2');
    expect(editor.isDirty()).toBe(true);
  });

  it('投影与写值发散（外部并发修改）：确认提交并报告 diverged，会话基线采纳宿主真相', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 本端修改'));

    const hostTruth = { ...INLINE_BASELINE, content_text: '外部并发写入' };
    const chainJournal: string[] = [];
    const ports = createPorts(chainJournal, { readBack: () => hostTruth });
    const outcome = await session.commit(ports);

    expect(outcome).toEqual({ status: 'diverged', revision: 2 });
    expect(editor.journal).toEqual(['editor:getChange', 'editor:markCommitted:2']);
    expect(session.revision).toBe(2);
    expect(session.isDirty()).toBe(false);
    expect(session.getBaseline()).toEqual(hostTruth);
  });

  it('连续两轮提交 revision 严格递增，编辑器基线随 markCommitted 前进', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    const chainJournal: string[] = [];
    const ports = createPorts(chainJournal, { revisions: [2, 3] });

    editor.emit(replaceChange('# 第一轮'));
    const first = await session.commit(ports);
    editor.emit(replaceChange('# 第二轮'));
    const second = await session.commit(ports);

    expect(first).toEqual({ status: 'committed', revision: 2 });
    expect(second).toEqual({ status: 'committed', revision: 3 });
    expect(session.revision).toBe(3);
    expect(session.getChange()).toBeNull();
  });

  it('change 事件驱动暂存：attach 后由编辑器事件维护待提交变更，discard 丢弃', () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 事件驱动'));
    expect(session.isDirty()).toBe(true);
    expect(session.getChange()).toEqual(replaceChange('# 事件驱动'));
    session.discard();
    expect(session.isDirty()).toBe(false);
    expect(editor.isDirty()).toBe(true);
  });
});

describe('保存链（flush + document:save 唯一落盘入口）', () => {
  function createSavePorts(journal: string[], commitPorts: RichTextCommitPorts): RichTextSavePorts {
    return {
      ...commitPorts,
      save: () => {
        journal.push('chain:document:save');
        return Promise.resolve({ source: 'chips-resource://ws/demo.card', digest: 'sha256-1' });
      },
    };
  }

  it('脏状态保存 = 完成回流后立即 document:save；保存回执驱动会话水位', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('# 新标题'));

    const chainJournal: string[] = [];
    const ports = createSavePorts(chainJournal, createPorts(chainJournal, { revisions: [2] }));
    const outcome = await session.flushAndSave(ports);

    expect(outcome).toEqual({
      status: 'saved',
      receipt: { source: 'chips-resource://ws/demo.card', digest: 'sha256-1' },
      committedRevision: 2,
    });
    expect(chainJournal).toEqual([
      'chain:document:write',
      'chain:document:read',
      'chain:document:save',
    ]);
    expect(editor.journal).toEqual(['editor:getChange', 'editor:markCommitted:2']);
    expect(session.isDirty()).toBe(false);
  });

  it('干净状态保存 = 直接 document:save（幂等，12 §6.3 规则 5）', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    session.attachEditor(new FakeEditor());
    const chainJournal: string[] = [];
    const ports = createSavePorts(chainJournal, createPorts(chainJournal));
    const outcome = await session.flushAndSave(ports);
    expect(outcome).toMatchObject({ status: 'saved', committedRevision: null });
    expect(chainJournal).toEqual(['chain:document:save']);
  });

  it('回流失败阻断保存：不触达 document:save（flush 语义，12 §6.3 规则 3）', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange('   '));

    const chainJournal: string[] = [];
    const ports = createSavePorts(chainJournal, createPorts(chainJournal));
    const outcome = await session.flushAndSave(ports);

    expect(outcome.status).toBe('commit-blocked');
    expect(chainJournal).toEqual([]);
    expect(editor.isDirty()).toBe(true);
  });

  it('document:save 失败如实回码（不吞错、不假成功）', async () => {
    const session = new RichTextEditSession('a1B2c3D4e5', 'f6G7h8I9j0');
    session.attachEditor(new FakeEditor());
    const ports: RichTextSavePorts = {
      readNode: () => Promise.resolve({}),
      writeNode: () => Promise.resolve(1),
      save: () =>
        Promise.reject(Object.assign(new Error('落盘失败'), { code: 'DOCUMENT_SAVE_FAILED' })),
    };
    const outcome = await session.flushAndSave(ports);
    expect(outcome).toMatchObject({ status: 'save-failed', errorCode: 'DOCUMENT_SAVE_FAILED' });
  });
});

describe('card 往返恰等（夹具 → 解析 → 会话写值 → 模型重建恰等）', () => {
  it('夹具卡片经解析、会话写值与重建解析后逐字段恰等（无字段漂移、无保留字段丢失）', async () => {
    const parsed = parseCompositeRichTextCard({
      metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
      structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
      contentYaml: VALID_INLINE_CONTENT_YAML,
    });
    expect(parsed.baseCardId).toBe('f6G7h8I9j0');

    // 会话基线 = 宿主 document:read 回包内容根（夹具 content/*.yaml 的对象形态）。
    const contentNode: Record<string, unknown> = { ...parsed.config };
    const session = new RichTextEditSession(parsed.cardId, parsed.baseCardId);
    session.setBaseline(contentNode, 1);

    const editedText = '# 旅行日记\n\n这次东京之旅更加精彩。';
    const editor = new FakeEditor();
    session.attachEditor(editor);
    editor.emit(replaceChange(editedText, contentNode));
    expect(validateEditorChange(replaceChange(editedText, contentNode))).toEqual({ ok: true });

    const chainJournal: string[] = [];
    const ports = createPorts(chainJournal, { revisions: [2] });
    const outcome = await session.commit(ports);
    expect(outcome).toEqual({ status: 'committed', revision: 2 });

    // 写值 = 宿主模型新内容根：与基线逐字段恰等（仅正文位前进，theme 等保留字段不丢失）。
    const written = ports.writes[0]?.value ?? {};
    expect(written).toEqual({ ...contentNode, content_text: editedText });

    // 重建解析：写值经 YAML 往返再入文档模型，模型恰等（插件展示 config 位为插件域字段，不入模型）。
    const { stringify } = await import('yaml');
    const rebuilt = parseCompositeRichTextCard({
      metadataYaml: VALID_COMPOSITE_CARD_FILES.metadataYaml,
      structureYaml: VALID_COMPOSITE_CARD_FILES.structureYaml,
      contentYaml: stringify(written),
    });
    expect(rebuilt.cardId).toBe(parsed.cardId);
    expect(rebuilt.baseCardId).toBe(parsed.baseCardId);
    expect(rebuilt.config).toEqual({ ...parsed.config, content_text: editedText });
    expect(parse(VALID_INLINE_CONTENT_YAML)).toMatchObject({ card_type: 'base.richtext' });
  });
});
