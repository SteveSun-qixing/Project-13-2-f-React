import { describe, expect, it } from 'vitest';
import { replaceContentUrls, replaceCoverHtmlUrls } from './url-replace.js';

describe('replaceContentUrls', () => {
  it('将图片基础卡片的 file_path 正式转换为 url 资源', () => {
    const urlMap = new Map<string, string>([
      ['demo.jpg', 'http://localhost:9000/chips-card-resources/user/card/demo.jpg'],
    ]);
    const contentMap = new Map<string, Record<string, unknown>>([
      [
        'node-1',
        {
          card_type: 'ImageCard',
          images: [
            {
              id: 'img-1',
              source: 'file',
              file_path: 'demo.jpg',
              alt: 'demo',
            },
          ],
        },
      ],
    ]);

    const replaced = replaceContentUrls(contentMap, urlMap);
    expect(replaced.get('node-1')).toEqual({
      card_type: 'ImageCard',
      images: [
        {
          id: 'img-1',
          source: 'url',
          url: 'http://localhost:9000/chips-card-resources/user/card/demo.jpg',
          alt: 'demo',
        },
      ],
    });
  });

  it('保留普通字段的直接字符串替换行为', () => {
    const urlMap = new Map<string, string>([
      ['cover.png', 'http://localhost:9000/chips-card-resources/user/card/cover.png'],
    ]);
    const contentMap = new Map<string, Record<string, unknown>>([
      [
        'node-2',
        {
          title: 'hello',
          poster: 'cover.png',
          nested: {
            src: 'cover.png',
          },
        },
      ],
    ]);

    const replaced = replaceContentUrls(contentMap, urlMap);
    expect(replaced.get('node-2')).toEqual({
      title: 'hello',
      poster: 'http://localhost:9000/chips-card-resources/user/card/cover.png',
      nested: {
        src: 'http://localhost:9000/chips-card-resources/user/card/cover.png',
      },
    });
  });

  it('可以把不同相对写法解析到同一个根目录资源', () => {
    const cdnUrl = 'http://localhost:9000/chips-card-resources/user/card/posters/cover.png';
    const urlMap = new Map<string, string>([
      ['posters/cover.png', cdnUrl],
    ]);
    const contentMap = new Map<string, Record<string, unknown>>([
      [
        'node-3',
        {
          poster: 'posters/cover.png',
          nested: {
            source: 'file',
            file_path: '../posters/cover.png',
          },
        },
      ],
    ]);

    const replaced = replaceContentUrls(contentMap, urlMap);

    expect(replaced.get('node-3')).toEqual({
      poster: cdnUrl,
      nested: {
        source: 'url',
        url: cdnUrl,
      },
    });
  });

  it('替换 cover.html 中带 ./ 前缀的 cardcover 相对资源路径', () => {
    const html = `<!doctype html>
<html>
  <body data-chips-cover-image-source="./cardcover/cover-image.png">
    <img src="./cardcover/cover-image.png" alt="" />
    <a href='./cardcover/cover-image.png'>cover</a>
    <div style="background-image:url('./cardcover/cover-image.png')"></div>
  </body>
</html>`;
    const cdnUrl = 'http://localhost:9000/chips-card-resources/user/card/.card/cardcover/cover-image.png';
    const urlMap = new Map<string, string>([
      ['.card/cardcover/cover-image.png', cdnUrl],
    ]);

    const replaced = replaceCoverHtmlUrls(html, urlMap);

    expect(replaced).toContain(`data-chips-cover-image-source="${cdnUrl}"`);
    expect(replaced).toContain(`src="${cdnUrl}"`);
    expect(replaced).toContain(`href='${cdnUrl}'`);
    expect(replaced).toContain(`url('${cdnUrl}')`);
    expect(replaced).not.toContain('./cardcover/cover-image.png');
  });
});
