import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import type { PlatformLaunchContext } from "chips-sdk";
import { resolveLaunchViewerTarget } from "../../src/utils/launch-resource";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const testingSpaceRoot = resolve(workspaceRoot, "ProductFinishedProductTestingSpace");

function buildLaunchContext(launchParams: Record<string, unknown>): PlatformLaunchContext {
  return {
    pluginId: "com.chips.universal-file-viewer",
    sceneId: "universal-viewer.scene.main",
    kind: "window",
    presentation: { title: "万能文件查看器", width: 1100, height: 760, resizable: true },
    surfaceContext: {
      surfaceId: "surface-1",
      sceneId: "universal-viewer.scene.main",
      pluginId: "com.chips.universal-file-viewer",
      sessionId: "session-1",
      kind: "window",
      presentation: { title: "万能文件查看器", width: 1100, height: 760, resizable: true },
      launchParams,
    },
    launchParams,
  };
}

describe("resolveLaunchViewerTarget", () => {
  it("从 resourceOpen.filePath 归一本地文件目标", () => {
    const target = resolveLaunchViewerTarget(buildLaunchContext({
      trigger: "resource-open-service",
      targetPath: "/tmp/演示文稿.pptx",
      resourceOpen: {
        intent: "view",
        resourceId: "/tmp/演示文稿.pptx",
        filePath: "/tmp/演示文稿.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        extension: ".pptx",
        fileName: "演示文稿.pptx",
        title: "演示文稿",
      },
    }));

    expect(target).not.toBeNull();
    expect(target?.files).toHaveLength(1);
    expect(target?.files[0]).toMatchObject({
      sourceId: "/tmp/演示文稿.pptx",
      filePath: "/tmp/演示文稿.pptx",
      fileName: "演示文稿.pptx",
    });
    expect(target?.title).toBe("演示文稿");
  });

  it("无 resourceOpen 时回退 targetPath（系统文件关联场景）", () => {
    const target = resolveLaunchViewerTarget(buildLaunchContext({
      trigger: "file-association",
      targetPath: "/Users/demo/Documents/报表.xlsx",
    }));

    expect(target?.files[0]).toMatchObject({
      sourceId: "/Users/demo/Documents/报表.xlsx",
      filePath: "/Users/demo/Documents/报表.xlsx",
      fileName: "报表.xlsx",
    });
  });

  it("远端资源 ID 作为读取入口（Web 场景回退）", () => {
    const target = resolveLaunchViewerTarget(buildLaunchContext({
      resourceOpen: {
        intent: "view",
        resourceId: "https://example.com/files/manual.pdf",
        mimeType: "application/pdf",
        fileName: "manual.pdf",
      },
    }));

    expect(target?.files[0]).toMatchObject({
      sourceId: "https://example.com/files/manual.pdf",
      fileName: "manual.pdf",
      mimeType: "application/pdf",
    });
  });

  it("电子书图片包 payload 恢复有序图片队列并定位初始索引", () => {
    const target = resolveLaunchViewerTarget(buildLaunchContext({
      trigger: "resource-open-service",
      targetPath: "/tmp/book/pages/002.png",
      resourceOpen: {
        intent: "view",
        resourceId: "/tmp/book/pages/002.png",
        filePath: "/tmp/book/pages/002.png",
        mimeType: "image/png",
        payload: {
          kind: "chips.book-card",
          version: "1.0.0",
          cardType: "base.book",
          mode: "image-sequence",
          resources: {
            images: [
              { resourceId: "pages/001.png", relativePath: "pages/001.png", fileName: "001.png" },
              { resourceId: "pages/002.png", relativePath: "pages/002.png", fileName: "002.png" },
              { resourceId: "pages/003.png", relativePath: "pages/003.png", fileName: "003.png" },
            ],
          },
          display: { title: "图片书" },
        },
      },
    }));

    expect(target?.files).toHaveLength(3);
    expect(target?.initialIndex).toBe(1);
    expect(target?.files.map((file) => file.fileName)).toEqual(["001.png", "002.png", "003.png"]);
    expect(target?.title).toBe("图片书");
  });

  it("ebook / video / music 卡片 payload 使用顶层资源作为读取入口", () => {
    const ebookTarget = resolveLaunchViewerTarget(buildLaunchContext({
      resourceOpen: {
        intent: "view",
        resourceId: "/tmp/电子书.epub",
        filePath: "/tmp/电子书.epub",
        mimeType: "application/epub+zip",
        payload: {
          kind: "chips.book-card",
          version: "1.0.0",
          cardType: "base.book",
          mode: "ebook",
          resources: { book: { resourceId: "book.epub", relativePath: "book.epub" } },
        },
      },
    }));
    expect(ebookTarget?.files[0]).toMatchObject({ sourceId: "/tmp/电子书.epub" });

    const videoTarget = resolveLaunchViewerTarget(buildLaunchContext({
      resourceOpen: {
        intent: "view",
        resourceId: "/tmp/视频.mp4",
        filePath: "/tmp/视频.mp4",
        mimeType: "video/mp4",
        payload: {
          kind: "chips.video-card",
          version: "1.0.0",
          cardType: "base.video",
          resources: { video: { resourceId: "video.mp4", relativePath: "video.mp4" } },
        },
      },
    }));
    expect(videoTarget?.files[0]).toMatchObject({ sourceId: "/tmp/视频.mp4" });
  });

  it("无任何启动资源时返回 null（空态场景）", () => {
    expect(resolveLaunchViewerTarget(buildLaunchContext({}))).toBeNull();
    expect(resolveLaunchViewerTarget(buildLaunchContext({ resourceOpen: {} }))).toBeNull();
  });

  it("真实素材回归：测试视频.mp4 归一为播放目标", () => {
    const videoPath = resolve(testingSpaceRoot, "测试视频.mp4");
    const target = resolveLaunchViewerTarget(buildLaunchContext({
      trigger: "resource-open-service",
      targetPath: videoPath,
      resourceOpen: {
        intent: "view",
        resourceId: videoPath,
        filePath: videoPath,
        mimeType: "video/mp4",
        extension: ".mp4",
        fileName: "测试视频.mp4",
      },
    }));

    expect(target?.files[0]?.sourceId).toBe(videoPath);
    expect(target?.files[0]?.mimeType).toBe("video/mp4");
  });
});
