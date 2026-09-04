/**
 * 移植自 GenOffice apps/sheets/src/renderer/sheet-rename-fix.ts（Apache-2.0）。
 *
 * 重命名仅改大小写的修复。Univer 的重命名检查（sheets-ui nameRepeatCheck）
 * 在调用 Workbook.checkSheetName 之前只做了一次区分大小写的自比较——而
 * checkSheetName 内部按不区分大小写匹配，于是 Sheet1 → SHEET1 会与自身
 * “冲突”而被拒绝。这里精确豁免该场景：候选名仅与活动 sheet 名称大小写不同
 * 时，只有当它同时匹配其他 sheet 才视为重名。
 */
import { Workbook } from "@univerjs/core";

interface SheetLike {
  getName(): string;
}

export interface WorkbookProtoLike {
  getActiveSheet(allowNull: true): SheetLike | null | undefined;
  getSheets(): SheetLike[];
  checkSheetName(name: string): boolean;
  uniqueSheetName(name?: string): string;
  generateNewSheetName(name: string): string;
}

export function patchCheckSheetName(proto: WorkbookProtoLike): { dispose(): void } {
  const originalCheck = proto.checkSheetName;
  const originalUnique = proto.uniqueSheetName;
  const originalGenerate = proto.generateNewSheetName;
  // uniqueSheetName/generateNewSheetName 用于为新建/复制的 sheet 生成名称；
  // 重命名豁免不得削弱它们的去重逻辑（生成的 "Sheet2" 仍须与活动 "sheet2" 冲突）。
  let minting = false;
  proto.uniqueSheetName = function (this: WorkbookProtoLike, name?: string) {
    minting = true;
    try {
      return originalUnique.call(this, name);
    } finally {
      minting = false;
    }
  };
  proto.generateNewSheetName = function (this: WorkbookProtoLike, name: string) {
    minting = true;
    try {
      return originalGenerate.call(this, name);
    } finally {
      minting = false;
    }
  };
  proto.checkSheetName = function (this: WorkbookProtoLike, name: string) {
    if (!minting) {
      const active = this.getActiveSheet(true);
      const activeName = active?.getName();
      if (
        activeName !== undefined &&
        activeName !== name &&
        activeName.toLowerCase() === name.toLowerCase()
      ) {
        return this.getSheets().some(
          (sheet) => sheet !== active && sheet.getName().toLowerCase() === name.toLowerCase(),
        );
      }
    }
    return originalCheck.call(this, name);
  };
  return {
    dispose() {
      proto.checkSheetName = originalCheck;
      proto.uniqueSheetName = originalUnique;
      proto.generateNewSheetName = originalGenerate;
    },
  };
}

export function installSheetRenameFix(): { dispose(): void } {
  // 直接修补类原型：安装时还没有任何工作簿单元（单元由后续 createWorkbook 创建）。
  return patchCheckSheetName(Workbook.prototype as unknown as WorkbookProtoLike);
}
