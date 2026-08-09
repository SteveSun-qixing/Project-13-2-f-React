import test from "node:test";
import assert from "node:assert/strict";
import {
  createObservationRecord,
  dismissSystemMessage,
  resolveConfigValue,
  resolveI18nText,
  resolveSystemMessageQueue
} from "../src/index.js";

test("stage8 cross-layer pipeline resolves config i18n queue and observation", () => {
  const diagnostics = [];
  const i18n = {
    dictionary: {
      "systemUx.notification.action.open": "Open",
      "systemUx.notification.close": "Close"
    },
    translate({ key }) {
      return this.dictionary[key] || "";
    }
  };
  const configSource = {
    systemUx: {
      notification: {
        maxVisible: 2,
        defaultDurationMs: 2800
      }
    }
  };

  const maxVisible = resolveConfigValue({
    configSource,
    key: "systemUx.notification.maxVisible",
    defaultValue: 3
  });
  const durationMs = resolveConfigValue({
    configSource,
    key: "systemUx.notification.defaultDurationMs",
    defaultValue: 5000
  });

  const queue = resolveSystemMessageQueue({
    items: [
      { id: "a", message: "m1", actionKey: "systemUx.notification.action.open" },
      { id: "b", message: "m2", actionKey: "systemUx.notification.action.open", durationMs: 1200 },
      { id: "c", message: "m3" }
    ],
    idPrefix: "notification",
    maxVisible,
    defaultDurationMs: durationMs
  });

  const actionLabel = resolveI18nText({
    i18n,
    key: queue[0].actionKey,
    fallback: "[[systemUx.notification.action]]",
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });
  const closeLabel = resolveI18nText({
    i18n,
    key: "systemUx.notification.close",
    fallback: "[[systemUx.notification.close]]"
  });

  const afterDismiss = dismissSystemMessage(queue, "a");
  const observation = createObservationRecord({
    traceId: "trace-integration-001",
    component: "notification",
    action: "manual-dismiss",
    durationMs: 4
  });

  assert.equal(maxVisible, 2);
  assert.equal(durationMs, 2800);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].effectiveDurationMs, 2800);
  assert.equal(queue[1].effectiveDurationMs, 1200);
  assert.equal(actionLabel, "Open");
  assert.equal(closeLabel, "Close");
  assert.equal(afterDismiss.length, 1);
  assert.equal(afterDismiss[0].id, "b");
  assert.equal(observation.component, "notification");
  assert.equal(observation.action, "manual-dismiss");
  assert.equal(diagnostics.length, 0);
});
