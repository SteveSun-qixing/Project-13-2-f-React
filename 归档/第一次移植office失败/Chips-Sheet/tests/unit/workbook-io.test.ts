import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { exportSheetCsv, openWorkbookBytes, saveWorkbookBytes } from "../../src/sheet/workbook-io";
import type { WorkbookModel } from "../../src/sheet/workbook-model";

function toBytes(output: unknown): Uint8Array {
  if (output instanceof Uint8Array) {
    return output;
  }
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }
  const view = output as ArrayBufferView;
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

/** 测试内现场构建一个含公式 / 数字格式 / 样式 / 合并 / 冻结 / 多 sheet 的 xlsx */
async function buildSampleXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.views = [
    { x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: "visible" },
  ];

  const data = workbook.addWorksheet("数据");
  const a1 = data.getCell("A1");
  a1.value = 100;
  a1.font = { bold: true };
  data.getCell("B1").value = 200;
  const c1 = data.getCell("C1");
  c1.value = { formula: "SUM(A1:B1)", result: 300 };
  const d1 = data.getCell("D1");
  d1.value = 0.25;
  d1.numFmt = "0.00%";
  data.mergeCells("A3:B3");
  data.getCell("A3").value = "合并区域";
  data.getCell("A3").alignment = { horizontal: "center" };
  data.getCell("A5").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE699" },
  };
  data.getCell("A6").border = {
    top: { style: "thin", color: { argb: "FF0A84FF" } },
  };
  data.getColumn(1).width = 15;
  data.getRow(2).height = 24;
  data.views = [{ state: "frozen", xSplit: 1, ySplit: 2, topLeftCell: "C3" }];

  workbook.addWorksheet("汇总", { state: "hidden" });
  const summary = workbook.addWorksheet("指标");
  summary.getCell("A1").value = { formula: "数据!C1*2", result: 600 };

  const buffer = await workbook.xlsx.writeBuffer();
  return toBytes(buffer);
}

describe("工作簿 IO：xlsx 打开", () => {
  it("解析单元格值、公式、数字格式、样式、合并、行列尺寸、冻结与多 sheet", async () => {
    const bytes = await buildSampleXlsx();
    const model = await openWorkbookBytes(bytes, "样例.xlsx");

    expect(model.fileName).toBe("样例.xlsx");
    expect(model.sheets.map((sheet) => sheet.name)).toEqual(["数据", "汇总", "指标"]);
    expect(model.activeSheetIndex).toBe(1);

    const data = model.sheets[0];
    expect(data?.cells[0]?.[0]?.value).toBe(100);
    expect(data?.cells[0]?.[0]?.style?.bold).toBe(true);
    expect(data?.cells[0]?.[1]?.value).toBe(200);
    expect(data?.cells[0]?.[2]?.formula).toBe("SUM(A1:B1)");
    expect(data?.cells[0]?.[2]?.result).toBe(300);
    expect(data?.cells[0]?.[3]?.numFmt).toBe("0.00%");
    expect(data?.cells[2]?.[0]?.value).toBe("合并区域");
    expect(data?.cells[2]?.[0]?.style?.horizontal).toBe("center");
    expect(data?.merges).toContain("A3:B3");
    expect(data?.cells[4]?.[0]?.style?.fillColor).toBe("#FFE699");
    expect(data?.cells[5]?.[0]?.style?.borders?.top?.style).toBe("thin");
    expect(data?.cells[5]?.[0]?.style?.borders?.top?.color).toBe("#0A84FF");
    expect(data?.freeze).toEqual({ xSplit: 1, ySplit: 2 });
    expect(data?.colWidths[0]).toBeGreaterThan(90);
    expect(data?.rowHeights[1]).toBe(32);
    expect(data?.hidden).toBe(false);

    expect(model.sheets[1]?.hidden).toBe(true);
    expect(model.sheets[2]?.cells[0]?.[0]?.formula).toBe("数据!C1*2");
  });

  it("CSV 字节解码并合成单 sheet 值模型", async () => {
    const csvText = "名称,数量\n笔记本,3";
    const bytes = new TextEncoder().encode(csvText);
    const model = await openWorkbookBytes(bytes, "清单.csv");
    expect(model.sheets).toHaveLength(1);
    expect(model.sheets[0]?.cells[0]?.[0]?.value).toBe("名称");
    expect(model.sheets[0]?.cells[1]?.[1]?.value).toBe(3);
  });

  it("不支持的扩展名抛出明确错误", async () => {
    await expect(openWorkbookBytes(new Uint8Array([1, 2, 3]), "文档.pdf")).rejects.toThrow(
      /不支持的表格文件格式/,
    );
  });
});

describe("工作簿 IO：保存与往返一致", () => {
  it("保存后再解析：值、公式字符串、合并区域、样式与结构保持一致", async () => {
    const bytes = await buildSampleXlsx();
    const opened = await openWorkbookBytes(bytes, "样例.xlsx");
    const savedBytes = await saveWorkbookBytes(opened, "xlsx");
    expect(savedBytes.byteLength).toBeGreaterThan(0);

    const reopened = await openWorkbookBytes(savedBytes, "样例.xlsx");
    expect(reopened.sheets.map((sheet) => sheet.name)).toEqual(["数据", "汇总", "指标"]);

    const data = reopened.sheets[0];
    expect(data?.cells[0]?.[0]?.value).toBe(100);
    expect(data?.cells[0]?.[0]?.style?.bold).toBe(true);
    expect(data?.cells[0]?.[1]?.value).toBe(200);
    expect(data?.cells[0]?.[2]?.formula).toBe("SUM(A1:B1)");
    expect(data?.cells[0]?.[2]?.result).toBe(300);
    expect(data?.cells[0]?.[3]?.numFmt).toBe("0.00%");
    expect(data?.merges).toContain("A3:B3");
    expect(data?.cells[2]?.[0]?.style?.horizontal).toBe("center");
    expect(data?.cells[4]?.[0]?.style?.fillColor).toBe("#FFE699");
    expect(data?.freeze).toEqual({ xSplit: 1, ySplit: 2 });
    // 列宽经历 chars ↔ px 两轮换算，允许 MDW 取整误差
    expect(Math.abs((data?.colWidths[0] ?? 0) - (opened.sheets[0]?.colWidths[0] ?? 0))).toBeLessThan(
      10,
    );
    expect(data?.rowHeights[1]).toBe(32);

    expect(reopened.sheets[1]?.hidden).toBe(true);
    expect(reopened.sheets[2]?.cells[0]?.[0]?.formula).toBe("数据!C1*2");
    expect(reopened.sheets[2]?.cells[0]?.[0]?.result).toBe(600);
  });

  it("新建空白工作簿模型可以写出合法 xlsx 并再次打开", async () => {
    const { createEmptyWorkbookModel } = await import("../../src/sheet/workbook-model");
    const model: WorkbookModel = createEmptyWorkbookModel("新建.xlsx");
    model.sheets[0]!.cells[0] = { 0: { value: "薯片表格" } };

    const bytes = await saveWorkbookBytes(model, "xlsx");
    const reopened = await openWorkbookBytes(bytes, "新建.xlsx");
    expect(reopened.sheets[0]?.name).toBe("工作表1");
    expect(reopened.sheets[0]?.cells[0]?.[0]?.value).toBe("薯片表格");
  });

  it("xlsm 格式按宏工作簿写出并可再次打开", async () => {
    const { createEmptyWorkbookModel } = await import("../../src/sheet/workbook-model");
    const bytes = await saveWorkbookBytes(createEmptyWorkbookModel("宏.xlsx"), "xlsm");
    const reopened = await openWorkbookBytes(bytes, "宏.xlsm");
    expect(reopened.sheets[0]?.name).toBe("工作表1");
  });
});

describe("工作簿 IO：CSV 导出", () => {
  it("活动工作表按公式缓存结果导出，UTF-8 带 BOM，逗号与引号正确转义", async () => {
    const bytes = await buildSampleXlsx();
    const model = await openWorkbookBytes(bytes, "样例.xlsx");
    const csv = exportSheetCsv(model, 0);

    expect(csv[0]).toBe(0xef);
    expect(csv[1]).toBe(0xbb);
    expect(csv[2]).toBe(0xbf);
    const text = new TextDecoder("utf-8").decode(csv.subarray(3));
    const lines = text.split("\r\n").filter((line) => line.length > 0);
    expect(lines[0]).toBe("100,200,300,25.00%");
    expect(lines[2]).toBe("合并区域,,,");
  });

  it("公式无缓存结果时导出为空字符串", () => {
    const model: WorkbookModel = {
      fileName: "t.xlsx",
      activeSheetIndex: 0,
      sheets: [
        {
          name: "工作表1",
          hidden: false,
          rowCount: 10,
          columnCount: 5,
          cells: {
            0: {
              0: { formula: "A2", result: null },
              1: { value: "文本" },
            },
          },
          merges: [],
          colWidths: {},
          rowHeights: {},
        },
      ],
    };
    const csv = exportSheetCsv(model, 0);
    const text = new TextDecoder("utf-8").decode(csv.subarray(3));
    expect(text.startsWith(",文本\r\n")).toBe(true);
  });
});
