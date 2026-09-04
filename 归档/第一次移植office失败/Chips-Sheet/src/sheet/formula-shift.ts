import { columnLabel, columnIndex } from "./cell-address";

/**
 * 移植自 GenOffice apps/sheets/src/domain/formula-shift.ts 的
 * offsetFormulaRefs（Apache-2.0）：按“复制/填充”语义改写公式中的 A1 引用，
 * 相对轴随偏移平移，`$` 绝对轴保持钉住，推出网格的引用改写为 #REF!。
 * 本插件用它把 xlsx 共享公式（shared formula）主单元格的公式文本
 * 展开到每个从属单元格。
 */

const MAX_GRID_ROWS = 1_048_576;
const MAX_GRID_COLUMNS = 16_384;

interface RefPart {
  readonly colAbs: string;
  readonly col: number;
  readonly rowAbs: string;
  readonly row: number;
}

function formatRef(part: RefPart): string {
  return `${part.colAbs}${columnLabel(part.col)}${part.rowAbs}${part.row + 1}`;
}

function offsetRefPart(part: RefPart, rowDelta: number, columnDelta: number): RefPart | null {
  const row = part.rowAbs === "$" ? part.row : part.row + rowDelta;
  const col = part.colAbs === "$" ? part.col : part.col + columnDelta;
  if (row < 0 || row >= MAX_GRID_ROWS || col < 0 || col >= MAX_GRID_COLUMNS) {
    return null;
  }
  return { ...part, row, col };
}

// sheet 前缀（可选）+ 首引用 + 可选 ":第二引用"。边界条件：
// 前面不能是 [A-Za-z0-9_.$]（保护 LOG10、名称），引用后面不能是字母/数字/(
// （保护 ABC1DEF 与函数名）。
const REF_RE =
  /(?<![A-Za-z0-9_.$!])(?:(?:'([^']+)'|([A-Za-z0-9_.]+))!)?(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})(?::(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7}))?(?![A-Za-z0-9(])/g;

// 整列跨度（B:D）——REF_RE 只匹配带行号的引用，整列跨度需要独立处理。
const COLUMN_SPAN_RE =
  /(?<![A-Za-z0-9_.$!:])(?:(?:'([^']+)'|([A-Za-z0-9_.]+))!)?(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![A-Za-z0-9($!:])/g;

export function offsetFormulaRefs(formula: string, rowDelta: number, columnDelta: number): string {
  if (rowDelta === 0 && columnDelta === 0) {
    return formula;
  }
  const segments = formula.split(/("(?:[^"]|"")*")/);
  const rewritten = segments.map((segment, index) => {
    if (index % 2 === 1) {
      return segment;
    }
    let out = segment.replace(
      REF_RE,
      (
        match: string,
        quoted: string | undefined,
        bare: string | undefined,
        aAbsC: string,
        aCol: string,
        aAbsR: string,
        aRow: string,
        bAbsC: string | undefined,
        bCol: string | undefined,
        bAbsR: string | undefined,
        bRow: string | undefined,
      ) => {
        const prefix =
          quoted !== undefined ? `'${quoted}'!` : bare !== undefined ? `${bare}!` : "";
        const first = offsetRefPart(
          {
            colAbs: aAbsC,
            col: columnIndex(aCol),
            rowAbs: aAbsR,
            row: Number(aRow) - 1,
          },
          rowDelta,
          columnDelta,
        );
        if (bCol === undefined) {
          return first ? `${prefix}${formatRef(first)}` : `${prefix}#REF!`;
        }
        const second = offsetRefPart(
          {
            colAbs: bAbsC ?? "",
            col: columnIndex(bCol),
            rowAbs: bAbsR ?? "",
            row: Number(bRow ?? "1") - 1,
          },
          rowDelta,
          columnDelta,
        );
        if (!first || !second) {
          return `${prefix}#REF!`;
        }
        return `${prefix}${formatRef(first)}:${formatRef(second)}`;
      },
    );
    if (columnDelta !== 0) {
      out = out.replace(
        COLUMN_SPAN_RE,
        (
          match: string,
          quoted: string | undefined,
          bare: string | undefined,
          aAbs: string,
          aCol: string,
          bAbs: string,
          bCol: string,
        ) => {
          const prefix =
            quoted !== undefined ? `'${quoted}'!` : bare !== undefined ? `${bare}!` : "";
          const shift = (abs: string, letters: string): string | null => {
            if (abs === "$") {
              return `$${letters}`;
            }
            const shifted = columnIndex(letters) + columnDelta;
            return shifted < 0 || shifted >= MAX_GRID_COLUMNS ? null : columnLabel(shifted);
          };
          const first = shift(aAbs, aCol);
          const second = shift(bAbs, bCol);
          if (first === null || second === null) {
            return `${prefix}#REF!`;
          }
          return `${prefix}${first}:${second}`;
        },
      );
    }
    return out;
  });
  return rewritten.join("");
}
