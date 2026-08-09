import { describe, it, expect } from "vitest";
import { createBasecardViewRoot } from "../../src/render/view";
describe("createBasecardViewRoot (text basic)", () => {
    it("renders body without a separate title node", () => {
        const config = {
            id: "test",
            body: "World",
            locale: "zh-CN",
        };
        const root = createBasecardViewRoot(config);
        const bodyEl = root.querySelector(".chips-basecard__body");
        expect(root.querySelector(".chips-basecard__title")).toBeNull();
        expect(bodyEl?.textContent).toBe("World");
    });
});
