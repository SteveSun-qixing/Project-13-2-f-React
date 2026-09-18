const MESSAGES: Record<string, string> = {
  "app.identity.displayName": "薯片办公",
  "office.cli.open.title": "打开办公文档",
  "office.cli.open.description": "在薯片办公中打开 Word / Excel / PowerPoint / PDF 文档",
  "office.start.title": "薯片办公",
  "office.start.description": "查看与编辑 Office 文档和 PDF",
  "office.start.formats": "支持 .docx / .xlsx / .xls / .csv / .pptx / .pdf",
  "office.start.open": "打开文档",
  "office.start.openShortcut": "拖入文件或点击打开",
  "office.start.dragActive": "松开即可打开文档",
  "office.start.createWord": "新建 Word 文档",
  "office.start.createSheet": "新建表格工作簿",
  "office.start.createSlide": "新建演示文稿",
  "office.start.error": "打开文档失败",
  "office.start.invalidType": "暂不支持该文件类型，请使用万能文件查看器打开",
  "office.open.failed": "文档打开失败",
  "office.open.fileDialogFailed": "文件选择对话框不可用",
  "office.save.failed": "文档保存失败",
  "office.save.saveAsCanceled": "已取消另存为",
  "office.cli.targetMissing": "命令缺少要打开的文档路径",
};

export type MessageKey = keyof typeof MESSAGES;

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key];
  if (template === undefined) {
    return key;
  }
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
