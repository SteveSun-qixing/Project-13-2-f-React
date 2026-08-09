import { describe, expect, it } from "vitest";
import {
  BOOK_READER_COMMAND_IDS,
  createBookReaderCommands,
  type BookReaderCommandRuntimeState,
} from "../../src/commands/book-reader-commands";
import { appConfig } from "../../config/app-config";

const noopDispatch = () => undefined;

const baseState: BookReaderCommandRuntimeState = {
  hasBook: false,
  activePanel: null,
  hasCurrentBookmark: false,
  readingMode: "paginated",
  isBusy: false,
  canPreviousSection: false,
  canNextSection: false,
};

describe("BookReader commands", () => {
  it("defines app scoped command metadata with Chinese titles", () => {
    const commands = createBookReaderCommands(noopDispatch, baseState);

    expect(commands.length).toBeGreaterThanOrEqual(21);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("enables only source commands when no book is loaded", () => {
    const commands = createBookReaderCommands(noopDispatch, baseState);
    const byId = new Map(commands.map((command) => [command.id, command]));

    expect(byId.get(BOOK_READER_COMMAND_IDS.openSourcePanel)?.enabled).not.toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.openFile)?.enabled).not.toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.toggleContents)?.enabled).toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.toggleSearch)?.enabled).toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.previousPage)?.enabled).toBe(false);
  });

  it("projects runtime state into command enabled flags", () => {
    const commands = createBookReaderCommands(noopDispatch, {
      ...baseState,
      hasBook: true,
      hasCurrentBookmark: true,
      activePanel: "contents",
      readingMode: "scroll",
      canPreviousSection: false,
      canNextSection: true,
    });
    const byId = new Map(commands.map((command) => [command.id, command]));

    expect(byId.get(BOOK_READER_COMMAND_IDS.toggleContents)?.enabled).toBe(true);
    expect(byId.get(BOOK_READER_COMMAND_IDS.closePanel)?.enabled).toBe(true);
    expect(byId.get(BOOK_READER_COMMAND_IDS.toggleBookmark)?.enabled).toBe(true);
    expect(byId.get(BOOK_READER_COMMAND_IDS.previousSection)?.enabled).toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.nextSection)?.enabled).toBe(true);
  });

  it("marks reader commands busy while the book is resolving", () => {
    const commands = createBookReaderCommands(noopDispatch, {
      ...baseState,
      isBusy: true,
    });
    const byId = new Map(commands.map((command) => [command.id, command]));

    expect(byId.get(BOOK_READER_COMMAND_IDS.openSourcePanel)?.enabled).toBe(false);
    expect(byId.get(BOOK_READER_COMMAND_IDS.openFile)?.enabled).toBe(false);
  });
});
