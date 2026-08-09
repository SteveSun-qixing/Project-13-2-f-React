import { describe, expect, it } from "vitest";
import { createPlaylistEngine } from "../../src/engine/playlist-engine";

describe("playlist engine", () => {
  it("starts empty with nothing playing", () => {
    const engine = createPlaylistEngine<string>();

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it("setQueue replaces the queue and selects the first item by default", () => {
    const engine = createPlaylistEngine<string>();

    engine.setQueue(["a", "b", "c"]);

    expect(engine.current()).toBe("a");
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(true);
  });

  it("setQueue honors an explicit start index", () => {
    const engine = createPlaylistEngine<string>();

    engine.setQueue(["a", "b", "c"], 1);

    expect(engine.current()).toBe("b");
    expect(engine.canGoPrevious()).toBe(true);
    expect(engine.canGoNext()).toBe(true);

    engine.setQueue(["a", "b", "c"], 2);

    expect(engine.current()).toBe("c");
    expect(engine.canGoNext()).toBe(false);
  });

  it("setQueue with -1 leaves nothing playing", () => {
    const engine = createPlaylistEngine<string>();

    engine.setQueue(["a", "b", "c"], -1);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it("setQueue clamps out-of-range start indexes", () => {
    const engine = createPlaylistEngine<string>();

    engine.setQueue(["a", "b"], 99);
    expect(engine.current()).toBe("b");

    engine.setQueue(["a", "b"], -5);
    expect(engine.current()).toBeNull();
  });

  it("setQueue with an empty list leaves nothing playing", () => {
    const engine = createPlaylistEngine<string>();

    engine.setQueue(["a", "b"]);
    engine.setQueue([]);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it("goNext advances through the queue and stops at the end", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"]);

    engine.goNext();
    expect(engine.current()).toBe("b");

    engine.goNext();
    expect(engine.current()).toBe("c");

    engine.goNext();
    expect(engine.current()).toBe("d");
    expect(engine.canGoNext()).toBe(false);

    engine.goNext();
    expect(engine.current()).toBe("d");
  });

  it("goPrevious goes back and stops at the start", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"], 3);

    engine.goPrevious();
    expect(engine.current()).toBe("c");

    engine.goPrevious();
    expect(engine.current()).toBe("b");

    engine.goPrevious();
    expect(engine.current()).toBe("a");
    expect(engine.canGoPrevious()).toBe(false);

    engine.goPrevious();
    expect(engine.current()).toBe("a");
  });

  it("navigation is inert while nothing is playing", () => {
    const engine = createPlaylistEngine<string>();

    engine.goNext();
    engine.goPrevious();
    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);

    engine.setQueue(["a", "b"], -1);
    engine.goNext();
    engine.goPrevious();
    expect(engine.current()).toBeNull();
  });

  it("append extends the queue without changing the current track", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c"], 1);

    engine.append(["d", "e"]);

    expect(engine.current()).toBe("b");
    expect(engine.canGoNext()).toBe(true);

    engine.goNext();
    expect(engine.current()).toBe("c");
    engine.goNext();
    expect(engine.current()).toBe("d");
    engine.goNext();
    expect(engine.current()).toBe("e");
    expect(engine.canGoNext()).toBe(false);
  });

  it("append to an empty queue starts at the first appended item", () => {
    const engine = createPlaylistEngine<string>();

    engine.append(["a", "b"]);

    expect(engine.current()).toBe("a");
    expect(engine.canGoNext()).toBe(true);
  });

  it("append with no items is a no-op", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a"]);

    engine.append([]);

    expect(engine.current()).toBe("a");
    engine.goNext();
    expect(engine.current()).toBe("a");
  });

  it("removeAt before the current track keeps the current track selected", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"], 2);

    engine.removeAt(0);

    expect(engine.current()).toBe("c");
    expect(engine.canGoPrevious()).toBe(true);
    expect(engine.canGoNext()).toBe(true);
  });

  it("removeAt of the current track selects the following track", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"], 1);

    engine.removeAt(1);

    expect(engine.current()).toBe("c");

    engine.removeAt(1);

    expect(engine.current()).toBe("d");
  });

  it("removeAt of the last remaining track leaves nothing playing", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a"]);

    engine.removeAt(0);

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);
  });

  it("removeAt guards out-of-range indexes", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c"]);

    engine.removeAt(99);
    engine.removeAt(-1);
    engine.removeAt(3);

    expect(engine.current()).toBe("a");
    expect(engine.canGoNext()).toBe(true);
  });

  it("removeAt on an empty engine is a no-op", () => {
    const engine = createPlaylistEngine<string>();

    expect(() => engine.removeAt(0)).not.toThrow();
    expect(engine.current()).toBeNull();
  });

  it("move reorders the queue", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"], 1);

    engine.move(0, 3);

    expect(engine.current()).toBe("b");
    engine.goNext();
    expect(engine.current()).toBe("c");
    engine.goNext();
    expect(engine.current()).toBe("d");
    engine.goNext();
    expect(engine.current()).toBe("a");
    expect(engine.canGoNext()).toBe(false);
  });

  it("moving the current track keeps it selected", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c", "d"], 1);

    engine.move(1, 3);

    expect(engine.current()).toBe("b");
    expect(engine.canGoNext()).toBe(false);
    expect(engine.canGoPrevious()).toBe(true);

    engine.goPrevious();
    expect(engine.current()).toBe("d");
  });

  it("move guards out-of-range indexes", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c"]);

    engine.move(99, 0);
    engine.move(0, 99);
    engine.move(-1, 2);
    engine.move(2, -1);
    engine.move(1, 1);

    expect(engine.current()).toBe("a");
    engine.goNext();
    expect(engine.current()).toBe("b");
    engine.goNext();
    expect(engine.current()).toBe("c");
    expect(engine.canGoNext()).toBe(false);
  });

  it("clear resets the queue and selection", () => {
    const engine = createPlaylistEngine<string>();
    engine.setQueue(["a", "b", "c"], 1);

    engine.clear();

    expect(engine.current()).toBeNull();
    expect(engine.canGoPrevious()).toBe(false);
    expect(engine.canGoNext()).toBe(false);

    engine.append(["x"]);
    expect(engine.current()).toBe("x");
  });

  it("clear on an empty engine is safe", () => {
    const engine = createPlaylistEngine<string>();

    expect(() => engine.clear()).not.toThrow();
    expect(engine.current()).toBeNull();
  });
});
