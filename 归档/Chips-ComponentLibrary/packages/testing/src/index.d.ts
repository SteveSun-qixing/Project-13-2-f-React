export interface ComponentFixtureOptions {
  scope?: string;
  part?: string;
  state?: string;
  role?: string;
  ariaLabel?: string;
}

export interface ComponentQualityA11yRules {
  role?: string | string[];
  requireLabel?: boolean;
  requireControlsWhenExpanded?: boolean;
  requiredProps?: string[];
}

export interface ComponentQualityA11yFixture {
  attrs: Record<string, unknown>;
  rules?: ComponentQualityA11yRules;
}

export interface ComponentQualityMatrixEntry {
  component: string;
  packageName: string;
  contractAttrs: {
    part: string;
    state: string;
  };
  statePriority: readonly string[];
  a11yFixtures: readonly ComponentQualityA11yFixture[];
  perfSmokeScenarios: readonly string[];
}

export interface ComponentQualityContract {
  component?: string;
  scope: string;
  parts: string[];
  states: string[];
  tokens?: string[];
  requiredTokens?: string[];
}

export interface ComponentMatrixReport {
  schemaVersion: string;
  generatedAt: string;
  status: "passed" | "failed";
  comparison: {
    label: string;
    expectedCount: number;
    actualCount: number;
    missing: string[];
    extra: string[];
    passed: boolean;
  };
  totals: {
    contractComponentCount: number;
    matrixComponentCount: number;
    requiredTokenCount: number;
    a11yFixtureCount: number;
    contractAttrFixtureCount: number;
    perfSmokeScenarioCount: number;
  };
  components: Array<{
    component: string;
    packageName: string;
    partCount: number;
    stateCount: number;
    requiredTokenCount: number;
    hasContractAttrFixture: boolean;
    a11yFixtureCount: number;
    statePriorityCount: number;
    perfSmokeScenarios: string[];
  }>;
}

export interface KeyboardEventFixture {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  target?: unknown;
  currentTarget?: unknown;
  preventDefault(): void;
  stopPropagation(): void;
  [key: string]: unknown;
}

export interface KeyboardEventFixtureOptions {
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  currentTarget?: unknown;
  extra?: Record<string, unknown>;
}

export interface RovingAssertionItem {
  id?: string;
  value?: string;
  "data-value"?: string;
  tabIndex?: number;
  disabled?: boolean;
  "aria-disabled"?: string;
}

export interface FocusTrapFixture {
  elements: Array<{
    id: string;
    tabIndex: number;
    isConnected: boolean;
    focus(): void;
  }>;
  focusHistory: string[];
  readonly first: FocusTrapFixture["elements"][number] | null;
  readonly last: FocusTrapFixture["elements"][number] | null;
  root: FocusTrapFixture["elements"];
}

export function assertHasContractAttrs(nodeAttrs: Record<string, unknown>): true;
export function assertAriaRequiredProps(nodeAttrs: Record<string, unknown>, requiredProps?: string[]): true;
export function createComponentFixture(options?: ComponentFixtureOptions): Record<string, unknown>;
export function assertAriaRole(nodeAttrs: Record<string, unknown>, expectedRole: string): true;
export function assertComponentContractCoverage(contracts: ComponentQualityContract[], matrix: ComponentQualityMatrixEntry[]): true;
export function assertContractAttrMatrixCoverage(contracts: ComponentQualityContract[], matrix: ComponentQualityMatrixEntry[]): true;
export function createKeyboardEventFixture(key: string, options?: KeyboardEventFixtureOptions): KeyboardEventFixture;
export function runKeyboardSequence(target: Record<string, unknown>, keys: string | string[], options?: { handlerName?: string; eventOptions?: KeyboardEventFixtureOptions }): KeyboardEventFixture[];
export function assertRovingTabIndex(items: RovingAssertionItem[], expectedActiveId?: string | number): true;
export function assertActiveDescendant(containerAttrs: Record<string, unknown>, expectedId?: string): true;
export function assertA11yFixtureCoverage(contracts: ComponentQualityContract[], matrix: ComponentQualityMatrixEntry[]): true;
export function assertFocusRestored(history: string[], expectedId?: string): true;
export function createFocusTrapFixture(ids?: string[]): FocusTrapFixture;
export function assertComponentStatePriorityCoverage(contracts: ComponentQualityContract[], matrix: ComponentQualityMatrixEntry[]): true;
export function assertStatePriority(state: string, priorityList: string[]): true;
export function createThemeFallbackFixture(overrides?: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>>;
export function resolveFallbackScopeValue(fixture: Record<string, Record<string, unknown>>, key: string): { scope: string; value: unknown } | null;
export function assertThemeFallbackChain(
  fixture: Record<string, Record<string, unknown>>,
  expectations?: Record<string, { scope?: string; value?: unknown }>,
): true;
export function createComponentMatrixReport(
  contracts: ComponentQualityContract[],
  matrix: ComponentQualityMatrixEntry[],
  options?: { generatedAt?: string },
): ComponentMatrixReport;
export function injectFault(type: string, payload?: Record<string, unknown>): { type: string; payload: Record<string, unknown> };

export const CHIPS_COMPONENT_QUALITY_MATRIX: readonly ComponentQualityMatrixEntry[];
export function createComponentQualityMatrix(overrides?: Partial<ComponentQualityMatrixEntry>[]): ComponentQualityMatrixEntry[];
export function getComponentQualityMatrixEntry(component: string, matrix?: readonly ComponentQualityMatrixEntry[]): ComponentQualityMatrixEntry | null;

export function createMockSurfaceContext(overrides?: Record<string, unknown>): Record<string, unknown>;
export function createMockLaunchContext(overrides?: Record<string, unknown>): Record<string, unknown>;
export function createMockPermissionDeniedError(action: string, required: string | string[], granted?: string[], options?: Record<string, unknown>): Record<string, unknown>;
export function createMockThemeDiagnosticSummary(overrides?: Record<string, unknown>): Record<string, unknown>;
export function createMockChipsHost(options?: Record<string, unknown>): Record<string, unknown>;
export function createMockChipsClient(options?: Record<string, unknown>): Record<string, unknown>;
export function createMockChipsEnvironment(options?: Record<string, unknown>): Record<string, unknown>;
