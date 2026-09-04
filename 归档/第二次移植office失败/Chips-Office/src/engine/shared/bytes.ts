/**
 * 引擎共享字节工具 —— 浏览器安全实现（工单172 架构收口）
 *
 * 引擎包处理 OOXML / PDF 等二进制包格式，历史上直接使用 Node.js Buffer 与
 * node:crypto 等内置模块；而应用插件运行在宿主沙箱化的浏览器渲染进程中
 * （Electron sandbox: true，无 Node 能力），导致浏览器构建与运行双双受阻。
 *
 * 本模块基于 Web 标准 API（TextEncoder / TextDecoder / atob / btoa /
 * Web Crypto）提供等价能力，是引擎各包唯一的字节操作入口：
 * - 引擎代码禁止再直接引用 Buffer 或 node:* 内置模块；
 * - 确需 Node 专属能力（如流式写盘）的函数必须收敛到独立的 node-io 入口，
 *   且不得被浏览器侧代码引用。
 */

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder('utf-8')

/** UTF-8 编码（替代 `Buffer.from(str, 'utf8')`） */
export function encodeUtf8(text: string): Uint8Array {
  return utf8Encoder.encode(text)
}

/** UTF-8 解码（替代 `Buffer.from(bytes).toString('utf8')`） */
export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes)
}

/** base64 编码（替代 `Buffer.from(bytes).toString('base64')`；分块转换避免大数组触发调用栈溢出） */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/** base64 解码（替代 `Buffer.from(base64, 'base64')`；容忍空白符与 URL-safe 变体） */
export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '').replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** 顺序拼接多个字节序列（替代 `Buffer.concat([...])`） */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 字节序列逐字节相等比较（替代 `Buffer.equals`） */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/** SHA-256 摘要，返回小写十六进制（替代 `node:crypto` 的 `createHash('sha256')`，基于 Web Crypto） */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
