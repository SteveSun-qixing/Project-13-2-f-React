import { describe, expect, it } from 'vitest';
import { parseEpubMetadata } from '../src/shared/epub';
import { createDeflateZip, createStoredZip, JPEG_BYTES, PNG_BYTES } from './helpers/zip';

/**
 * EPUB 元数据解析测试：全部夹具为测试内构造的**真实字节**最小合法 EPUB
 * （container.xml → OPF → 封面资源三链路），断言目录与资源解析走真实解码路径。
 */

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function createEpubFile(zip: Uint8Array, name = 'sea.epub'): File {
  return new File([toArrayBuffer(zip)], name, { type: 'application/epub+zip' });
}

describe('parseEpubMetadata', () => {
  it('从 OPF 元数据读取标题、作者与封面（meta name=cover 臂）', async () => {
    const zip = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container>
            <rootfiles>
              <rootfile full-path="OPS/package.opf" />
            </rootfiles>
          </container>`,
      },
      {
        path: 'OPS/package.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata>
              <dc:title>Sea of Pages</dc:title>
              <dc:creator>Alice Chen</dc:creator>
              <meta name="cover" content="cover-image" />
            </metadata>
            <manifest>
              <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" />
            </manifest>
          </package>`,
      },
      { path: 'OPS/images/cover.jpg', data: JPEG_BYTES },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip));

    expect(metadata.title).toBe('Sea of Pages');
    expect(metadata.author).toBe('Alice Chen');
    expect(metadata.cover?.mimeType).toBe('image/jpeg');
    expect(metadata.cover?.entryPath).toBe('OPS/images/cover.jpg');
    expect(metadata.cover?.suggestedFileName).toBe('sea-cover.jpg');
    expect(metadata.cover?.file.type).toBe('image/jpeg');
  });

  it('properties=cover-image 登记臂命中封面', async () => {
    const zip = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>`,
      },
      {
        path: 'OEBPS/content.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata><dc:title>Properties Cover</dc:title></metadata>
            <manifest>
              <item id="cover" href="pix/cover.png" media-type="image/png" properties="cover-image" />
            </manifest>
          </package>`,
      },
      { path: 'OEBPS/pix/cover.png', data: PNG_BYTES },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip, 'properties.epub'));

    expect(metadata.title).toBe('Properties Cover');
    expect(metadata.cover?.mimeType).toBe('image/png');
    expect(metadata.cover?.entryPath).toBe('OEBPS/pix/cover.png');
  });

  it('无显式登记时回退清单首个图片条目', async () => {
    const zip = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`,
      },
      {
        path: 'book.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata><dc:title>Fallback Cover</dc:title><dc:creator>Bob</dc:creator></metadata>
            <manifest>
              <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml" />
              <item id="c2" href="img/pic.jpg" media-type="image/jpeg" />
            </manifest>
          </package>`,
      },
      { path: 'img/pic.jpg', data: JPEG_BYTES },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip, 'fallback.epub'));

    expect(metadata.cover?.entryPath).toBe('img/pic.jpg');
    expect(metadata.cover?.suggestedFileName).toBe('fallback-cover.jpg');
  });

  it('解析 deflate EPUB（真实 deflate-raw 压缩夹具）', async () => {
    const zip = await createDeflateZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>`,
      },
      {
        path: 'OPS/package.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata>
              <dc:title>压缩之书</dc:title>
              <dc:creator>卡罗</dc:creator>
              <meta name="cover" content="cov" />
            </metadata>
            <manifest>
              <item id="cov" href="cover.jpg" media-type="image/jpeg" />
            </manifest>
          </package>`,
      },
      { path: 'OPS/cover.jpg', data: JPEG_BYTES },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip, 'deflated.epub'));

    expect(metadata.title).toBe('压缩之书');
    expect(metadata.author).toBe('卡罗');
    expect(metadata.cover?.mimeType).toBe('image/jpeg');
  });

  it('封面 href 含相对段时按 OPF 基目录归一', async () => {
    const zip = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>`,
      },
      {
        path: 'OEBPS/content.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata><dc:title>相对封面</dc:title></metadata>
            <manifest>
              <item id="cov" href="../assets/cover.jpg" media-type="image/jpeg" />
            </manifest>
          </package>`,
      },
      { path: 'assets/cover.jpg', data: JPEG_BYTES },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip, 'relative.epub'));

    expect(metadata.cover?.entryPath).toBe('assets/cover.jpg');
  });

  it('缺 container.xml 时返回空元数据', async () => {
    const zip = createStoredZip([{ path: 'OPS/package.opf', data: '<package></package>' }]);

    const metadata = await parseEpubMetadata(createEpubFile(zip));

    expect(metadata.title).toBe('');
    expect(metadata.author).toBe('');
    expect(metadata.cover).toBeUndefined();
  });

  it('container 指向的 OPF 缺失或不可解析时返回空元数据', async () => {
    const missingOpf = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>`,
      },
    ]);
    const brokenOpf = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="OPS/package.opf" /></rootfiles></container>`,
      },
      { path: 'OPS/package.opf', data: '<package><未闭合>' },
    ]);

    const missing = await parseEpubMetadata(createEpubFile(missingOpf));
    const broken = await parseEpubMetadata(createEpubFile(brokenOpf));

    expect(missing.title).toBe('');
    expect(broken.title).toBe('');
  });

  it('封面条目不是可识别图片时不产生封面', async () => {
    const zip = createStoredZip([
      {
        path: 'META-INF/container.xml',
        data: `<?xml version="1.0"?>
          <container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`,
      },
      {
        path: 'book.opf',
        data: `<?xml version="1.0"?>
          <package xmlns:dc="http://purl.org/dc/elements/1.1/">
            <metadata><dc:title>Not Image</dc:title></metadata>
            <manifest>
              <item id="cov" href="cover.txt" media-type="text/plain" />
            </manifest>
          </package>`,
      },
      { path: 'cover.txt', data: 'plain text' },
    ]);

    const metadata = await parseEpubMetadata(createEpubFile(zip));

    expect(metadata.title).toBe('Not Image');
    expect(metadata.cover).toBeUndefined();
  });
});
