// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandProvider, useCommandRegistry } from "@chips/ui";
import { BOOK_READER_COMMAND_IDS } from "../../src/commands/book-reader-commands";
import { useBookReaderCommands, type UseBookReaderCommandsResult } from "../../src/commands/useBookReaderCommands";
import type { ReaderPreferences } from "../../src/utils/book-reader";

const runtimeState = {
  hasBook: true,
  activePanel: null,
  hasCurrentBookmark: false,
  readingMode: "paginated" as ReaderPreferences["readingMode"],
  isBusy: false,
  canPreviousSection: true,
  canNextSection: true,
};

describe("useBookReaderCommands", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await React.act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("registers localized commands into the shared registry", async () => {
    let registeredCount = 0;
    const captured: { result: UseBookReaderCommandsResult | null } = { result: null };

    function RegistryProbe(): React.ReactElement | null {
      const { commands } = useCommandRegistry();
      registeredCount = commands.length;
      return null;
    }

    function Harness(): React.ReactElement | null {
      captured.result = useBookReaderCommands({ runtimeState });
      return <RegistryProbe />;
    }

    await React.act(async () => {
      root.render(
        <CommandProvider>
          <Harness />
        </CommandProvider>,
      );
    });

    expect(captured.result?.commands.length).toBeGreaterThanOrEqual(21);
    expect(registeredCount).toBeGreaterThanOrEqual(21);
  });

  it("dispatches invoked commands to the top registered handler with payload", async () => {
    const handler = vi.fn();
    let latest: UseBookReaderCommandsResult | null = null;

    function Harness(): React.ReactElement | null {
      latest = useBookReaderCommands({ runtimeState });
      React.useEffect(() => {
        return latest?.registerHandler("book-reader:source.open-url", handler);
      }, []);
      return null;
    }

    await React.act(async () => {
      root.render(
        <CommandProvider>
          <Harness />
        </CommandProvider>,
      );
    });

    await React.act(async () => {
      latest?.invokeCommand(BOOK_READER_COMMAND_IDS.openUrl, { url: "https://example.com/book.epub" });
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ url: "https://example.com/book.epub" });
  });

  it("does nothing when no handler is registered for a command", async () => {
    const handler = vi.fn();
    let latest: UseBookReaderCommandsResult | null = null;

    function Harness(): React.ReactElement | null {
      latest = useBookReaderCommands({ runtimeState });
      return null;
    }

    await React.act(async () => {
      root.render(
        <CommandProvider>
          <Harness />
        </CommandProvider>,
      );
    });

    await React.act(async () => {
      latest?.invokeCommand(BOOK_READER_COMMAND_IDS.toggleContents);
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("unregisters handlers on cleanup so stale commands are not dispatched", async () => {
    const handler = vi.fn();
    let latest: UseBookReaderCommandsResult | null = null;

    function Harness(): React.ReactElement | null {
      latest = useBookReaderCommands({ runtimeState });
      React.useEffect(() => {
        return latest?.registerHandler("book-reader:view.toggle-contents", handler);
      }, []);
      return null;
    }

    await React.act(async () => {
      root.render(
        <CommandProvider>
          <Harness />
        </CommandProvider>,
      );
    });

    await React.act(async () => {
      root.unmount();
    });

    await React.act(async () => {
      latest?.invokeCommand(BOOK_READER_COMMAND_IDS.toggleContents);
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
