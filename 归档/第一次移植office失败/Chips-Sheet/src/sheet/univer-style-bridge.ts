/**
 * 内部样式模型 ↔ Univer IStyleData 的双向桥接。
 * 覆盖样式子集：字体加粗/斜体/下划线/删除线/字号/字体名/颜色、填充色、
 * 边框（线型+颜色）、水平/垂直对齐、自动换行、文字旋转、数字格式。
 */
import {
  BooleanNumber,
  BorderStyleTypes,
  HorizontalAlign,
  TextDecoration,
  VerticalAlign,
  WrapStrategy,
  type IBorderData,
  type IBorderStyleData,
  type IColorStyle,
  type IStyleData,
  type ITextDecoration,
  type Nullable,
} from "@univerjs/core";

import type { CellBorderModel, CellStyleModel } from "./workbook-model";

const UNIVER_BORDER_STYLE_BY_NAME: Record<string, BorderStyleTypes> = {
  thin: BorderStyleTypes.THIN,
  hair: BorderStyleTypes.HAIR,
  dotted: BorderStyleTypes.DOTTED,
  dashed: BorderStyleTypes.DASHED,
  medium: BorderStyleTypes.MEDIUM,
  thick: BorderStyleTypes.THICK,
};

const BORDER_NAME_BY_UNIVER_STYLE: Record<number, string> = {
  [BorderStyleTypes.THIN]: "thin",
  [BorderStyleTypes.HAIR]: "hair",
  [BorderStyleTypes.DOTTED]: "dotted",
  [BorderStyleTypes.DASHED]: "dashed",
  [BorderStyleTypes.DASH_DOT]: "dashed",
  [BorderStyleTypes.DASH_DOT_DOT]: "dashed",
  [BorderStyleTypes.MEDIUM]: "medium",
  [BorderStyleTypes.MEDIUM_DASHED]: "dashed",
  [BorderStyleTypes.MEDIUM_DASH_DOT]: "dashed",
  [BorderStyleTypes.MEDIUM_DASH_DOT_DOT]: "dashed",
  [BorderStyleTypes.SLANT_DASH_DOT]: "dashed",
  [BorderStyleTypes.DOUBLE]: "medium",
  [BorderStyleTypes.THICK]: "thick",
};

function colorStyle(rgb: string | undefined): IColorStyle | undefined {
  return rgb ? { rgb } : undefined;
}

function textDecoration(): ITextDecoration {
  return { s: BooleanNumber.TRUE, t: TextDecoration.SINGLE };
}

/** 内部样式 → Univer IStyleData（仅携带非默认字段） */
export function modelStyleToUniverStyle(style: CellStyleModel, numFmt?: string): IStyleData {
  const result: IStyleData = {};
  if (style.fontFamily) {
    result.ff = style.fontFamily;
  }
  if (typeof style.fontSize === "number") {
    result.fs = style.fontSize;
  }
  if (style.bold === true) {
    result.bl = BooleanNumber.TRUE;
  }
  if (style.italic === true) {
    result.it = BooleanNumber.TRUE;
  }
  if (style.underline === true) {
    result.ul = textDecoration();
  }
  if (style.strike === true) {
    result.st = textDecoration();
  }
  const fontColor = colorStyle(style.fontColor);
  if (fontColor) {
    result.cl = fontColor;
  }
  const fillColor = colorStyle(style.fillColor);
  if (fillColor) {
    result.bg = fillColor;
  }
  const borders = style.borders;
  if (borders) {
    const bd: IBorderData = {};
    const sides: Array<[keyof IBorderData, CellBorderModel | undefined]> = [
      ["t", borders.top],
      ["b", borders.bottom],
      ["l", borders.left],
      ["r", borders.right],
    ];
    for (const [key, side] of sides) {
      if (!side) {
        continue;
      }
      const borderStyle: IBorderStyleData = {
        s: UNIVER_BORDER_STYLE_BY_NAME[side.style] ?? BorderStyleTypes.THIN,
        cl: colorStyle(side.color) ?? { rgb: "#000000" },
      };
      bd[key] = borderStyle;
    }
    if (Object.keys(bd).length > 0) {
      result.bd = bd;
    }
  }
  if (style.horizontal === "left") {
    result.ht = HorizontalAlign.LEFT;
  } else if (style.horizontal === "center") {
    result.ht = HorizontalAlign.CENTER;
  } else if (style.horizontal === "right") {
    result.ht = HorizontalAlign.RIGHT;
  }
  if (style.vertical === "top") {
    result.vt = VerticalAlign.TOP;
  } else if (style.vertical === "middle") {
    result.vt = VerticalAlign.MIDDLE;
  } else if (style.vertical === "bottom") {
    result.vt = VerticalAlign.BOTTOM;
  }
  if (style.wrapText === true) {
    result.tb = WrapStrategy.WRAP;
  }
  const rotation = style.textRotation;
  if (typeof rotation === "number" && rotation > 0) {
    // OOXML textRotation 1-90 逆时针、91-180 顺时针（Univer 以负角表达顺时针，
    // 与 GenOffice ooxmlTextRotationToUniver 同口径）、255 为垂直堆叠
    // （exceljs 读取侧不保留 255，这里仅作兼容兜底）。
    if (rotation === 255) {
      result.tr = { a: 0, v: BooleanNumber.TRUE };
    } else if (rotation > 90) {
      result.tr = { a: 90 - rotation };
    } else {
      result.tr = { a: rotation };
    }
  }
  if (numFmt) {
    result.n = { pattern: numFmt };
  }
  return result;
}

function borderStyleName(style: BorderStyleTypes | undefined): string {
  if (style === undefined) {
    return "thin";
  }
  return BORDER_NAME_BY_UNIVER_STYLE[style] ?? "thin";
}

function univerColorRgb(color: Nullable<IColorStyle>): string | undefined {
  if (color?.rgb) {
    return color.rgb;
  }
  return undefined;
}

/** Univer IStyleData → 内部样式模型（仅携带已设置字段） */
export function univerStyleToModelStyle(style: IStyleData): CellStyleModel {
  const result: CellStyleModel = {};
  if (style.ff) {
    result.fontFamily = style.ff;
  }
  if (typeof style.fs === "number") {
    result.fontSize = style.fs;
  }
  if (style.bl === BooleanNumber.TRUE) {
    result.bold = true;
  }
  if (style.it === BooleanNumber.TRUE) {
    result.italic = true;
  }
  if (style.ul?.s === BooleanNumber.TRUE && style.ul.t !== TextDecoration.NONE) {
    result.underline = true;
  }
  if (style.st?.s === BooleanNumber.TRUE) {
    result.strike = true;
  }
  const fontColor = univerColorRgb(style.cl);
  if (fontColor) {
    result.fontColor = fontColor;
  }
  const fillColor = univerColorRgb(style.bg);
  if (fillColor) {
    result.fillColor = fillColor;
  }
  const bd = style.bd;
  if (bd) {
    const borders: CellStyleModel["borders"] = {};
    const top = bd.t;
    if (top) {
      borders.top = {
        style: borderStyleName(top.s),
        color: univerColorRgb(top.cl) ?? "#000000",
      };
    }
    const bottom = bd.b;
    if (bottom) {
      borders.bottom = {
        style: borderStyleName(bottom.s),
        color: univerColorRgb(bottom.cl) ?? "#000000",
      };
    }
    const left = bd.l;
    if (left) {
      borders.left = {
        style: borderStyleName(left.s),
        color: univerColorRgb(left.cl) ?? "#000000",
      };
    }
    const right = bd.r;
    if (right) {
      borders.right = {
        style: borderStyleName(right.s),
        color: univerColorRgb(right.cl) ?? "#000000",
      };
    }
    if (Object.keys(borders).length > 0) {
      result.borders = borders as NonNullable<CellStyleModel["borders"]>;
    }
  }
  if (style.ht === HorizontalAlign.LEFT) {
    result.horizontal = "left";
  } else if (style.ht === HorizontalAlign.CENTER) {
    result.horizontal = "center";
  } else if (style.ht === HorizontalAlign.RIGHT) {
    result.horizontal = "right";
  }
  if (style.vt === VerticalAlign.TOP) {
    result.vertical = "top";
  } else if (style.vt === VerticalAlign.MIDDLE) {
    result.vertical = "middle";
  } else if (style.vt === VerticalAlign.BOTTOM) {
    result.vertical = "bottom";
  }
  if (style.tb === WrapStrategy.WRAP) {
    result.wrapText = true;
  }
  const tr = style.tr;
  if (tr && typeof tr.a === "number") {
    if (tr.v === BooleanNumber.TRUE) {
      result.textRotation = 255;
    } else if (tr.a === 0) {
      // 未旋转
    } else if (tr.a < 0) {
      // Univer 负角表达顺时针：还原为 OOXML 的 91-180 区间
      result.textRotation = 90 - tr.a;
    } else {
      result.textRotation = tr.a;
    }
  }
  return result;
}
