import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  CellModel,
  CellScalarValue,
  SheetModel,
  WorkbookModel,
} from "./workbook-model";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  parseTagValue: false,
  attributeValueProcessor: (_name, value) => value.trim(),
});

type XmlNode = Record<string, unknown>;

function isXmlNode(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function xmlChild(node: unknown, key: string): unknown {
  if (!isXmlNode(node)) return undefined;
  return node[key];
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (isXmlNode(node)) {
    return textOf(node["#text"]);
  }
  return String(node);
}

function sharedStringText(si: Record<string, unknown>): string {
  if (si["t"] !== undefined) return textOf(si["t"]);
  return asArray(si["r"] as unknown)
    .map((run) => textOf((run as Record<string, unknown>)["t"]))
    .join("");
}

function columnIndex(cellRef: string): number {
  let index = 0;
  for (const ch of cellRef) {
    if (ch < "A" || ch > "Z") break;
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseCellAddress(cellRef: string): { column: number; row: number } {
  const colStr = cellRef.replace(/[0-9]/g, "");
  const rowStr = cellRef.replace(/[A-Z]/g, "");
  const column = columnIndex(colStr);
  const row = parseInt(rowStr, 10) - 1;
  return { column, row };
}

interface XlsxCell {
  "@_r"?: string;
  "@_t"?: string;
  v?: unknown;
  is?: Record<string, unknown>;
  f?: unknown;
}

function parseCellValue(
  cell: XlsxCell,
  shared: string[],
): CellModel {
  const model: CellModel = {};
  const type = cell["@_t"] ?? "";

  if (type === "inlineStr") {
    if (cell.is) {
      model.value = sharedStringText(cell.is);
    }
    return model;
  }

  const rawValue = textOf(cell.v);

  // 真实 xlsx 中公式单元格的缓存结果通过 t="str"/"b"/"e" 标注类型，
  // 公式判定必须先于结果类型判定，否则公式信息会被丢弃。
  if (typeof cell.f === "string" && cell.f.length > 0) {
    model.formula = cell.f.replace(/^=/, "");
    if (type === "str") {
      model.result = rawValue;
      return model;
    }
    if (type === "b") {
      model.result = rawValue.trim() === "1" ? true : false;
      return model;
    }
    if (type === "e") {
      model.error = rawValue;
      return model;
    }
    if (rawValue) {
      const result = tryParseScalar(rawValue);
      if (result !== null) {
        model.result = result;
      }
    }
    return model;
  }

  if (type === "s") {
    model.value = shared[parseInt(rawValue, 10)] ?? "";
    return model;
  }

  if (type === "b") {
    model.value = rawValue.trim() === "1" ? true : false;
    return model;
  }

  if (type === "e") {
    model.error = rawValue;
    return model;
  }

  const scalar = tryParseScalar(rawValue);
  if (scalar !== null) {
    model.value = scalar;
  } else if (rawValue) {
    model.value = rawValue;
  }

  return model;
}

function tryParseScalar(value: string): CellScalarValue {
  if (value === "") return null;
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }
  return null;
}

function parseSheet(
  worksheet: Record<string, unknown>,
  shared: string[],
): SheetModel {
  const cells: Record<number, Record<number, CellModel>> = {};
  const merges: string[] = [];
  const colWidths: Record<number, number> = {};
  const rowHeights: Record<number, number> = {};

  let maxRow = 0;
  let maxColumn = 0;

  const sheetData = worksheet["sheetData"] as Record<string, unknown>;
  if (sheetData && typeof sheetData === "object") {
    const rows = asArray(sheetData["row"]) as Array<Record<string, unknown>>;
    for (const rowData of rows) {
      const rowCells = asArray(rowData["c"] as XlsxCell | XlsxCell[]) || [];
      const rowNum = parseInt(String(rowData["@_r"] ?? "1"), 10) - 1;
      const rowHeight = parseFloat(String(rowData["@_ht"] ?? ""));
      if (!isNaN(rowHeight) && rowHeight > 0) {
        rowHeights[rowNum] = rowHeight;
      }

      for (const cell of rowCells) {
        const cellRef = String(cell["@_r"] ?? "");
        if (!cellRef) continue;

        const { column, row } = parseCellAddress(cellRef);
        maxRow = Math.max(maxRow, row);
        maxColumn = Math.max(maxColumn, column);

        const cellModel = parseCellValue(cell, shared);
        if (Object.keys(cellModel).length > 0) {
          if (!cells[row]) cells[row] = {};
          cells[row][column] = cellModel;
        }
      }
    }
  }

  const mergeCells = worksheet["mergeCells"] as Record<string, unknown>;
  if (mergeCells && typeof mergeCells === "object") {
    const mergeList = asArray(mergeCells["mergeCell"]) as Array<Record<string, unknown>>;
    for (const merge of mergeList) {
      const ref = String(merge["@_ref"] ?? "");
      if (ref) merges.push(ref);
    }
  }

  const cols = worksheet["cols"] as Record<string, unknown>;
  if (cols && typeof cols === "object") {
    const colList = asArray(cols["col"]) as Array<Record<string, unknown>>;
    for (const col of colList) {
      const min = parseInt(String(col["@_min"] ?? "1"), 10) - 1;
      const max = parseInt(String(col["@_max"] ?? "1"), 10) - 1;
      const width = parseFloat(String(col["@_width"] ?? "8.43"));
      for (let i = min; i <= max; i++) {
        colWidths[i] = width * 8;
      }
    }
  }

  const dimension = worksheet["dimension"] as Record<string, unknown>;
  if (dimension && typeof dimension === "object") {
    const ref = String(dimension["@_ref"] ?? "");
    const parts = ref.split(":");
    if (parts.length === 2) {
      const start = parseCellAddress(parts[0]);
      const end = parseCellAddress(parts[1]);
      maxRow = Math.max(maxRow, end.row);
      maxColumn = Math.max(maxColumn, end.column);
    }
  }

  return {
    name: "工作表",
    hidden: false,
    rowCount: Math.max(maxRow + 10, 99),
    columnCount: Math.max(maxColumn + 5, 25),
    cells,
    merges,
    colWidths,
    rowHeights,
  };
}

export async function parseXlsxBytes(bytes: Uint8Array): Promise<WorkbookModel> {
  const zip = await JSZip.loadAsync(bytes);

  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  if (!workbookXml) {
    throw new Error("Invalid xlsx: missing xl/workbook.xml");
  }

  const workbook = parser.parse(workbookXml) as XmlNode;
  const sheets = asArray(
    xmlChild(xmlChild(workbook["workbook"], "sheets"), "sheet"),
  ) as Array<XmlNode>;

  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  const relTargets = new Map<string, string>();

  if (relsXml) {
    const rels = parser.parse(relsXml) as XmlNode;
    const relationships = asArray(
      xmlChild(rels["Relationships"], "Relationship"),
    ) as Array<XmlNode>;
    for (const rel of relationships) {
      const target = String(rel["@_Target"] ?? "");
      relTargets.set(
        String(rel["@_Id"] ?? ""),
        target.startsWith("/") ? target.slice(1) : `xl/${target}`,
      );
    }
  }

  const shared: string[] = [];
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (sharedXml) {
    const sst = parser.parse(sharedXml) as XmlNode;
    const siList = asArray(xmlChild(sst["sst"], "si")) as Array<XmlNode>;
    for (const si of siList) {
      shared.push(sharedStringText(si));
    }
  }

  const sheetModels: SheetModel[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const sheetInfo = sheets[i];
    const sheetName = String(sheetInfo["@_name"] ?? `工作表${i + 1}`);
    const rId = String(sheetInfo["@_r:id"] ?? "");
    const path = relTargets.get(rId);

    if (!path) continue;

    const sheetXml = await zip.file(path)?.async("text");
    if (!sheetXml) continue;

    const worksheet = xmlChild(parser.parse(sheetXml) as XmlNode, "worksheet");
    const model = parseSheet(isXmlNode(worksheet) ? worksheet : {}, shared);
    model.name = sheetName;

    const state = String(sheetInfo["@_state"] ?? "visible");
    model.hidden = state === "hidden" || state === "veryHidden";

    sheetModels.push(model);
  }

  if (sheetModels.length === 0) {
    sheetModels.push({
      name: "工作表1",
      hidden: false,
      rowCount: 100,
      columnCount: 26,
      cells: {},
      merges: [],
      colWidths: {},
      rowHeights: {},
    });
  }

  let activeSheetIndex = 0;
  const workbookView = xmlChild(xmlChild(workbook["workbook"], "bookViews"), "workbookView");
  if (isXmlNode(workbookView)) {
    const activeTab = parseInt(String(workbookView["@_activeTab"] ?? "0"), 10);
    if (activeTab >= 0 && activeTab < sheetModels.length) {
      activeSheetIndex = activeTab;
    }
  }

  return {
    fileName: "工作簿.xlsx",
    sheets: sheetModels,
    activeSheetIndex,
  };
}

export function xlsxModelToCsv(model: WorkbookModel, sheetIndex = model.activeSheetIndex): string {
  const sheet = model.sheets[sheetIndex];
  if (!sheet) return "";

  let maxRow = -1;
  let maxColumn = -1;

  for (const [rowStr, rowCells] of Object.entries(sheet.cells)) {
    const row = parseInt(rowStr, 10);
    for (const colStr of Object.keys(rowCells)) {
      const col = parseInt(colStr, 10);
      maxRow = Math.max(maxRow, row);
      maxColumn = Math.max(maxColumn, col);
    }
  }

  if (maxRow < 0 || maxColumn < 0) return "";

  const lines: string[] = [];
  for (let row = 0; row <= maxRow; row++) {
    const values: string[] = [];
    for (let col = 0; col <= maxColumn; col++) {
      const cell = sheet.cells[row]?.[col];
      let value = "";
      if (cell) {
        if (cell.formula !== undefined && cell.result !== undefined) {
          value = formatCsvValue(cell.result);
        } else if (cell.value !== undefined) {
          value = formatCsvValue(cell.value);
        }
      }
      values.push(escapeCsvField(value));
    }
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

function formatCsvValue(value: CellScalarValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
