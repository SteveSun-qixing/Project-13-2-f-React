import * as React from "react";

export interface ThemeRuntimeState {
  themeId: string;
  version: string;
  cacheKey: string;
  lastChangedAt: number;
}

export interface TokenResolver {
  get(tokenKey: string): unknown;
  keys(): Iterable<string>;
}

export type ThemeDiagnosticSeverity = "info" | "warning" | "error";
export type ThemeDiagnosticStatus = "complete" | "warning" | "blocked";

export interface ThemeCoverageSummary {
  componentCount: number;
  coveredComponentCount: number;
  requiredTokenCount: number;
  coveredRequiredTokenCount: number;
  missingRequiredTokenCount: number;
  optionalTokenCount: number;
  coveredOptionalTokenCount: number;
  missingOptionalTokenCount: number;
  requiredCoverage: number;
  optionalCoverage: number;
}

export interface ThemeDiagnosticSummary {
  total: number;
  blocking: number;
  bySeverity: Record<ThemeDiagnosticSeverity, number>;
  byCode: Record<string, number>;
  status: ThemeDiagnosticStatus;
  coverage?: ThemeCoverageSummary;
}

export interface ThemeChangedPayload {
  previousThemeId?: string;
  themeId?: string;
  themeVersion?: string;
  version?: string;
  timestamp?: number;
  diagnosticsSummary?: ThemeDiagnosticSummary;
  [key: string]: unknown;
}

export interface ThemeEventSource {
  on?(eventName: string, handler: (payload: unknown) => void): void;
  off?(eventName: string, handler: (payload: unknown) => void): void;
  addEventListener?(eventName: string, handler: (event: Event | CustomEvent<unknown>) => void): void;
  removeEventListener?(eventName: string, handler: (event: Event | CustomEvent<unknown>) => void): void;
  subscribe?(eventName: string, handler: (payload: unknown) => void): (() => void) | void;
}

export type ChipsRuntimeStatus = "idle" | "loading" | "ready" | "error";

export interface ChipsRuntimeDiagnostic {
  code: string;
  message: string;
  messageKey?: string;
  details?: unknown;
  retryable?: boolean;
  requestId?: string;
  traceId?: string;
  permission?: ChipsPermissionDiagnostic;
  source?: string;
  [key: string]: unknown;
}

export interface ChipsPermissionDiagnostic {
  domain?: string;
  action?: string;
  resource?: string;
  required: string[];
  granted: string[];
  messageKey?: string;
  callerId?: string;
  callerType?: string;
  pluginId?: string;
}

export interface ChipsThemeState {
  themeId: string;
  displayName?: string;
  version?: string;
  parentTheme?: string;
  [key: string]: unknown;
}

export interface ChipsSurfaceContext {
  sceneId: string;
  surfaceId?: string;
  pluginId?: string;
  sessionId?: string;
  kind?: string;
  presentation?: Record<string, unknown>;
  launchParams?: Record<string, unknown>;
  permissions?: string[];
  [key: string]: unknown;
}

export interface ChipsLaunchContext {
  pluginId?: string;
  sessionId?: string;
  sceneId?: string;
  surfaceId?: string;
  kind?: string;
  presentation?: Record<string, unknown>;
  surfaceContext?: ChipsSurfaceContext;
  launchParams?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChipsEventsLike {
  on<T = unknown>(eventName: string, handler: (payload: T) => void): () => void;
}

export interface ChipsClientLike {
  events?: ChipsEventsLike;
  theme?: {
    getCurrent(): Promise<ChipsThemeState>;
    apply(themeId: string): Promise<void>;
    onChanged?(handler: (payload: ThemeChangedPayload) => void): () => void;
  };
  i18n?: {
    getCurrent(): Promise<string>;
    setCurrent(locale: string): Promise<void>;
    translate(key: string, params?: Record<string, unknown>): Promise<string>;
    onChanged?(handler: (payload: { locale: string }) => void): () => void;
  };
  platform?: {
    getLaunchContext(): ChipsLaunchContext | null;
  };
  command?: {
    register?(definition: unknown): Promise<unknown>;
    unregister?(commandId: string): Promise<void>;
    get?(commandId: string, options?: Record<string, unknown>): Promise<unknown>;
    list?(options?: Record<string, unknown>): Promise<unknown[]>;
    invoke?(commandId: string, payload?: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
    setState?(commandId: string, state: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
    onRegistered?(handler: (payload: unknown) => void): () => void;
    onUnregistered?(handler: (payload: unknown) => void): () => void;
    onChanged?(handler: (payload: unknown) => void): () => void;
    onInvoked?(handler: (payload: unknown) => void): () => void;
  };
  controlPlane?: {
    diagnose(): Promise<unknown>;
  };
  [key: string]: unknown;
}

export interface ChipsEnvironmentStatus {
  theme: ChipsRuntimeStatus;
  i18n: ChipsRuntimeStatus;
  surface: ChipsRuntimeStatus;
  diagnostics: ChipsRuntimeStatus;
}

export interface ChipsCommandEnvironmentApi {
  register(...args: unknown[]): Promise<unknown> | undefined;
  unregister(...args: unknown[]): Promise<unknown> | undefined;
  get(...args: unknown[]): Promise<unknown> | undefined;
  list(...args: unknown[]): Promise<unknown> | undefined;
  invoke(...args: unknown[]): Promise<unknown> | undefined;
  setState(...args: unknown[]): Promise<unknown> | undefined;
  onRegistered(...args: unknown[]): (() => void) | undefined;
  onUnregistered(...args: unknown[]): (() => void) | undefined;
  onChanged(...args: unknown[]): (() => void) | undefined;
  onInvoked(...args: unknown[]): (() => void) | undefined;
}

export interface ChipsEnvironmentValue {
  client: ChipsClientLike | null;
  eventSource: ThemeEventSource;
  theme: ChipsThemeState | null;
  locale: string | null;
  launchContext: ChipsLaunchContext | null;
  surface: ChipsSurfaceContext | null;
  permissions: string[];
  diagnostics: ChipsRuntimeDiagnostic[];
  status: ChipsEnvironmentStatus;
  error: ChipsRuntimeDiagnostic | null;
  ready: boolean;
  refresh(): Promise<PromiseSettledResult<unknown>[]>;
  refreshTheme(): Promise<ChipsThemeState | null>;
  refreshLocale(): Promise<string | null>;
  refreshSurface(): Promise<ChipsSurfaceContext | null>;
  refreshDiagnostics(): Promise<unknown>;
  hasPermission(permission: string): boolean;
  translate(key: string, params?: Record<string, unknown>): Promise<string>;
  command: ChipsCommandEnvironmentApi;
  pushDiagnostic(diagnostic: ChipsRuntimeDiagnostic): void;
  clearDiagnostics(): void;
}

export interface ChipsEnvironmentProviderProps {
  client?: ChipsClientLike | null;
  createClient?: () => ChipsClientLike | null;
  initialTheme?: ChipsThemeState | null;
  initialLocale?: string;
  initialLaunchContext?: ChipsLaunchContext | null;
  initialSurface?: ChipsSurfaceContext | null;
  initialPermissions?: string[];
  initialDiagnostics?: ChipsRuntimeDiagnostic[];
  onDiagnostic?: (diagnostic: ChipsRuntimeDiagnostic) => void;
  children?: React.ReactNode;
}

export interface UseChipsThemeResult {
  theme: ChipsThemeState | null;
  status: ChipsRuntimeStatus;
  error: ChipsRuntimeDiagnostic | null;
  refresh(): Promise<ChipsThemeState | null>;
  apply(themeId: string): Promise<ChipsThemeState | null>;
}

export interface UseChipsI18nResult {
  locale: string | null;
  status: ChipsRuntimeStatus;
  error: ChipsRuntimeDiagnostic | null;
  t(key: string, params?: Record<string, unknown>): Promise<string>;
  translate(key: string, params?: Record<string, unknown>): Promise<string>;
  refresh(): Promise<string | null>;
  setLocale(locale: string): Promise<string | null>;
}

export type ChipsI18nTextParams = Record<string, string | number | boolean | null | undefined>;
export type ChipsI18nText = (key: string, params?: ChipsI18nTextParams, fallback?: string) => string;

export interface ChipsI18nTextOptions {
  bundles?: Record<string, Record<string, unknown>>;
  locale?: string;
  defaultLocale?: string;
  fallbackLocale?: string;
  fallbackLocales?: string[];
  missingText?: (key: string, context: { locale: string; params?: ChipsI18nTextParams }) => string;
}

export type ChipsStateUpdater<T> = T | ((previousValue: T) => T);
export type ChipsBindingPath = string | number | Array<string | number>;
export type ChipsBindingStatus = "idle" | "loading" | "success" | "error";
export type ChipsBindingProps<
  TValueProp extends string,
  TChangeProp extends string,
  TValue,
  TChangeValue = TValue,
  TResult = unknown,
> = Record<TValueProp, TValue> & Record<TChangeProp, (value: TChangeValue, meta?: Record<string, unknown>) => TResult>;

export interface ChipsBindingChange<T = unknown> {
  name?: string;
  previousValue: T;
  value: T;
  reason?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChipsBinding<T = unknown> {
  readonly kind: "chips.binding";
  readonly name?: string;
  readonly meta: Record<string, unknown>;
  readonly value: T;
  get(): T;
  set(nextValue: ChipsStateUpdater<T>, meta?: Record<string, unknown>): T;
  update(updater: (previousValue: T) => T, meta?: Record<string, unknown>): T;
  reset(nextValue?: T, meta?: Record<string, unknown>): T;
  toProps<
    TValueProp extends string = "value",
    TChangeProp extends string = "onValueChange",
    TComponentValue = T,
    TChangeValue = TComponentValue,
  >(options?: {
    valueProp?: TValueProp;
    changeProp?: TChangeProp;
    mapValue?: (value: T) => TComponentValue;
    mapChange?: (value: TChangeValue) => T;
  }): ChipsBindingProps<TValueProp, TChangeProp, TComponentValue, TChangeValue, T>;
  valueProps<TComponentValue = T, TChangeValue = TComponentValue>(options?: {
    mapValue?: (value: T) => TComponentValue;
    mapChange?: (value: TChangeValue) => T;
  }): ChipsBindingProps<"value", "onValueChange", TComponentValue, TChangeValue, T>;
  checkedProps(options?: {
    mapValue?: (value: T) => boolean;
    mapChange?: (value: boolean) => T;
  }): ChipsBindingProps<"checked", "onCheckedChange", boolean, boolean, T>;
  openProps(options?: {
    mapValue?: (value: T) => boolean;
    mapChange?: (value: boolean) => T;
  }): ChipsBindingProps<"open", "onOpenChange", boolean, boolean, T>;
  inputProps<TInputValue = T extends null | undefined ? "" : T>(options?: {
    eventValue?: (event: unknown) => T;
    mapValue?: (value: T) => TInputValue;
    mapChange?: (value: unknown) => T;
  }): ChipsBindingProps<"value", "onChange", TInputValue, unknown, T>;
  inputProps<TValueProp extends string, TChangeProp extends string, TInputValue = T extends null | undefined ? "" : T>(options: {
    valueProp: TValueProp;
    changeProp: TChangeProp;
    eventValue?: (event: unknown) => T;
    mapValue?: (value: T) => TInputValue;
    mapChange?: (value: unknown) => T;
  }): ChipsBindingProps<TValueProp, TChangeProp, TInputValue, unknown, T>;
}

export interface CreateBindingOptions<T = unknown> {
  value?: T;
  defaultValue?: T | (() => T);
  get?: () => T;
  set?: (value: T, event: ChipsBindingChange<T>) => void;
  onChange?: (value: T, event: ChipsBindingChange<T>) => void;
  equals?: (a: T, b: T) => boolean;
  name?: string;
  meta?: Record<string, unknown>;
  readOnly?: boolean;
}

export interface UseBindingOptions<T = unknown> extends CreateBindingOptions<T> {}

export interface UseChipsStateOptions<T = unknown> {
  name?: string;
  meta?: Record<string, unknown>;
  equals?: (a: T, b: T) => boolean;
  onChange?: (value: T, event: ChipsBindingChange<T>) => void;
}

export interface UseChipsStateResult<T = unknown> {
  value: T;
  setValue(nextValue: ChipsStateUpdater<T>, meta?: Record<string, unknown>): T;
  update(nextValue: ChipsStateUpdater<T>, meta?: Record<string, unknown>): T;
  reset(nextValue?: T, meta?: Record<string, unknown>): T;
  binding: ChipsBinding<T>;
}

export interface UseChipsAsyncStateOptions<TResult = unknown> {
  action?: (...args: unknown[]) => Promise<TResult> | TResult;
  initialStatus?: ChipsBindingStatus;
  initialData?: TResult;
  onSuccess?: (data: TResult, context: { requestId: number; args: unknown[] }) => void;
  onError?: (error: unknown, context: { requestId: number; args: unknown[] }) => void;
  onSettled?: (context: { requestId: number; args: unknown[] }) => void;
}

export interface UseChipsAsyncStateResult<TResult = unknown> {
  status: ChipsBindingStatus;
  data: TResult | undefined;
  value: TResult | undefined;
  error: unknown;
  requestId: number;
  loading: boolean;
  success: boolean;
  idle: boolean;
  run(...args: unknown[]): Promise<TResult>;
  reset(): void;
  setData(data: TResult): void;
  setError(error: unknown): void;
}

export interface ChipsFieldMeta<T = unknown> {
  name: string;
  value: T;
  initialValue: T;
  error: unknown;
  touched: boolean;
  dirty: boolean;
  invalid: boolean;
}

export interface UseChipsFormStateOptions<TValues extends Record<string, unknown> = Record<string, unknown>> {
  name?: string;
  initialErrors?: Record<string, unknown>;
  initialTouched?: Record<string, unknown>;
  equals?: (a: unknown, b: unknown) => boolean;
  onFieldChange?: (field: string, value: unknown, meta?: Record<string, unknown>) => void;
}

export interface UseChipsFormStateResult<TValues extends Record<string, unknown> = Record<string, unknown>> {
  values: TValues;
  initialValues: TValues;
  errors: Record<string, unknown>;
  touched: Record<string, unknown>;
  dirty: boolean;
  valid: boolean;
  submitted: boolean;
  binding: ChipsBinding<TValues>;
  setValues(values: TValues | ((previousValues: TValues) => TValues)): TValues;
  setSubmitted(submitted: boolean): void;
  reset(values?: TValues): TValues;
  getFieldValue<T = unknown>(field: ChipsBindingPath): T;
  setFieldValue<T = unknown>(field: ChipsBindingPath, value: ChipsStateUpdater<T>, meta?: Record<string, unknown>): T;
  getFieldError(field: ChipsBindingPath): unknown;
  setFieldError(field: ChipsBindingPath, error: unknown): void;
  clearFieldError(field: ChipsBindingPath): void;
  getFieldTouched(field: ChipsBindingPath): boolean;
  setFieldTouched(field: ChipsBindingPath, touched?: boolean): void;
  getFieldMeta<T = unknown>(field: ChipsBindingPath): ChipsFieldMeta<T>;
  getFieldBinding<T = unknown>(field: ChipsBindingPath, options?: { name?: string; meta?: Record<string, unknown> }): ChipsBinding<T>;
  field<T = unknown>(field: ChipsBindingPath, options?: { name?: string; meta?: Record<string, unknown> }): ChipsBinding<T>;
}

export interface ChipsFieldBindingSource {
  getFieldBinding<T = unknown>(field: ChipsBindingPath, options?: { name?: string; meta?: Record<string, unknown> }): ChipsBinding<T>;
}

export interface UseChipsSurfaceResult {
  surface: ChipsSurfaceContext | null;
  launchContext: ChipsLaunchContext | null;
  status: ChipsRuntimeStatus;
  error: ChipsRuntimeDiagnostic | null;
  refresh(): Promise<ChipsSurfaceContext | null>;
}

export interface UseChipsPermissionResult {
  permissions: string[];
  hasPermission(permission: string): boolean;
  diagnostics: ChipsRuntimeDiagnostic[];
  latest: ChipsPermissionDiagnostic | null;
}

export interface UseChipsDiagnosticsResult {
  diagnostics: ChipsRuntimeDiagnostic[];
  status: ChipsRuntimeStatus;
  error: ChipsRuntimeDiagnostic | null;
  refresh(): Promise<unknown>;
  push(diagnostic: ChipsRuntimeDiagnostic): void;
  clear(): void;
}

export interface ThemeChunkDiagnostic {
  chunkIndex: number;
  chunkSize: number;
  appliedCount: number;
  totalCount: number;
}

export interface ApplyThemeVariablesOptions {
  chunkSize?: number;
  scheduler?: () => Promise<unknown> | unknown;
  signal?: AbortSignal;
  onChunkApplied?: (diagnostic: ThemeChunkDiagnostic) => void;
  onDiagnostic?: (diagnostic: ThemeChunkDiagnostic & { code: string }) => void;
}

export interface ApplyThemeVariablesResult {
  appliedCount: number;
  chunkCount: number;
  durationMs: number;
}

export interface ChipsTokenProviderProps {
  resolver: TokenResolver;
  children?: React.ReactNode;
}

export interface ChipsThemeProviderProps {
  themeId?: string;
  version?: string;
  eventName?: string;
  eventSource?: ThemeEventSource;
  onThemeChanged?: (payload: ThemeChangedPayload) => void;
  resolver?: TokenResolver | null;
  children?: React.ReactNode;
}

export function ChipsTokenProvider(props: ChipsTokenProviderProps): React.ReactElement;
export function subscribeThemeChanged(
  eventSource: ThemeEventSource | undefined,
  eventName: string,
  handler: (payload: ThemeChangedPayload) => void,
): () => void;
export function applyThemeVariables(target: HTMLElement, variables: Record<string, string | number>): void;
export function applyThemeVariablesInBatches(
  target: HTMLElement,
  variables: Record<string, string | number>,
  options?: ApplyThemeVariablesOptions,
): Promise<ApplyThemeVariablesResult>;
export function ChipsThemeProvider(props: ChipsThemeProviderProps): React.ReactElement;
export function useTokenResolver(): TokenResolver;
export function useToken<T = unknown>(tokenKey: string): T;
export function useComponentTokens(componentScope: string): Record<string, unknown>;
export function useThemeRuntime(): ThemeRuntimeState;
export function createBinding<T = unknown>(options?: CreateBindingOptions<T> | ChipsBinding<T>): ChipsBinding<T>;
export function useBinding<T = unknown>(options?: UseBindingOptions<T> | ChipsBinding<T>): ChipsBinding<T>;
export function useChipsBinding<T = unknown>(options?: UseBindingOptions<T> | ChipsBinding<T>): ChipsBinding<T>;
export function useChipsState<T = unknown>(initialValue: T | (() => T), options?: UseChipsStateOptions<T>): UseChipsStateResult<T>;
export function useChipsAsyncState<TResult = unknown>(
  action?: ((...args: unknown[]) => Promise<TResult> | TResult) | null,
  options?: UseChipsAsyncStateOptions<TResult>,
): UseChipsAsyncStateResult<TResult>;
export function useChipsFormState<TValues extends Record<string, unknown> = Record<string, unknown>>(
  initialValues?: TValues | (() => TValues),
  options?: UseChipsFormStateOptions<TValues>,
): UseChipsFormStateResult<TValues>;
export function useFieldBinding<T = unknown, TValues extends Record<string, unknown> = Record<string, unknown>>(
  formState: UseChipsFormStateResult<TValues> | ChipsBinding<TValues>,
  field: ChipsBindingPath,
  options?: { name?: string; meta?: Record<string, unknown> },
): ChipsBinding<T>;
export function useFieldBinding<T = unknown>(
  formState: ChipsFieldBindingSource | ChipsBinding<unknown>,
  field: ChipsBindingPath,
  options?: { name?: string; meta?: Record<string, unknown> },
): ChipsBinding<T>;
export function ChipsEnvironmentProvider(props: ChipsEnvironmentProviderProps): React.ReactElement;
export function useChipsEnvironment(): ChipsEnvironmentValue;
export function useChipsClient<T extends ChipsClientLike = ChipsClientLike>(): T;
export function useChipsTheme(): UseChipsThemeResult;
export function useChipsI18n(): UseChipsI18nResult;
export function createChipsI18nText(options?: ChipsI18nTextOptions): ChipsI18nText;
export function useChipsI18nText(options?: Omit<ChipsI18nTextOptions, "locale">): ChipsI18nText;
export function useChipsSurface(): UseChipsSurfaceResult;
export function useChipsPermission(): UseChipsPermissionResult;
export function useChipsCommand(): ChipsCommandEnvironmentApi;
export function useChipsDiagnostics(): UseChipsDiagnosticsResult;
