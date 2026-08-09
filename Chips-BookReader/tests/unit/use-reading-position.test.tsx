// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useReadingPosition,
  type ReadingPositionSnapshot,
  type UseReadingPositionParams,
  type UseReadingPositionReturn,
} from "../../src/hooks/useReadingPosition";

const CONFIG_KEY_PATTERN = /^book-reader\.reading-position\.[0-9a-f]+$/;

describe("useReadingPosition 阅读位置持久化", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookValue: UseReadingPositionReturn | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    hookValue = null;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  function renderHarness(
    configClient: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown) => Promise<void>;
      reset?: (key: string) => Promise<void>;
    },
    bookSourceId: string | null = "book-1",
  ): Promise<void> {
    const client = {
      get: configClient.get as UseReadingPositionParams["configClient"]["get"],
      set: configClient.set as UseReadingPositionParams["configClient"]["set"],
      reset: configClient.reset as UseReadingPositionParams["configClient"]["reset"],
    };
    function Harness({ configClient }: { configClient: UseReadingPositionParams["configClient"] }): React.ReactElement | null {
      hookValue = useReadingPosition({ bookSourceId, configClient });
      return null;
    }

    return act(async () => {
      root.render(<Harness configClient={client} />);
    });
  }

  it("挂载时按书源读取持久化位置并暴露快照", async () => {
    const stored: ReadingPositionSnapshot = {
      sectionIndex: 2,
      readingMode: "paginated",
      spreadIndex: 4,
      scrollFraction: 0.5,
      updatedAt: 1234,
    };
    const get = vi.fn(async (_key: string) => stored);
    const set = vi.fn(async (_key: string, _value: unknown) => undefined);

    await renderHarness({ get, set });

    await act(async () => {
      await Promise.resolve();
    });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toMatch(CONFIG_KEY_PATTERN);
    expect(hookValue?.savedPosition).toEqual(stored);
  });

  it("track 在节流窗口内合并最新捕获值，窗口结束写入一次", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const get = vi.fn(async (_key: string) => null);
    const set = vi.fn(async (_key: string, _value: unknown) => undefined);

    await renderHarness({ get, set });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hookValue?.track({
        sectionIndex: 0,
        readingMode: "paginated",
        spreadIndex: 1,
        scrollFraction: 0.1,
      });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      hookValue?.track({
        sectionIndex: 1,
        readingMode: "scroll",
        scrollFraction: 0.7,
      });
    });

    expect(set).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(set).toHaveBeenCalledTimes(1);
    const [key, value] = set.mock.calls[0] ?? [];
    expect(key).toMatch(CONFIG_KEY_PATTERN);
    expect(value).toMatchObject({
      sectionIndex: 1,
      readingMode: "scroll",
      scrollFraction: 0.7,
    });
    expect((value as ReadingPositionSnapshot).updatedAt).toBeGreaterThan(0);
  });

  it("距上次写入超过节流窗口时 track 立即落盘", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const get = vi.fn(async (_key: string) => null);
    const set = vi.fn(async (_key: string, _value: unknown) => undefined);

    await renderHarness({ get, set });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hookValue?.track({
        sectionIndex: 0,
        readingMode: "paginated",
        spreadIndex: 0,
        scrollFraction: 0.2,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(set).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    act(() => {
      hookValue?.track({
        sectionIndex: 0,
        readingMode: "paginated",
        spreadIndex: 1,
        scrollFraction: 0.5,
      });
    });

    expect(set).toHaveBeenCalledTimes(2);
  });

  it("restore 归一化位置并保留分页 spread 目标", async () => {
    const get = vi.fn(async (_key: string) => null);
    const set = vi.fn(async (_key: string, _value: unknown) => undefined);

    await renderHarness({ get, set });

    await act(async () => {
      await Promise.resolve();
    });

    const paginated = hookValue?.restore({
      sectionIndex: 3,
      readingMode: "paginated",
      spreadIndex: 6,
      scrollFraction: 0.3,
      updatedAt: 1,
    });

    expect(paginated).toEqual({
      sectionIndex: 3,
      readingMode: "paginated",
      spreadIndex: 6,
      scrollFraction: 0.3,
    });

    const scroll = hookValue?.restore({
      sectionIndex: 1,
      readingMode: "scroll",
      spreadIndex: 9,
      scrollFraction: 0.9,
      updatedAt: 1,
    });

    expect(scroll).toEqual({
      sectionIndex: 1,
      readingMode: "scroll",
      spreadIndex: undefined,
      scrollFraction: 0.9,
    });

    expect(
      hookValue?.restore({
        sectionIndex: -1,
        readingMode: "scroll",
        scrollFraction: 0.5,
        updatedAt: 1,
      }),
    ).toBeNull();
  });

  it("clear 会清除节流任务并重置持久化位置", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const get = vi.fn(async (_key: string) => null);
    const set = vi.fn(async (_key: string, _value: unknown) => undefined);
    const reset = vi.fn(async (_key: string) => undefined);

    await renderHarness({ get, set, reset });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hookValue?.track({
        sectionIndex: 0,
        readingMode: "paginated",
        spreadIndex: 0,
        scrollFraction: 0.1,
      });
    });
    act(() => {
      hookValue?.clear();
    });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset.mock.calls[0]?.[0]).toMatch(CONFIG_KEY_PATTERN);
    expect(hookValue?.savedPosition).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(set).not.toHaveBeenCalled();
  });
});
