/**
 * Univer 中文语言包装配。
 * 应用界面语言固定为简体中文，preset 每个包自带全部语言包，
 * 这里静态聚合 zh-CN 并合并（浅合并命名空间，同命名空间需自行展开）。
 * sheets-ui 0.25.1 引用了语言包缺失的两个键，这里补齐官方英文兜底文案，
 * 避免原始键名直接暴露给用户。
 */
import { LocaleType, mergeLocales, type ILocales } from "@univerjs/core";

import UniverPresetSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import UniverPresetSheetsConditionalFormattingZhCN from "@univerjs/preset-sheets-conditional-formatting/locales/zh-CN";
import UniverPresetSheetsDataValidationZhCN from "@univerjs/preset-sheets-data-validation/locales/zh-CN";
import UniverPresetSheetsDrawingZhCN from "@univerjs/preset-sheets-drawing/locales/zh-CN";
import UniverPresetSheetsFilterZhCN from "@univerjs/preset-sheets-filter/locales/zh-CN";
import UniverPresetSheetsFindReplaceZhCN from "@univerjs/preset-sheets-find-replace/locales/zh-CN";
import UniverPresetSheetsNoteZhCN from "@univerjs/preset-sheets-note/locales/zh-CN";
import UniverPresetSheetsSortZhCN from "@univerjs/preset-sheets-sort/locales/zh-CN";
import UniverPresetSheetsTableZhCN from "@univerjs/preset-sheets-table/locales/zh-CN";

type LocalePack = Record<string, unknown>;

const PRESET_PACKS: LocalePack[] = [
  UniverPresetSheetsCoreZhCN,
  UniverPresetSheetsConditionalFormattingZhCN,
  UniverPresetSheetsDataValidationZhCN,
  UniverPresetSheetsDrawingZhCN,
  UniverPresetSheetsFilterZhCN,
  UniverPresetSheetsFindReplaceZhCN,
  UniverPresetSheetsNoteZhCN,
  UniverPresetSheetsSortZhCN,
  UniverPresetSheetsTableZhCN,
];

export const SHEETS_LOCALE_TYPE = LocaleType.ZH_CN;

export function buildSheetsLocales(): ILocales {
  const merged = mergeLocales(...PRESET_PACKS) as Record<string, Record<string, unknown>>;
  // sheets-ui 0.25.1 引用以下两个键但语言包未随包发布；
  // 保留英文兜底，避免原始键名出现在界面上（与 en-US 启动语言包的补丁一致）。
  merged["sheets-ui"] = {
    ...(merged["sheets-ui"] ?? {}),
    info: {
      ...((merged["sheets-ui"]?.info as Record<string, string> | undefined) ?? {}),
      error: "Number stored as text",
      forceStringInfo:
        "The value in this cell is stored as text — it will not be treated as a " +
        "number in formulas.",
    },
  };
  return { [SHEETS_LOCALE_TYPE]: merged } as unknown as ILocales;
}
