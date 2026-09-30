import { describe, expect, it } from 'vitest';
import {
  isElementNode,
  isStyleElementNode,
  resolveDocumentScrollingElement,
  resolveEventTargetElement,
} from '../../src/core/dom';

describe('dom utils', () => {
  it('基于 nodeType 判定跨 realm 的元素节点', () => {
    const crossRealmLikeElement = {
      nodeType: 1,
      localName: 'div',
    };

    expect(isElementNode(crossRealmLikeElement)).toBe(true);
    expect(resolveEventTargetElement(crossRealmLikeElement as unknown as EventTarget)).toBe(
      crossRealmLikeElement
    );
  });

  it('可以识别 style 元素并拒绝普通节点', () => {
    expect(
      isStyleElementNode({
        nodeType: 1,
        localName: 'style',
      })
    ).toBe(true);

    expect(
      isStyleElementNode({
        nodeType: 1,
        localName: 'div',
      })
    ).toBe(false);
  });

  it('优先返回文档的 scrollingElement，而不是错误退回到 body', () => {
    const scrollingElement = {
      nodeType: 1,
      localName: 'html',
      scrollWidth: 95611,
      offsetWidth: 1440,
    };
    const documentElement = {
      nodeType: 1,
      localName: 'html',
      scrollWidth: 95611,
      offsetWidth: 1440,
    };
    const body = {
      nodeType: 1,
      localName: 'body',
      scrollWidth: 589,
      offsetWidth: 589,
    };

    const documentLike = {
      scrollingElement,
      documentElement,
      body,
    } as unknown as Document;

    expect(resolveDocumentScrollingElement(documentLike)).toBe(scrollingElement);
  });
});
