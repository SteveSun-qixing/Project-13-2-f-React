import type { PreviewMessages, PreviewOptions } from "./types";

/**
 * 引擎界面文案：简体中文直写（R5；task030 后无 locale 键层与双语包，旧 en-US 包不迁移）。
 *
 * 插件经 `ctx.options.messages` 消费；调用方可用 `PreviewOptions.messages` 覆盖个别条目。
 */
export const engineMessages: PreviewMessages = {
  loading: "正在加载预览...",
  unsupportedTitle: "当前文件暂不支持在线预览",
  downloadTitle: "当前文件可下载后查看",
  downloadFile: "下载文件",
  file: "文件",
  unnamedFile: "未命名文件",
  format: "格式",
  unknown: "未知",
  mime: "MIME",
  undeclared: "未声明",
  size: "大小",
  source: "来源",
  remoteUrl: "远程 URL",
  localFile: "本地/内存文件",
  textPlainLanguage: "纯文本",
  textLineCount: "{count} 行",
  textWrap: "换行",
  textCopy: "复制",
  textCopied: "已复制",
  textCopyFailed: "复制失败",
  textDownload: "下载",
  textDownloadReady: "下载已准备",
  textLargeFileNotice: "文件较大，当前展示前 {size}，复制和下载仍会使用完整内容。",
  textHighlightSkipped: "内容较大，已跳过语法高亮以保持滚动流畅。",
  textPreviewFailedTitle: "文本预览失败",
  textPreviewFailedMessage: "无法读取该文本内容，可能是远程文件不可访问或响应状态异常。",
  textOpenOriginal: "打开原文件",
  lrcPreviewMode: "LRC 预览模式",
  lrcDisplayMode: "展示模式",
  lrcAnnotatedMode: "美观模式",
  lrcSourceMode: "源码模式",
  lrcWordTimestamp: "逐字时间",
  lrcMale: "男声",
  lrcFemale: "女声",
  lrcDuet: "合唱",
  lrcAuthor: "词曲",
  lrcLyricist: "作词",
  lrcLrcBy: "歌词制作",
  lrcAlbum: "专辑",
  lrcLength: "时长",
  lrcOffset: "时间偏移",
  lrcTool: "制作工具",
  lrcVersion: "版本",
  lrcTrackInformation: "音乐作品信息",
  lrcEmpty: "没有可展示的歌词内容。",
  officeLegacyConversionTitle: "Office 转换提示",
  officeLegacyBinaryNotice:
    "属于旧版 Microsoft Office 二进制格式，浏览器内无法高保真解析；当前仅展示可信文本片段和结构指纹，完整排版建议接入 LibreOffice/OnlyOffice 服务端转换为 PDF/HTML。",
  officeLegacyMetaFormatType: "格式类型",
  officeLegacyMetaFileStructure: "文件结构",
  officeLegacyOleDetected: "检测到 OLE Compound File 签名",
  officeLegacyOleMissing: "未检测到标准 OLE 签名，按原始二进制尝试提取",
  officeLegacyMetaTextFragments: "文本片段",
  officeLegacyTextFragmentCount: "{count} 段",
  officeLegacyMetaParseStatus: "解析状态",
  officeLegacyReadableFragments: "可读文本片段",
  officeLegacyNoText: "未提取到稳定可读文本。该文件可能经过压缩、加密，或文本编码无法在浏览器端可靠识别；请使用服务端 LibreOffice/OnlyOffice 转换后预览。",
  officeLegacyWordParseFailed: "Word 二进制解析失败：{message}",
  officeSheetParseFailed: "表格解析失败：{message}",
  officeUnsupportedTitle: "Office 基础预览",
  officeUnsupportedLegacyMessage:
    "该格式属于老二进制或专有格式，浏览器内无法可靠解析；建议接入 LibreOffice/OnlyOffice 服务端转换为 PDF/HTML 后预览。",
  officeUnsupportedGenericMessage: "该格式通常需要服务端转换或专用解析器才能高保真预览。",
  officeUnsupportedIntro: "已进入 Office 插件。{message}",
  officeUnsupportedSupportedFormats:
    "当前版本优先支持 docx、rtf、odt/fodt、xlsx/xls/csv/ods、pptx/ppsx、odp/fodp 的基础内容预览。",
  officeErrorWithMessage: "解析器返回：{message}",
  officeErrorWithoutMessage: "解析器未返回具体错误信息。",
  officeConvertedTitle: "Office 高保真转换预览",
  officeConvertedPdfFailed: "Office 转换后的 PDF 无法预览",
  pdfEncryptedTitle: "PDF 已加密，无法在线预览",
  pdfEncryptedMessage: "请下载后使用密码打开，或上传解密后的 PDF 文件。",
  pdfPreviewFailedTitle: "PDF 预览失败",
  pdfCorruptedMessage: "该 PDF 文件可能已损坏或格式无效。",
  pdfCannotLoadMessage: "当前浏览器无法加载该 PDF。",
  pdfDownload: "下载 PDF",
  pdfPageLoading: "页面 {page} 加载中...",
  pdfPageEmpty: "该页没有检测到可显示的 PDF 兼容内容。若这是 Illustrator/AI 文件，可能只包含私有编辑数据，建议导出为 PDF/SVG/PNG 后预览。",
  pdfPageRenderFailed: "无法渲染该页面。该页可能包含浏览器 PDF 引擎暂不支持的图形、字体或压缩特性。",
  pdfPreviousPage: "上一页",
  pdfNextPage: "下一页",
  pdfPageInput: "当前页码",
  pdfPagePosition: "/ {total}",
  pdfPageLabel: "第 {page} 页",
  pdfSummaryPages: "页数",
  pdfSummaryPageSizes: "页面尺寸",
  pdfSummaryFit: "适配",
  pdfSummaryActualSize: "原始大小",
  pdfSummaryFitWidth: "适合宽度",
  pdfSummaryZoom: "缩放",
  imagePreviewFailedTitle: "图片预览失败",
  imagePreviewFailedMessage: "当前浏览器无法直接显示该图片，文件可能已损坏或编码暂不受支持。",
  imageDownload: "下载图片",
  imageZoomOut: "缩小",
  imageZoomIn: "放大",
  imageRotate: "旋转图片",
  imageReset: "重置图片视图"
};

/** 以引擎直写文案为底、合并调用方覆盖项，得到插件消费的最终文案表。 */
export function resolveMessages(options: Pick<PreviewOptions, "messages">): PreviewMessages {
  return {
    ...engineMessages,
    ...options.messages
  };
}

/** 把 `{key}` 占位模板渲染为最终字符串；未知占位保持原样。 */
export function formatPreviewMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
