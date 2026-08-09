import * as React from "react";
export * from "./layout-primitives.js";

export type InteractiveState = "disabled" | "loading" | "error" | "active" | "focus" | "hover" | "idle";

export interface StandardErrorLike {
  code?: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export interface ComponentMeta {
  name: string;
  scope: string;
  parts: string[];
  states: string[];
}

export interface ObservationRecord {
  traceId?: string;
  component: string;
  action: string;
  durationMs: number;
  error?: StandardErrorLike | null;
  [key: string]: unknown;
}

export interface ConfigSource {
  get?(key: string): unknown;
  [key: string]: unknown;
}

export interface I18nTextSource {
  t?(key: string, params?: Record<string, string | number>): string;
  translate?(key: string, params?: Record<string, string | number>): string;
  [key: string]: unknown;
}

export interface SystemMessageItem {
  id: string;
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  message?: string;
  actionLabel?: string;
  actionKey?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

export interface TreeNode {
  id: string;
  label?: React.ReactNode;
  disabled?: boolean;
  children?: TreeNode[];
  [key: string]: unknown;
}

export interface CommandPaletteItem {
  id?: string | number;
  commandId?: string;
  label?: React.ReactNode;
  title?: string;
  subtitle?: string;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  command?: ChipsCommandView;
  [key: string]: unknown;
}

export type ChipsCommandSource = "menu" | "toolbar" | "shortcut" | "palette" | "context-menu" | "api";

export interface ChipsCommandShortcut {
  accelerator: string;
  platform?: "all" | "desktop" | "web" | "mobile" | "headless";
  [key: string]: unknown;
}

export interface ChipsCommandPlacement {
  menuId?: string;
  toolbarId?: string;
  groupId?: string;
  order?: number;
  section?: string;
  [key: string]: unknown;
}

export interface ChipsCommandState {
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  busy?: boolean;
  reasonKey?: string;
  disabledReasonKey?: string;
  hiddenReasonKey?: string;
  [key: string]: unknown;
}

export interface ChipsCommandDiagnostic {
  visible?: boolean;
  enabled?: boolean;
  checked?: boolean;
  reasonKey?: string;
  [key: string]: unknown;
}

export interface ChipsCommandView {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: ChipsIconDescriptor;
  shortcut?: string | ChipsCommandShortcut | ChipsCommandShortcut[];
  menuPlacement?: ChipsCommandPlacement[];
  toolbarPlacement?: ChipsCommandPlacement[];
  paletteKeywords?: string[];
  state?: ChipsCommandState;
  diagnostic?: ChipsCommandDiagnostic;
  disabledReasonKey?: string;
  hiddenReasonKey?: string;
  [key: string]: unknown;
}

export interface ChipsResolvedCommandView extends ChipsCommandView {
  label: string;
  description: string;
  ariaLabel: string;
  disabled: boolean;
  hidden: boolean;
  checked: boolean;
  shortcutLabel: string;
  menuPlacement: ChipsCommandPlacement[];
  toolbarPlacement: ChipsCommandPlacement[];
  paletteKeywords: string[];
}

export interface ChipsCommandQueryOptions {
  source?: ChipsCommandSource;
  includeDisabled?: boolean;
  includeHidden?: boolean;
  [key: string]: unknown;
}

export interface ChipsCommandAdapter {
  listCommands(options?: ChipsCommandQueryOptions): Promise<ChipsCommandView[]>;
  invokeCommand(
    commandId: string,
    payload?: Record<string, unknown>,
    options?: { source?: ChipsCommandSource; context?: Record<string, unknown> },
  ): Promise<unknown>;
  onCommandsChanged?(handler: (event: unknown) => void): () => void;
}

export interface ChipsCommandProviderProps {
  adapter?: ChipsCommandAdapter;
  commands?: ChipsCommandView[];
  query?: ChipsCommandQueryOptions;
  i18n?: I18nTextSource | ((key: string, params?: Record<string, string | number>, fallback?: string) => string);
  children?: React.ReactNode;
}

export interface VirtualItem {
  value?: string | number;
  label?: React.ReactNode;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface DataGridColumn {
  key: string;
  label?: string;
  sortable?: boolean;
}

export interface DataGridRow {
  id?: string | number;
  [key: string]: unknown;
}

export interface DockPanelItem {
  id: string;
  title?: string;
  content?: React.ReactNode;
  [key: string]: unknown;
}

export interface InspectorSection {
  id: string;
  title?: string;
  content?: React.ReactNode;
  disabled?: boolean;
  [key: string]: unknown;
}

export type ChipsIconStyle = "outlined" | "rounded" | "sharp";
export type ChipsIconTone = "default" | "muted" | "accent" | "danger" | "disabled";

export interface ChipsIconDescriptor {
  name: string;
  style?: ChipsIconStyle;
  tone?: ChipsIconTone;
  fill?: 0 | 1;
  wght?: number;
  grad?: number;
  opsz?: number;
  decorative?: boolean;
  label?: string;
}

export interface ChipsIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  descriptor: ChipsIconDescriptor;
  size?: number | string;
  color?: string;
  tone?: ChipsIconTone;
}

export type ChipsTextTone = "default" | "muted" | "accent" | "error";
export type ChipsTextEmphasis = "regular" | "strong" | "code";
export type ChipsTextElement = "span" | "p" | "strong" | "em" | "small" | "code" | "div";
export type ChipsRatingShape = "star" | "heart";

export interface ChipsDisplayTextProps {
  i18n?: I18nTextSource | ((key: string, params?: Record<string, string | number>, fallback?: string) => string);
  onDiagnostic?: (record: ObservationRecord | Record<string, unknown>) => void;
}

export interface ChipsTextProps extends ChipsDisplayTextProps, Omit<React.HTMLAttributes<HTMLElement>, "color"> {
  as?: ChipsTextElement;
  text?: React.ReactNode;
  textKey?: string;
  textParams?: Record<string, string | number>;
  fallbackText?: string;
  tone?: ChipsTextTone;
  emphasis?: ChipsTextEmphasis;
  truncate?: boolean;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
}

export interface ChipsLabelProps extends ChipsDisplayTextProps, React.LabelHTMLAttributes<HTMLLabelElement> {
  label?: React.ReactNode;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  required?: boolean;
  requiredIndicator?: React.ReactNode;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
}

export interface ButtonProps {
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  toggleable?: boolean;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPress?: (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  onPressedChange?: (pressed: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface IconButtonProps {
  icon?: React.ReactNode;
  descriptor?: ChipsIconDescriptor;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  ariaLabel?: string;
  ariaLabelKey?: string;
  ariaLabelParams?: Record<string, string | number>;
  fallbackAriaLabel?: string;
  i18n?: ChipsDisplayTextProps["i18n"];
  onPress?: (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: ChipsDisplayTextProps["onDiagnostic"];
  [key: string]: unknown;
}

export interface ToggleButtonProps {
  children?: React.ReactNode;
  label?: React.ReactNode;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  pressed?: boolean;
  defaultPressed?: boolean;
  i18n?: ChipsDisplayTextProps["i18n"];
  onPress?: (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  onPressedChange?: (pressed: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: ChipsDisplayTextProps["onDiagnostic"];
  [key: string]: unknown;
}

export type ChipsControlTone = "neutral" | "accent" | "success" | "warning" | "error";

export interface BadgeProps extends ChipsDisplayTextProps {
  children?: React.ReactNode;
  label?: React.ReactNode;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  count?: number;
  max?: number;
  tone?: ChipsControlTone;
  icon?: React.ReactNode;
  decorative?: boolean;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface TagProps extends ChipsDisplayTextProps {
  children?: React.ReactNode;
  label?: React.ReactNode;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  removable?: boolean;
  closeLabel?: string;
  closeLabelKey?: string;
  fallbackCloseLabel?: string;
  onRemove?: (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export type AvatarShape = "circle" | "rounded" | "square";
export type ImageFit = "cover" | "contain" | "fill" | "none" | "scale-down";
export type MediaKind = "audio" | "video" | "generic";
export type MediaFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface AvatarProps extends ChipsDisplayTextProps {
  name?: string;
  nameKey?: string;
  nameParams?: Record<string, string | number>;
  fallbackName?: string;
  src?: string;
  alt?: string;
  initials?: string;
  shape?: AvatarShape;
  decorative?: boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface ImageModel {
  src: string;
  alt: string;
  decorative: boolean;
  fit: ImageFit;
  objectPosition: string;
  width?: string | number;
  height?: string | number;
  loading: boolean;
  loaded: boolean;
  error: StandardErrorLike | null;
  hasSource: boolean;
  fallbackVisible: boolean;
  state: InteractiveState;
}

export interface ImageProps extends ChipsDisplayTextProps {
  src?: string;
  alt?: string;
  decorative?: boolean;
  caption?: React.ReactNode;
  captionKey?: string;
  captionParams?: Record<string, string | number>;
  fallbackCaption?: string;
  fallback?: React.ReactNode;
  fit?: ImageFit;
  objectPosition?: string;
  width?: string | number;
  height?: string | number;
  loading?: boolean;
  loaded?: boolean;
  loadingStrategy?: "eager" | "lazy";
  decoding?: "sync" | "async" | "auto";
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  onError?: (error: StandardErrorLike, event?: React.SyntheticEvent<HTMLImageElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface MediaModel {
  kind: MediaKind;
  src: string;
  title: string;
  caption: React.ReactNode;
  fit: MediaFit;
  objectPosition: string;
  poster: string;
  width?: string | number;
  height?: string | number;
  muted: boolean;
  loop: boolean;
  autoPlay: boolean;
  controls: boolean;
  loading: boolean;
  error: StandardErrorLike | null;
  hasSource: boolean;
  fallbackVisible: boolean;
  state: InteractiveState;
}

export interface MediaProps extends ChipsDisplayTextProps {
  kind?: MediaKind;
  src?: string;
  title?: string;
  titleKey?: string;
  titleParams?: Record<string, string | number>;
  fallbackTitle?: string;
  caption?: React.ReactNode;
  captionKey?: string;
  captionParams?: Record<string, string | number>;
  fallbackCaption?: string;
  poster?: string;
  fit?: MediaFit;
  objectPosition?: string;
  width?: string | number;
  height?: string | number;
  controls?: boolean;
  controlsContent?: React.ReactNode;
  muted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
  preload?: "none" | "metadata" | "auto" | string;
  fallback?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  children?: React.ReactNode;
  onLoadStart?: React.ReactEventHandler<HTMLMediaElement>;
  onLoadedMetadata?: React.ReactEventHandler<HTMLMediaElement>;
  onError?: (error: StandardErrorLike, event?: React.SyntheticEvent<HTMLMediaElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface SpinnerProps extends ChipsDisplayTextProps {
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  decorative?: boolean;
  loading?: boolean;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface ProgressProps extends ChipsDisplayTextProps {
  value?: number;
  min?: number;
  max?: number;
  indeterminate?: boolean;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  showValue?: boolean;
  valueText?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface RatingItemLabelDetails {
  active: boolean;
  count: number;
  shape: ChipsRatingShape;
}

export interface RatingProps extends ChipsDisplayTextProps {
  value?: number;
  defaultValue?: number;
  count?: number;
  shape?: ChipsRatingShape;
  readOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  getItemLabel?: (value: number, details: RatingItemLabelDetails) => string;
  onValueChange?: (value: number) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface TextInputDescriptor {
  scope: string;
  state: InteractiveState;
  disabledByState: boolean;
  normalizedError: StandardErrorLike | null;
  required: boolean;
  readOnly: boolean;
  label: string;
  description: string;
  descriptionId?: string;
  statusId?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  describedBy?: string;
  controlValueProps: Record<string, unknown>;
  hasAccessibleName: boolean;
}

export interface BaseTextInputProps extends ChipsDisplayTextProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  readOnly?: boolean;
  required?: boolean;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  ariaLabel?: string;
  ariaLabelKey?: string;
  ariaLabelParams?: Record<string, string | number>;
  fallbackAriaLabel?: string;
  description?: string;
  descriptionKey?: string;
  descriptionParams?: Record<string, string | number>;
  fallbackDescription?: string;
  placeholder?: string;
  name?: string;
  maxLength?: number;
  minLength?: number;
  onValueChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  onEnterPress?: (value: string, event?: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  [key: string]: unknown;
}

export interface TextFieldProps extends BaseTextInputProps {
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}

export interface TextAreaProps extends BaseTextInputProps {
  rows?: number;
  resize?: "none" | "inline" | "block" | "both";
}

export interface SearchFieldProps extends BaseTextInputProps {
  searchIcon?: React.ReactNode;
  clearLabel?: string;
  clearLabelKey?: string;
  fallbackClearLabel?: string;
  showClear?: boolean;
  onSearch?: (value: string, event?: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: (event?: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => void;
}

export interface SecureFieldProps extends BaseTextInputProps {
  autoComplete?: string;
  revealLabel?: string;
  revealLabelKey?: string;
  fallbackRevealLabel?: string;
  concealLabel?: string;
  concealLabelKey?: string;
  fallbackConcealLabel?: string;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibilityChange?: (
    visible: boolean,
    event?: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>,
  ) => void;
}

export interface InputProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  readOnly?: boolean;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  onEnterPress?: (value: string) => void;
  [key: string]: unknown;
}

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  label?: React.ReactNode;
  name?: string;
  value?: string;
  onCheckedChange?: (checked: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface RadioGroupOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  options?: RadioGroupOption[];
  onValueChange?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  textValue?: string;
  disabled?: boolean;
}

export interface SelectProps {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  placeholder?: string;
  iconContent?: React.ReactNode;
  options?: SelectOption[];
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  gutter?: string | number;
  maxBlockSize?: string | number;
  minInlineSize?: string | number;
}

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: React.ReactNode;
}

export interface SelectOptionProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  disabled?: boolean;
  textValue?: string;
  index?: number;
}

export interface SelectCompoundComponent extends React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLDivElement>>;
  Trigger: React.ForwardRefExoticComponent<SelectTriggerProps & React.RefAttributes<HTMLButtonElement>>;
  Content: React.ForwardRefExoticComponent<SelectContentProps & React.RefAttributes<HTMLDivElement>>;
  Option: React.ForwardRefExoticComponent<SelectOptionProps & React.RefAttributes<HTMLDivElement>>;
  Value: React.ForwardRefExoticComponent<SelectValueProps & React.RefAttributes<HTMLSpanElement>>;
}

export type SegmentedControlOption = SelectOption;

export interface SegmentedControlProps {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  options?: SegmentedControlOption[];
  ariaLabel?: string;
  ariaLabelledBy?: string;
  i18n?: ChipsDisplayTextProps["i18n"];
  onValueChange?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: ChipsDisplayTextProps["onDiagnostic"];
  [key: string]: unknown;
}

export interface ComboBoxProps extends BaseTextInputProps {
  value?: string;
  defaultValue?: string;
  inputValue?: string;
  defaultInputValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  autoComplete?: string;
  options?: SelectOption[];
  emptyLabel?: string;
  emptyLabelKey?: string;
  fallbackEmptyLabel?: string;
  triggerLabel?: string;
  triggerLabelKey?: string;
  fallbackTriggerLabel?: string;
  onValueChange?: (value: string) => void;
  onInputValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export type NumericControlChangeSource =
  | "input"
  | "commit"
  | "blur"
  | "keyboard"
  | "decrement"
  | "increment";

export interface NumericControlDetails {
  source: NumericControlChangeSource | string;
  previousValue?: number | null;
  value: number | null;
  text: string;
  min: number;
  max: number;
  step: number;
  largeStep: number;
  atMin: boolean;
  atMax: boolean;
  empty: boolean;
  invalid: boolean;
}

export interface NumericControlModel {
  min: number;
  max: number;
  step: number;
  largeStep: number;
  precision: number;
  value: number | null;
  text: string;
  empty: boolean;
  invalid: boolean;
  atMin: boolean;
  atMax: boolean;
  valueText?: string;
}

export interface SliderModel extends NumericControlModel {
  orientation: "horizontal" | "vertical";
  ratio: number;
}

export interface DatePickerMonth {
  year: number;
  month: number;
}

export interface DatePickerCell {
  value: string;
  label: string;
  selected: boolean;
  today: boolean;
  outsideMonth: boolean;
  disabled: boolean;
}

export interface DatePickerModel {
  value: string;
  text: string;
  textValue: string;
  invalid: boolean;
  min?: string;
  max?: string;
  month: DatePickerMonth;
  title: string;
  weekDayLabels: string[];
  cells: DatePickerCell[];
  weekStartsOn: number;
}

export interface TimePickerOption {
  value: string;
  label?: React.ReactNode;
  disabled?: boolean;
}

export interface TimePickerModel {
  value: string;
  text: string;
  textValue: string;
  invalid: boolean;
  min?: string;
  max?: string;
  step: number;
  optionStep: number;
  showSeconds: boolean;
  options: Array<Required<Pick<TimePickerOption, "value">> & Pick<TimePickerOption, "label" | "disabled">>;
}

export interface PickerChangeDetails {
  source: string;
  previousValue?: string;
  value: string;
  text: string;
  invalid: boolean;
}

export interface NumberInputProps extends Omit<BaseTextInputProps, "value" | "defaultValue" | "onValueChange" | "onEnterPress"> {
  value?: number | null;
  defaultValue?: number | null;
  textValue?: string;
  defaultTextValue?: string;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  valueText?: string;
  formatValue?: (value: number) => string;
  invalidMessage?: string;
  invalidMessageKey?: string;
  fallbackInvalidMessage?: string;
  decrementLabel?: string;
  decrementLabelKey?: string;
  fallbackDecrementLabel?: string;
  incrementLabel?: string;
  incrementLabelKey?: string;
  fallbackIncrementLabel?: string;
  decrementContent?: React.ReactNode;
  incrementContent?: React.ReactNode;
  onValueChange?: (
    value: number | null,
    details: NumericControlDetails,
    event?: React.SyntheticEvent,
  ) => void;
  onInputChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onEnterPress?: (value: number | null, event?: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

export interface StepperProps extends ChipsDisplayTextProps {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  ariaLabel?: string;
  ariaLabelKey?: string;
  ariaLabelParams?: Record<string, string | number>;
  fallbackAriaLabel?: string;
  ariaLabelledBy?: string;
  valueText?: string;
  formatValue?: (value: number) => string;
  decrementLabel?: string;
  decrementLabelKey?: string;
  fallbackDecrementLabel?: string;
  incrementLabel?: string;
  incrementLabelKey?: string;
  fallbackIncrementLabel?: string;
  decrementContent?: React.ReactNode;
  incrementContent?: React.ReactNode;
  onValueChange?: (
    value: number | null,
    details: NumericControlDetails,
    event?: React.SyntheticEvent,
  ) => void;
  onStateChange?: (state: InteractiveState) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  [key: string]: unknown;
}

export interface SliderProps extends ChipsDisplayTextProps {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  label?: string;
  labelKey?: string;
  labelParams?: Record<string, string | number>;
  fallbackLabel?: string;
  ariaLabel?: string;
  ariaLabelKey?: string;
  ariaLabelParams?: Record<string, string | number>;
  fallbackAriaLabel?: string;
  ariaLabelledBy?: string;
  valueText?: string;
  formatValue?: (value: number) => string;
  showValue?: boolean;
  onValueChange?: (
    value: number | null,
    details: NumericControlDetails,
    event?: React.SyntheticEvent,
  ) => void;
  onStateChange?: (state: InteractiveState) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  [key: string]: unknown;
}

export interface DatePickerProps extends Omit<BaseTextInputProps, "onValueChange" | "onEnterPress"> {
  textValue?: string;
  defaultTextValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  min?: string;
  max?: string;
  defaultMonth?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  weekDayLabels?: string[];
  monthLabels?: string[];
  triggerLabel?: string;
  triggerLabelKey?: string;
  fallbackTriggerLabel?: string;
  previousLabel?: string;
  previousLabelKey?: string;
  fallbackPreviousLabel?: string;
  nextLabel?: string;
  nextLabelKey?: string;
  fallbackNextLabel?: string;
  invalidMessage?: string;
  invalidMessageKey?: string;
  fallbackInvalidMessage?: string;
  triggerContent?: React.ReactNode;
  isDateDisabled?: (value: string) => boolean;
  onValueChange?: (
    value: string,
    details: PickerChangeDetails,
    event?: React.SyntheticEvent,
  ) => void;
  onInputChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenChange?: (open: boolean, event?: React.SyntheticEvent) => void;
  onMonthChange?: (
    month: DatePickerMonth,
    details: { source: string },
    event?: React.SyntheticEvent,
  ) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export interface TimePickerProps extends Omit<BaseTextInputProps, "onValueChange" | "onEnterPress"> {
  textValue?: string;
  defaultTextValue?: string;
  open?: boolean;
  defaultOpen?: boolean;
  min?: string;
  max?: string;
  step?: number;
  optionStep?: number;
  showSeconds?: boolean;
  options?: TimePickerOption[] | string[];
  limitOptionsToRange?: boolean;
  triggerLabel?: string;
  triggerLabelKey?: string;
  fallbackTriggerLabel?: string;
  invalidMessage?: string;
  invalidMessageKey?: string;
  fallbackInvalidMessage?: string;
  triggerContent?: React.ReactNode;
  isTimeDisabled?: (value: string) => boolean;
  onValueChange?: (
    value: string,
    details: PickerChangeDetails,
    event?: React.SyntheticEvent,
  ) => void;
  onInputChange?: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenChange?: (open: boolean, event?: React.SyntheticEvent) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  triggerContent?: React.ReactNode;
  closeButtonLabel?: string;
  closeButtonContent?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  modal?: boolean;
  labelledBy?: string;
  describedBy?: string;
  contentId?: string;
  onOpenChange?: (open: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  onCloseReason?: (reason: string) => void;
  [key: string]: unknown;
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface DialogSectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface DialogCompoundComponent extends React.ForwardRefExoticComponent<DialogProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<DialogProps & React.RefAttributes<HTMLDivElement>>;
  Trigger: React.ForwardRefExoticComponent<DialogTriggerProps & React.RefAttributes<HTMLButtonElement>>;
  Content: React.ForwardRefExoticComponent<DialogContentProps & React.RefAttributes<HTMLDivElement>>;
  Header: React.ForwardRefExoticComponent<DialogSectionProps & React.RefAttributes<HTMLElement>>;
  Body: React.ForwardRefExoticComponent<DialogSectionProps & React.RefAttributes<HTMLElement>>;
  Footer: React.ForwardRefExoticComponent<DialogSectionProps & React.RefAttributes<HTMLElement>>;
  Actions: React.ForwardRefExoticComponent<DialogSectionProps & React.RefAttributes<HTMLElement>>;
  Close: React.ForwardRefExoticComponent<DialogCloseProps & React.RefAttributes<HTMLButtonElement>>;
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  triggerContent?: React.ReactNode;
  children?: React.ReactNode;
  closeOnEscape?: boolean;
  contentId?: string;
  onOpenChange?: (open: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface PopoverArrowProps extends React.HTMLAttributes<HTMLSpanElement> {}

export interface PopoverCompoundComponent extends React.ForwardRefExoticComponent<PopoverProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<PopoverProps & React.RefAttributes<HTMLDivElement>>;
  Trigger: React.ForwardRefExoticComponent<PopoverTriggerProps & React.RefAttributes<HTMLButtonElement>>;
  Content: React.ForwardRefExoticComponent<PopoverContentProps & React.RefAttributes<HTMLDivElement>>;
  Arrow: React.ForwardRefExoticComponent<PopoverArrowProps & React.RefAttributes<HTMLSpanElement>>;
}

export interface TabsItem {
  value: string;
  label: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  children?: React.ReactNode;
  items?: TabsItem[];
  value?: string;
  defaultValue?: string;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  onValueChange?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string | number;
  index?: number;
}

export interface TabsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number;
  index?: number;
}

export interface TabsCompoundComponent extends React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>>;
  List: React.ForwardRefExoticComponent<TabsListProps & React.RefAttributes<HTMLDivElement>>;
  Trigger: React.ForwardRefExoticComponent<TabsTriggerProps & React.RefAttributes<HTMLButtonElement>>;
  Panel: React.ForwardRefExoticComponent<TabsPanelProps & React.RefAttributes<HTMLDivElement>>;
}

export interface MenuItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface MenuProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  triggerContent?: React.ReactNode;
  items?: MenuItem[];
  closeOnSelect?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface MenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export interface MenuContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string | number;
  disabled?: boolean;
  textValue?: string;
  index?: number;
}

export interface MenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  labelId?: string;
}

export interface MenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export interface MenuCompoundComponent extends React.ForwardRefExoticComponent<MenuProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<MenuProps & React.RefAttributes<HTMLDivElement>>;
  Trigger: React.ForwardRefExoticComponent<MenuTriggerProps & React.RefAttributes<HTMLButtonElement>>;
  Content: React.ForwardRefExoticComponent<MenuContentProps & React.RefAttributes<HTMLDivElement>>;
  Item: React.ForwardRefExoticComponent<MenuItemProps & React.RefAttributes<HTMLButtonElement>>;
  Group: React.ForwardRefExoticComponent<MenuGroupProps & React.RefAttributes<HTMLDivElement>>;
  Separator: React.ForwardRefExoticComponent<MenuSeparatorProps & React.RefAttributes<HTMLDivElement>>;
}

export interface CommandConsumerBaseProps {
  commands?: ChipsCommandView[];
  adapter?: ChipsCommandAdapter;
  i18n?: ChipsCommandProviderProps["i18n"];
  query?: ChipsCommandQueryOptions;
  payload?: Record<string, unknown>;
  invocationContext?: Record<string, unknown>;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | string | null;
  onCommandInvoke?: (command: ChipsResolvedCommandView) => void;
  onStateChange?: (state: InteractiveState) => void;
}

export interface ShortcutProps extends Pick<CommandConsumerBaseProps, "onStateChange"> {
  shortcut?: string | ChipsCommandShortcut | ChipsCommandShortcut[];
  command?: ChipsCommandView;
  disabled?: boolean;
  ariaLabel?: string;
  separator?: string;
  [key: string]: unknown;
}

export interface ToolbarProps extends CommandConsumerBaseProps {
  toolbarId?: string;
  groupId?: string;
  ariaLabel?: string;
  [key: string]: unknown;
}

export interface ToolbarItemProps extends Omit<CommandConsumerBaseProps, "commands" | "query"> {
  command?: ChipsCommandView;
  visualState?: InteractiveState;
  [key: string]: unknown;
}

export interface MenuBarDescriptor {
  menuId: string;
  label?: React.ReactNode;
}

export interface MenuBarProps extends CommandConsumerBaseProps {
  menus?: MenuBarDescriptor[];
  ariaLabel?: string;
  [key: string]: unknown;
}

export interface ContextMenuProps extends CommandConsumerBaseProps {
  menuId?: string;
  triggerContent?: React.ReactNode;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  triggerContent?: React.ReactNode;
  content?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  readOnly?: boolean;
  required?: boolean;
  onStateChange?: (state: InteractiveState) => void;
}

export interface FormSectionProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  titleId?: string;
  description?: React.ReactNode;
  descriptionId?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  readOnly?: boolean;
  required?: boolean;
  onStateChange?: (state: InteractiveState) => void;
}

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string;
  name?: string;
  children?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  readOnly?: boolean;
  onStateChange?: (state: InteractiveState) => void;
}

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children?: React.ReactNode;
  requiredIndicator?: React.ReactNode;
}

export interface FormControlProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}

export interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
  live?: "polite" | "assertive" | "off";
}

export interface FormHintProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

export interface FormCompoundComponent extends React.ForwardRefExoticComponent<FormProps & React.RefAttributes<HTMLFormElement>> {
  Root: React.ForwardRefExoticComponent<FormProps & React.RefAttributes<HTMLFormElement>>;
  Section: React.ForwardRefExoticComponent<FormSectionProps & React.RefAttributes<HTMLElement>>;
  Field: React.ForwardRefExoticComponent<FormFieldProps & React.RefAttributes<HTMLDivElement>>;
  Label: React.ForwardRefExoticComponent<FormLabelProps & React.RefAttributes<HTMLLabelElement>>;
  Control: React.ForwardRefExoticComponent<FormControlProps & React.RefAttributes<HTMLElement>>;
  Error: React.ForwardRefExoticComponent<FormErrorProps & React.RefAttributes<HTMLParagraphElement>>;
  Hint: React.ForwardRefExoticComponent<FormHintProps & React.RefAttributes<HTMLParagraphElement>>;
}

export interface VirtualListProps {
  items?: VirtualItem[];
  itemHeight?: number;
  height?: number;
  overscan?: number;
  ariaLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  activeIndex?: number;
  defaultActiveIndex?: number;
  renderItem?: (item: VirtualItem, index: number) => React.ReactNode;
  onActiveIndexChange?: (index: number) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface DataGridProps {
  children?: React.ReactNode;
  columns?: DataGridColumn[];
  rows?: DataGridRow[];
  sort?: SortState | null;
  defaultSort?: SortState | null;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  onSortChange?: (sort: SortState | null) => void;
  onSelectedRowIdsChange?: (rowIds: string[]) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface DataGridToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  ariaLabel?: string;
}

export interface DataGridHeaderProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

export interface DataGridRowProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  rowId?: string | number;
  selected?: boolean;
  active?: boolean;
}

export interface DataGridCellProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  columnKey?: string;
  header?: boolean;
  sortable?: boolean;
  sortDirection?: SortState["direction"] | null;
}

export interface DataGridPaginationProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  page?: number;
  pageCount?: number;
  ariaLabel?: string;
}

export interface DataGridCompoundComponent extends React.ForwardRefExoticComponent<DataGridProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<DataGridProps & React.RefAttributes<HTMLDivElement>>;
  Toolbar: React.ForwardRefExoticComponent<DataGridToolbarProps & React.RefAttributes<HTMLDivElement>>;
  Header: React.ForwardRefExoticComponent<DataGridHeaderProps & React.RefAttributes<HTMLElement>>;
  Row: React.ForwardRefExoticComponent<DataGridRowProps & React.RefAttributes<HTMLElement>>;
  Cell: React.ForwardRefExoticComponent<DataGridCellProps & React.RefAttributes<HTMLElement>>;
  Pagination: React.ForwardRefExoticComponent<DataGridPaginationProps & React.RefAttributes<HTMLElement>>;
}

export interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  nodes?: TreeNode[];
  expandedIds?: string[];
  defaultExpandedIds?: string[];
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  expandIconContent?: React.ReactNode;
  collapseIconContent?: React.ReactNode;
  onExpandedIdsChange?: (expandedIds: string[]) => void;
  onSelectedIdChange?: (selectedId: string | null) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface TreeItemProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  id?: string | number;
  label?: React.ReactNode;
  textValue?: string;
  disabled?: boolean;
  level?: number;
  parentId?: string | null;
  posInSet?: number;
  setSize?: number;
}

export interface TreeBranchProps extends TreeItemProps {
  groupId?: string;
}

export interface TreeLeafProps extends TreeItemProps {}

export interface TreeDisclosureProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

export interface TreeCompoundComponent extends React.ForwardRefExoticComponent<TreeProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<TreeProps & React.RefAttributes<HTMLDivElement>>;
  Item: React.ForwardRefExoticComponent<TreeItemProps & React.RefAttributes<HTMLElement>>;
  Branch: React.ForwardRefExoticComponent<TreeBranchProps & React.RefAttributes<HTMLElement>>;
  Leaf: React.ForwardRefExoticComponent<TreeLeafProps & React.RefAttributes<HTMLElement>>;
  Disclosure: React.ForwardRefExoticComponent<TreeDisclosureProps & React.RefAttributes<HTMLButtonElement>>;
}

export interface DateTimeProps {
  id?: string;
  label?: React.ReactNode;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  readOnly?: boolean;
  iconContent?: React.ReactNode;
  onValueChange?: (value: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface CommandPaletteProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  query?: string;
  defaultQuery?: string;
  items?: CommandPaletteItem[];
  commands?: ChipsCommandView[];
  adapter?: ChipsCommandAdapter;
  i18n?: ChipsCommandProviderProps["i18n"];
  commandQuery?: ChipsCommandQueryOptions;
  payload?: Record<string, unknown>;
  invocationContext?: Record<string, unknown>;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  inputPlaceholder?: string;
  ariaLabel?: string;
  listId?: string;
  onOpenChange?: (open: boolean) => void;
  onQueryChange?: (query: string) => void;
  onSelect?: (item: CommandPaletteItem) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface CommandPaletteInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
}

export interface CommandPaletteListProps extends React.HTMLAttributes<HTMLUListElement> {
  children?: React.ReactNode;
}

export interface CommandPaletteItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
  item?: CommandPaletteItem;
  id?: string | number;
  label?: React.ReactNode;
  shortcut?: React.ReactNode;
  disabled?: boolean;
  textValue?: string;
}

export interface CommandPaletteGroupProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode;
  label?: React.ReactNode;
  labelId?: string;
}

export interface CommandPaletteCompoundComponent extends React.ForwardRefExoticComponent<CommandPaletteProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<CommandPaletteProps & React.RefAttributes<HTMLDivElement>>;
  Input: React.ForwardRefExoticComponent<CommandPaletteInputProps & React.RefAttributes<HTMLInputElement>>;
  List: React.ForwardRefExoticComponent<CommandPaletteListProps & React.RefAttributes<HTMLUListElement>>;
  Item: React.ForwardRefExoticComponent<CommandPaletteItemProps & React.RefAttributes<HTMLLIElement>>;
  Group: React.ForwardRefExoticComponent<CommandPaletteGroupProps & React.RefAttributes<HTMLLIElement>>;
}

export interface NavigationSplitViewProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface NavigationSplitViewRegionProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  [key: string]: unknown;
}

export interface NavigationSplitViewCompoundComponent extends React.ForwardRefExoticComponent<NavigationSplitViewProps & React.RefAttributes<HTMLDivElement>> {
  Root: React.ForwardRefExoticComponent<NavigationSplitViewProps & React.RefAttributes<HTMLDivElement>>;
  Sidebar: React.ForwardRefExoticComponent<NavigationSplitViewRegionProps & React.RefAttributes<HTMLElement>>;
  Content: React.ForwardRefExoticComponent<NavigationSplitViewRegionProps & React.RefAttributes<HTMLElement>>;
  Detail: React.ForwardRefExoticComponent<NavigationSplitViewRegionProps & React.RefAttributes<HTMLElement>>;
}

export interface SplitPaneProps {
  orientation?: "horizontal" | "vertical";
  ratio?: number;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  start?: React.ReactNode;
  end?: React.ReactNode;
  onRatioChange?: (ratio: number) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface DockPanelProps {
  panels?: DockPanelItem[];
  panelStates?: Record<string, string>;
  defaultPanelStates?: Record<string, string>;
  activePanelId?: string;
  defaultActivePanelId?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  onPanelStatesChange?: (panelStates: Record<string, string>) => void;
  onActivePanelIdChange?: (activePanelId: string) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface InspectorProps {
  sections?: InspectorSection[];
  openSectionIds?: string[];
  defaultOpenSectionIds?: string[];
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  onOpenSectionIdsChange?: (sectionIds: string[]) => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface PanelHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  closable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  expandIconContent?: React.ReactNode;
  collapseIconContent?: React.ReactNode;
  closeIconContent?: React.ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface CardShellProps {
  title?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface ToolWindowProps {
  title?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  minimized?: boolean;
  defaultMinimized?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  expandIconContent?: React.ReactNode;
  collapseIconContent?: React.ReactNode;
  closeIconContent?: React.ReactNode;
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  onMinimizedChange?: (minimized: boolean) => void;
  onFocus?: () => void;
  onStateChange?: (state: InteractiveState) => void;
  [key: string]: unknown;
}

export interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode | ((payload: { error: StandardErrorLike | null; state: InteractiveState }) => React.ReactNode);
  resetKeys?: unknown[];
  error?: StandardErrorLike | null;
  disabled?: boolean;
  loading?: boolean;
  title?: React.ReactNode;
  titleKey?: string;
  description?: React.ReactNode;
  descriptionKey?: string;
  retryLabel?: React.ReactNode;
  retryLabelKey?: string;
  showErrorMessage?: boolean;
  ariaLabel?: string;
  i18n?: I18nTextSource;
  traceId?: string;
  onError?: (error: StandardErrorLike) => void;
  onRetry?: () => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface LoadingBoundaryProps {
  children?: React.ReactNode;
  loading?: boolean;
  delayMs?: number;
  skeletonLines?: number;
  fallback?: React.ReactNode | ((payload: { state: InteractiveState; loading: boolean }) => React.ReactNode);
  disabled?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel?: string;
  ariaLabelKey?: string;
  loadingText?: React.ReactNode;
  loadingTextKey?: string;
  i18n?: I18nTextSource;
  configSource?: ConfigSource;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface NotificationProps {
  items?: SystemMessageItem[];
  defaultItems?: SystemMessageItem[];
  maxVisible?: number;
  defaultDurationMs?: number;
  closeButtonLabel?: string;
  closeButtonLabelKey?: string;
  closeIconContent?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel: string;
  i18n?: I18nTextSource;
  configSource?: ConfigSource;
  traceId?: string;
  onItemsChange?: (items: SystemMessageItem[]) => void;
  onDismiss?: (item: SystemMessageItem, reason?: string) => void;
  onAction?: (item: SystemMessageItem) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface ToastProps {
  entries?: SystemMessageItem[];
  defaultEntries?: SystemMessageItem[];
  maxVisible?: number;
  defaultDurationMs?: number;
  closeButtonLabel?: string;
  closeButtonLabelKey?: string;
  closeIconContent?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel: string;
  placement?: string;
  i18n?: I18nTextSource;
  configSource?: ConfigSource;
  traceId?: string;
  onEntriesChange?: (entries: SystemMessageItem[]) => void;
  onDismiss?: (item: SystemMessageItem, reason?: string) => void;
  onAction?: (item: SystemMessageItem) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  titleKey?: string;
  description?: React.ReactNode;
  descriptionKey?: string;
  actionLabel?: React.ReactNode;
  actionLabelKey?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  ariaLabel: string;
  i18n?: I18nTextSource;
  onAction?: () => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface ErrorStateModel {
  error: StandardErrorLike;
  retryable: boolean;
  showDetails: boolean;
  tone: ChipsControlTone;
  state: InteractiveState;
}

export interface ErrorStateProps {
  error?: StandardErrorLike | Error | string | null;
  code?: string;
  message?: string;
  details?: unknown;
  title?: React.ReactNode;
  titleKey?: string;
  description?: React.ReactNode;
  descriptionKey?: string;
  actionLabel?: React.ReactNode;
  actionLabelKey?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  fallbackActionLabel?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  retryable?: boolean;
  showDetails?: boolean;
  ariaLabel?: string;
  i18n?: I18nTextSource;
  traceId?: string;
  onAction?: (error: StandardErrorLike, event?: React.MouseEvent<HTMLButtonElement>) => void;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export interface SkeletonProps {
  lines?: number;
  animated?: boolean;
  shape?: "line" | "circle" | "rect";
  loading?: boolean;
  disabled?: boolean;
  error?: StandardErrorLike | string | null;
  ariaLabel?: string;
  ariaLabelKey?: string;
  i18n?: I18nTextSource;
  onStateChange?: (state: InteractiveState) => void;
  onDiagnostic?: (record: ObservationRecord) => void;
  [key: string]: unknown;
}

export const InteractiveEventType: {
  readonly POINTER_ENTER: "pointer-enter";
  readonly POINTER_LEAVE: "pointer-leave";
  readonly FOCUS: "focus";
  readonly BLUR: "blur";
  readonly PRESS_START: "press-start";
  readonly PRESS_END: "press-end";
};

export const COMPONENT_TOKEN_MAP: Record<string, string[]>;

export const ChipsText: React.ForwardRefExoticComponent<ChipsTextProps & React.RefAttributes<HTMLElement>>;
export const ChipsLabel: React.ForwardRefExoticComponent<ChipsLabelProps & React.RefAttributes<HTMLLabelElement>>;
export const ChipsIcon: React.ForwardRefExoticComponent<ChipsIconProps & React.RefAttributes<HTMLSpanElement>>;
export const ChipsButton: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsIconButton: React.ForwardRefExoticComponent<IconButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsToggleButton: React.ForwardRefExoticComponent<ToggleButtonProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsBadge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<HTMLSpanElement>>;
export const ChipsTag: React.ForwardRefExoticComponent<TagProps & React.RefAttributes<HTMLSpanElement>>;
export const ChipsAvatar: React.ForwardRefExoticComponent<AvatarProps & React.RefAttributes<HTMLSpanElement>>;
export const ChipsImage: React.ForwardRefExoticComponent<ImageProps & React.RefAttributes<HTMLElement>>;
export const ChipsMedia: React.ForwardRefExoticComponent<MediaProps & React.RefAttributes<HTMLElement>>;
export const ChipsSpinner: React.ForwardRefExoticComponent<SpinnerProps & React.RefAttributes<HTMLSpanElement>>;
export const ChipsProgress: React.ForwardRefExoticComponent<ProgressProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsRating: React.ForwardRefExoticComponent<RatingProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsTextField: React.ForwardRefExoticComponent<TextFieldProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsTextArea: React.ForwardRefExoticComponent<TextAreaProps & React.RefAttributes<HTMLTextAreaElement>>;
export const ChipsSearchField: React.ForwardRefExoticComponent<SearchFieldProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsSecureField: React.ForwardRefExoticComponent<SecureFieldProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsInput: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsCheckbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsRadioGroup: React.ForwardRefExoticComponent<RadioGroupProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsSwitch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsSelect: SelectCompoundComponent;
export const ChipsSegmentedControl: React.ForwardRefExoticComponent<SegmentedControlProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsComboBox: React.ForwardRefExoticComponent<ComboBoxProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsNumberInput: React.ForwardRefExoticComponent<NumberInputProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsStepper: React.ForwardRefExoticComponent<StepperProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsSlider: React.ForwardRefExoticComponent<SliderProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsDatePicker: React.ForwardRefExoticComponent<DatePickerProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsTimePicker: React.ForwardRefExoticComponent<TimePickerProps & React.RefAttributes<HTMLInputElement>>;
export const ChipsDialog: DialogCompoundComponent;
export const ChipsPopover: PopoverCompoundComponent;
export const ChipsTabs: TabsCompoundComponent;
export const ChipsMenu: MenuCompoundComponent;
export const ChipsCommandProvider: React.FC<ChipsCommandProviderProps>;
export const ChipsShortcut: React.ForwardRefExoticComponent<ShortcutProps & React.RefAttributes<HTMLElement>>;
export const ChipsToolbarItem: React.ForwardRefExoticComponent<ToolbarItemProps & React.RefAttributes<HTMLButtonElement>>;
export const ChipsToolbar: React.ForwardRefExoticComponent<ToolbarProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsMenuBar: React.ForwardRefExoticComponent<MenuBarProps & React.RefAttributes<HTMLElement>>;
export const ChipsContextMenu: React.ForwardRefExoticComponent<ContextMenuProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsTooltip: React.ForwardRefExoticComponent<TooltipProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsForm: FormCompoundComponent;
export const ChipsVirtualList: React.ForwardRefExoticComponent<VirtualListProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsDataGrid: DataGridCompoundComponent;
export const ChipsTree: TreeCompoundComponent;
export const ChipsDateTime: React.ForwardRefExoticComponent<DateTimeProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsCommandPalette: CommandPaletteCompoundComponent;
export const ChipsNavigationSplitView: NavigationSplitViewCompoundComponent;
export const ChipsSplitPane: React.ForwardRefExoticComponent<SplitPaneProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsDockPanel: React.ForwardRefExoticComponent<DockPanelProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsInspector: React.ForwardRefExoticComponent<InspectorProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsPanelHeader: React.ForwardRefExoticComponent<PanelHeaderProps & React.RefAttributes<HTMLElement>>;
export const ChipsCardShell: React.ForwardRefExoticComponent<CardShellProps & React.RefAttributes<HTMLElement>>;
export const ChipsToolWindow: React.ForwardRefExoticComponent<ToolWindowProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsErrorBoundary: React.ForwardRefExoticComponent<ErrorBoundaryProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsLoadingBoundary: React.ForwardRefExoticComponent<LoadingBoundaryProps & React.RefAttributes<HTMLElement>>;
export const ChipsNotification: React.ForwardRefExoticComponent<NotificationProps & React.RefAttributes<HTMLElement>>;
export const ChipsToast: React.ForwardRefExoticComponent<ToastProps & React.RefAttributes<HTMLElement>>;
export const ChipsEmptyState: React.ForwardRefExoticComponent<EmptyStateProps & React.RefAttributes<HTMLDivElement>>;
export const ChipsErrorState: React.ForwardRefExoticComponent<ErrorStateProps & React.RefAttributes<HTMLElement>>;
export const ChipsSkeleton: React.ForwardRefExoticComponent<SkeletonProps & React.RefAttributes<HTMLDivElement>>;

export function resolveInteractiveState(params: {
  disabled?: boolean;
  loading?: boolean;
  error?: StandardErrorLike | null;
  interaction?: { hovered?: boolean; focused?: boolean; active?: boolean };
}): InteractiveState;
export function interactiveStateReducer(
  state: { hovered?: boolean; focused?: boolean; active?: boolean },
  event: { type: (typeof InteractiveEventType)[keyof typeof InteractiveEventType] },
): { hovered: boolean; focused: boolean; active: boolean };
export function buildComponentContract(component: string): {
  component: string;
  scope: string;
  parts: string[];
  states: string[];
  tokens: string[];
};
export function validateComponentA11y(component: string, props: Record<string, unknown>): boolean;
export function resolveTextInputDescriptor(params?: Record<string, unknown>): TextInputDescriptor;
export function resolveNumericControlModel(params?: Record<string, unknown>): NumericControlModel;
export function resolveSliderModel(params?: Record<string, unknown>): SliderModel;
export function resolveDatePickerModel(params?: Record<string, unknown>): DatePickerModel;
export function resolveTimePickerModel(params?: Record<string, unknown>): TimePickerModel;
export function resolveImageModel(params?: Record<string, unknown>): ImageModel;
export function resolveMediaModel(params?: Record<string, unknown>): MediaModel;
export function resolveErrorStateModel(params?: Record<string, unknown>): ErrorStateModel;
export const P0_DISPLAY_COMPONENTS: ComponentMeta[];
export const TASK015_BASE_CONTROL_COMPONENTS: ComponentMeta[];
export const P0_BASE_INTERACTIVE_COMPONENTS: ComponentMeta[];
export const P0_DATA_FORM_COMPONENTS: ComponentMeta[];
export const STAGE7_DATA_ADVANCED_COMPONENTS: ComponentMeta[];
export const STAGE7_WORKBENCH_COMPONENTS: ComponentMeta[];
export const STAGE8_SYSTEM_UX_COMPONENTS: ComponentMeta[];
export function applyDataGridSort<T extends DataGridRow>(rows: T[], sort?: SortState | null): T[];
export function clampSplitRatio(ratio: number, minRatio?: number, maxRatio?: number): number;
export function computeVirtualWindow(params: {
  itemCount: number;
  itemHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}): { start: number; end: number; offsetTop: number; offsetBottom: number };
export function createComponentMeta(meta: ComponentMeta): ComponentMeta;
export function createObservationRecord(record: ObservationRecord): ObservationRecord;
export function dismissSystemMessage<T extends { id: string }>(items: T[], targetId: string): T[];
export function filterCommandPaletteItems<T extends CommandPaletteItem>(items: T[], query?: string): T[];
export function findTreeParentId(nodes: TreeNode[], nodeId: string): string | null;
export function flattenTreeNodes(nodes: TreeNode[], expandedIds?: string[]): Array<TreeNode & { parentId?: string; hasChildren?: boolean; expanded?: boolean }>;
export function getNextEnabledIndex(
  items: Array<{ disabled?: boolean }>,
  startIndex: number,
  direction: "next" | "prev",
  loop?: boolean,
): number;
export function normalizeSystemMessageItems(items: SystemMessageItem[], kind: string): Array<SystemMessageItem & { effectiveDurationMs?: number }>;
export function parsePositiveInteger(value: unknown): number | null;
export function resolveConfigValue<T>(params: {
  configSource?: ConfigSource;
  key: string;
  defaultValue: T;
  parser?: (value: unknown) => T;
  onDiagnostic?: (record: ObservationRecord | Record<string, unknown>) => void;
}): T;
export function resolveDockPanelStateMap(panels: DockPanelItem[], stateMap?: Record<string, string>): Record<string, string>;
export function createCommandAdapter(client: unknown): ChipsCommandAdapter;
export function useChipsCommandContext(): ChipsCommandProviderProps | null;
export function useChipsCommands(options?: {
  adapter?: ChipsCommandAdapter;
  commands?: ChipsCommandView[];
  query?: ChipsCommandQueryOptions;
}): { commands: ChipsCommandView[]; loading: boolean; error: StandardErrorLike | null };
export function resolveCommandToolbarItems(
  commands: ChipsCommandView[],
  options?: { toolbarId?: string; groupId?: string; i18n?: ChipsCommandProviderProps["i18n"]; includeHidden?: boolean },
): ChipsResolvedCommandView[];
export function resolveCommandMenuGroups(
  commands: ChipsCommandView[],
  options?: { menuId?: string; i18n?: ChipsCommandProviderProps["i18n"]; includeHidden?: boolean },
): Array<{ groupId: string; items: ChipsResolvedCommandView[] }>;
export function resolveCommandPaletteItems(
  commands: ChipsCommandView[],
  options?: { i18n?: ChipsCommandProviderProps["i18n"]; includeHidden?: boolean },
): CommandPaletteItem[];
export function resolveI18nText(params: {
  i18n?: I18nTextSource;
  key: string;
  fallback: string;
  params?: Record<string, string | number>;
  onDiagnostic?: (record: ObservationRecord | Record<string, unknown>) => void;
}): string;
export function toStandardError(error: unknown, fallbackCode?: string): StandardErrorLike;
export function toggleInspectorSection(sectionIds: string[] | undefined, sectionId: string): string[];
