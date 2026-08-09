import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoViewerStage } from "../../src/components/PhotoViewerStage";
import { formatMessage } from "../../src/lib/messages";

function t(key: string, params?: Record<string, string | number>): string {
  return formatMessage(key, params);
}

describe("PhotoViewerStage", () => {
  it("renders empty prompt when no image", () => {
    const html = renderToStaticMarkup(
      <PhotoViewerStage
        imageSource={null}
        isImageLoaded={false}
        isResolving={false}
        feedback={null}
        onOpenFile={() => undefined}
        onDropFile={() => undefined}
        onImageLoad={() => undefined}
        onImageError={() => undefined}
        imageDimensions={null}
        setZoomActions={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain("拖动或者点击导入图片");
    expect(html).toContain("photo-viewer-empty");
  });

  it("renders loading overlay while resolving", () => {
    const html = renderToStaticMarkup(
      <PhotoViewerStage
        imageSource={null}
        isImageLoaded={false}
        isResolving
        feedback={null}
        onOpenFile={() => undefined}
        onDropFile={() => undefined}
        onImageLoad={() => undefined}
        onImageError={() => undefined}
        imageDimensions={null}
        setZoomActions={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain("正在加载图片");
    expect(html).toContain("photo-viewer-overlay");
  });

  it("renders drag prompt while dragging", () => {
    const html = renderToStaticMarkup(
      <PhotoViewerStage
        imageSource={null}
        isImageLoaded={false}
        isResolving={false}
        feedback={null}
        onOpenFile={() => undefined}
        onDropFile={() => undefined}
        onImageLoad={() => undefined}
        onImageError={() => undefined}
        imageDimensions={null}
        setZoomActions={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain("photo-viewer-stage");
  });

  it("exposes accessible labels for the viewport, image, zoom badge and navigation arrows", () => {
    const html = renderToStaticMarkup(
      <PhotoViewerStage
        imageSource={{
          sourceId: "demo.png",
          fileName: "demo.png",
          resourceUri: "file:///demo.png",
          revision: 1,
        }}
        imageDimensions={{ width: 400, height: 300 }}
        isImageLoaded
        isResolving={false}
        feedback={null}
        onOpenFile={() => undefined}
        onDropFile={() => undefined}
        onImageLoad={() => undefined}
        onImageError={() => undefined}
        setZoomActions={() => undefined}
        hasPreviousImage={false}
        hasNextImage
        onPreviousImage={() => undefined}
        onNextImage={() => undefined}
        t={t}
      />,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="demo.png，400 × 300，100%"');
    expect(html).toContain('alt="demo.png"');
    expect(html).toContain('aria-label="100%，点击恢复适应窗口"');
    expect(html).toContain('aria-label="上一张"');
    expect(html).toContain('aria-label="下一张"');
    expect(html.match(/disabled/g)?.length).toBe(1);
  });
});
