export function isElementNode(value: unknown): value is Element {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'nodeType' in value &&
    typeof (value as { nodeType?: unknown }).nodeType === 'number' &&
    (value as { nodeType: number }).nodeType === 1
  );
}

export function isStyleElementNode(value: unknown): value is HTMLStyleElement {
  return isElementNode(value) && value.localName.toLowerCase() === 'style';
}

export function resolveEventTargetElement(target: EventTarget | null): Element | null {
  return isElementNode(target) ? target : null;
}

export function resolveDocumentScrollingElement(document: Document): HTMLElement {
  if (isElementNode(document.scrollingElement)) {
    return document.scrollingElement as HTMLElement;
  }

  if (isElementNode(document.documentElement)) {
    return document.documentElement;
  }

  if (isElementNode(document.body)) {
    return document.body;
  }

  throw new Error('当前文档缺少可滚动根节点。');
}
