const MESSAGES: Record<string, string> = {
  "universal-viewer.app.title": "万能文件查看器",
  "universal-viewer.app.subtitle": "薯片生态内的通用文件预览入口，专用查看器未覆盖的文件在这里打开。",

  "universal-viewer.scenes.empty.title": "未打开任何文件",
  "universal-viewer.scenes.empty.hint": "点击「打开文件」选择本地文件，或把文件拖拽到窗口中。",
  "universal-viewer.scenes.viewer.title": "文件查看场景",

  "universal-viewer.commands.menu.file": "文件",
  "universal-viewer.commands.menu.view": "查看",
  "universal-viewer.commands.menu.navigate": "导航",
  "universal-viewer.commands.openFile.title": "打开文件…",
  "universal-viewer.commands.openFile.description": "从本地文件系统选择要查看的文件。",
  "universal-viewer.commands.saveCopy.title": "另存为…",
  "universal-viewer.commands.saveCopy.description": "将当前文件保存一个副本。",
  "universal-viewer.commands.refresh.title": "重新加载",
  "universal-viewer.commands.refresh.description": "重新加载当前文件。",
  "universal-viewer.commands.zoomIn.title": "放大",
  "universal-viewer.commands.zoomOut.title": "缩小",
  "universal-viewer.commands.zoomFit.title": "适应窗口",
  "universal-viewer.commands.zoomActual.title": "原始大小",
  "universal-viewer.commands.rotateLeft.title": "向左旋转",
  "universal-viewer.commands.rotateRight.title": "向右旋转",
  "universal-viewer.commands.previousFile.title": "上一个文件",
  "universal-viewer.commands.nextFile.title": "下一个文件",
  "universal-viewer.commands.fullscreen.title": "全屏",
  "universal-viewer.commands.print.title": "打印",
  "universal-viewer.commands.search.title": "搜索内容",

  "universal-viewer.stage.dropHint": "松开鼠标即可打开文件",
  "universal-viewer.stage.loading": "正在加载文件…",
  "universal-viewer.stage.fileLabel": "文件",
  "universal-viewer.stage.queueLabel": "队列",
  "universal-viewer.stage.pageLabel": "页码",
  "universal-viewer.stage.pageOf": "共 {total} 页",
  "universal-viewer.stage.zoomLabel": "缩放",
  "universal-viewer.stage.searchPlaceholder": "搜索内容",
  "universal-viewer.stage.searchResult": "找到 {count} 处",
  "universal-viewer.stage.toolbarLabel": "查看器工具栏",

  "universal-viewer.errors.unsupportedFile": "当前文件类型不受支持，无法预览。",
  "universal-viewer.errors.loadFailed": "无法读取该文件，请检查文件是否存在或是否损坏。",
  "universal-viewer.errors.unsupportedFileForTarget": "该文件类型不受支持：{fileName}",
  "universal-viewer.errors.openFailed": "打开文件失败，请重试。",
  "universal-viewer.errors.dropFailed": "读取拖入的文件失败，请重试。",
  "universal-viewer.errors.saveSamePath": "目标路径与当前文件相同，请选择其他位置。",
  "universal-viewer.errors.saveFailed": "保存文件副本失败，请检查目标位置是否可写。",

  "universal-viewer.feedback.saved": "文件副本已保存。",
  "universal-viewer.feedback.saveUnsupported": "当前查看环境不支持保存副本。",
  "universal-viewer.info.fileName": "文件名",
  "universal-viewer.info.path": "路径",
  "universal-viewer.info.format": "类型",
  "universal-viewer.info.size": "大小",
};

export type MessageKey = keyof typeof MESSAGES;

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key];
  if (typeof template !== "string") {
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
