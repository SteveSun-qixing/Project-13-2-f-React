import { describe, expect, it } from "vitest";
import {
  defaultSceneDefinition,
  getSceneDefinition,
  isAppSceneId,
  sceneDefinitions,
  type AppSceneId,
} from "../../src/app/scene-registry";
import {
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommands,
} from "../../src/commands/app-commands";

/** Office 四件套对应的场景 id：Word 编辑、PDF/Office 文档查看、幻灯片编辑、表格编辑。 */
const OFFICE_SCENE_IDS: AppSceneId[] = ["word-editor", "document", "slide", "sheet"];

/** 场景 id 到场景组件模块的映射，动态 import() 成功即视为组件可懒加载。 */
const SCENE_COMPONENT_LOADERS: Record<AppSceneId, () => Promise<unknown>> = {
  main: () => import("../../src/scenes/MainScene"),
  "word-editor": () => import("../../src/scenes/WordEditorScene"),
  document: () => import("../../src/scenes/DocumentScene"),
  slide: () => import("../../src/app/SlideScene"),
  sheet: () => import("../../src/apps/sheet/SheetScene"),
  settings: () => import("../../src/scenes/SettingsScene"),
};

/** 应用命令 handler 到其目标场景的映射（与 AppShell 命令分发逻辑保持一致）。 */
const COMMAND_TARGET_SCENES: Record<string, AppSceneId> = {
  [APP_COMMAND_HANDLER_IDS.openWorkspace]: "main",
  [APP_COMMAND_HANDLER_IDS.openSettings]: "settings",
  [APP_COMMAND_HANDLER_IDS.openDocument]: "document",
};

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

describe("应用场景注册表契约", () => {
  it("应注册 Office 四件套场景以及应用骨架场景", () => {
    const sceneIds = sceneDefinitions.map((scene) => scene.id);

    expect(sceneIds).toEqual([
      "main",
      "word-editor",
      "document",
      "slide",
      "sheet",
      "settings",
    ]);
    expect(new Set(sceneIds).size).toBe(sceneIds.length);

    for (const officeSceneId of OFFICE_SCENE_IDS) {
      expect(
        sceneDefinitions.some((scene) => scene.id === officeSceneId),
        `Office 场景 ${officeSceneId} 应在注册表中`,
      ).toBe(true);
    }
    expect(defaultSceneDefinition?.id).toBe("main");
  });

  it("每个场景定义的字段应完整且标题为简体中文", () => {
    expect(sceneDefinitions.length).toBeGreaterThan(0);

    for (const scene of sceneDefinitions) {
      expect(scene.id.trim().length, `场景 ${scene.id} 的 id 不应为空`).toBeGreaterThan(0);
      expect(
        scene.title.trim().length,
        `场景 ${scene.id} 的标题不应为空`,
      ).toBeGreaterThan(0);
      expect(
        scene.description.trim().length,
        `场景 ${scene.id} 的描述不应为空`,
      ).toBeGreaterThan(0);
      expect(
        containsChinese(scene.title),
        `场景 ${scene.id} 的标题应为简体中文，实际为「${scene.title}」`,
      ).toBe(true);
      expect(
        containsChinese(scene.description),
        `场景 ${scene.id} 的描述应为简体中文，实际为「${scene.description}」`,
      ).toBe(true);
      expect(scene.title, `场景 ${scene.id} 的标题不应直接使用 id`).not.toBe(scene.id);
    }
  });

  it("场景查找与兜底行为应正确", () => {
    expect(isAppSceneId("main")).toBe(true);
    expect(isAppSceneId("sheet")).toBe(true);
    expect(isAppSceneId("not-existed-scene")).toBe(false);

    expect(getSceneDefinition("slide").id).toBe("slide");
    expect(getSceneDefinition("word-editor").title).toBe("Word 编辑器");
    expect(getSceneDefinition("document").title).toBe("文档查看");

    expect(getSceneDefinition(null)).toBe(defaultSceneDefinition);
    expect(getSceneDefinition(undefined)).toBe(defaultSceneDefinition);
    expect(getSceneDefinition("")).toBe(defaultSceneDefinition);
    expect(getSceneDefinition("not-existed-scene").id).toBe("main");
  });

  it("每个注册场景的组件都应能通过动态 import 加载并导出可渲染组件", async () => {
    const registryIds = sceneDefinitions.map((scene) => scene.id);

    expect(
      Object.keys(SCENE_COMPONENT_LOADERS).sort(),
      "懒加载映射应覆盖注册表中的全部场景",
    ).toEqual([...registryIds].sort());

    for (const sceneId of registryIds) {
      const loader = SCENE_COMPONENT_LOADERS[sceneId];
      const sceneModule = (await loader()) as Record<string, unknown>;

      const componentExports = Object.values(sceneModule).filter(
        (value) => typeof value === "function",
      );
      expect(
        componentExports.length,
        `场景 ${sceneId} 的组件模块应至少导出一个可渲染组件`,
      ).toBeGreaterThan(0);
    }
  });

  it("应用命令注册应与场景定义匹配", () => {
    expect(appCommandDefinitions.length).toBeGreaterThan(0);

    const commandIds = appCommandDefinitions.map((definition) => definition.commandId);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);

    expect(new Set(commandIds).size).toBe(commandIds.length);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
    expect([...commandIds].sort()).toEqual([...Object.values(APP_COMMAND_IDS)].sort());

    for (const definition of appCommandDefinitions) {
      expect(
        definition.commandId.startsWith(`${APP_PLUGIN_ID}.`),
        `命令 ${definition.commandId} 应以应用插件 id 为前缀`,
      ).toBe(true);
      expect(
        Object.values(APP_COMMAND_HANDLER_IDS),
        `命令 ${definition.commandId} 的 handler 应在应用 handler 表中注册`,
      ).toContain(definition.handlerId);
      expect(
        containsChinese(definition.titleKey),
        `命令 ${definition.commandId} 的标题应为简体中文`,
      ).toBe(true);
    }

    for (const [handlerId, targetSceneId] of Object.entries(COMMAND_TARGET_SCENES)) {
      expect(
        handlerIds,
        `handler ${handlerId} 应有对应的命令定义`,
      ).toContain(handlerId);
      expect(
        isAppSceneId(targetSceneId),
        `命令 ${handlerId} 的目标场景 ${targetSceneId} 应是注册表中的场景`,
      ).toBe(true);
    }

    const commands = createAppCommands({
      openWorkspace: () => {},
      openSettings: () => {},
      openDocument: () => {},
    });
    expect(commands.length).toBe(appCommandDefinitions.length);
    for (const command of commands) {
      expect(Object.values(APP_COMMAND_IDS)).toContain(command.id);
      expect(typeof command.run).toBe("function");
      expect(containsChinese(command.title), `命令 ${command.id} 标题应为简体中文`).toBe(true);
    }
  });
});
