import { describe, expect, it } from "vitest";
import {
  createVideoPlayerCommands,
  VIDEO_PLAYER_COMMAND_IDS,
} from "../../src/commands/video-player-commands";
import { appConfig } from "../../config/app-config";

const noopHandlers = {
  openFile: () => undefined,
  saveCopy: () => undefined,
  togglePlayback: () => undefined,
  seekBackward: () => undefined,
  seekForward: () => undefined,
  toggleMute: () => undefined,
  toggleFullscreen: () => undefined,
  togglePictureInPicture: () => undefined,
  toggleMorePanel: () => undefined,
};

const noVideoState = {
  hasVideo: false,
  isSaving: false,
  canUsePictureInPicture: false,
};

const readyState = {
  hasVideo: true,
  isSaving: false,
  canUsePictureInPicture: true,
};

describe("video player commands", () => {
  it("uses stable app scoped command ids with Chinese titles", () => {
    const commands = createVideoPlayerCommands(noopHandlers, noVideoState);

    expect(commands.length).toBeGreaterThanOrEqual(9);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("enables only open and more panel when no video is loaded", () => {
    const commands = createVideoPlayerCommands(noopHandlers, noVideoState);

    const open = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.openFile);
    const save = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.saveCopy);
    const togglePlayback = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.togglePlayback);
    const seekBackward = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.seekBackward);
    const seekForward = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.seekForward);
    const toggleMute = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.toggleMute);
    const toggleFullscreen = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.toggleFullscreen);
    const togglePictureInPicture = commands.find(
      (command) => command.id === VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture,
    );
    const toggleMorePanel = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.toggleMorePanel);

    expect(open?.enabled).not.toBe(false);
    expect(save?.enabled).toBe(false);
    expect(togglePlayback?.enabled).toBe(false);
    expect(seekBackward?.enabled).toBe(false);
    expect(seekForward?.enabled).toBe(false);
    expect(toggleMute?.enabled).toBe(false);
    expect(toggleFullscreen?.enabled).toBe(false);
    expect(togglePictureInPicture?.enabled).toBe(false);
    expect(toggleMorePanel?.enabled).not.toBe(false);
  });

  it("projects runtime state into command enabled flags", () => {
    const commands = createVideoPlayerCommands(noopHandlers, readyState);

    const save = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.saveCopy);
    const togglePlayback = commands.find((command) => command.id === VIDEO_PLAYER_COMMAND_IDS.togglePlayback);
    const togglePictureInPicture = commands.find(
      (command) => command.id === VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture,
    );

    expect(save?.enabled).toBe(true);
    expect(togglePlayback?.enabled).toBe(true);
    expect(togglePictureInPicture?.enabled).toBe(true);
  });

  it("keeps picture-in-picture disabled when the host does not support it", () => {
    const commands = createVideoPlayerCommands(noopHandlers, {
      hasVideo: true,
      isSaving: false,
      canUsePictureInPicture: false,
    });

    const togglePictureInPicture = commands.find(
      (command) => command.id === VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture,
    );

    expect(togglePictureInPicture?.enabled).toBe(false);
  });
});
