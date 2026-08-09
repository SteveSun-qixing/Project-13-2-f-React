// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoPlayerController } from "../../src/hooks/useVideoPlayerController";

function createMockVideo(): HTMLVideoElement {
  const video = {
    paused: true,
    muted: false,
    volume: 0.85,
    duration: 120,
    currentTime: 0,
    playbackRate: 1,
    buffered: { length: 0 },
    textTracks: {
      length: 0,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  } as unknown as HTMLVideoElement;
  return video;
}

describe("useVideoPlayerController (重构后行为)", () => {
  it("ended 后 isEnded 置位，commitSeek 后复位", () => {
    const video = createMockVideo();
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s1" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    act(() => {
      result.current.handleEnded();
    });
    expect(result.current.isEnded).toBe(true);

    act(() => {
      result.current.commitSeek(10);
    });
    expect(result.current.isEnded).toBe(false);
    expect(video.currentTime).toBe(10);
  });

  it("seekPreviewTo 只更新进度不写 video.currentTime", () => {
    const video = createMockVideo();
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s2" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    act(() => {
      result.current.seekPreviewTo(42);
    });
    expect(video.currentTime).toBe(0);
    expect(result.current.currentTime).toBe(42);

    act(() => {
      result.current.commitSeek(42);
    });
    expect(video.currentTime).toBe(42);
  });

  it("commitSeek 超出时长时钳制", () => {
    const video = createMockVideo();
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s3" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    act(() => {
      result.current.commitSeek(999);
    });
    expect(video.currentTime).toBe(120);

    act(() => {
      result.current.commitSeek(-5);
    });
    expect(video.currentTime).toBe(0);
  });


  it("toggleLoop 切换循环状态", () => {
    const video = createMockVideo();
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s5" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    expect(result.current.loop).toBe(false);
    act(() => {
      result.current.toggleLoop();
    });
    expect(result.current.loop).toBe(true);
    expect(video.loop).toBe(true);
  });

  it("播放速度/音量变更持久化到偏好", () => {
    const video = createMockVideo();
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s6" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    act(() => {
      result.current.setPlaybackRate(1.5);
      result.current.setVolumeLevel(0.4);
    });
    const prefs = JSON.parse(window.localStorage.getItem("chips.video-player.preferences.v1") ?? "{}");
    expect(prefs.playbackRate).toBe(1.5);
    expect(prefs.volume).toBe(0.4);
  });
  it("togglePlayback 播放失败时置 errorKey", async () => {
    const video = createMockVideo();
    video.play = vi.fn().mockRejectedValue(new Error("play rejected"));
    const { result, rerender } = renderHook(() =>
      useVideoPlayerController({ sessionKey: "s4" }),
    );

    act(() => {
      (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    });
    rerender();

    await act(async () => {
      await result.current.togglePlayback();
    });
    expect(result.current.errorKey).not.toBeNull();
  });
});
