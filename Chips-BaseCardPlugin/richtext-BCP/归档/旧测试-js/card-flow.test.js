import { afterEach, describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
describe("basecard integration flow (text basic)", () => {
    afterEach(() => {
        vi.useRealTimers();
    });
    it("updates view when editor emits valid body content", () => {
        vi.useFakeTimers();
        const container = document.createElement("div");
        const editorContainer = document.createElement("div");
        const initialConfig = {
            id: "test",
            body: "Body",
            locale: "zh-CN",
        };
        let currentConfig = initialConfig;
        mountBasecardView({
            container,
            config: currentConfig,
        });
        mountBasecardEditor({
            container: editorContainer,
            initialConfig,
            onChange: (next) => {
                currentConfig = next;
                mountBasecardView({
                    container,
                    config: currentConfig,
                });
            },
        });
        expect(editorContainer.querySelector(".chips-basecard-editor__input")).toBeNull();
        const bodyEditor = editorContainer.querySelector(".chips-basecard-editor__richtext");
        if (!bodyEditor) {
            throw new Error("找不到正文编辑器");
        }
        bodyEditor.innerHTML = "<p>Updated Body</p>";
        bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(130);
        const bodyEl = container.querySelector(".chips-basecard__body");
        expect(bodyEl?.textContent).toContain("Updated Body");
    });
});
