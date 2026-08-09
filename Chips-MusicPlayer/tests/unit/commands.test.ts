import { describe, expect, it } from "vitest";
import { appConfig } from "../../config/app-config";
import {
  createMusicPlayerCommands,
  MUSIC_PLAYER_COMMAND_IDS,
} from "../../src/commands/music-player-commands";

const noopHandlers = {
  openFiles: () => undefined,
  saveAudio: () => undefined,
  previousTrack: () => undefined,
  nextTrack: () => undefined,
  togglePlayback: () => undefined,
  rewind10: () => undefined,
  forward10: () => undefined,
  volumeUp: () => undefined,
  volumeDown: () => undefined,
  toggleMute: () => undefined,
  toggleLoop: () => undefined,
};

describe("music player commands", () => {
  it("uses stable app scoped command ids with Chinese titles", () => {
    const commands = createMusicPlayerCommands(noopHandlers, {
      hasTrack: false,
      canSave: false,
      canGoPrevious: false,
      canGoNext: false,
      isSaving: false,
    });

    expect(commands.length).toBeGreaterThanOrEqual(11);

    for (const command of commands) {
      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(command.title.length).toBeGreaterThan(0);
      expect(typeof command.run).toBe("function");
    }
  });

  it("enables only file actions when no track is loaded", () => {
    const commands = createMusicPlayerCommands(noopHandlers, {
      hasTrack: false,
      canSave: false,
      canGoPrevious: false,
      canGoNext: false,
      isSaving: false,
    });

    const open = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.openFiles);
    const save = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.saveAudio);
    const toggle = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.togglePlayback);

    expect(open?.enabled).not.toBe(false);
    expect(save?.enabled).toBe(false);
    expect(toggle?.enabled).toBe(false);
  });

  it("projects runtime state into command enabled flags", () => {
    const commands = createMusicPlayerCommands(noopHandlers, {
      hasTrack: true,
      canSave: true,
      canGoPrevious: false,
      canGoNext: true,
      isSaving: true,
    });

    const previous = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.previousTrack);
    const next = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.nextTrack);
    const save = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.saveAudio);
    const toggle = commands.find((command) => command.id === MUSIC_PLAYER_COMMAND_IDS.togglePlayback);

    expect(previous?.enabled).toBe(false);
    expect(next?.enabled).toBe(true);
    expect(save?.enabled).toBe(false);
    expect(toggle?.enabled).toBe(true);
  });
});
