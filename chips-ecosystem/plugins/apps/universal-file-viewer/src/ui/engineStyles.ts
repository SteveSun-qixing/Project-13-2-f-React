/**
 * 引擎样式装载：token 化引擎样式表（engine-stage.css）经 Vite `?raw` 编译期内联，
 * 由壳层在挂载时注入一次 `<style>`（幂等）。产物自包含，无独立根级 CSS 文件。
 */

import engineStageCss from './engine-stage.css?raw';

const STYLE_ELEMENT_ID = 'chips-universal-file-viewer-engine-stage';

/** 幂等注入引擎样式；窗口内多次挂载壳层不会产生重复样式节点。 */
export function ensureEngineStyles(): void {
  if (document.getElementById(STYLE_ELEMENT_ID) !== null) {
    return;
  }
  const element = document.createElement('style');
  element.id = STYLE_ELEMENT_ID;
  element.textContent = engineStageCss;
  document.head.appendChild(element);
}
