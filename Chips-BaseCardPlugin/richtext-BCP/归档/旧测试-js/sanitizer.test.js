import { describe, it, expect } from "vitest";
import { sanitizeRichTextHtml } from "../../src/shared/utils";
describe("sanitizeRichTextHtml", () => {
    it("removes script tags and keeps text content", () => {
        const input = '<p>safe</p><script>alert(1)</script><p>more</p>';
        const sanitized = sanitizeRichTextHtml(input);
        const container = document.createElement("div");
        container.innerHTML = sanitized;
        expect(container.querySelector("script")).toBeNull();
        expect(container.textContent).toContain("safe");
        expect(container.textContent).toContain("more");
    });
    it("removes dangerous javascript: URLs from links", () => {
        const input = '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>';
        const sanitized = sanitizeRichTextHtml(input);
        const container = document.createElement("div");
        container.innerHTML = sanitized;
        const links = container.querySelectorAll("a");
        expect(links.length).toBe(2);
        const badLink = links.item(0);
        const goodLink = links.item(1);
        if (!badLink || !goodLink) {
            throw new Error("预期存在两个链接元素");
        }
        expect(badLink.getAttribute("href")).toBeNull();
        expect(goodLink.getAttribute("href")).toBe("https://example.com");
    });
});
