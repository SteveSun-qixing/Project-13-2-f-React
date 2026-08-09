import { describe, expect, it, vi } from "vitest";
import {
  createPhotoViewerCommands,
  PHOTO_VIEWER_COMMAND_IDS,
  type PhotoViewerCommandHandlers,
} from "../../src/commands/photo-viewer-commands";
import { appConfig } from "../../config/app-config";

const noopHandlers = {
  openFile: () => undefined,
  saveImage: () => undefined,
  previousImage: () => undefined,
  nextImage: () => undefined,
  zoomOut: () => undefined,
  zoomIn: () => undefined,
  fitToWindow: () => undefined,
  actualSize: () => undefined,
};

function createFullHandlers(): PhotoViewerCommandHandlers {
  return {
    ...noopHandlers,
    fullscreen: vi.fn(),
    rotateClockwise: vi.fn(),
    rotateCounterclockwise: vi.fn(),
    showInfo: vi.fn(),
    copyImage: vi.fn(),
    firstImage: vi.fn(),
    lastImage: vi.fn(),
  };
}

describe("photo viewer commands", () => {
  it("uses stable app scoped command ids with Chinese titles", () => {
    const commands = createPhotoViewerCommands(noopHandlers, {
      hasImage: false,
      isImageLoaded: false,
      isSaving: false,
      canPreviousImage: false,
      canNextImage: false,
    });

    expect(commands.length).toBeGreaterThanOrEqual(8);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("enables only open when no image is loaded", () => {
    const commands = createPhotoViewerCommands(noopHandlers, {
      hasImage: false,
      isImageLoaded: false,
      isSaving: false,
      canPreviousImage: false,
      canNextImage: false,
    });

    const open = commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.openFile);
    const save = commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.saveImage);
    const zoomIn = commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.zoomIn);

    expect(open?.enabled).not.toBe(false);
    expect(save?.enabled).toBe(false);
    expect(zoomIn?.enabled).toBe(false);
  });

  it("projects runtime state into command enabled flags", () => {
    const commands = createPhotoViewerCommands(noopHandlers, {
      hasImage: true,
      isImageLoaded: true,
      isSaving: false,
      canPreviousImage: true,
      canNextImage: false,
    });

    const previous = commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.previousImage);
    const next = commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.nextImage);

    expect(previous?.enabled).toBe(true);
    expect(next?.enabled).toBe(false);
  });

  it("registers new viewer commands with app-scoped ids and wired run handlers", () => {
    const handlers = createFullHandlers();
    const commands = createPhotoViewerCommands(handlers, {
      hasImage: true,
      isImageLoaded: true,
      isSaving: false,
      canPreviousImage: true,
      canNextImage: true,
      canFirst: true,
      canLast: true,
    });

    const newCommandIds = [
      PHOTO_VIEWER_COMMAND_IDS.fullscreen,
      PHOTO_VIEWER_COMMAND_IDS.rotateClockwise,
      PHOTO_VIEWER_COMMAND_IDS.rotateCounterclockwise,
      PHOTO_VIEWER_COMMAND_IDS.showInfo,
      PHOTO_VIEWER_COMMAND_IDS.copyImage,
      PHOTO_VIEWER_COMMAND_IDS.firstImage,
      PHOTO_VIEWER_COMMAND_IDS.lastImage,
    ];

    for (const id of newCommandIds) {
      const command = commands.find((item) => item.id === id);
      expect(command, `command ${id} should exist`).toBeDefined();
      expect(command?.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command?.title.length).toBeGreaterThan(0);
      expect(typeof command?.run).toBe("function");
    }

    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.fullscreen)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.rotateClockwise)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.rotateCounterclockwise)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.showInfo)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.copyImage)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.firstImage)?.run();
    commands.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.lastImage)?.run();

    expect(handlers.fullscreen).toHaveBeenCalledTimes(1);
    expect(handlers.rotateClockwise).toHaveBeenCalledTimes(1);
    expect(handlers.rotateCounterclockwise).toHaveBeenCalledTimes(1);
    expect(handlers.showInfo).toHaveBeenCalledTimes(1);
    expect(handlers.copyImage).toHaveBeenCalledTimes(1);
    expect(handlers.firstImage).toHaveBeenCalledTimes(1);
    expect(handlers.lastImage).toHaveBeenCalledTimes(1);
  });

  it("enables new viewer commands only when an image is present", () => {
    const handlers = createFullHandlers();
    const stateWithImage = {
      hasImage: true,
      isImageLoaded: true,
      isSaving: false,
      canPreviousImage: true,
      canNextImage: true,
      canFirst: true,
      canLast: true,
    };

    const withImage = createPhotoViewerCommands(handlers, stateWithImage);
    const withoutImage = createPhotoViewerCommands(handlers, {
      hasImage: false,
      isImageLoaded: false,
      isSaving: false,
      canPreviousImage: false,
      canNextImage: false,
      canFirst: false,
      canLast: false,
    });

    for (const id of [
      PHOTO_VIEWER_COMMAND_IDS.fullscreen,
      PHOTO_VIEWER_COMMAND_IDS.rotateClockwise,
      PHOTO_VIEWER_COMMAND_IDS.rotateCounterclockwise,
      PHOTO_VIEWER_COMMAND_IDS.showInfo,
      PHOTO_VIEWER_COMMAND_IDS.copyImage,
    ]) {
      expect(withImage.find((command) => command.id === id)?.enabled).toBe(true);
      expect(withoutImage.find((command) => command.id === id)?.enabled).toBe(false);
    }

    expect(withImage.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.firstImage)?.enabled).toBe(true);
    expect(withImage.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.lastImage)?.enabled).toBe(true);

    const atFirstImage = createPhotoViewerCommands(handlers, {
      hasImage: true,
      isImageLoaded: true,
      isSaving: false,
      canPreviousImage: false,
      canNextImage: true,
      canFirst: false,
      canLast: true,
    });
    expect(atFirstImage.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.firstImage)?.enabled).toBe(false);
    expect(atFirstImage.find((command) => command.id === PHOTO_VIEWER_COMMAND_IDS.lastImage)?.enabled).toBe(true);
  });
});
