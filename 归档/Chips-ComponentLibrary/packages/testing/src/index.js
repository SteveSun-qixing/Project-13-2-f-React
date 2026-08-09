export {
  CHIPS_COMPONENT_QUALITY_MATRIX,
  createComponentQualityMatrix,
  getComponentQualityMatrixEntry
} from "./component-quality-matrix.js";

export function assertHasContractAttrs(nodeAttrs) {
  const required = ["data-scope", "data-part", "data-state"];
  for (const key of required) {
    if (!Object.hasOwn(nodeAttrs, key)) {
      throw new Error(`TEST_CONTRACT_ATTR_MISSING:${key}`);
    }
  }
  return true;
}

function toSortedUniqueStrings(values = []) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort();
}

function toSet(values = []) {
  return new Set(toSortedUniqueStrings(values));
}

function getContractTokens(contract) {
  return toSortedUniqueStrings(contract.requiredTokens || contract.tokens || []);
}

function getMatrixComponents(matrix = []) {
  return toSortedUniqueStrings(matrix.map((item) => item.component));
}

function getContractComponents(contracts = []) {
  return toSortedUniqueStrings(contracts.map((item) => item.component || item.scope));
}

function compareStringSets(label, expectedValues, actualValues) {
  const expected = toSortedUniqueStrings(expectedValues);
  const actual = toSortedUniqueStrings(actualValues);
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));

  return {
    label,
    expectedCount: expected.length,
    actualCount: actual.length,
    missing,
    extra,
    passed: missing.length === 0 && extra.length === 0
  };
}

export function assertAriaRequiredProps(nodeAttrs, requiredProps = []) {
  if (!nodeAttrs || typeof nodeAttrs !== "object") {
    throw new Error("TEST_ARIA_NODE_INVALID");
  }

  for (const propName of requiredProps) {
    const value = nodeAttrs[propName];
    if (value === undefined || value === null || value === "") {
      throw new Error(`TEST_ARIA_REQUIRED_PROP_MISSING:${propName}`);
    }
  }

  return true;
}

export function createComponentFixture(options = {}) {
  const {
    scope = "component",
    part = "root",
    state = "idle",
    role = "region",
    ariaLabel = "fixture"
  } = options;

  return {
    "data-scope": scope,
    "data-part": part,
    "data-state": state,
    role,
    "aria-label": ariaLabel
  };
}

export function assertAriaRole(nodeAttrs, expectedRole) {
  if (!nodeAttrs || typeof nodeAttrs !== "object") {
    throw new Error("TEST_ARIA_NODE_INVALID");
  }

  if (nodeAttrs.role !== expectedRole) {
    throw new Error(`TEST_ARIA_ROLE_MISMATCH:${expectedRole}`);
  }

  return true;
}

export function assertComponentContractCoverage(contracts, matrix) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    throw new Error("TEST_COMPONENT_CONTRACTS_INVALID");
  }
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error("TEST_COMPONENT_MATRIX_INVALID");
  }

  const comparison = compareStringSets(
    "components",
    getContractComponents(contracts),
    getMatrixComponents(matrix)
  );
  if (!comparison.passed) {
    throw new Error(
      `TEST_COMPONENT_MATRIX_DRIFT:missing=${comparison.missing.join(",")}:extra=${comparison.extra.join(",")}`
    );
  }

  return true;
}

export function assertContractAttrMatrixCoverage(contracts, matrix) {
  assertComponentContractCoverage(contracts, matrix);
  const contractByComponent = new Map(contracts.map((contract) => [contract.component || contract.scope, contract]));
  const failures = [];

  for (const entry of matrix) {
    const contract = contractByComponent.get(entry.component);
    const attrs = createComponentFixture({
      scope: contract.scope || entry.component,
      part: entry.contractAttrs?.part || "root",
      state: entry.contractAttrs?.state || "idle"
    });

    try {
      assertHasContractAttrs(attrs);
    } catch (error) {
      failures.push(`${entry.component}:${error.message}`);
      continue;
    }

    const parts = toSet(contract.parts);
    const states = toSet(contract.states);
    if (!parts.has(attrs["data-part"])) {
      failures.push(`${entry.component}:TEST_CONTRACT_PART_NOT_PUBLIC:${attrs["data-part"]}`);
    }
    if (!states.has(attrs["data-state"])) {
      failures.push(`${entry.component}:TEST_CONTRACT_STATE_NOT_PUBLIC:${attrs["data-state"]}`);
    }
    if (attrs["data-scope"] !== contract.scope) {
      failures.push(`${entry.component}:TEST_CONTRACT_SCOPE_MISMATCH:${contract.scope}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`TEST_CONTRACT_ATTR_MATRIX_INVALID:${failures.join("|")}`);
  }

  return true;
}

export function createKeyboardEventFixture(key, options = {}) {
  return {
    key,
    code: options.code || key,
    altKey: options.altKey === true,
    ctrlKey: options.ctrlKey === true,
    metaKey: options.metaKey === true,
    shiftKey: options.shiftKey === true,
    defaultPrevented: false,
    propagationStopped: false,
    target: options.target,
    currentTarget: options.currentTarget || options.target,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...(options.extra || {})
  };
}

export function runKeyboardSequence(target, keys, options = {}) {
  if (!target || typeof target !== "object") {
    throw new Error("TEST_KEYBOARD_TARGET_INVALID");
  }
  const handlerName = options.handlerName || "onKeyDown";
  const handler = target[handlerName];
  if (typeof handler !== "function") {
    throw new Error(`TEST_KEYBOARD_HANDLER_MISSING:${handlerName}`);
  }

  const events = [];
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    const event = createKeyboardEventFixture(key, {
      target,
      currentTarget: target,
      ...(options.eventOptions || {})
    });
    handler(event);
    events.push(event);
  }
  return events;
}

export function assertRovingTabIndex(items, expectedActiveId) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("TEST_ROVING_ITEMS_INVALID");
  }

  const enabledItems = items.filter((item) => item && item.disabled !== true && item["aria-disabled"] !== "true");
  const activeItems = enabledItems.filter((item) => item.tabIndex === 0);
  if (activeItems.length !== 1) {
    throw new Error(`TEST_ROVING_ACTIVE_COUNT:${activeItems.length}`);
  }

  const activeItem = activeItems[0];
  const activeId = activeItem.id || activeItem.value || activeItem["data-value"];
  if (expectedActiveId !== undefined && String(activeId) !== String(expectedActiveId)) {
    throw new Error(`TEST_ROVING_ACTIVE_MISMATCH:${expectedActiveId}`);
  }

  for (const item of enabledItems) {
    if (item === activeItem) {
      continue;
    }
    if (item.tabIndex !== -1) {
      throw new Error("TEST_ROVING_INACTIVE_TABINDEX_INVALID");
    }
  }

  return true;
}

export function assertActiveDescendant(containerAttrs, expectedId) {
  if (!containerAttrs || typeof containerAttrs !== "object") {
    throw new Error("TEST_ACTIVE_DESCENDANT_CONTAINER_INVALID");
  }
  if (!containerAttrs["aria-activedescendant"]) {
    throw new Error("TEST_ACTIVE_DESCENDANT_MISSING");
  }
  if (expectedId !== undefined && containerAttrs["aria-activedescendant"] !== expectedId) {
    throw new Error(`TEST_ACTIVE_DESCENDANT_MISMATCH:${expectedId}`);
  }
  return true;
}

export function assertA11yFixtureCoverage(contracts, matrix) {
  assertComponentContractCoverage(contracts, matrix);
  const failures = [];

  for (const entry of matrix) {
    if (!Array.isArray(entry.a11yFixtures) || entry.a11yFixtures.length === 0) {
      failures.push(`${entry.component}:TEST_A11Y_FIXTURE_MISSING`);
      continue;
    }
    for (const fixture of entry.a11yFixtures) {
      const attrs = fixture?.attrs;
      const rules = fixture?.rules || {};
      if (!attrs || typeof attrs !== "object") {
        failures.push(`${entry.component}:TEST_A11Y_FIXTURE_ATTRS_INVALID`);
        continue;
      }
      try {
        if (rules.role !== undefined) {
          const allowedRoles = Array.isArray(rules.role) ? rules.role : [rules.role];
          if (!allowedRoles.includes(attrs.role)) {
            throw new Error(`TEST_ARIA_ROLE_MISMATCH:${allowedRoles.join("|")}`);
          }
        }
        if (rules.requireLabel) {
          const hasLabel = typeof attrs["aria-label"] === "string" && attrs["aria-label"].length > 0;
          const hasLabelledBy = typeof attrs["aria-labelledby"] === "string" && attrs["aria-labelledby"].length > 0;
          if (!hasLabel && !hasLabelledBy) {
            throw new Error("TEST_ARIA_LABEL_MISSING");
          }
        }
        if (rules.requireControlsWhenExpanded && attrs["aria-expanded"] === "true" && !attrs["aria-controls"]) {
          throw new Error("TEST_ARIA_CONTROLS_MISSING");
        }
        assertAriaRequiredProps(attrs, rules.requiredProps || []);
      } catch (error) {
        failures.push(`${entry.component}:${error.message}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`TEST_A11Y_FIXTURE_MATRIX_INVALID:${failures.join("|")}`);
  }

  return true;
}

export function assertFocusRestored(history, expectedId) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error("TEST_FOCUS_HISTORY_EMPTY");
  }
  const latest = history[history.length - 1];
  if (expectedId !== undefined && latest !== expectedId) {
    throw new Error(`TEST_FOCUS_RESTORE_MISMATCH:${expectedId}`);
  }
  return true;
}

export function createFocusTrapFixture(ids = []) {
  const focusHistory = [];
  const elements = ids.map((id) => ({
    id,
    tabIndex: 0,
    isConnected: true,
    focus() {
      focusHistory.push(id);
    }
  }));

  return {
    elements,
    focusHistory,
    get first() {
      return elements[0] || null;
    },
    get last() {
      return elements[elements.length - 1] || null;
    },
    root: elements
  };
}

export function assertStatePriority(state, priorityList) {
  if (typeof state !== "string" || state.length === 0) {
    throw new Error("TEST_STATE_INVALID");
  }

  if (!Array.isArray(priorityList) || priorityList.length === 0) {
    throw new Error("TEST_PRIORITY_LIST_INVALID");
  }

  if (!priorityList.includes(state)) {
    throw new Error(`TEST_STATE_NOT_IN_PRIORITY:${state}`);
  }

  return true;
}

export function assertComponentStatePriorityCoverage(contracts, matrix) {
  assertComponentContractCoverage(contracts, matrix);
  const failures = [];
  const matrixByComponent = new Map(matrix.map((item) => [item.component, item]));

  for (const contract of contracts) {
    const component = contract.component || contract.scope;
    const entry = matrixByComponent.get(component);
    const priority = entry?.statePriority || [];
    const prioritySet = toSet(priority);
    const states = toSortedUniqueStrings(contract.states || []);
    const missingStates = states.filter((state) => !prioritySet.has(state));
    if (missingStates.length > 0) {
      failures.push(`${component}:TEST_STATE_PRIORITY_MISSING:${missingStates.join(",")}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`TEST_STATE_PRIORITY_MATRIX_INVALID:${failures.join("|")}`);
  }

  return true;
}

export function createThemeFallbackFixture(overrides = {}) {
  return {
    global: {},
    app: {},
    box: {},
    "composite-card": {},
    "base-card": {},
    component: {},
    ...overrides
  };
}

export function resolveFallbackScopeValue(fixture, key) {
  const chain = ["component", "base-card", "composite-card", "box", "app", "global"];
  const source = fixture && typeof fixture === "object" ? fixture : {};
  for (const scope of chain) {
    const tokenMap = source[scope];
    if (tokenMap && Object.hasOwn(tokenMap, key)) {
      return {
        scope,
        value: tokenMap[key]
      };
    }
  }
  return null;
}

export function assertThemeFallbackChain(fixture, expectations = {}) {
  for (const [tokenKey, expected] of Object.entries(expectations)) {
    const resolved = resolveFallbackScopeValue(fixture, tokenKey);
    if (!resolved) {
      throw new Error(`TEST_THEME_FALLBACK_MISSING:${tokenKey}`);
    }
    if (expected.scope !== undefined && resolved.scope !== expected.scope) {
      throw new Error(`TEST_THEME_FALLBACK_SCOPE_MISMATCH:${tokenKey}:${expected.scope}`);
    }
    if (expected.value !== undefined && resolved.value !== expected.value) {
      throw new Error(`TEST_THEME_FALLBACK_VALUE_MISMATCH:${tokenKey}`);
    }
  }

  return true;
}

export function createComponentMatrixReport(contracts, matrix, options = {}) {
  if (!Array.isArray(contracts)) {
    throw new Error("TEST_COMPONENT_CONTRACTS_INVALID");
  }
  if (!Array.isArray(matrix)) {
    throw new Error("TEST_COMPONENT_MATRIX_INVALID");
  }

  const contractComponents = getContractComponents(contracts);
  const matrixComponents = getMatrixComponents(matrix);
  const componentComparison = compareStringSets("components", contractComponents, matrixComponents);
  const matrixByComponent = new Map(matrix.map((item) => [item.component, item]));
  const contractCoverage = contracts.map((contract) => {
    const component = contract.component || contract.scope;
    const matrixEntry = matrixByComponent.get(component);
    const requiredTokens = getContractTokens(contract);
    return {
      component,
      packageName: matrixEntry?.packageName || "unknown",
      partCount: Array.isArray(contract.parts) ? contract.parts.length : 0,
      stateCount: Array.isArray(contract.states) ? contract.states.length : 0,
      requiredTokenCount: requiredTokens.length,
      hasContractAttrFixture: Boolean(matrixEntry?.contractAttrs),
      a11yFixtureCount: Array.isArray(matrixEntry?.a11yFixtures) ? matrixEntry.a11yFixtures.length : 0,
      statePriorityCount: Array.isArray(matrixEntry?.statePriority) ? matrixEntry.statePriority.length : 0,
      perfSmokeScenarios: [...(matrixEntry?.perfSmokeScenarios || [])]
    };
  }).sort((left, right) => left.component.localeCompare(right.component));
  const totals = {
    contractComponentCount: contractComponents.length,
    matrixComponentCount: matrixComponents.length,
    requiredTokenCount: contractCoverage.reduce((sum, item) => sum + item.requiredTokenCount, 0),
    a11yFixtureCount: contractCoverage.reduce((sum, item) => sum + item.a11yFixtureCount, 0),
    contractAttrFixtureCount: contractCoverage.filter((item) => item.hasContractAttrFixture).length,
    perfSmokeScenarioCount: contractCoverage.reduce((sum, item) => sum + item.perfSmokeScenarios.length, 0)
  };

  return {
    schemaVersion: "1.0.0",
    generatedAt: options.generatedAt || new Date().toISOString(),
    status: componentComparison.passed ? "passed" : "failed",
    comparison: componentComparison,
    totals,
    components: contractCoverage
  };
}

export function injectFault(type, payload = {}) {
  return {
    type,
    payload
  };
}

export function createMockSurfaceContext(overrides = {}) {
  return {
    sceneId: overrides.sceneId || "test-scene",
    surfaceId: overrides.surfaceId || "test-surface",
    pluginId: overrides.pluginId || "com.chips.test-plugin",
    sessionId: overrides.sessionId || "test-session",
    kind: overrides.kind || "window",
    presentation: {
      title: "Test Surface",
      width: 960,
      height: 640,
      ...(overrides.presentation || {})
    },
    launchParams: {
      ...(overrides.launchParams || {})
    },
    ...(overrides.documentContext ? { documentContext: overrides.documentContext } : {}),
    ...(overrides.commandContext ? { commandContext: overrides.commandContext } : {}),
    permissions: Array.isArray(overrides.permissions) ? [...overrides.permissions] : []
  };
}

export function createMockLaunchContext(overrides = {}) {
  const surfaceContext = overrides.surfaceContext || createMockSurfaceContext(overrides.surface || {});
  return {
    pluginId: overrides.pluginId || surfaceContext.pluginId,
    sessionId: overrides.sessionId || surfaceContext.sessionId,
    sceneId: overrides.sceneId || surfaceContext.sceneId,
    surfaceId: overrides.surfaceId || surfaceContext.surfaceId,
    kind: overrides.kind || surfaceContext.kind,
    presentation: overrides.presentation || surfaceContext.presentation,
    surfaceContext,
    launchParams: {
      ...(overrides.launchParams || {})
    }
  };
}

export function createMockPermissionDeniedError(action, required, granted = [], options = {}) {
  const requiredList = Array.isArray(required) ? required : [required];
  return {
    code: "PERMISSION_DENIED",
    message: options.message || `Permission denied for ${action}.`,
    messageKey: options.messageKey || "chips.error.permissionDenied",
    retryable: false,
    details: {
      action,
      required: requiredList,
      granted
    },
    permission: {
      action,
      required: requiredList,
      granted,
      messageKey: options.messageKey || "chips.error.permissionDenied",
      pluginId: options.pluginId
    }
  };
}

export function createMockThemeDiagnosticSummary(overrides = {}) {
  return {
    total: 0,
    blocking: 0,
    bySeverity: {
      info: 0,
      warning: 0,
      error: 0
    },
    byCode: {},
    status: "complete",
    ...overrides
  };
}

export function createMockChipsHost(options = {}) {
  const listeners = new Map();
  const calls = [];
  const actionHandlers = new Map(Object.entries(options.actions || {}));
  const faults = new Map(Object.entries(options.faults || {}));
  const delays = new Map(Object.entries(options.delays || {}));
  let surfaceSeed = 0;
  let invocationSeed = 0;
  const surfaceContext = createMockSurfaceContext({
    permissions: options.permissions || [],
    ...(options.surfaceContext || {})
  });
  const state = {
    theme: options.theme || {
      themeId: "chips-official.default-theme",
      displayName: "薯片官方 · 默认主题",
      version: "1.0.0"
    },
    themes: options.themes || [
      {
        id: "chips-official.default-theme",
        displayName: "薯片官方 · 默认主题",
        version: "1.0.0",
        isDefault: true
      },
      {
        id: "chips-official.default-dark-theme",
        displayName: "薯片官方 · 默认深色主题",
        version: "1.0.0",
        isDefault: false,
        parentTheme: "chips-official.default-theme"
      }
    ],
    locale: options.locale || "zh-CN",
    locales: options.locales || ["zh-CN", "en-US"],
    translations: options.translations || {},
    launchContext: options.launchContext || createMockLaunchContext({ surfaceContext }),
    surfaces: [
      {
        id: surfaceContext.surfaceId,
        kind: surfaceContext.kind,
        title: surfaceContext.presentation.title,
        width: surfaceContext.presentation.width,
        height: surfaceContext.presentation.height,
        focused: true,
        state: "normal",
        pluginId: surfaceContext.pluginId,
        sessionId: surfaceContext.sessionId,
        context: surfaceContext
      }
    ],
    diagnostics: options.diagnostics || {
      routeCount: 0,
      serviceCount: 0,
      config: {},
      runtimeSnapshot: {},
      topFailureRoutes: []
    },
    commands: Array.isArray(options.commands) ? [...options.commands] : [],
    permissions: options.permissions || []
  };

  const emit = async (eventName, payload) => {
    const handlers = listeners.get(eventName);
    if (!handlers) {
      return;
    }
    for (const handler of [...handlers]) {
      handler(payload);
    }
  };

  const on = (eventName, handler) => {
    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Set());
    }
    listeners.get(eventName).add(handler);
    return () => {
      listeners.get(eventName)?.delete(handler);
    };
  };

  const delay = (delayMs) => new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

  const normalizeCommand = (definition) => ({
    ...definition,
    diagnostic: definition.diagnostic || {
      visible: true,
      enabled: true,
      checked: false
    },
    registeredAt: definition.registeredAt || Date.now(),
    updatedAt: definition.updatedAt || Date.now()
  });

  const invokeDefault = async (action, payload = {}) => {
    switch (action) {
      case "theme.getCurrent":
        if (options.failTheme) throw options.failTheme;
        return state.theme;
      case "theme.apply": {
        const previousThemeId = state.theme.themeId;
        const themeId = payload.id || payload.themeId;
        state.theme = {
          ...state.theme,
          themeId
        };
        await emit("theme.changed", {
          previousThemeId,
          themeId,
          themeVersion: state.theme.version,
          timestamp: Date.now(),
          diagnosticsSummary: createMockThemeDiagnosticSummary()
        });
        return { ack: true };
      }
      case "theme.list":
        return { themes: state.themes };
      case "theme.getAllCss":
        return { css: ":root { --chips-sys-color-surface: #ffffff; }", themeId: state.theme.themeId };
      case "theme.resolve":
        return {
          resolved: (Array.isArray(payload.chain) ? payload.chain : [state.theme.themeId]).map((id, order) => ({
            id,
            displayName: id,
            version: state.theme.version,
            order
          })),
          tokens: {},
          diagnostics: [],
          summary: createMockThemeDiagnosticSummary()
        };
      case "theme.contract.get":
        return {
          schemaVersion: "1.0.0",
          themeId: state.theme.themeId,
          themeVersion: state.theme.version,
          contractVersion: "1.0.0",
          components: [],
          summary: createMockThemeDiagnosticSummary()
        };
      case "i18n.getCurrent":
        if (options.failI18n) throw options.failI18n;
        return { locale: state.locale };
      case "i18n.setCurrent":
        state.locale = payload.locale;
        if (!state.locales.includes(payload.locale)) {
          state.locales.push(payload.locale);
        }
        await emit("language.changed", { locale: state.locale });
        return { ack: true };
      case "i18n.translate": {
        const localeMap = state.translations[state.locale];
        const text = localeMap && typeof localeMap === "object"
          ? localeMap[payload.key]
          : state.translations[payload.key];
        return { text: typeof text === "string" ? text : payload.key };
      }
      case "i18n.listLocales":
        return { locales: state.locales };
      case "surface.list":
        return { surfaces: state.surfaces };
      case "surface.getState":
        return { state: state.surfaces.find((surface) => surface.id === payload.surfaceId) };
      case "surface.open": {
        surfaceSeed += 1;
        const request = payload.request || {};
        const nextSurfaceContext = request.context || createMockSurfaceContext({
          surfaceId: `surface-${surfaceSeed}`,
          kind: request.kind || "window",
          pluginId: request.target?.type === "plugin" ? request.target.pluginId : undefined,
          presentation: request.presentation || {}
        });
        const surface = {
          id: nextSurfaceContext.surfaceId,
          kind: nextSurfaceContext.kind,
          title: nextSurfaceContext.presentation.title,
          width: nextSurfaceContext.presentation.width,
          height: nextSurfaceContext.presentation.height,
          focused: true,
          state: "normal",
          pluginId: nextSurfaceContext.pluginId,
          sessionId: nextSurfaceContext.sessionId,
          context: nextSurfaceContext
        };
        state.surfaces.push(surface);
        return { surface };
      }
      case "surface.focus":
      case "surface.resize":
      case "surface.setState":
      case "surface.close":
        return { ack: true };
      case "command.register": {
        const command = normalizeCommand(payload);
        state.commands = state.commands.filter((item) => item.commandId !== command.commandId).concat(command);
        await emit("command.registered", { commandId: command.commandId, command });
        await emit("command.changed", { commandId: command.commandId, command, change: "registered" });
        return { command };
      }
      case "command.unregister":
        state.commands = state.commands.filter((command) => command.commandId !== payload.commandId);
        await emit("command.unregistered", { commandId: payload.commandId, reason: "unregistered" });
        await emit("command.changed", { commandId: payload.commandId, change: "unregistered" });
        return { ack: true };
      case "command.get":
        return { command: state.commands.find((command) => command.commandId === payload.commandId) };
      case "command.list":
        return { commands: state.commands };
      case "command.invoke": {
        invocationSeed += 1;
        const command = state.commands.find((item) => item.commandId === payload.commandId);
        const result = {
          commandId: payload.commandId,
          invocationId: `invocation-${invocationSeed}`,
          dispatched: true,
          command
        };
        await emit("command.invoked", {
          ...result,
          source: payload.source,
          payload: payload.payload,
          handlerId: command?.handlerId
        });
        return result;
      }
      case "command.setState": {
        const command = state.commands.find((item) => item.commandId === payload.commandId);
        if (command) {
          command.state = {
            ...(command.state || {}),
            ...(payload.state || {})
          };
          await emit("command.changed", { commandId: payload.commandId, command, state: payload.state, change: "state" });
        }
        return { command };
      }
      case "control-plane.diagnose":
        if (options.failDiagnostics) throw options.failDiagnostics;
        return { diagnose: state.diagnostics };
      default:
        throw new Error(`MOCK_HOST_ACTION_NOT_REGISTERED:${action}`);
    }
  };

  const host = {
    calls,
    state,
    events: {
      on,
      once(eventName, handler) {
        const unsubscribe = on(eventName, (payload) => {
          unsubscribe();
          handler(payload);
        });
        return unsubscribe;
      },
      async emit(eventName, payload) {
        await emit(eventName, payload);
      }
    },
    emit,
    async transport(action, payload = {}) {
      const call = {
        action,
        payload,
        timestamp: Date.now()
      };
      calls.push(call);
      const delayMs = delays.get(action);
      if (delayMs > 0) {
        await delay(delayMs);
      }
      if (faults.has(action)) {
        const fault = faults.get(action);
        throw typeof fault === "function" ? await fault(payload, { action, payload, call, host }) : fault;
      }
      if (actionHandlers.has(action)) {
        return actionHandlers.get(action)(payload, { action, payload, call, host });
      }
      return invokeDefault(action, payload);
    },
    setActionHandler(action, handler) {
      actionHandlers.set(action, handler);
    },
    clearActionHandler(action) {
      actionHandlers.delete(action);
    },
    setFault(action, fault) {
      faults.set(action, fault);
    },
    clearFault(action) {
      faults.delete(action);
    },
    setPermissionDenied(action, required, granted = [], faultOptions = {}) {
      faults.set(action, createMockPermissionDeniedError(action, required, granted, faultOptions));
    },
    setDelay(action, delayMs) {
      delays.set(action, delayMs);
    },
    clearDelay(action) {
      delays.delete(action);
    },
    resetCalls() {
      calls.splice(0, calls.length);
    },
    theme: {
      async getCurrent() {
        return host.transport("theme.getCurrent", {});
      },
      async apply(themeId) {
        await host.transport("theme.apply", { id: themeId });
      },
      async list(publisher) {
        const result = await host.transport("theme.list", { publisher });
        return result.themes;
      },
      async getAllCss() {
        return host.transport("theme.getAllCss", {});
      },
      async resolve(chain) {
        return host.transport("theme.resolve", { chain });
      },
      contract: {
        async get(component) {
          return host.transport("theme.contract.get", component ? { component } : {});
        }
      },
      onChanged(handler) {
        return on("theme.changed", handler);
      }
    },
    i18n: {
      async getCurrent() {
        const result = await host.transport("i18n.getCurrent", {});
        return result.locale;
      },
      async setCurrent(locale) {
        await host.transport("i18n.setCurrent", { locale });
      },
      async translate(key, params) {
        const result = await host.transport("i18n.translate", { key, params });
        return result.text;
      },
      async listLocales() {
        const result = await host.transport("i18n.listLocales", {});
        return result.locales;
      },
      onChanged(handler) {
        return on("language.changed", handler);
      }
    },
    platform: {
      getLaunchContext() {
        return state.launchContext;
      }
    },
    command: {
      async register(definition) {
        const result = await host.transport("command.register", definition);
        return result.command;
      },
      async unregister(commandId) {
        await host.transport("command.unregister", { commandId });
      },
      async get(commandId) {
        const result = await host.transport("command.get", { commandId });
        return result.command;
      },
      async list(options) {
        const result = await host.transport("command.list", options || {});
        return result.commands;
      },
      async invoke(commandId, payload, invokeOptions) {
        return host.transport("command.invoke", { commandId, payload: payload || {}, ...(invokeOptions || {}) });
      },
      async setState(commandId, commandState, setStateOptions) {
        const result = await host.transport("command.setState", { commandId, state: commandState, options: setStateOptions });
        return result.command;
      },
      onRegistered(handler) {
        return on("command.registered", handler);
      },
      onUnregistered(handler) {
        return on("command.unregistered", handler);
      },
      onChanged(handler) {
        return on("command.changed", handler);
      },
      onInvoked(handler) {
        return on("command.invoked", handler);
      }
    },
    controlPlane: {
      async diagnose() {
        const result = await host.transport("control-plane.diagnose", {});
        return result.diagnose;
      }
    }
  };

  return host;
}

export function createMockChipsClient(options = {}) {
  const host = createMockChipsHost(options);
  host.mockHost = host;
  return host;
}

export function createMockChipsEnvironment(options = {}) {
  const client = options.client || createMockChipsClient(options);
  const launchContext = client.state?.launchContext || null;
  const surface = launchContext?.surfaceContext || null;
  return {
    client,
    initialTheme: options.initialTheme || client.state?.theme || null,
    initialLocale: options.initialLocale || client.state?.locale,
    initialLaunchContext: launchContext,
    initialSurface: options.initialSurface || surface,
    initialPermissions: options.initialPermissions || surface?.permissions || [],
    initialDiagnostics: options.initialDiagnostics || []
  };
}
