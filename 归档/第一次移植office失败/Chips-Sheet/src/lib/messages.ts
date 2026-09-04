const MESSAGES: Record<string, string> = {
  "app.identity.displayName": "表格编辑器",
  "app.shell.loading": "正在加载表格",
  "app.shell.errorTitle": "表格编辑器运行异常",
  "app.shell.errorDescription": "运行时边界捕获到异常。",
  "app.shell.retry": "重试",

  "start.title": "表格编辑器",
  "start.description": "打开并编辑 Excel（.xlsx / .xlsm）与 CSV 表格文件，支持公式、样式、合并单元格与冻结窗格。",
  "start.formats": "支持格式：.xlsx / .xlsm / .csv",
  "start.actions.open": "打开表格文件",
  "start.actions.create": "新建工作簿",
  "start.hints.shortcut": "快捷键 Mod+O 打开文件，Mod+N 新建空白工作簿",
  "start.hints.dropToOpen": "松开鼠标即可打开表格文件",
  "start.ariaLabel": "表格编辑器起始页",

  "stage.actions.save": "保存",
  "stage.actions.saveAs": "另存为",
  "stage.actions.new": "新建",
  "stage.actions.exportCsv": "导出 CSV",
  "stage.status.saved": "已保存",
  "stage.status.unsaved": "未保存",
  "stage.status.loading": "正在解析表格文件",
  "stage.errorTitle": "表格打开失败",
  "stage.errorRetry": "重试",
  "stage.errorBack": "返回起始页",
  "stage.engineLoading": "正在启动表格引擎",
  "stage.ariaLabel": "表格编辑工作区",
  "stage.untitled": "未命名工作簿",

  "message.openFailed": "打开表格文件失败：{reason}",
  "message.saveFailed": "保存表格文件失败：{reason}",
  "message.saveSuccess": "已保存到 {path}",
  "message.saveAsCanceled": "已取消另存为",
  "message.saveNoWorkbook": "当前没有可保存的工作簿",
  "message.exportSuccess": "已导出活动工作表到 {path}",
  "message.exportCanceled": "已取消导出 CSV",
  "message.exportFailed": "导出 CSV 失败：{reason}",
  "message.newCreated": "已新建空白工作簿",
  "message.unsupportedFile": "不支持的表格格式，请选择 .xlsx / .xlsm / .csv 文件",
  "message.dropMissingPath": "无法获取拖入文件的本地路径，请改用“打开表格文件”按钮",
  "message.downloadStarted": "已开始下载 {name}",
  "message.engineBootFailed": "表格引擎启动失败：{reason}",
  "message.applySnapshotFailed": "工作簿内容加载失败：{reason}",

  "command.menu.file": "文件",
  "command.file.open.title": "打开表格文件",
  "command.file.open.description": "从本地选择 .xlsx / .xlsm / .csv 文件",
  "command.file.save.title": "保存",
  "command.file.save.description": "把当前工作簿保存回原文件",
  "command.file.saveAs.title": "另存为",
  "command.file.saveAs.description": "把当前工作簿保存为新文件",
  "command.file.new.title": "新建空白工作簿",
  "command.file.new.description": "创建一个空白表格并开始编辑",
  "command.file.exportCsv.title": "导出活动工作表为 CSV",
  "command.file.exportCsv.description": "以值形式导出当前活动工作表（UTF-8 带 BOM）",

  "dialog.openFileTitle": "打开表格文件",
  "dialog.saveFileTitle": "保存表格文件",
  "dialog.exportCsvTitle": "导出活动工作表为 CSV",

  "error.unsupportedDetail": "仅支持 .xlsx、.xlsm 与 .csv 文件",
};

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
