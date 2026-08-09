import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedFrameOrigin,
  resolveIframeSandboxPolicy
} from "../src/security-policy.js";

test("resolveIframeSandboxPolicy keeps defaults and removes forbidden tokens", () => {
  const value = resolveIframeSandboxPolicy(
    "allow-forms allow-top-navigation allow-popups-to-escape-sandbox"
  );

  assert.equal(value, "allow-scripts allow-same-origin allow-forms");
});

test("resolveIframeSandboxPolicy falls back to default when input invalid", () => {
  assert.equal(resolveIframeSandboxPolicy(), "allow-scripts allow-same-origin");
});

test("isAllowedFrameOrigin accepts all when allowed origins missing", () => {
  assert.equal(isAllowedFrameOrigin("https://chips.example.com"), true);
});

test("isAllowedFrameOrigin enforces provided allowlist", () => {
  assert.equal(
    isAllowedFrameOrigin("https://chips.example.com", ["https://chips.example.com"]),
    true
  );
  assert.equal(
    isAllowedFrameOrigin("https://unknown.example.com", ["https://chips.example.com"]),
    false
  );
});
