import { describe, expect, it } from "vitest";
import { AppRuntimeProvider, createRuntimeDiagnostic } from "../../src/app/AppRuntimeProvider";
import { OFFICE_SCENE_IDS, getSceneIdForDocumentType, officeScenes } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import { createAppMockClient } from "../../src/testing/mock-environment";
import { renderWithAntd } from "../../src/testing/render-with-antd";

describe("薯片办公应用壳层", () => {
  it("AppRuntimeProvider 应为可用组件", () => {
    expect(AppRuntimeProvider).toBeTypeOf("function");
  });

  it("应通过本地中文文案表解析文案与参数插值", () => {
    expect(formatMessage("app.identity.displayName")).toBe("薯片办公");
    expect(formatMessage("office.start.open")).toBe("打开文档");
    expect(formatMessage("office.missing.key")).toBe("office.missing.key");
  });

  it("应提供五场景注册表与类型到场景的映射", () => {
    expect(officeScenes.map((scene) => scene.id)).toEqual([
      OFFICE_SCENE_IDS.start,
      OFFICE_SCENE_IDS.word,
      OFFICE_SCENE_IDS.sheet,
      OFFICE_SCENE_IDS.slide,
      OFFICE_SCENE_IDS.pdf,
    ]);
    expect(getSceneIdForDocumentType("word")).toBe(OFFICE_SCENE_IDS.word);
    expect(getSceneIdForDocumentType("sheet")).toBe(OFFICE_SCENE_IDS.sheet);
    expect(getSceneIdForDocumentType("slide")).toBe(OFFICE_SCENE_IDS.slide);
    expect(getSceneIdForDocumentType("pdf")).toBe(OFFICE_SCENE_IDS.pdf);
    expect(getSceneIdForDocumentType("image")).toBe(OFFICE_SCENE_IDS.start);
    expect(getSceneIdForDocumentType(null)).toBe(OFFICE_SCENE_IDS.start);
  });

  it("mock 客户端应携带办公插件全部权限", () => {
    const client = createAppMockClient();
    expect(client.state.permissions).toContain("file.read");
    expect(client.state.permissions).toContain("file.write");
    expect(client.state.permissions).toContain("office.read");
    expect(client.state.permissions).toContain("office.write");
    expect(client.state.launchContext.sceneId).toBe("office.scene.start");
  });

  it("Provider 树应在 mock 环境下构造成功", () => {
    const rendered = renderWithAntd(<div>start-placeholder</div>);
    expect(rendered.element).toBeTruthy();
    expect(rendered.client.state.launchContext.surfaceContext?.sceneId).toBe("office.scene.start");
  });

  it("createRuntimeDiagnostic 应保留编号、文案与来源", () => {
    const diagnostic = createRuntimeDiagnostic("OFFICE_TEST", "测试诊断", "test-source", { a: 1 });
    expect(diagnostic.code).toBe("OFFICE_TEST");
    expect(diagnostic.message).toBe("测试诊断");
    expect(diagnostic.source).toBe("test-source");
    expect(diagnostic.details).toEqual({ a: 1 });
  });
});
