/**
 * 移植自 GenOffice apps/sheets/src/renderer/merge-border-fix.ts（Apache-2.0）。
 *
 * Univer 在只有合并区域主单元格带边框时（Excel 写文件的常见形态——样式写在
 * 左上角单元格上）不会渲染合并区域的边框：`_setStylesCacheForOneCell` 只对
 * 被覆盖单元格（`isMerged`）传 mergeRange，对主单元格（`isMergedMainCell`）
 * 不传，而非合并分支又会经 `intersectMergeRange` 提前返回——主单元格的边框
 * 因此永远进不了渲染缓存。为主单元格补传合并区域可让它走进
 * `_setMergeBorderProps`，按范围边缘逐格产出与 Excel 完全一致的边框分段。
 */
import type { IRange, IStyleData, Nullable } from "@univerjs/core";
import { SpreadsheetSkeleton } from "@univerjs/engine-render";

interface MergeInfoLike {
  isMergedMainCell?: boolean;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

interface SkeletonProtoLike {
  worksheet?: { getCellInfoInMergeData(row: number, col: number): MergeInfoLike };
  _setBorderStylesCache(
    row: number,
    col: number,
    style: Nullable<IStyleData>,
    options: { mergeRange?: IRange; cacheItem?: unknown } | undefined,
  ): void;
}

let installed = false;

export function installMergeBorderFix(): void {
  if (installed) {
    return;
  }
  installed = true;
  const proto = SpreadsheetSkeleton.prototype as unknown as SkeletonProtoLike;
  const original = proto._setBorderStylesCache;
  if (typeof original !== "function") {
    return;
  }
  proto._setBorderStylesCache = function (
    this: SkeletonProtoLike,
    row: number,
    col: number,
    style: Nullable<IStyleData>,
    options: { mergeRange?: IRange; cacheItem?: unknown } | undefined,
  ): void {
    if (style?.bd && !options?.mergeRange) {
      const info = this.worksheet?.getCellInfoInMergeData(row, col);
      if (
        info?.isMergedMainCell &&
        (info.endRow > info.startRow || info.endColumn > info.startColumn)
      ) {
        options = {
          ...options,
          mergeRange: {
            startRow: info.startRow,
            startColumn: info.startColumn,
            endRow: info.endRow,
            endColumn: info.endColumn,
          },
        };
      }
    }
    original.call(this, row, col, style, options);
  };
}
