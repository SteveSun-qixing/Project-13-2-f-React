import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UniversalViewerStage } from "../../src/components/UniversalViewerStage";
import { formatMessage } from "../../src/lib/messages";

describe("UniversalViewerStage", () => {
  it("空态渲染打开引导与拖拽提示", () => {
    const markup = renderToStaticMarkup(
      <UniversalViewerStage
        loadedFiles={[]}
        initialIndex={0}
        isLoading={false}
        feedback={null}
        toolbarContext={null}
        onToolbarContext={() => undefined}
        onOpenFile={() => undefined}
        onReload={() => undefined}
        onSaveCopy={() => undefined}
        onDropFile={() => undefined}
      />,
    );

    expect(markup).toContain(formatMessage("universal-viewer.scenes.empty.title"));
    expect(markup).toContain(formatMessage("universal-viewer.scenes.empty.hint"));
    expect(markup).toContain(formatMessage("universal-viewer.commands.openFile.title"));
  });

  it("加载中渲染状态提示", () => {
    const markup = renderToStaticMarkup(
      <UniversalViewerStage
        loadedFiles={[]}
        initialIndex={0}
        isLoading={true}
        feedback={null}
        toolbarContext={null}
        onToolbarContext={() => undefined}
        onOpenFile={() => undefined}
        onReload={() => undefined}
        onSaveCopy={() => undefined}
        onDropFile={() => undefined}
      />,
    );

    expect(markup).toContain(formatMessage("universal-viewer.stage.loading"));
  });

  it("反馈消息按语气渲染", () => {
    const markup = renderToStaticMarkup(
      <UniversalViewerStage
        loadedFiles={[]}
        initialIndex={0}
        isLoading={false}
        feedback={{ tone: "error", message: "预览失败提示" }}
        toolbarContext={null}
        onToolbarContext={() => undefined}
        onOpenFile={() => undefined}
        onReload={() => undefined}
        onSaveCopy={() => undefined}
        onDropFile={() => undefined}
      />,
    );

    expect(markup).toContain("universal-viewer-stage__feedback--error");
    expect(markup).toContain("预览失败提示");
  });
});
