/**
 * 编辑链路契约类型面 ↔ 文档库契约分件的字段级对照锁（工单036 残段 T1）。
 *
 * 口径：
 * - 权威分件（v1.0.0 正式版）：12.03 §3.1 编辑会话、12.04 §4.1 受管门面、
 *   12.07 §7.2 历史记录模型、12.09 §9.2 错误码、05.02 §2.4 渲染会话模型、
 *   08.04 §4 IBaseCardEditor、09.07 §7.1 ILayoutEditor；
 * - 锁法与 `packages/host/tests/helpers/contract-source.ts` 判例同族：测试内读取文档库
 *   原文与 SDK 源码原文，用同一组提取器取「接口成员名清单 / 联合体字段名清单 /
 *   在册导出名清单」做精确相等断言——契约侧多一名（SDK 漏落）或 SDK 侧多一名
 *   （自造形状）都确定性翻红，双向覆盖；
 * - `EDIT_*` 错误域不落第二份清单：以 `generated/error-codes.ts`（contract-gen 单源）
 *   与 12.09 §9.2 两表对照，新增表恰等、复用表逐名在册；
 * - 主入口与编辑链路类型域出口的在册名单锁（偏差注入双向臂）与编译期语义锚
 *   （`expectTypeOf`）随批在册：同名不同物的 manifest `IPluginRuntime` 与编辑链路
 *   受管门面以结构探针锁异，`revision` 链（`document:write` 回执 → 会话 → 预览 →
 *   `markCommitted`）锚为同一 `number` 序列（12 §3.5、05 §2.4 会话规则 5）。
 */

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  extractDeclaredTypeNames,
  extractErrorCodes,
  extractInterfaceMembers,
  extractUnionObjectFields,
  parseExportTypeNames,
  readDocSource,
  readSdkSource,
} from './helpers/contract-source.js';
import { ERROR_CODES } from '../src/generated/error-codes.js';
import type { IDocumentWriteOutput } from '../src/index.js';
import type * as sdkMain from '../src/index.js';
import type { IBaseCardEditor, IBaseCardPlugin } from '../src/types/roles/basecard.js';
import type {
  IBoxLayoutPlugin,
  ILayoutEditor,
  LayoutChange,
} from '../src/types/roles/boxlayout.js';
import type { BaseCardView, BoxRenderView } from '../src/types/views.js';
import type { ChangePayload, EditHistoryEntry, IManagedPluginRuntime } from '../src/edit/index.js';

/** 文档库两目录（相对 `tests/` 的四级回退到仓库根，host 判例同口径）。 */
const DOC_SUBSYSTEM = '../../../../薯片生态文档库/01-架构设计/01-子系统设计/';
const DOC_CONTRACT = '../../../../薯片生态文档库/05-接口与契约/';

const DOC_12_03 = readDocSource(
  `${DOC_SUBSYSTEM}12.03-12-编辑引擎设计-三、编辑会话 IEditSession.md`
);
const DOC_12_04 = readDocSource(`${DOC_SUBSYSTEM}12.04-12-编辑引擎设计-四、插件装载与调用.md`);
const DOC_12_07 = readDocSource(`${DOC_SUBSYSTEM}12.07-12-编辑引擎设计-七、撤销-重做.md`);
const DOC_12_09 = readDocSource(`${DOC_SUBSYSTEM}12.09-12-编辑引擎设计-九、错误与降级.md`);
const DOC_05_02 = readDocSource(`${DOC_SUBSYSTEM}05.02-05-渲染引擎设计-二、统一渲染链路.md`);
const DOC_08_04 = readDocSource(
  `${DOC_CONTRACT}08.04-08-基础卡片插件接口-四、IBaseCardEditor 编辑契约.md`
);
const DOC_09_07 = readDocSource(`${DOC_CONTRACT}09.07-09-箱子布局插件接口-七、布局编辑面板.md`);

/** SDK 源码原文（成员与在册名单提取对象）。 */
const SRC_SESSION = readSdkSource('../src/edit/session.ts');
const SRC_FACADE = readSdkSource('../src/edit/facade.ts');
const SRC_HISTORY = readSdkSource('../src/edit/history.ts');
const SRC_EDIT_BARREL = readSdkSource('../src/edit/index.ts');
const SRC_RENDER_SESSION = readSdkSource('../src/types/render-session.ts');
const SRC_BASECARD = readSdkSource('../src/types/roles/basecard.ts');
const SRC_BOXLAYOUT = readSdkSource('../src/types/roles/boxlayout.ts');
const SRC_INDEX = readSdkSource('../src/index.ts');

/** 七份契约分件声明的全部类型名并集（「禁自造类型名」的在册域）。 */
const CONTRACT_TYPE_NAMES = [
  DOC_12_03,
  DOC_12_04,
  DOC_12_07,
  DOC_05_02,
  DOC_08_04,
  DOC_09_07,
].flatMap((source) => extractDeclaredTypeNames(source));

/** 断言契约成员清单与 SDK 成员清单逐名恰等（保持原文顺序）。 */
function expectMembersLocked(docSource: string, sdkSource: string, typeName: string): void {
  const docMembers = extractInterfaceMembers(docSource, typeName);
  const sdkMembers = extractInterfaceMembers(sdkSource, typeName);
  expect(sdkMembers, `${typeName} SDK 侧成员`).toEqual(docMembers);
}

describe('编辑会话契约（12.03 §3.1）逐成员锁', () => {
  it('七个接口逐成员恰等：EditRequest / EditOptions / IEditEngine / EditEventMap / IEditSession / EntryInput / MetadataPatch', () => {
    for (const typeName of [
      'EditRequest',
      'EditOptions',
      'IEditEngine',
      'EditEventMap',
      'IEditSession',
      'EntryInput',
      'MetadataPatch',
    ]) {
      expectMembersLocked(DOC_12_03, SRC_SESSION, typeName);
    }
  });

  it('别名在册且 SDK 联合形状与原文一致（DocumentKind 与能力契约域共用单点）', () => {
    const declared = extractDeclaredTypeNames(DOC_12_03);
    expect(declared).toEqual(
      expect.arrayContaining(['DocumentKind', 'EditSessionState', 'IEditEngine', 'IEditSession'])
    );
    expectTypeOf<sdkMain.DocumentKind>().toEqualTypeOf<'card' | 'box'>();
    expectTypeOf<sdkMain.EditSessionState>().toEqualTypeOf<
      'opening' | 'active' | 'saving' | 'disposed'
    >();
  });

  it('IEditSession 是会话面唯一入口形态：preview 即 IRenderSession、revision 与 document:write 回执同一序列', () => {
    expectTypeOf<sdkMain.IEditSession['preview']>().toEqualTypeOf<sdkMain.IRenderSession>();
    expectTypeOf<sdkMain.IEditSession['revision']>().toEqualTypeOf<number>();
    expectTypeOf<sdkMain.IEditSession['revision']>().toEqualTypeOf<
      IDocumentWriteOutput['revision']
    >();
    expectTypeOf<sdkMain.EditEventMap['revision-changed']>().toEqualTypeOf<{ revision: number }>();
  });
});

describe('渲染侧受管门面契约（12.04 §4.1）逐成员锁', () => {
  it('IManagedPluginRuntime 逐成员恰等，门面返回即角色接口单点', () => {
    expectMembersLocked(DOC_12_04, SRC_FACADE, 'IManagedPluginRuntime');
    expectTypeOf<IManagedPluginRuntime['loadBaseCard']>().toEqualTypeOf<
      (cardType: string) => Promise<IBaseCardPlugin>
    >();
    expectTypeOf<IManagedPluginRuntime['loadLayout']>().toEqualTypeOf<
      (layoutType: string) => Promise<IBoxLayoutPlugin>
    >();
  });

  it('同名不同物锁：编辑链路受管门面非 manifest runtime 声明（{targets, background}）', () => {
    type HasTargets<T> = T extends { targets: unknown } ? true : false;
    expectTypeOf<HasTargets<IManagedPluginRuntime>>().toEqualTypeOf<false>();
    expectTypeOf<HasTargets<sdkMain.IPluginRuntime>>().toEqualTypeOf<true>();
  });
});

describe('撤销/重做历史记录模型（12.07 §7.2）逐字段锁', () => {
  it('EditHistoryEntry 逐成员恰等', () => {
    expectMembersLocked(DOC_12_07, SRC_HISTORY, 'EditHistoryEntry');
  });

  it('ChangePayload 联合体字段恰等，layout 变体载荷即 LayoutChange 单点', () => {
    expect(extractUnionObjectFields(DOC_12_07, 'ChangePayload')).toEqual(
      extractUnionObjectFields(SRC_HISTORY, 'ChangePayload')
    );
    expectTypeOf<EditHistoryEntry['forward']>().toEqualTypeOf<ChangePayload>();
    expectTypeOf<EditHistoryEntry['inverse']>().toEqualTypeOf<ChangePayload>();
    expectTypeOf<
      Extract<ChangePayload, { part: 'layout' }>['change']
    >().toEqualTypeOf<LayoutChange>();
  });

  it('EditPayloadPart 别名在册且联合形状与原文一致', () => {
    expect(extractDeclaredTypeNames(DOC_12_07)).toContain('EditPayloadPart');
    expectTypeOf<ChangePayload['part']>().toEqualTypeOf<
      'metadata' | 'structure' | 'content' | 'layout'
    >();
  });
});

describe('预览渲染会话契约（05.02 §2.4）逐成员锁', () => {
  it('IRenderSession / RenderEventMap 逐成员恰等', () => {
    expectMembersLocked(DOC_05_02, SRC_RENDER_SESSION, 'IRenderSession');
    expectMembersLocked(DOC_05_02, SRC_RENDER_SESSION, 'RenderEventMap');
  });

  it('RenderMode / RenderSessionState 别名在册且联合形状与原文一致', () => {
    const declared = extractDeclaredTypeNames(DOC_05_02);
    expect(declared).toEqual(expect.arrayContaining(['RenderMode', 'RenderSessionState']));
    expectTypeOf<sdkMain.RenderMode>().toEqualTypeOf<'view' | 'edit'>();
    expectTypeOf<sdkMain.RenderSessionState>().toEqualTypeOf<
      'opening' | 'ready' | 'error' | 'disposed'
    >();
    expectTypeOf<sdkMain.IRenderSession['update']>().toEqualTypeOf<
      (view: sdkMain.DocumentView, revision: number) => Promise<void>
    >();
  });
});

describe('基础卡片编辑句柄契约（08.04 §4）逐成员锁', () => {
  it('IBaseCardEditor / IBaseCardEditorEventMap / ICardPatchOperation 逐成员恰等', () => {
    for (const typeName of ['IBaseCardEditor', 'IBaseCardEditorEventMap', 'ICardPatchOperation']) {
      expectMembersLocked(DOC_08_04, SRC_BASECARD, typeName);
    }
  });

  it('BaseCardChange 联合体字段恰等；update 入参即 BaseCardView 单点、revision 链同源', () => {
    expect(extractUnionObjectFields(DOC_08_04, 'BaseCardChange')).toEqual(
      extractUnionObjectFields(SRC_BASECARD, 'BaseCardChange')
    );
    expectTypeOf<IBaseCardEditor['update']>().toEqualTypeOf<
      (basecard: BaseCardView, revision: number) => void
    >();
    expectTypeOf<IBaseCardEditor['markCommitted']>().toEqualTypeOf<(revision: number) => void>();
    expectTypeOf<IBaseCardEditor['markCommitted']>().toEqualTypeOf<
      (revision: IDocumentWriteOutput['revision']) => void
    >();
  });

  it('EditorState 别名在册（08.04/09.07 同名同形状，SDK 单点在 roles/common）', () => {
    expect(extractDeclaredTypeNames(DOC_08_04)).toContain('EditorState');
    expect(extractDeclaredTypeNames(DOC_09_07)).toContain('EditorState');
    expect(extractInterfaceMembers(SRC_BASECARD, 'IBaseCardEditor').at(0)).toBe('state');
    expectTypeOf<sdkMain.EditorState>().toEqualTypeOf<'active' | 'disposed'>();
  });
});

describe('布局编辑句柄契约（09.07 §7.1）逐成员锁', () => {
  it('ILayoutEditor / ILayoutEditorEventMap / ILayoutPatchOperation 逐成员恰等', () => {
    for (const typeName of ['ILayoutEditor', 'ILayoutEditorEventMap', 'ILayoutPatchOperation']) {
      expectMembersLocked(DOC_09_07, SRC_BOXLAYOUT, typeName);
    }
  });

  it('LayoutChange 联合体字段恰等；update 入参即 BoxRenderView 单点，两套句柄不共享类型名', () => {
    expect(extractUnionObjectFields(DOC_09_07, 'LayoutChange')).toEqual(
      extractUnionObjectFields(SRC_BOXLAYOUT, 'LayoutChange')
    );
    expectTypeOf<ILayoutEditor['update']>().toEqualTypeOf<
      (box: BoxRenderView, revision: number) => void
    >();
    expectTypeOf<IBaseCardEditor>().not.toEqualTypeOf<ILayoutEditor>();
  });
});

describe('EDIT_* 错误域（12.09 §9.2）与生成常量单源对照锁', () => {
  it('新增表三码恰等，且与 ERROR_CODES 的 EDIT_* 子集双向恰等', () => {
    const added = extractErrorCodes(DOC_12_09, '新增（归口：编辑链路）', '同一场景不得两码并用');
    expect(added).toEqual([
      'EDIT_SESSION_DISPOSED',
      'EDIT_TARGET_UNSUPPORTED',
      'EDIT_VALIDATION_FAILED',
    ]);
    expect(ERROR_CODES.filter((code) => code.startsWith('EDIT_'))).toEqual(added);
  });

  it('复用表逐名在册（RENDER_* / DOCUMENT_* / BRIDGE_*，RESOURCE_* 通配不取）', () => {
    const reused = extractErrorCodes(DOC_12_09, '### 9.2', '新增（归口：编辑链路）');
    expect(reused.length).toBeGreaterThan(10);
    const registered = new Set<string>(ERROR_CODES);
    for (const code of reused) {
      expect(registered.has(code), code).toBe(true);
    }
  });
});

describe('主入口与编辑链路类型域出口的在册名单锁（偏差注入双向臂）', () => {
  it('主入口编辑链路段两块在册名单精确相等（少一名漏落、多一名夹带都红）', () => {
    expect(parseExportTypeNames(SRC_INDEX, './edit/index.js')).toEqual([
      'EditEventMap',
      'EditOptions',
      'EditRequest',
      'EditSessionState',
      'EntryInput',
      'IEditEngine',
      'IEditSession',
      'MetadataPatch',
    ]);
    expect(parseExportTypeNames(SRC_INDEX, './types/render-session.js')).toEqual([
      'IRenderSession',
      'RenderEventMap',
      'RenderMode',
      'RenderSessionState',
    ]);
  });

  it('域出口聚合名单精确相等，且全部类型名都在契约原文在册（禁自造）', () => {
    const barrelBlocks: readonly (readonly string[])[] = [
      parseExportTypeNames(SRC_EDIT_BARREL, './session.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, './facade.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, './history.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, '../types/roles/basecard.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, '../types/roles/boxlayout.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, '../types/roles/common.js'),
      parseExportTypeNames(SRC_EDIT_BARREL, '../types/render-session.js'),
    ];
    expect(barrelBlocks.map((block) => [...block].sort())).toEqual([
      [
        'EditEventMap',
        'EditOptions',
        'EditRequest',
        'EditSessionState',
        'EntryInput',
        'IEditEngine',
        'IEditSession',
        'MetadataPatch',
      ],
      ['IManagedPluginRuntime'],
      ['ChangePayload', 'EditHistoryEntry', 'EditPayloadPart'],
      ['BaseCardChange', 'IBaseCardEditor', 'IBaseCardEditorEventMap', 'ICardPatchOperation'],
      ['ILayoutEditor', 'ILayoutEditorEventMap', 'ILayoutPatchOperation', 'LayoutChange'],
      ['EditorState'],
      ['IRenderSession', 'RenderEventMap', 'RenderMode', 'RenderSessionState'],
    ]);
    const declared = new Set<string>(CONTRACT_TYPE_NAMES);
    for (const block of barrelBlocks) {
      for (const name of block) {
        expect(declared.has(name), `类型名 ${name} 未在契约分件原文声明`).toBe(true);
      }
    }
  });

  it('主入口不导出受管门面与历史记录模型（12 §4.1 规则 1、§7.1 归属），manifest 同名块不动', () => {
    const mainBlocks = [
      ...parseExportTypeNames(SRC_INDEX, './edit/index.js'),
      ...parseExportTypeNames(SRC_INDEX, './types/render-session.js'),
    ];
    expect(mainBlocks).not.toContain('IManagedPluginRuntime');
    expect(mainBlocks).not.toContain('EditHistoryEntry');
    expect(mainBlocks).not.toContain('ChangePayload');
    expect(mainBlocks).not.toContain('EditPayloadPart');
    expect(parseExportTypeNames(SRC_INDEX, './scaffold/index.js')).toContain('IPluginRuntime');
  });
});
