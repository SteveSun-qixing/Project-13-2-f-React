// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "./__animation-events";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("react event probe", () => {
  it("pointerout synthesizes onPointerLeave", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let left = 0;
    act(() => {
      root.render(
        <div
          className="el"
          onPointerLeave={() => {
            left += 1;
          }}
        />,
      );
    });
    const el = container.querySelector(".el") as Element;
    act(() => {
      el.dispatchEvent(new Event("pointerout", { bubbles: true }));
    });
    console.log("pointerleave count:", left);
    expect(left).toBe(1);
  });

  it("onAnimationEnd with plain Event + animationName", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let name = "none";
    act(() => {
      root.render(
        <div
          className="el"
          onAnimationEnd={(e) => {
            name = String(e.animationName);
          }}
        />,
      );
    });
    const el = container.querySelector(".el") as Element;
    const event = new Event("animationend", { bubbles: true });
    Object.defineProperty(event, "animationName", { value: "video-player-osd-enter" });
    act(() => {
      el.dispatchEvent(event);
    });
    console.log("animationName read by react:", name);
    expect(name).toBe("video-player-osd-enter");
  });
});
