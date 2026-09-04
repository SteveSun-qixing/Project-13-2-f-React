const MESSAGES: Record<string, string> = {
  "start-home.title": "薯片办公起始页",
  "start-home.description": "从这里打开你的文档，开始工作。",
  "start-home.formats": "支持 .docx 格式",
  "start-home.actions.open": "打开文件",
  "start-home.hints.shortcut": "按 ⌘O 打开文件，或将文件拖入窗口",
  "start-home.hints.dropToOpen": "松开以打开",
  "start-home.dialogs.openFileTitle": "选择文件",
  "start-home.hints.bridgeUnavailable": "当前环境不可用文件选择能力",
  "app.commands.menu.file": "文件",
};

export function formatMessage(key: string, params?: Record<string, string | number>): string {
  const template = MESSAGES[key] ?? key;
  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
