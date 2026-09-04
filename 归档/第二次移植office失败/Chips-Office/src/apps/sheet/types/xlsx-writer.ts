/**
 * WorkbookModel → xlsx 字节序列化器。
 *
 * 生成 OOXML 最小合法包（与 xlsx-parser.ts 的解析约定对齐）：
 * - [Content_Types].xml
 * - _rels/.rels
 * - xl/workbook.xml（bookViews/workbookView 的 activeTab 承载活动工作表）
 * - xl/_rels/workbook.xml.rels
 * - xl/worksheets/sheetN.xml（dimension、cols 列宽、行高、sheetData、mergeCells）
 * - xl/sharedStrings.xml（字符串单元格统一入共享字符串表）
 * - xl/styles.xml（基础样式表）
 *
 * 公式单元格写为 `<f>` + 缓存结果 `<v>`，结果类型按真实 xlsx 语义标注
 * t="str"/"b"/"e"，与解析器的公式分支严格互逆。
 */
import JSZip from "jszip";
import type { CellModel, SheetModel, WorkbookModel } from "./workbook-model";
import { formatCellAddress } from "./workbook-model";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types";

const WORKSHEET_REL_TYPE = `${REL_NS}/worksheet`;
const STYLES_REL_TYPE = `${REL_NS}/styles`;
const SHARED_STRINGS_REL_TYPE = `${REL_NS}/sharedStrings`;
const OFFICE_DOCUMENT_REL_TYPE = `${REL_NS}/officeDocument`;

const WORKBOOK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const WORKSHEET_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
const STYLES_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml";
const SHARED_STRINGS_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml";

/** 列宽在模型中以像素近似值存储，xlsx 列宽单位按解析器约定除以 8 还原。 */
const COLUMN_WIDTH_UNIT = 8;

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type SharedStringIntern = (text: string) => number;

interface SharedStringTable {
  intern(text: string): number;
  texts(): string[];
  referenceCount(): number;
}

function createSharedStringTable(): SharedStringTable {
  const indexOfText = new Map<string, number>();
  const texts: string[] = [];
  let referenceCount = 0;
  return {
    intern(text: string): number {
      referenceCount += 1;
      const existing = indexOfText.get(text);
      if (existing !== undefined) return existing;
      const index = texts.length;
      indexOfText.set(text, index);
      texts.push(text);
      return index;
    },
    texts(): string[] {
      return texts;
    },
    referenceCount(): number {
      return referenceCount;
    },
  };
}

function buildCellXml(cell: CellModel, cellRef: string, intern: SharedStringIntern): string {
  const formula = cell.formula !== undefined && cell.formula !== ""
    ? cell.formula.replace(/^=/, "")
    : null;

  if (formula !== null) {
    let typeAttribute = "";
    let valueXml = "";
    if (cell.error !== undefined) {
      typeAttribute = ' t="e"';
      valueXml = `<v>${escapeXmlText(cell.error)}</v>`;
    } else if (typeof cell.result === "boolean") {
      typeAttribute = ' t="b"';
      valueXml = `<v>${cell.result ? "1" : "0"}</v>`;
    } else if (typeof cell.result === "string") {
      typeAttribute = ' t="str"';
      valueXml = `<v>${escapeXmlText(cell.result)}</v>`;
    } else if (typeof cell.result === "number") {
      valueXml = `<v>${cell.result}</v>`;
    }
    return `<c r="${cellRef}"${typeAttribute}><f>${escapeXmlText(formula)}</f>${valueXml}</c>`;
  }

  const value = cell.value;
  if (value === undefined || value === null) {
    return `<c r="${cellRef}"/>`;
  }
  if (typeof value === "string") {
    if (value === "") {
      return `<c r="${cellRef}" t="inlineStr"><is><t/></is></c>`;
    }
    return `<c r="${cellRef}" t="s"><v>${intern(value)}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${cellRef}" t="b"><v>${value ? "1" : "0"}</v></c>`;
  }
  return `<c r="${cellRef}"><v>${value}</v></c>`;
}

function buildWorksheetXml(sheet: SheetModel, intern: SharedStringIntern): string {
  const rowNumberSet = new Set<number>([
    ...Object.keys(sheet.cells).map((rowStr) => parseInt(rowStr, 10)),
    ...Object.keys(sheet.rowHeights).map((rowStr) => parseInt(rowStr, 10)),
  ]);
  const rowNumbers = [...rowNumberSet]
    .filter((row) => Number.isInteger(row))
    .sort((a, b) => a - b);

  const rowXmlParts: string[] = [];
  let maxRow = 0;
  let maxColumn = 0;
  let hasContent = false;

  for (const rowNumber of rowNumbers) {
    const rowCells = sheet.cells[rowNumber] ?? {};
    const columnNumbers = Object.keys(rowCells)
      .map((colStr) => parseInt(colStr, 10))
      .filter((column) => Number.isInteger(column))
      .sort((a, b) => a - b);

    const cellXmlParts: string[] = [];
    for (const columnNumber of columnNumbers) {
      const cell = rowCells[columnNumber];
      if (!cell) continue;
      hasContent = true;
      maxRow = Math.max(maxRow, rowNumber);
      maxColumn = Math.max(maxColumn, columnNumber);
      cellXmlParts.push(buildCellXml(cell, formatCellAddress(columnNumber, rowNumber), intern));
    }

    const rowHeight = sheet.rowHeights[rowNumber];
    const heightAttribute = rowHeight !== undefined
      ? ` ht="${rowHeight}" customHeight="1"`
      : "";
    if (cellXmlParts.length === 0 && !heightAttribute) continue;
    rowXmlParts.push(`<row r="${rowNumber + 1}"${heightAttribute}>${cellXmlParts.join("")}</row>`);
  }

  const dimensionXml = hasContent
    ? `<dimension ref="${formatCellAddress(0, 0)}:${formatCellAddress(maxColumn, maxRow)}"/>`
    : "";

  const columnNumbers = Object.keys(sheet.colWidths)
    .map((colStr) => parseInt(colStr, 10))
    .filter((column) => Number.isInteger(column))
    .sort((a, b) => a - b);
  const colsXml = columnNumbers.length > 0
    ? `<cols>${columnNumbers
        .map((column) => {
          const width = sheet.colWidths[column] / COLUMN_WIDTH_UNIT;
          return `<col min="${column + 1}" max="${column + 1}" width="${width}" customWidth="1"/>`;
        })
        .join("")}</cols>`
    : "";

  const mergesXml = sheet.merges.length > 0
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
        .map((ref) => `<mergeCell ref="${escapeXmlText(ref)}"/>`)
        .join("")}</mergeCells>`
    : "";

  return (
    XML_DECLARATION +
    `<worksheet xmlns="${MAIN_NS}">` +
    dimensionXml +
    colsXml +
    `<sheetData>${rowXmlParts.join("")}</sheetData>` +
    mergesXml +
    "</worksheet>"
  );
}

function buildWorkbookXml(model: WorkbookModel, activeTab: number): string {
  const sheetXml = model.sheets
    .map((sheet, index) => {
      const stateAttribute = sheet.hidden ? ' state="hidden"' : "";
      return `<sheet name="${escapeXmlText(sheet.name)}" sheetId="${index + 1}"${stateAttribute} r:id="rId${index + 1}"/>`;
    })
    .join("");
  return (
    XML_DECLARATION +
    `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">` +
    `<bookViews><workbookView activeTab="${activeTab}"/></bookViews>` +
    `<sheets>${sheetXml}</sheets>` +
    "</workbook>"
  );
}

function buildWorkbookRelsXml(sheetCount: number): string {
  const worksheetRels = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="${WORKSHEET_REL_TYPE}" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  const stylesRel = `<Relationship Id="rId${sheetCount + 1}" Type="${STYLES_REL_TYPE}" Target="styles.xml"/>`;
  const sharedStringsRel = `<Relationship Id="rId${sheetCount + 2}" Type="${SHARED_STRINGS_REL_TYPE}" Target="sharedStrings.xml"/>`;
  return (
    XML_DECLARATION +
    `<Relationships xmlns="${PACKAGE_RELS_NS}">` +
    worksheetRels +
    stylesRel +
    sharedStringsRel +
    "</Relationships>"
  );
}

function buildContentTypesXml(sheetCount: number): string {
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="${WORKSHEET_CONTENT_TYPE}"/>`,
  ).join("");
  return (
    XML_DECLARATION +
    `<Types xmlns="${CONTENT_TYPES_NS}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${WORKBOOK_CONTENT_TYPE}"/>` +
    worksheetOverrides +
    `<Override PartName="/xl/styles.xml" ContentType="${STYLES_CONTENT_TYPE}"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${SHARED_STRINGS_CONTENT_TYPE}"/>` +
    "</Types>"
  );
}

function buildRootRelsXml(): string {
  return (
    XML_DECLARATION +
    `<Relationships xmlns="${PACKAGE_RELS_NS}">` +
    `<Relationship Id="rId1" Type="${OFFICE_DOCUMENT_REL_TYPE}" Target="xl/workbook.xml"/>` +
    "</Relationships>"
  );
}

function buildSharedStringsXml(table: SharedStringTable): string {
  const items = table
    .texts()
    .map((text) => `<si><t xml:space="preserve">${escapeXmlText(text)}</t></si>`)
    .join("");
  return (
    XML_DECLARATION +
    `<sst xmlns="${MAIN_NS}" count="${table.referenceCount()}" uniqueCount="${table.texts().length}">` +
    items +
    "</sst>"
  );
}

function buildStylesXml(): string {
  return (
    XML_DECLARATION +
    `<styleSheet xmlns="${MAIN_NS}">` +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

/**
 * 将工作簿模型序列化为 xlsx 字节流。
 *
 * 活动工作表下标按工作表数量钳制，保证写出的 `@_activeTab` 恒合法。
 */
export async function writeXlsx(model: WorkbookModel): Promise<Uint8Array> {
  if (!model || model.sheets.length === 0) {
    throw new Error("无法生成 xlsx 文件：工作簿中没有工作表");
  }

  const activeTab = Math.max(0, Math.min(model.activeSheetIndex, model.sheets.length - 1));
  const table = createSharedStringTable();

  const worksheetXmlParts = model.sheets.map((sheet) => buildWorksheetXml(sheet, table.intern));

  const zip = new JSZip();
  zip.file("[Content_Types].xml", buildContentTypesXml(model.sheets.length));
  zip.file("_rels/.rels", buildRootRelsXml());
  zip.file("xl/workbook.xml", buildWorkbookXml(model, activeTab));
  zip.file("xl/_rels/workbook.xml.rels", buildWorkbookRelsXml(model.sheets.length));
  zip.file("xl/styles.xml", buildStylesXml());
  zip.file("xl/sharedStrings.xml", buildSharedStringsXml(table));
  worksheetXmlParts.forEach((worksheetXml, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, worksheetXml);
  });

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
