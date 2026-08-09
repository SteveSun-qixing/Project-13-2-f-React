// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../../src/components/EmptyState";
import { ZoomBadge } from "../../src/components/ZoomBadge";
import { NavigationArrows } from "../../src/components/NavigationArrows";
import { InfoPanel } from "../../src/components/InfoPanel";
import { ViewerContextMenu } from "../../src/components/ViewerContextMenu";
import { Filmstrip } from "../../src/components/Filmstrip";

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe("EmptyState", () => {
  const baseProps = {
    title: "打开一张图片",
    description: "拖动或者点击导入图片",
    hint: "支持 .png .jpg .jpeg",
    shortcutText: "按 ⌘O 打开",
    actionLabel: "打开图片",
    onOpen: () => undefined,
  };

  it("renders idle state without drag-active styling", () => {
    const html = renderToStaticMarkup(<EmptyState {...baseProps} dragActive={false} />);
    expect(html).toContain('class="photo-viewer-empty"');
    expect(html).not.toContain("drag-active");
    expect(html).toContain("打开一张图片");
    expect(html).toContain("拖动或者点击导入图片");
    expect(html).toContain("支持 .png .jpg .jpeg");
  });

  it("switches description and class while dragging", () => {
    const html = renderToStaticMarkup(
      <EmptyState {...baseProps} description="松开导入图片" dragActive />,
    );
    expect(html).toContain("photo-viewer-empty--drag-active");
    expect(html).toContain("松开导入图片");
    expect(html).not.toContain("拖动或者点击导入图片");
  });
});

describe("ZoomBadge", () => {
  it("renders the formatted percent with a screen-reader label", () => {
    const html = renderToStaticMarkup(
      <ZoomBadge percent="25%" title="点击恢复适应窗口" onClick={() => undefined} />,
    );
    expect(html).toContain("photo-viewer-zoom-badge");
    expect(html).toContain("25%");
    expect(html).toContain('aria-label="25%，点击恢复适应窗口"');
    expect(html).toContain('aria-live="polite"');
  });
});

describe("NavigationArrows", () => {
  it("disables only the arrow whose direction is unavailable", () => {
    const html = renderToStaticMarkup(
      <NavigationArrows
        hasPrevious={false}
        hasNext
        onPrevious={() => undefined}
        onNext={() => undefined}
        previousLabel="上一张"
        nextLabel="下一张"
      />,
    );
    expect(html).toContain('aria-label="上一张"');
    expect(html).toContain('aria-label="下一张"');
    expect(html.match(/disabled/g)?.length).toBe(1);

    const bothDisabled = renderToStaticMarkup(
      <NavigationArrows
        hasPrevious={false}
        hasNext={false}
        onPrevious={() => undefined}
        onNext={() => undefined}
        previousLabel="上一张"
        nextLabel="下一张"
      />,
    );
    expect(bothDisabled.match(/disabled/g)?.length).toBe(2);
  });
});

describe("InfoPanel", () => {
  const fields = [
    { label: "文件名", value: "demo.png" },
    { label: "分辨率", value: "400 × 300" },
  ];

  it("renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      <InfoPanel open={false} onClose={() => undefined} title="图片信息" closeLabel="关闭" fields={fields} />,
    );
    expect(html).toBe("");
  });

  it("renders title, fields and dialog semantics when open", () => {
    const html = renderToStaticMarkup(
      <InfoPanel open onClose={() => undefined} title="图片信息" closeLabel="关闭" fields={fields} />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="图片信息"');
    expect(html).toContain("图片信息");
    expect(html).toContain("文件名");
    expect(html).toContain("demo.png");
    expect(html).toContain("分辨率");
    expect(html).toContain("400 × 300");
    expect(html).toContain('aria-label="关闭"');
  });
});

describe("ViewerContextMenu", () => {
  const items = [
    { key: "zoom-in", label: "放大", shortcut: "Mod+=" },
    { key: "separator-1", separator: true },
    { key: "copy", label: "复制图片", disabled: true },
  ];

  it("renders the wrapper with children and keeps the popup closed initially", () => {
    const html = renderToStaticMarkup(
      <ViewerContextMenu items={items}>
        <div className="photo-viewer-context-menu__target" />
      </ViewerContextMenu>,
    );
    expect(html).toContain("photo-viewer-context-menu");
    expect(html).toContain("photo-viewer-context-menu__target");
    expect(html).not.toContain("photo-viewer-context-menu__popup");
    expect(html).not.toContain("放大");
  });

  it("opens a menu with items, separators and disabled semantics on contextmenu", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      act(() => {
        root.render(
          <ViewerContextMenu items={items}>
            <div className="photo-viewer-context-menu__target" />
          </ViewerContextMenu>,
        );
      });

      const wrapper = container.querySelector(".photo-viewer-context-menu");
      expect(wrapper).not.toBeNull();

      act(() => {
        wrapper?.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, clientX: 120, clientY: 80 }),
        );
      });

      const popup = container.querySelector(".photo-viewer-context-menu__popup");
      expect(popup).not.toBeNull();
      expect(popup?.getAttribute("role")).toBe("menu");

      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems.length).toBe(2);
      expect(container.textContent).toContain("放大");
      expect(container.textContent).toContain("复制图片");
      expect(container.textContent).toContain("Mod+=");
      expect(container.querySelector('[role="menuitem"]:disabled')).not.toBeNull();
      expect(container.querySelector('[role="separator"]')).not.toBeNull();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});

describe("Filmstrip", () => {
  const items = [
    { sourceId: "a", fileName: "a.png" },
    { sourceId: "b", fileName: "b.png", thumbSrc: "file:///b.png" },
    { sourceId: "c", fileName: "c.png" },
  ];

  it("highlights the current item with aria-current and labels each item", () => {
    const html = renderToStaticMarkup(
      <Filmstrip items={items} currentIndex={1} onSelect={() => undefined} visible />,
    );
    expect(html.match(/pv-filmstrip__item--current/g)?.length).toBe(1);
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    expect(html).toContain('aria-label="a.png"');
    expect(html).toContain('aria-label="b.png"');
    expect(html).toContain('aria-label="c.png"');
    expect(html).toContain("pv-filmstrip__thumb");
    expect(html).toContain("pv-filmstrip__placeholder");
  });

  it("applies the hidden class when not visible", () => {
    const html = renderToStaticMarkup(
      <Filmstrip items={items} currentIndex={0} onSelect={() => undefined} visible={false} />,
    );
    expect(html).toContain("pv-filmstrip pv-filmstrip--hidden");
  });
});
