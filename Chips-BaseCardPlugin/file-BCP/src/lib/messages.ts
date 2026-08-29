const MESSAGES: Record<string, string> = {
  "file.view.empty": "上传文件后，这里会显示文件基础卡片。",
  "file.view.unnamed": "未命名文件",
  "file.view.no_extension": "未识别后缀",
  "file.view.open": "打开《{title}》",
  "file.view.openExtension": "打开 {extension} 文件",
  "file.editor.badge.required": "必填",
  "file.editor.status.file": "正在导入文件…",
  "file.editor.resources.title": "文件资源",
  "file.editor.file.title": "文件",
  "file.editor.file.upload": "上传文件",
  "file.editor.file.upload_note": "点击选择或拖放任意文件到此处",
  "file.editor.file.recognized": "已自动识别文件信息",
  "file.editor.fields.file_name": "文件名",
  "file.editor.fields.file_extension": "文件后缀",
  "file.editor.actions.remove": "删除文件",
  "file.editor.errors.import_unavailable": "当前宿主没有提供正式资源导入能力。",
  "file.editor.errors.import_failed": "文件导入失败。",
  "file.editor.errors.delete_failed": "资源删除请求提交失败，请稍后重试。",
  "file.editor.errors.operation_failed": "操作失败",
  "file.editor.errors.validation_failed": "配置需要调整",
};

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
