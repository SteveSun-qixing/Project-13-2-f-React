const MESSAGES: Record<string, string> = {
  "card-viewer.actions.open": "打开文件",
  "card-viewer.actions.reselectFile": "重新选择文件",
  "card-viewer.actions.retry": "重试",
  "card-viewer.actions.returnHome": "返回首页",
  "card-viewer.actions.viewCover": "查看封面",
  "card-viewer.actions.viewContent": "查看内容",
  "card-viewer.actions.downloadCard": "下载卡片",
  "card-viewer.actions.downloadingCard": "正在下载卡片…",
  "card-viewer.actions.downloadComplete": "卡片已下载",
  "card-viewer.actions.downloadFailed": "卡片下载失败",
  "card-viewer.actions.downloadUnavailable": "当前社区卡片暂不支持在此客户端下载",
  "card-viewer.chrome.createdAt": "创建于 {date}",
  "card-viewer.dialogs.openFileTitle": "打开卡片或箱子文件",
  "card-viewer.dropzone.ariaLabel": "导入卡片或箱子",
  "card-viewer.dropzone.fileMark": ".card / .box",
  "card-viewer.dropzone.title": "拖入卡片或箱子文件",
  "card-viewer.dropzone.description": "将 .card 或 .box 文件拖到当前窗口，或者点击下方按钮选择打开。导入后会直接进入对应的正式查看模式。",
  "card-viewer.viewer.documentTitle": "文档查看",
  "card-viewer.viewer.documentDescription": "通过 Host 托管文档窗口查看卡片或箱子内容。",
  "card-viewer.viewer.hostedDocumentTitle": "托管文档查看",
  "card-viewer.viewer.hostedDocumentDescription": "通过 Host 提供的文档 URL 承载托管内容。",
  "card-viewer.viewer.hostedDocumentFrameTitle": "托管卡片文档",
  "card-viewer.viewer.documentLoading": "正在加载文档…",
  "card-viewer.viewer.documentContainerError": "找不到文档窗口容器",
  "card-viewer.viewer.documentFatalError": "文档窗口发生严重错误",
  "card-viewer.viewer.documentRenderError": "文档窗口渲染失败",
  "card-viewer.viewer.metadataLoadError": "查看来源元数据读取失败",
  "card-viewer.viewer.coverUnavailable": "当前来源没有可查看的封面",
  "card-viewer.errors.hostActionFailed": "打开文件失败，请重试。",
  "card-viewer.errors.unsupportedFile": "当前只支持打开 .card 或 .box 文件。",
  "card-viewer.errors.unsupportedSource": "当前查看来源暂不支持，请检查启动参数与 Host 日志。",
  "card-viewer.errors.resourceOpenFailedTitle": "无法打开资源",
  "card-viewer.errors.resourceOpenFailed": "当前资源无法通过正式路由打开，请检查处理器插件与 Host 日志。",
  "card-viewer.commands.openFile.title": "打开文件",
  "card-viewer.commands.openFile.description": "通过 Host 文件选择器打开 .card 或 .box 文件。",
  "card-viewer.commands.openFile.ariaLabel": "打开卡片或箱子文件",
};

export type MessageParams = Record<string, string | number>;

export function hasMessage(key: string): boolean {
  return key in MESSAGES;
}

export function formatMessage(key: string, params?: MessageParams): string {
  const template = MESSAGES[key];
  if (template === undefined) {
    return key;
  }
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}

export function resolveMessage(key: string, params?: MessageParams, fallback?: string): string {
  if (!hasMessage(key)) {
    return fallback ?? key;
  }
  return formatMessage(key, params);
}
