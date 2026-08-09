import { afterEach, describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
describe("createBasecardEditorRoot (text basic)", () => {
    afterEach(() => {
        vi.useRealTimers();
    });
    it("emits changes when body content is updated", () => {
        vi.useFakeTimers();
        const initialConfig = {
            id: "test",
            body: "<p>Body</p>",
            locale: "zh-CN",
        };
        let lastConfig;
        const root = createBasecardEditorRoot({
            initialConfig,
            onChange: (next) => {
                lastConfig = next;
            },
        });
        const bodyEditor = root.querySelector(".chips-basecard-editor__richtext");
        if (!bodyEditor) {
            throw new Error("找不到正文编辑器");
        }
        bodyEditor.innerHTML = "<p>New Body</p>";
        bodyEditor.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(130);
        expect(lastConfig?.body).toContain("New Body");
    });
});
