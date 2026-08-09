const MESSAGES: Record<string, string> = {
  "basecard.editor.ariaLabel": "基础卡片编辑器",
  "basecard.error.ariaLabel": "基础卡片配置错误",
  "basecard.error.title": "配置需要修正",
  "basecard.field.title.ariaLabel": "标题",
  "basecard.field.title.label": "标题",
  "basecard.field.title.placeholder": "输入标题",
  "basecard.field.body.ariaLabel": "内容",
  "basecard.field.body.label": "内容",
  "basecard.field.body.placeholder": "输入正文内容",
  "basecard.validation.cardTypeMismatch": "卡片类型必须与插件声明一致。",
  "basecard.validation.titleRequired": "标题不能为空。",
  "basecard.validation.bodyRequired": "内容不能为空。",
  "basecard.validation.resourcePathInvalid": "资源路径必须是卡片根目录内的相对路径。",
  "basecard.resource.deleteAction": "删除资源",
  "basecard.resource.deleteFailed": "资源删除失败。",
  "basecard.resource.dropzoneAriaLabel": "导入卡片资源",
  "basecard.resource.dropzoneLabel": "拖放资源文件以导入",
  "basecard.resource.importFailed": "资源导入失败。",
  "basecard.resource.importUnavailable": "当前宿主未提供资源导入能力。",
  "basecard.resource.openAction": "打开资源",
  "basecard.resource.pathAriaLabel": "资源路径",
  "basecard.resource.pathLabel": "资源路径",
  "basecard.resource.pathPlaceholder": "assets/example.png",
  "basecard.resource.previewLabel": "关联资源",
  "basecard.resource.resolveFailed": "资源预览地址解析失败。",
  "basecard.resource.resolving": "正在解析资源",
  "basecard.view.ariaLabel": "{title} 基础卡片",
};

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
