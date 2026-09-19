/**
 * 剪贴板端口；能力契约当前只定义文本读写。
 *
 * 权威：`04-能力契约规范` §7.6。
 *
 * @remarks
 * - `readText` 在剪贴板无文本时返回 `null`（系统空字符串同样归一为 `null`）。
 * - 读取属高风险操作，首次调用确认与审计由能力层完成；端口不写日志。
 */
export interface IPalClipboardPort {
  /** 读取剪贴板文本；无文本时返回 `null`。 */
  readText(): Promise<string | null>;
  /** 写入剪贴板文本。 */
  writeText(text: string): Promise<void>;
}
