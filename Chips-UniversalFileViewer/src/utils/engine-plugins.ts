import {
  archivePlugin,
  assetPlugin,
  audioPlugin,
  cadPlugin,
  drawingPlugin,
  emailPlugin,
  epubPlugin,
  fallbackPlugin,
  gisPlugin,
  imagePlugin,
  model3dPlugin,
  officePlugin,
  ofdPlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin,
  xmindPlugin,
  xpsPlugin,
  type PreviewPlugin,
} from "../viewer-engine";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

/**
 * 万能文件查看器引擎插件装配表。
 * 顺序即匹配优先级：专用格式插件在前，fallback 兜底在后。
 */
export function createViewerPlugins(): PreviewPlugin[] {
  return [
    imagePlugin(),
    videoPlugin(),
    audioPlugin(),
    pdfPlugin({ workerSrc: pdfWorkerSrc }),
    epubPlugin(),
    xpsPlugin(),
    officePlugin(),
    ofdPlugin(),
    archivePlugin(),
    emailPlugin(),
    drawingPlugin(),
    xmindPlugin(),
    cadPlugin(),
    model3dPlugin(),
    gisPlugin(),
    assetPlugin(),
    textPlugin(),
    fallbackPlugin(),
  ];
}
