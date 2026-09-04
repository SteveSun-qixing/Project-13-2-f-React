import { describe, expect, it } from "vitest";
import {
  decodeCsvBuffer,
  isNumericCell,
  parseCsv,
  sniffDelimiter,
} from "../../src/sheet/csv-import";
import { csvFromValueRows } from "../../src/sheet/workbook-io";

/** “中文表格,数量”的 GB18030（与 GB2312 双字节段兼容）字节序列 */
const GB18030_SAMPLE_BYTES = new Uint8Array([
  0xd6, 0xd0, 0xce, 0xc4, 0xb1, 0xed, 0xb8, 0xf1, 0x2c, 0xca, 0xfd, 0xc1, 0xbf, 0x0d, 0x0a, 0x41,
  0x2c, 0x31,
]);

describe("CSV 编码嗅探", () => {
  it("识别 UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("名,值\n1,2")]);
    expect(decodeCsvBuffer(bytes)).toBe("名,值\n1,2");
  });

  it("严格 UTF-8 直接解码", () => {
    const bytes = new TextEncoder().encode("名称,数量\n笔记本,3");
    expect(decodeCsvBuffer(bytes)).toBe("名称,数量\n笔记本,3");
  });

  it("GBK/GB18030 中文样本按遗留字符集解码", () => {
    const text = decodeCsvBuffer(GB18030_SAMPLE_BYTES);
    expect(text).toBe("中文表格,数量\r\nA,1");
  });

  it("UTF-16LE BOM 解码", () => {
    const text = "名,值";
    const bytes = new Uint8Array(2 + text.length * 2);
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      bytes[2 + index * 2] = code & 0xff;
      bytes[3 + index * 2] = code >> 8;
    }
    expect(decodeCsvBuffer(bytes)).toBe("名,值");
  });
});

describe("CSV 分隔符嗅探与解析", () => {
  it("按引号外出现次数选择分隔符", () => {
    expect(sniffDelimiter("a,b\n1,2")).toBe(",");
    expect(sniffDelimiter("a;b\n1;2")).toBe(";");
    expect(sniffDelimiter("a\tb\n1\t2")).toBe("\t");
  });

  it("解析引号、转义引号与跨行字段", () => {
    const rows = parseCsv('a,"b,1"\r\n"he said ""hi""","第\n二行"\r\n');
    expect(rows).toEqual([
      ["a", "b,1"],
      ['he said "hi"', "第\n二行"],
    ]);
  });

  it("丢弃末尾空行，保留中间空行", () => {
    expect(parseCsv("a,b\r\n\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });

  it("分号分隔的中文样本同样解析正确", () => {
    const text = decodeCsvBuffer(GB18030_SAMPLE_BYTES).replace(/,/g, ";");
    const rows = parseCsv(text);
    expect(rows[0]).toEqual(["中文表格", "数量"]);
    expect(rows[1]).toEqual(["A", "1"]);
  });
});

describe("CSV 数值判定与导出", () => {
  it("纯数字转数值，前导零保持文本", () => {
    expect(isNumericCell("42")).toBe(true);
    expect(isNumericCell("-3.14")).toBe(true);
    expect(isNumericCell("1e3")).toBe(true);
    expect(isNumericCell("007")).toBe(false);
    expect(isNumericCell("12a")).toBe(false);
    expect(isNumericCell("")).toBe(false);
  });

  it("导出行矩阵时逗号与引号字段正确转义", () => {
    const csv = csvFromValueRows([
      ["名称", "备注"],
      ["笔,记", '引号"文本'],
    ]);
    expect(csv).toBe('名称,备注\r\n"笔,记","引号""文本"\r\n');
  });
});
