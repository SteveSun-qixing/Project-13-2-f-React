/**
 * Browser byte/text helpers — the vendor engine's Node API replacement layer.
 *
 * pptx-engine originally ran in the Electron main process and used node:crypto /
 * node:zlib / Buffer. The Chips-Slide port runs the same engine in the browser
 * renderer, so every Node touchpoint is rewritten against these Web APIs with
 * identical semantics (same output bytes, same UTF-8/Base64 round-trips).
 */

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Buffer.from(str, 'utf8') → UTF-8 bytes. */
export function utf8Encode(text: string): Uint8Array {
  return textEncoder.encode(text)
}

/** Buffer.from(bytes).toString('utf8') → decode bytes as UTF-8. */
export function utf8Decode(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

/** Buffer.from(str, 'base64') → decode Base64 (whitespace tolerant, like Node). */
export function base64Decode(input: string): Uint8Array {
  const normalized = input.replace(/[\s]+/g, '')
  const binary = globalThis.atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** bytes.toString('base64') → encode bytes as Base64. */
export function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const slice = bytes.subarray(offset, offset + chunk)
    binary += String.fromCharCode(...slice)
  }
  return globalThis.btoa(binary)
}

/** Buffer.from(str, 'ascii') → ASCII bytes (code points truncated to 8 bit). */
export function asciiEncode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

/** Buffer.alloc(n) → zero-filled byte array. */
export function allocBytes(length: number): Uint8Array {
  return new Uint8Array(length)
}

/** Buffer.concat(list) → concatenated byte array. */
export function concatBytes(list: Array<Uint8Array | ArrayBufferLike>): Uint8Array {
  const parts = list.map((item) =>
    item instanceof Uint8Array ? item : new Uint8Array(item),
  )
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** buf.writeUInt32BE(value, offset) → big-endian uint32 write into a byte array. */
export function writeUint32BE(bytes: Uint8Array, value: number, offset: number): void {
  bytes[offset] = (value >>> 24) & 0xff
  bytes[offset + 1] = (value >>> 16) & 0xff
  bytes[offset + 2] = (value >>> 8) & 0xff
  bytes[offset + 3] = value & 0xff
}

/** Buffer.equals counterpart for byte arrays. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** node:crypto createHash('sha256').update(bytes).digest('hex') → WebCrypto. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** node:crypto randomUUID → Web Crypto, with a getRandomValues fallback for
 * environments whose crypto.randomUUID is unavailable (older jsdom). */
export function randomUuid(): string {
  const cryptoRef = globalThis.crypto
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  const bytes = new Uint8Array(16)
  cryptoRef.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
