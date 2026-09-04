/**
 * 引擎共享字节工具（工单172 浏览器安全实现）单元测试。
 *
 * 除 Web 标准 API 外，这里额外用 Node 的 zlib/crypto 作为参照实现，
 * 验证纯 JS 算法（stored deflate、SHA-256、base64）与既有生态语义逐字节一致。
 */
import { inflateSync, crc32 } from 'node:zlib'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  bytesEqual,
  bytesToBase64,
  concatBytes,
  decodeUtf8,
  encodeUtf8,
  sha256Hex,
} from '../../src/engine/shared/bytes'
import { solidPng } from '../../src/engine/pptx-engine/src/media-insert'

function randomBytes(length: number, seed = 1): Uint8Array {
  // 简单可复现的伪随机序列（LCG），避免测试对全局随机性的依赖
  let state = seed >>> 0
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    out[i] = state & 0xff
  }
  return out
}

describe('shared/bytes UTF-8 编解码', () => {
  it('ASCII、中文、emoji 与 surrogate 对往返一致', () => {
    const samples = ['', 'pptx', '演示文稿.pptx', '薯片 🍟 office', '𠮷野家', 'line\nbreak\ttab']
    for (const text of samples) {
      expect(decodeUtf8(encodeUtf8(text))).toBe(text)
    }
  })

  it('与 Buffer 语义一致（含 BOM 与多字节序列）', () => {
    const text = '薯片 Chips'
    expect(Array.from(encodeUtf8(text))).toEqual(Array.from(Buffer.from(text, 'utf8')))
  })
})

describe('shared/bytes base64 编解码', () => {
  it('空、1 字节、块边界（0x8000 跨界）与随机数据往返一致', () => {
    const sizes = [0, 1, 3, 0x7fff, 0x8000, 0x8001, 100_003]
    for (const size of sizes) {
      const bytes = randomBytes(size, size + 7)
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
    }
  })

  it('与 Buffer 的 base64 输出一致', () => {
    const bytes = randomBytes(1000, 42)
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
  })

  it('容忍空白符与 URL-safe 变体', () => {
    const bytes = randomBytes(64, 99)
    const standard = bytesToBase64(bytes)
    expect(base64ToBytes(standard)).toEqual(bytes)
    expect(base64ToBytes(standard.replaceAll('+', '-').replaceAll('/', '_'))).toEqual(bytes)
    expect(base64ToBytes(standard.replace(/(.{8})/g, '$1\n'))).toEqual(bytes)
  })
})

describe('shared/bytes 拼接与比较', () => {
  it('concatBytes 等价于 Buffer.concat', () => {
    const a = randomBytes(13, 1)
    const b = randomBytes(0, 2)
    const c = randomBytes(250, 3)
    expect(Array.from(concatBytes(a, b, c))).toEqual(
      Array.from(Buffer.concat([Buffer.from(a), Buffer.from(b), Buffer.from(c)])),
    )
  })

  it('bytesEqual 判定长度与逐字节相等', () => {
    const a = randomBytes(16, 5)
    const b = randomBytes(16, 5)
    const c = randomBytes(16, 6)
    const d = randomBytes(15, 5)
    expect(bytesEqual(a, b)).toBe(true)
    expect(bytesEqual(a, c)).toBe(false)
    expect(bytesEqual(a, d)).toBe(false)
    expect(bytesEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true)
  })
})

describe('shared/bytes SHA-256（Web Crypto 实现）', () => {
  it('与 node:crypto createHash 结果一致', async () => {
    for (const input of ['', 'abc', '薯片生态 Chips-Office']) {
      const bytes = encodeUtf8(input)
      const expected = createHash('sha256').update(bytes).digest('hex')
      await expect(sha256Hex(bytes)).resolves.toBe(expected)
    }
  })

  it('大输入（跨 chunk）与二进制数据一致', async () => {
    const bytes = randomBytes(300_000, 77)
    const expected = createHash('sha256').update(bytes).digest('hex')
    await expect(sha256Hex(bytes)).resolves.toBe(expected)
  })
})

describe('solidPng（纯 JS stored deflate 实现）', () => {
  it('生成合法 PNG：签名、IHDR 尺寸与 IDAT 可被 node:zlib 还原', () => {
    const png = solidPng(16, 9, [38, 38, 44])
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    // PNG 签名
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // IHDR：宽 16、高 9、位深 8、颜色类型 2（RGB）
    expect(view.getUint32(16)).toBe(16)
    expect(view.getUint32(20)).toBe(9)
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(2)
    // IDAT 数据可被标准 zlib 还原，且长度与原始行结构一致（每行 1 过滤字节 + 16*3 像素字节）
    const idatLength = view.getUint32(33)
    const idatType = String.fromCharCode(png[37], png[38], png[39], png[40])
    expect(idatType).toBe('IDAT')
    const idat = png.subarray(41, 41 + idatLength)
    const raw = inflateSync(idat)
    expect(raw.length).toBe(9 * (1 + 16 * 3))
    // 首行：过滤字节 0 + 像素 RGB(38,38,44)
    expect(Array.from(raw.subarray(0, 4))).toEqual([0, 38, 38, 44])
  })

  it('所有 chunk 的 CRC 校验正确', () => {
    const png = solidPng(4, 2, [1, 2, 3])
    let offset = 8
    while (offset < png.length) {
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      const length = view.getUint32(offset)
      const typeAndData = png.subarray(offset + 4, offset + 4 + 4 + length)
      const expectedCrc = view.getUint32(offset + 8 + length)
      expect(crc32(typeAndData) >>> 0).toBe(expectedCrc)
      offset += 12 + length
    }
  })

  it('空尺寸退化输入不崩溃且仍为合法结构', () => {
    const png = solidPng(0, 0, [0, 0, 0])
    expect(png.length).toBeGreaterThan(8)
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
    expect(view.getUint32(16)).toBe(0)
    expect(view.getUint32(20)).toBe(0)
  })
})
