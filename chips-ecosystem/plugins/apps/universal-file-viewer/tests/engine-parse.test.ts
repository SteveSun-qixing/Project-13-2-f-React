// @vitest-environment node
/**
 * 引擎字节读取面契约在 Node 环境验证（引擎臂交付口径）：postal-mime 等引擎依赖在
 * Node 与浏览器分派不同解码路径，jsdom 仿真的浏览器面不构成有效运行环境。
 */
import JSZip from "jszip";
import PostalMime from "postal-mime";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseLrc } from "../src/engine/plugins/lrc";
import { getInitialZoom } from "../src/engine/plugins/utils";
import { formatPreviewMessage, resolveMessages } from "../src/engine/messages";

describe("LRC 歌词解析（真实歌词文本）", () => {
  const LRC_SAMPLE = [
    "[ti:测试歌曲]",
    "[ar:薯片乐团]",
    "[offset:+500]",
    "[00:01.00]第一句歌词",
    "[00:03.50][00:07.00]重复段歌词",
    "[00:05.00]<00:05.00>逐<00:05.40>字<00:05.80>歌",
    ""
  ].join("\n");

  it("解析元数据标签", () => {
    const parsed = parseLrc(LRC_SAMPLE);
    const keys = parsed.metadata.map((entry) => entry.key);
    expect(keys).toContain("ti");
    expect(keys).toContain("ar");
    expect(keys).toContain("offset");
    const title = parsed.metadata.find((entry) => entry.key === "ti");
    expect(title?.value).toBe("测试歌曲");
  });

  it("解析歌词行与多时间戳", () => {
    const parsed = parseLrc(LRC_SAMPLE);
    expect(parsed.lyrics.length).toBe(3);
    expect(parsed.lyrics[0]?.timestamps).toEqual(["00:01.00"]);
    expect(parsed.lyrics[0]?.text).toBe("第一句歌词");
    const repeated = parsed.lyrics[1];
    expect(repeated?.timestamps).toEqual(["00:03.50", "00:07.00"]);
    expect(repeated?.text).toBe("重复段歌词");
  });

  it("解析逐字时间轴词级序列", () => {
    const parsed = parseLrc(LRC_SAMPLE);
    const enhanced = parsed.lyrics[2];
    expect(enhanced?.words.map((word) => word.text)).toEqual(["逐", "字", "歌"]);
    expect(enhanced?.words[0]?.timestamp).toBe("00:05.00");
    expect(enhanced?.words[2]?.timestamp).toBe("00:05.80");
  });

  it("空内容产生空解析结果", () => {
    const parsed = parseLrc("");
    expect(parsed.metadata).toEqual([]);
    expect(parsed.lyrics).toEqual([]);
  });
});

describe("ZIP 容器：引擎读取面契约（真实 zip 字节）", () => {
  it("真实 zip 条目可按引擎消费方式枚举与读取", async () => {
    const zip = new JSZip();
    zip.file("目录/说明.txt", "压缩包内的文本");
    zip.file("数据.json", JSON.stringify({ ok: true }));
    zip.folder("空目录");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    // ZIP 本地文件头签名（PK\x03\x04）必须真实存在于产物中
    expect(new Uint8Array(buffer)[0]).toBe(0x50);
    expect(new Uint8Array(buffer)[1]).toBe(0x4b);

    const loaded = await JSZip.loadAsync(buffer);
    const entries = Object.values(loaded.files);
    const fileEntries = entries.filter((entry) => !entry.dir);
    expect(fileEntries.map((entry) => entry.name).sort()).toEqual(["数据.json", "目录/说明.txt"]);
    expect(entries.some((entry) => entry.dir && entry.name === "空目录/")).toBe(true);

    const readme = loaded.file("目录/说明.txt");
    expect(readme).toBeDefined();
    const decoded = new TextDecoder().decode(await readme?.async("arraybuffer"));
    expect(decoded).toBe("压缩包内的文本");
  });
});

describe("邮件 MIME：引擎读取面契约（真实 eml 字节）", () => {
  const EML = [
    "From: =?utf-8?B?5pS25Lu25Lq6?= <from@example.com>",
    "To: to@example.com",
    "Subject: =?utf-8?B?5Li76aKY6aqM6K+B?=",
    "Date: Wed, 1 Oct 2026 08:00:00 +0800",
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=\"BOUNDARY\"",
    "",
    "--BOUNDARY",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<p>你好，<b>邮件正文</b>。</p>",
    "--BOUNDARY",
    "Content-Type: application/octet-stream; name=\"附件.bin\"",
    "Content-Disposition: attachment; filename=\"附件.bin\"",
    "Content-Transfer-Encoding: base64",
    "",
    "ZGF0YQ==",
    "--BOUNDARY--",
    ""
  ].join("\r\n");

  it("真实 eml 解析出引擎渲染所需的头部、正文与附件字节", async () => {
    const parsed = await PostalMime.parse(EML);
    expect(parsed.subject).toBe("主题验证");
    expect(parsed.html).toContain("邮件正文");
    expect(parsed.attachments.length).toBe(1);
    const attachment = parsed.attachments[0];
    expect(attachment?.filename).toBe("附件.bin");
    const content = attachment?.content;
    // Node 环境下 postal-mime 附件内容为 ArrayBuffer（引擎侧统一经 new Uint8Array(...) 归一）
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content as ArrayBuffer);
    expect(new TextDecoder().decode(bytes)).toBe("data");
  });
});

describe("表格工作簿：引擎读取面契约（真实 xlsx 字节）", () => {
  it("生成最小合法 xlsx 并读出引擎消费的单元格字段", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["项目", "数量"],
      ["薯片", 13]
    ]);
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    XLSX.utils.book_append_sheet(workbook, sheet, "清单");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");

    const restored = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheetNames = restored.SheetNames;
    expect(sheetNames).toEqual(["清单"]);
    type SheetCell = { v?: unknown; w?: unknown };
    const restoredSheet = restored.Sheets["清单"] as
      | (Record<string, unknown> & { A1?: SheetCell; B2?: SheetCell; "!merges"?: unknown; "!ref"?: unknown })
      | undefined;
    expect(restoredSheet).toBeDefined();
    const cellA1 = restoredSheet?.A1;
    const cellB2 = restoredSheet?.B2;
    expect(cellA1?.v).toBe("项目");
    expect(cellB2?.v).toBe(13);
    expect(typeof cellB2?.w).toBe("string");
    expect(Array.isArray(restoredSheet?.["!merges"])).toBe(true);
    expect(typeof restoredSheet?.["!ref"]).toBe("string");
  });
});

describe("引擎文案与缩放参数", () => {
  it("resolveMessages 以简体中文直写为底并支持覆盖", () => {
    const messages = resolveMessages({ messages: { loading: "自定义加载文案" } });
    expect(messages.loading).toBe("自定义加载文案");
    expect(messages.unsupportedTitle).toBe("当前文件暂不支持在线预览");
    expect(messages.downloadFile).toBe("下载文件");
  });

  it("formatPreviewMessage 渲染占位", () => {
    expect(formatPreviewMessage("页面 {page} 加载中...", { page: 3 })).toBe("页面 3 加载中...");
    expect(formatPreviewMessage("{count} 行", { count: 128 })).toBe("128 行");
    expect(formatPreviewMessage("{unknown}", {})).toBe("{unknown}");
  });

  it("getInitialZoom 钳制到合法区间", () => {
    expect(getInitialZoom({ options: { zoom: 1 } })).toBe(1);
    expect(getInitialZoom({ options: { zoom: 0 } })).toBe(0.1);
    expect(getInitialZoom({ options: { zoom: 100 } })).toBe(8);
    expect(getInitialZoom({ options: { zoom: 2 } }, 0.25, 4)).toBe(2);
  });
});
