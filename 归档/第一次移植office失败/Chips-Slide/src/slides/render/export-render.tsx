/**
 * 离屏渲染导出 —— 将 RenderSlide 画进离屏 Konva 舞台并导出高分辨率 PNG。
 * 复用 SlideThumb（与主画布/缩略图完全一致的渲染），保证导出结果与所见一致。
 * 原版（.tsx）经 React root 逐页挂载；本移植保留同一渲染链路。
 */
import { createRoot } from "react-dom/client";
import type Konva from "konva";
import type { RenderSlide } from "@genoffice/pptx-render";
import { SlideThumb } from "./SlideThumb";

/** 导出位图像素比（2x 高清：960 视口宽 → 1920px PNG） */
const EXPORT_PIXEL_RATIO = 2;

function offscreenContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-100000px";
  container.style.top = "0";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);
  return container;
}

/**
 * 将一页渲染为 PNG base64（不含 data: 前缀）。
 * 离屏容器挂在视口外（display:none 会让 Konva 舞台尺寸归零，无法使用）。
 */
export async function renderSlideToPngBase64(
  slide: RenderSlide,
  images: Map<string, HTMLImageElement>,
  pixelRatio: number = EXPORT_PIXEL_RATIO,
): Promise<string> {
  const container = offscreenContainer();
  const root = createRoot(container);
  try {
    const stage = await new Promise<Konva.Stage>((resolve) => {
      root.render(
        <SlideThumb
          slide={slide}
          images={images}
          width={slide.widthPx}
          stageRef={(s) => s && resolve(s)}
        />,
      );
    });
    // 等待一帧让 Konva 完成 batchDraw 再截取
    await new Promise((r) => requestAnimationFrame(r));
    const dataUrl = stage.toDataURL({ mimeType: "image/png", pixelRatio });
    return dataUrl.replace(/^data:image\/png;base64,/, "");
  } finally {
    root.unmount();
    container.remove();
  }
}

/** 将整份文档逐页渲染为 PNG base64 数组（页序）。 */
export async function renderSlidesToPngBase64(
  slides: RenderSlide[],
  images: Map<string, HTMLImageElement>,
  pixelRatio: number = EXPORT_PIXEL_RATIO,
): Promise<string[]> {
  const out: string[] = [];
  for (const slide of slides) {
    out.push(await renderSlideToPngBase64(slide, images, pixelRatio));
  }
  return out;
}
