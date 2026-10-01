/// pdf 阅读域字节级集成测试：真实 minimal.pdf 经 pdfjs-dist legacy 构建解析
/// （不 mock 解析器），搜索索引/表单目录/标注目录全部建立在真实解析产物上。
/// pdfjs worker 在 Node 下经 legacy 构建内置承载，无需外部 worker 文件。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { buildSearchIndex, searchInIndex, type SearchIndex } from '../../src/pdf/domain/search'
import { buildFormCatalog, documentFormFeatures } from '../../src/pdf/domain/form-catalog'
import { loadSavedAnnots } from '../../src/pdf/domain/annotation-catalog'

const here = join(dirname(fileURLToPath(import.meta.url)))
const fixtureBytes = (): Uint8Array =>
  new Uint8Array(readFileSync(join(here, '../fixtures/minimal.pdf')))

/** 打开真实夹具并在用例结束后经 loadingTask 释放（pdfjs v6 资源面）。 */
async function withDoc<T>(run: (doc: PDFDocumentProxy) => Promise<T>): Promise<T> {
  const task = getDocument({ data: fixtureBytes() })
  try {
    return await run(await task.promise)
  } finally {
    await task.destroy()
  }
}

describe('pdf 阅读域：真实 pdf 字节解析', () => {
  it('pdfjs 读出双页文档与页面文本', async () => {
    await withDoc(async (doc) => {
      expect(doc.numPages).toBe(2)
      const page1 = await doc.getPage(1)
      const content = await page1.getTextContent()
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join('')
      expect(text).toContain('Chips Office PDF fixture')
      expect(text).toContain('Page one text for search.')
    })
  })
})

describe('pdf 阅读域：搜索索引（真实解析链）', () => {
  let index: SearchIndex

  it('buildSearchIndex 从真实文档构建每页索引', async () => {
    await withDoc(async (doc) => {
      index = await buildSearchIndex(doc)
      expect(index).toHaveLength(2)
      expect(index[0]?.lower).toContain('chips office pdf fixture')
      expect(index[1]?.lower).toContain('page two text')
    })
  })

  it('searchInIndex 命中并携带页码与片段', () => {
    const matches = searchInIndex(index, 'fixture')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.pageIndex).toBe(0)
    const miss = searchInIndex(index, '不存在的词')
    expect(miss).toEqual([])
    expect(searchInIndex(index, '')).toEqual([])
  })
})

describe('pdf 阅读域：表单目录与文档特性（真实解析链）', () => {
  it('无表单夹具的 buildFormCatalog 返回空目录', async () => {
    await withDoc(async (doc) => {
      const catalog = await buildFormCatalog(doc)
      expect(catalog.widgets.length).toBe(0)
    })
  })

  it('documentFormFeatures 判定加密与 XFA（本夹具均为否）', () => {
    const features = documentFormFeatures(
      { EncryptFilterName: null, IsXFAPresent: false },
      fixtureBytes(),
    )
    expect(features).toEqual({ encrypted: false, hasXfa: false })
    // 字节标记兜底：XFA 元数据缺失时按字节判定
    const marker = documentFormFeatures(
      { IsXFAPresent: false },
      new Uint8Array([0x00, 0x2f, 0x58, 0x46, 0x41, 0x00]),
    )
    expect(marker.hasXfa).toBe(true)
  })
})

describe('pdf 阅读域：已存标注目录（真实解析链）', () => {
  it('无标注夹具返回空页面标注', async () => {
    await withDoc(async (doc) => {
      for (const origIdx of [0, 1]) {
        const saved = await loadSavedAnnots(doc, origIdx)
        expect(saved.markups).toEqual([])
        expect(saved.notes).toEqual([])
      }
    })
  })
})
