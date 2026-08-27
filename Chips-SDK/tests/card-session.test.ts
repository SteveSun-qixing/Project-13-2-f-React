import { describe, it, expect, vi } from "vitest";
import { createCardApi } from "../src/api/card";
import type { CoreClient } from "../src/types/client";

function createStubClient(invokeImpl: CoreClient["invoke"]): CoreClient {
  return {
    clientConfig: {},
    invoke: invokeImpl,
    events: {
      on: () => () => {},
      once: () => {},
      emit: async () => {},
    },
  };
}

const SNAPSHOT = {
  cardId: "card-1",
  path: "/tmp/card-1.card",
  metadata: { name: "测试", createdAt: "2026-01-01", modifiedAt: "2026-01-01" },
  cover: { html: "<html></html>", ratio: "3:4", resources: [] },
  structure: { layout: {}, basicCards: [] },
  isDirty: false,
  isPersisting: false,
  persistedRevision: 0,
};

describe("card.session API 封装测试", () => {
  it("init 调用 card.init 并返回会话", async () => {
    const client = createStubClient(async (action, payload) => {
      expect(action).toBe("card.init");
      expect(payload).toEqual({ parentPath: "/tmp", name: "新卡片", initialBasicCard: undefined });
      return { cardDir: "/tmp/card-1.card", cardId: "card-1", sessionId: "s1", snapshot: SNAPSHOT };
    });
    const api = createCardApi(client);
    const result = await api.session.init("/tmp", "新卡片");
    expect(result.sessionId).toBe("s1");
    expect(result.snapshot.metadata.name).toBe("测试");
  });

  it("open/get/persist/close 走会话动作", async () => {
    const calls: string[] = [];
    const client = createStubClient(async (action) => {
      calls.push(action);
      if (action === "card.session.open") {
        return { sessionId: "s1", snapshot: SNAPSHOT };
      }
      if (action === "card.session.get" || action === "card.session.persist") {
        return { snapshot: SNAPSHOT };
      }
      if (action === "card.session.close") {
        return { ack: true };
      }
      return {};
    });
    const api = createCardApi(client);

    await api.session.open("/tmp/card-1.card");
    await api.session.get("s1");
    await api.session.persist("s1");
    await api.session.close("s1");
    expect(calls).toEqual([
      "card.session.open",
      "card.session.get",
      "card.session.persist",
      "card.session.close",
    ]);
  });

  it("updateBasicCard 传递资源操作字节", async () => {
    const client = createStubClient(async (action, payload) => {
      expect(action).toBe("card.session.updateBasicCard");
      const ops = (payload as { resourceOperations: { imports: Array<{ data: Uint8Array }> } }).resourceOperations;
      expect(ops.imports[0].data).toEqual(new Uint8Array([1, 2, 3]));
      return { snapshot: SNAPSHOT };
    });
    const api = createCardApi(client);
    await api.session.updateBasicCard(
      "s1",
      "bc1",
      { content: "x" },
      { imports: [{ path: "a.png", data: new Uint8Array([1, 2, 3]) }] },
    );
  });

  it("undo/redo/history 走会话动作", async () => {
    const calls: string[] = [];
    const client = createStubClient(async (action) => {
      calls.push(action);
      if (action === "card.session.history") {
        return { history: { undoAvailable: true, redoAvailable: false, undoStack: [], redoStack: [] } };
      }
      return { snapshot: SNAPSHOT };
    });
    const api = createCardApi(client);
    await api.session.undo("s1");
    await api.session.redo("s1");
    const history = await api.session.history("s1");
    expect(history.undoAvailable).toBe(true);
    expect(calls).toEqual(["card.session.undo", "card.session.redo", "card.session.history"]);
  });

  it("事件订阅注册到 client.events.on", async () => {
    const subscriptions: string[] = [];
    const client: CoreClient = {
      clientConfig: {},
      invoke: async () => ({}),
      events: {
        on: (event: string) => {
          subscriptions.push(event);
          return () => {};
        },
        once: () => {},
        emit: async () => {},
      },
    };
    const api = createCardApi(client);
    api.session.onOpened(() => {});
    api.session.onPersisted(() => {});
    api.session.onPersistError(() => {});
    api.session.onClosed(() => {});
    api.session.onUndo(() => {});
    api.session.onRedo(() => {});
    expect(subscriptions).toEqual([
      "card.session.opened",
      "card.session.persisted",
      "card.session.persist-error",
      "card.session.closed",
      "card.session.undo",
      "card.session.redo",
    ]);
  });

  it("入参校验缺失参数抛 INVALID_ARGUMENT", async () => {
    const client = createStubClient(async () => ({}));
    const api = createCardApi(client);
    await expect(api.session.open("")).rejects.toThrow();
    await expect(api.session.persist("")).rejects.toThrow();
    await expect(api.session.updateMetadata("", {})).rejects.toThrow();
    await expect(api.session.updateCover("", { html: "" })).rejects.toThrow();
  });
});
