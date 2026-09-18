import type { Client, FileSessionDescriptor } from "chips-sdk";
import { createBlankPptx } from "@genoffice/pptx-engine";
import { buildBlankDocx } from "@genoffice/docx-engine";
import { createDocument } from "./document-session";
import { formatMessage } from "../lib/messages";

/**
 * 新建文档工厂：四件套新建动作的统一入口。
 *
 * - Word / Slide / PDF：引擎直接产出合法空白字节（buildBlankDocx / createBlankPptx / pdf-lib），
 *   经 file.session.create 立即在工作区落盘，不允许零字节占位。
 * - Sheet：工作簿由 Univer 在 renderer 内存中构建（GenOffice 原生流程），
 *   首次保存时由 sheets-bridge 延迟建立 file.session，因此这里不预创建会话。
 */

export interface CreatedDocument {
  sceneId: "office.scene.word" | "office.scene.slide" | "office.scene.pdf";
  opened: { session: FileSessionDescriptor; bytes: Uint8Array; name: string; path: string };
}

export async function createWordDocument(client: Client, baseName?: string): Promise<CreatedDocument> {
  const bytes = await buildBlankDocx();
  const opened = await createDocument(client, {
    fileName: `${baseName ?? "未命名"}.docx`,
    format: "docx",
    initialBytes: bytes,
  });
  return { sceneId: "office.scene.word", opened };
}

export async function createSlideDocument(client: Client, baseName?: string): Promise<CreatedDocument> {
  const bytes = await createBlankPptx();
  const opened = await createDocument(client, {
    fileName: `${baseName ?? "未命名"}.pptx`,
    format: "pptx",
    initialBytes: bytes,
  });
  return { sceneId: "office.scene.slide", opened };
}

export async function createPdfDocument(client: Client, baseName?: string): Promise<CreatedDocument> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const bytes = new Uint8Array(await pdf.save());
  const opened = await createDocument(client, {
    fileName: `${baseName ?? "未命名"}.pdf`,
    format: "pdf",
    initialBytes: bytes,
  });
  return { sceneId: "office.scene.pdf", opened };
}

/** 打开文件选择对话框，返回选中的路径（取消时为 null）。 */
export async function pickOfficeDocument(
  client: Client,
): Promise<string[] | null> {
  return client.platform.openFile({
    title: formatMessage("office.start.open"),
    mode: "file",
    allowMultiple: false,
    mustExist: true,
    filters: [
      {
        name: "Office 与 PDF 文档",
        extensions: ["docx", "xlsx", "xlsm", "xls", "csv", "pptx", "pdf"],
      },
    ],
  });
}
