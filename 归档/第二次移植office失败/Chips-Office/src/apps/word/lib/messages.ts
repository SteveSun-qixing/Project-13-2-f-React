const MESSAGES: Record<string, string> = {
  // Word 编辑器
  "word.editor.title": "Word 编辑器",
  "word.editor.loading": "正在加载文档",
  "word.editor.saving": "正在保存文档",
  "word.editor.saved": "文档已保存",
  "word.editor.unsaved": "未保存的更改",
  "word.editor.error": "文档处理出错",
  "word.editor.empty": "文档为空",

  // 工具栏
  "word.toolbar.bold": "加粗",
  "word.toolbar.italic": "斜体",
  "word.toolbar.underline": "下划线",
  "word.toolbar.strikethrough": "删除线",
  "word.toolbar.font": "字体",
  "word.toolbar.fontSize": "字号",
  "word.toolbar.textColor": "文字颜色",
  "word.toolbar.highlight": "背景颜色",
  "word.toolbar.alignLeft": "左对齐",
  "word.toolbar.alignCenter": "居中对齐",
  "word.toolbar.alignRight": "右对齐",
  "word.toolbar.alignJustify": "两端对齐",
  "word.toolbar.orderedList": "编号列表",
  "word.toolbar.unorderedList": "项目符号列表",
  "word.toolbar.decreaseIndent": "减少缩进",
  "word.toolbar.increaseIndent": "增加缩进",
  "word.toolbar.heading1": "标题 1",
  "word.toolbar.heading2": "标题 2",
  "word.toolbar.heading3": "标题 3",
  "word.toolbar.paragraph": "正文",
  "word.toolbar.insertImage": "插入图片",
  "word.toolbar.insertTable": "插入表格",
  "word.toolbar.insertComment": "插入批注",
  "word.toolbar.undo": "撤销",
  "word.toolbar.redo": "重做",

  // 状态栏
  "word.statusBar.page": "第 {current} 页，共 {total} 页",
  "word.statusBar.words": "{count} 字",
  "word.statusBar.zoom": "缩放 {percent}%",
  "word.statusBar.readOnly": "只读模式",
  "word.statusBar.editMode": "编辑模式",

  // 批注面板
  "word.comment.title": "批注",
  "word.comment.add": "添加批注",
  "word.comment.reply": "回复",
  "word.comment.delete": "删除",
  "word.comment.resolve": "标记为已解决",
  "word.comment.placeholder": "输入批注内容...",
  "word.comment.empty": "暂无批注",

  // 表格编辑器
  "word.table.insertRow": "插入行",
  "word.table.insertColumn": "插入列",
  "word.table.deleteRow": "删除行",
  "word.table.deleteColumn": "删除列",
  "word.table.mergeCells": "合并单元格",
  "word.table.splitCells": "拆分单元格",

  // 图片插入
  "word.image.title": "插入图片",
  "word.image.selectFile": "选择文件",
  "word.image.dragHint": "或拖放图片到此处",
  "word.image.unsupported": "不支持的图片格式",

  // 对话框
  "word.dialog.confirm": "确认",
  "word.dialog.cancel": "取消",
  "word.dialog.save": "保存",
  "word.dialog.dontSave": "不保存",
  "word.dialog.unsavedChanges": "有未保存的更改，是否保存？",

  // 资源打开
  "word.open.fileNotFound": "文件不存在",
  "word.open.parseError": "文档解析失败",
  "word.open.unsupportedFormat": "不支持的文档格式",

  // 表格尺寸选择
  "word.table.size": "表格尺寸",
  "word.table.rows": "行数",
  "word.table.columns": "列数",
  "word.table.insert": "插入表格",
};

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
