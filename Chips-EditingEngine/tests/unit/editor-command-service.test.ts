import { describe, expect, it } from "vitest";
import {
  applyConfigChange,
  canRedo,
  canUndo,
  createBaseCardEditSession,
  currentEditorConfig,
  markSaveFailed,
  markSaveInFlight,
  markSaveSucceeded,
  redoConfigChange,
  undoConfigChange,
} from "../../src/domains/editor/editor-command-service";

describe("editor-command-service", () => {
  const selectedNode = {
    nodeId: "intro",
    cardType: "RichTextCard",
    pluginId: "chips.basecard.richtext",
    title: "Intro",
  };

  const baseCard = {
    nodeId: "intro",
    cardType: "RichTextCard",
    pluginId: "chips.basecard.richtext",
    title: "Intro",
    contentPath: "intro.yaml",
    config: {
      id: "intro",
      title: "Intro",
      body: "<p>Hello</p>",
      locale: "zh-CN",
    },
  };

  it("creates a clean initial edit session", () => {
    const session = createBaseCardEditSession(selectedNode, baseCard);
    expect(session.dirty).toBe(false);
    expect(session.saveState).toBe("idle");
    expect(session.historyLimit).toBe(100);
    expect(session.lastCommand.kind).toBe("initialize");
    expect(session.history.past).toEqual([]);
    expect(session.history.present).toEqual(baseCard.config);
    expect(currentEditorConfig(session)).toEqual(baseCard.config);
  });

  it("applies config changes and supports undo/redo", () => {
    const session = createBaseCardEditSession(selectedNode, baseCard);
    const changed = applyConfigChange(session, {
      ...baseCard.config,
      title: "Updated Intro",
    });

    expect(changed.dirty).toBe(true);
    expect(changed.saveState).toBe("pending");
    expect(changed.lastCommand.kind).toBe("change");
    expect(canUndo(changed)).toBe(true);
    expect(canRedo(changed)).toBe(false);
    expect(changed.history.present?.title).toBe("Updated Intro");

    const undone = undoConfigChange(changed);
    expect(undone.history.present?.title).toBe("Intro");
    expect(undone.lastCommand.kind).toBe("undo");
    expect(canRedo(undone)).toBe(true);

    const redone = redoConfigChange(undone);
    expect(redone.history.present?.title).toBe("Updated Intro");
    expect(redone.lastCommand.kind).toBe("redo");
  });

  it("marks save state transitions and keeps dirty state if newer edits exist", () => {
    const session = createBaseCardEditSession(selectedNode, baseCard);
    const changed = applyConfigChange(session, {
      ...baseCard.config,
      title: "Updated Intro",
    });
    const saving = markSaveInFlight(changed);
    const editedAgain = applyConfigChange(saving, {
      ...baseCard.config,
      title: "Updated Intro",
      body: "<p>Hello again</p>",
    });

    const saved = markSaveSucceeded(editedAgain, {
      ...baseCard,
      title: "Updated Intro",
      config: {
        ...baseCard.config,
        title: "Updated Intro",
      },
    });

    expect(saved.lastSavedConfig.title).toBe("Updated Intro");
    expect(saved.history.present?.body).toBe("<p>Hello again</p>");
    expect(saved.dirty).toBe(true);
    expect(saved.saveState).toBe("pending");
    expect(saved.lastCommand.kind).toBe("sync");
  });

  it("stores save failures without losing current edits", () => {
    const session = createBaseCardEditSession(selectedNode, baseCard);
    const changed = applyConfigChange(session, {
      ...baseCard.config,
      title: "Broken Save",
    });
    const failed = markSaveFailed(changed, "save failed");
    expect(failed.error).toBe("save failed");
    expect(failed.saveState).toBe("error");
    expect(failed.history.present?.title).toBe("Broken Save");
  });

  it("caps history depth at the configured limit", () => {
    let session = createBaseCardEditSession(selectedNode, baseCard);

    for (let index = 0; index < 140; index += 1) {
      session = applyConfigChange(session, {
        ...baseCard.config,
        title: `Intro ${index}`,
      });
    }

    expect(session.history.past).toHaveLength(100);
    expect(session.history.past[0]?.title).toBe("Intro 39");
    expect(session.history.present?.title).toBe("Intro 139");
  });
});
