/**
 * 表格编辑器 preset 装配清单。
 * 全部来自开源 Apache-2.0 的 @univerjs/preset-sheets-* 单包，
 * 与 GenOffice Sheets 的启用范围保持一致。
 */
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import { UniverSheetsDrawingPreset } from "@univerjs/preset-sheets-drawing";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import { UniverSheetsNotePreset } from "@univerjs/preset-sheets-note";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import { UniverSheetsTablePreset, UniverSheetsTableUIPlugin } from "@univerjs/preset-sheets-table";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-table/lib/index.css";

import type { IPreset } from "./create-univer";

export interface SheetsPresetOptions {
  /** Univer 挂载容器元素 id */
  containerId: string;
}

export function buildSheetsPresets(options: SheetsPresetOptions): IPreset[] {
  const { containerId } = options;
  return [
    UniverSheetsCorePreset({
      container: containerId,
      header: true,
      toolbar: true,
      contextMenu: true,
      formulaBar: true,
      footer: {
        sheetBar: true,
        statisticBar: true,
        menus: true,
        zoomSlider: true,
      },
      statusBarStatistic: true,
      // OOXML 样式默认值解析为“单元格 > 行 > 列”；渲染骨架默认列优先，
      // 需要此开关才能与 Excel 一致。
      sheets: { isRowStylePrecedeColumnStyle: true },
    }),
    UniverSheetsDrawingPreset(),
    UniverSheetsConditionalFormattingPreset(),
    UniverSheetsFilterPreset(),
    UniverSheetsDataValidationPreset(),
    UniverSheetsNotePreset(),
    UniverSheetsFindReplacePreset(),
    UniverSheetsSortPreset(),
    UniverSheetsTablePreset(),
    // 不显示浮动表格名标签：其 32px 间距会使网格相对 Excel 偏移。
    { plugins: [[UniverSheetsTableUIPlugin, { hideAnchor: true }]] },
  ];
}
