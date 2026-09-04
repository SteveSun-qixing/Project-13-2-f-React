/**
 * Univer 运行时共享类型与补丁装配。
 *
 * 原版 univer-state.ts 承载 sidecar 视口懒加载的流式状态；移植为全量快照
 * 灌入后，运行时只需要引擎引导结果与渲染层补丁（编辑日志见 edit-journal.ts，
 * 与 sidecar 完全解耦）。
 */
import { createUniver, type CreateUniverOptions, type IPreset } from "./create-univer";
import { buildSheetsLocales, SHEETS_LOCALE_TYPE } from "./univer-locales";
import { buildSheetsPresets } from "./presets";
import { installMergeBorderFix } from "./patches/merge-border-fix";
import { installSheetRenameFix } from "./patches/sheet-rename-fix";
import { installFormulaLexerFix } from "./patches/formula-lexer-fix";

export type UniverRuntime = ReturnType<typeof createUniver>;
export type ActiveWorkbook = NonNullable<ReturnType<UniverRuntime["univerAPI"]["getActiveWorkbook"]>>;
export type UniverWorksheet = NonNullable<ReturnType<ActiveWorkbook["getActiveSheet"]>>;

export interface SheetRuntimePatches {
  mergeBorderFix: void;
  sheetRenameFix: { dispose(): void };
  formulaLexerFix: { dispose(): void };
}

/** 安装纯 JS 渲染/词法补丁（全局原型补丁幂等，可安全重复调用）。 */
export function installSheetRuntimePatches(runtime: UniverRuntime): SheetRuntimePatches {
  installMergeBorderFix();
  return {
    mergeBorderFix: undefined,
    sheetRenameFix: installSheetRenameFix(),
    formulaLexerFix: installFormulaLexerFix(runtime),
  };
}

export interface BootSheetRuntimeOptions {
  /** Univer 挂载容器元素 id */
  containerId: string;
}

/**
 * 引导表格编辑引擎：组装开源 preset 列表 + 中文语言包。
 * 协作模式与 @univerjs-pro 专有包不参与。
 */
export function bootSheetRuntime(options: BootSheetRuntimeOptions): UniverRuntime {
  const presets: IPreset[] = buildSheetsPresets({ containerId: options.containerId });
  const createOptions: CreateUniverOptions = {
    locale: SHEETS_LOCALE_TYPE,
    locales: buildSheetsLocales(),
    presets,
  };
  return createUniver(createOptions);
}
