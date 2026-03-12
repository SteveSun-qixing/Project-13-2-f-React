import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSaveScheduler } from "../../src/domains/editor/editor-save-scheduler";

describe("editor-save-scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces writes and only saves the latest config", async () => {
    vi.useFakeTimers();
    const savedTitles: string[] = [];
    const scheduler = createEditorSaveScheduler({
      delayMs: 420,
      save: async (request) => {
        savedTitles.push(String(request.config.title));
        return request.nodeId;
      },
    });

    scheduler.schedule({
      nodeId: "intro",
      config: { title: "First" },
    });
    scheduler.schedule({
      nodeId: "intro",
      config: { title: "Second" },
    });

    await vi.advanceTimersByTimeAsync(419);
    expect(savedTitles).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(savedTitles).toEqual(["Second"]);
  });

  it("flushes pending work immediately", async () => {
    vi.useFakeTimers();
    const savedTitles: string[] = [];
    const scheduler = createEditorSaveScheduler({
      delayMs: 420,
      save: async (request) => {
        savedTitles.push(String(request.config.title));
        return request.nodeId;
      },
    });

    scheduler.schedule({
      nodeId: "intro",
      config: { title: "Flush Now" },
    });

    await scheduler.flush();
    expect(savedTitles).toEqual(["Flush Now"]);
  });

  it("serializes in-flight saves and replays the queued latest request", async () => {
    vi.useFakeTimers();
    const completionOrder: string[] = [];
    let releaseFirstSave: (() => void) | null = null;
    const scheduler = createEditorSaveScheduler({
      delayMs: 100,
      save: (request) =>
        new Promise<string>((resolve) => {
          if (request.config.title === "First") {
            releaseFirstSave = () => {
              completionOrder.push("First");
              resolve(request.nodeId);
            };
            return;
          }
          completionOrder.push(String(request.config.title));
          resolve(request.nodeId);
        }),
    });

    scheduler.schedule({
      nodeId: "intro",
      config: { title: "First" },
    });

    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule({
      nodeId: "intro",
      config: { title: "Second" },
    });
    scheduler.schedule({
      nodeId: "intro",
      config: { title: "Third" },
    });

    releaseFirstSave?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    expect(completionOrder).toEqual(["First", "Third"]);
  });
});
