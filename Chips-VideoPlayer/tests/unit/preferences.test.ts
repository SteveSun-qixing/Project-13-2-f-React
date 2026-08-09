// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PREFERENCES,
  readVideoPlayerPreferences,
  writeVideoPlayerPreferences,
} from "../../src/utils/preferences";

describe("video player preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时返回默认值", () => {
    expect(readVideoPlayerPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("写入并读取偏好", () => {
    writeVideoPlayerPreferences({ volume: 0.5, muted: true, playbackRate: 1.5, loop: true, subtitleIndex: 2 });
    const prefs = readVideoPlayerPreferences();
    expect(prefs.volume).toBe(0.5);
    expect(prefs.muted).toBe(true);
    expect(prefs.playbackRate).toBe(1.5);
    expect(prefs.loop).toBe(true);
    expect(prefs.subtitleIndex).toBe(2);
  });

  it("音量越界时钳制", () => {
    writeVideoPlayerPreferences({ volume: 99 });
    expect(readVideoPlayerPreferences().volume).toBe(1);
    writeVideoPlayerPreferences({ volume: -1 });
    expect(readVideoPlayerPreferences().volume).toBe(0);
  });

  it("损坏的存储内容回退默认值", () => {
    window.localStorage.setItem("chips.video-player.preferences.v1", "{invalid json");
    expect(readVideoPlayerPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("写入失败时静默降级", () => {
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => writeVideoPlayerPreferences({ volume: 0.3 })).not.toThrow();
    setItem.mockRestore();
  });
});
