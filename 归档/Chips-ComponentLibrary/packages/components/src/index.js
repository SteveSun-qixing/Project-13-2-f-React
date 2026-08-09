import React from "react";
import { createScopeAttributes } from "@chips/primitives";
import {
  assertAriaProps,
  buildAriaDescribedBy,
  createAriaStatusProps,
  createFocusRestorePoint,
  createFocusScope,
  createRovingTabIndex,
  getRovingTabIndexProps,
  isKeyboardActivationKey
} from "@chips/a11y";
import {
  buildLayoutComponentContract,
  ChipsBox,
  ChipsDivider,
  ChipsGrid,
  ChipsInline,
  ChipsScrollView,
  ChipsSection,
  ChipsSpacer,
  ChipsSplitView,
  ChipsStack,
  ChipsView,
  LAYOUT_COMPONENT_TOKEN_MAP,
  LAYOUT_PRIMITIVE_COMPONENTS,
  validateLayoutComponentA11y
} from "./layout-primitives.js";

export {
  buildLayoutComponentContract,
  ChipsBox,
  ChipsDivider,
  ChipsGrid,
  ChipsInline,
  ChipsScrollView,
  ChipsSection,
  ChipsSpacer,
  ChipsSplitView,
  ChipsStack,
  ChipsView,
  LAYOUT_COMPONENT_TOKEN_MAP,
  LAYOUT_PRIMITIVE_COMPONENTS,
  validateLayoutComponentA11y
};

const INTERACTIVE_STATE_PRIORITY = [
  "disabled",
  "loading",
  "error",
  "active",
  "focus",
  "hover",
  "idle"
];

const INITIAL_INTERACTION_STATE = {
  hovered: false,
  focused: false,
  active: false
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeIconName(name) {
  if (!isNonEmptyString(name)) {
    throw new Error("ICON_DESCRIPTOR_INVALID:name");
  }
  return name.trim().replace(/[\s-]+/g, "_");
}

function normalizeIconStyle(style) {
  return style === "rounded" || style === "sharp" ? style : "outlined";
}

function normalizeIconFill(fill) {
  return fill === 1 ? 1 : 0;
}

function normalizeIconAxis(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const ICON_TONES = new Set(["default", "muted", "accent", "danger", "disabled"]);

function normalizeIconTone(tone) {
  return ICON_TONES.has(tone) ? tone : "default";
}

function normalizeIconDescriptor(descriptor = {}) {
  return {
    name: normalizeIconName(descriptor.name),
    style: normalizeIconStyle(descriptor.style),
    fill: normalizeIconFill(descriptor.fill),
    wght: normalizeIconAxis(descriptor.wght, 400),
    grad: normalizeIconAxis(descriptor.grad, 0),
    opsz: normalizeIconAxis(descriptor.opsz, 24),
    tone: normalizeIconTone(descriptor.tone),
    explicitAxes: {
      fill: descriptor.fill === 0 || descriptor.fill === 1,
      wght: typeof descriptor.wght === "number" && Number.isFinite(descriptor.wght),
      grad: typeof descriptor.grad === "number" && Number.isFinite(descriptor.grad),
      opsz: typeof descriptor.opsz === "number" && Number.isFinite(descriptor.opsz)
    },
    decorative: descriptor.label ? false : descriptor.decorative !== false,
    label: isNonEmptyString(descriptor.label) ? descriptor.label.trim() : undefined
  };
}

const DEFAULT_ICON_DESCRIPTOR_MAP = Object.freeze({
  "chevron-down": Object.freeze({ name: "keyboard_arrow_down" }),
  close: Object.freeze({ name: "close" }),
  expand: Object.freeze({ name: "add" }),
  collapse: Object.freeze({ name: "remove" }),
  calendar: Object.freeze({ name: "calendar_month" }),
  time: Object.freeze({ name: "schedule" }),
  search: Object.freeze({ name: "search" }),
  visibility: Object.freeze({ name: "visibility" }),
  "visibility-off": Object.freeze({ name: "visibility_off" })
});

function getDefaultIconDescriptor(type) {
  if (!isNonEmptyString(type)) {
    return null;
  }
  return DEFAULT_ICON_DESCRIPTOR_MAP[type] ?? null;
}

const TEXT_ELEMENT_TAGS = new Set(["span", "p", "strong", "em", "small", "code", "div"]);
const TEXT_TONES = new Set(["default", "muted", "accent", "error"]);
const TEXT_EMPHASIS = new Set(["regular", "strong", "code"]);
const CONTROL_TONES = new Set(["neutral", "accent", "success", "warning", "error"]);
const RATING_SHAPES = new Set(["star", "heart"]);
const AVATAR_SHAPES = new Set(["circle", "rounded", "square"]);
const IMAGE_FIT_VALUES = new Set(["cover", "contain", "fill", "none", "scale-down"]);
const MEDIA_KINDS = new Set(["audio", "video", "generic"]);
const MEDIA_FIT_VALUES = new Set(["cover", "contain", "fill", "none", "scale-down"]);
const TASK015_BASE_CONTROL_STATES = ["idle", "disabled", "loading", "error"];

function normalizeTextElementTag(tag, fallback = "span") {
  return TEXT_ELEMENT_TAGS.has(tag) ? tag : fallback;
}

function normalizeTextTone(tone) {
  return TEXT_TONES.has(tone) ? tone : "default";
}

function normalizeTextEmphasis(emphasis) {
  return TEXT_EMPHASIS.has(emphasis) ? emphasis : "regular";
}

function normalizeControlTone(tone) {
  return CONTROL_TONES.has(tone) ? tone : "neutral";
}

function normalizeRatingShape(shape) {
  return RATING_SHAPES.has(shape) ? shape : "star";
}

function normalizeAvatarShape(shape) {
  return AVATAR_SHAPES.has(shape) ? shape : "circle";
}

function normalizeImageFit(fit) {
  return IMAGE_FIT_VALUES.has(fit) ? fit : "cover";
}

function normalizeObjectPosition(value) {
  return isNonEmptyString(value) ? value.trim() : "center";
}

function normalizeDimension(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (isNonEmptyString(value)) {
    return value.trim();
  }

  return undefined;
}

function normalizeMediaKind(kind) {
  return MEDIA_KINDS.has(kind) ? kind : "generic";
}

function normalizeMediaFit(fit) {
  return MEDIA_FIT_VALUES.has(fit) ? fit : "contain";
}

function resolveAccessibleText(params = {}) {
  const {
    value,
    key,
    params: textParams,
    fallback = "",
    i18n,
    onDiagnostic
  } = params;

  if (isNonEmptyString(key)) {
    return resolveI18nText({
      i18n,
      key,
      params: textParams,
      fallback: isNonEmptyString(fallback) ? fallback : value,
      onDiagnostic
    });
  }

  if (isNonEmptyString(value)) {
    return value.trim();
  }

  return isNonEmptyString(fallback) ? fallback.trim() : "";
}

function resolveDisplayContent(params = {}) {
  const {
    children,
    value,
    key,
    i18n,
    params: textParams,
    fallback = "",
    onDiagnostic
  } = params;

  if (children !== undefined) {
    return children;
  }

  const fallbackText = typeof fallback === "string"
    ? fallback
    : typeof value === "string"
      ? value
      : "";

  if (isNonEmptyString(key)) {
    return resolveI18nText({
      i18n,
      key,
      params: textParams,
      fallback: fallbackText,
      onDiagnostic
    });
  }

  return value !== undefined ? value : fallbackText;
}

function formatBadgeValue(count, max) {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return undefined;
  }

  const limit = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 99;
  return count > limit ? `${limit}+` : String(count);
}

function resolveAvatarInitials(params = {}) {
  const { initials, name, fallback = "?" } = params;

  if (isNonEmptyString(initials)) {
    return initials.trim().slice(0, 3).toUpperCase();
  }

  if (isNonEmptyString(name)) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const source = words.length > 1
      ? `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`
      : name.trim().slice(0, 2);
    return source.toUpperCase();
  }

  return fallback;
}

function toFiniteNumber(value, fallback) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDecimalPrecision(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const source = String(value);
  if (source.includes("e-")) {
    const [, exponent] = source.split("e-");
    return Number.parseInt(exponent, 10) || 0;
  }

  const [, fraction = ""] = source.split(".");
  return fraction.length;
}

function roundNumericValue(value, precision) {
  const multiplier = 10 ** Math.min(Math.max(precision, 0), 12);
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function normalizeNumericRange(params = {}) {
  const min = toFiniteNumber(params.min, 0);
  const rawMax = toFiniteNumber(params.max, 100);
  const max = rawMax > min ? rawMax : 100;
  const rawStep = toFiniteNumber(params.step, 1);
  const step = rawStep > 0 ? rawStep : 1;
  const rawLargeStep = toFiniteNumber(params.largeStep, step * 10);
  const largeStep = rawLargeStep > 0 ? rawLargeStep : step * 10;
  const precision = Math.max(
    getDecimalPrecision(min),
    getDecimalPrecision(max),
    getDecimalPrecision(step),
    getDecimalPrecision(largeStep)
  );

  return {
    min,
    max,
    step,
    largeStep,
    precision
  };
}

function alignNumericStep(value, range) {
  const offset = (value - range.min) / range.step;
  return roundNumericValue(range.min + Math.round(offset) * range.step, range.precision);
}

function clampNumericValue(value, range) {
  return roundNumericValue(clampNumber(value, range.min, range.max), range.precision);
}

function normalizeNumericValue(value, range, options = {}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const clamped = clampNumericValue(numeric, range);
  return options.align === false ? clamped : clampNumericValue(alignNumericStep(clamped, range), range);
}

function parseNumericText(text, range, options = {}) {
  const source = String(text ?? "").trim();
  if (source.length === 0) {
    return {
      kind: options.required ? "invalid" : "empty",
      value: null,
      text: source
    };
  }

  const numeric = Number(source);
  if (!Number.isFinite(numeric)) {
    return {
      kind: "invalid",
      value: null,
      text: source
    };
  }

  return {
    kind: "valid",
    value: normalizeNumericValue(numeric, range, options),
    text: source
  };
}

function formatNumericValue(value, formatValue) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "";
  }

  if (typeof formatValue === "function") {
    return String(formatValue(value));
  }

  return String(value);
}

function resolveNumericValueText(value, range, valueText, formatValue) {
  if (isNonEmptyString(valueText)) {
    return valueText.trim();
  }

  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return undefined;
  }

  return formatNumericValue(clampNumericValue(Number(value), range), formatValue);
}

function getNumericStepForKey(key, range) {
  if (key === "ArrowUp" || key === "ArrowRight") {
    return range.step;
  }

  if (key === "ArrowDown" || key === "ArrowLeft") {
    return -range.step;
  }

  if (key === "PageUp") {
    return range.largeStep;
  }

  if (key === "PageDown") {
    return -range.largeStep;
  }

  return 0;
}

function getNextNumericValue(currentValue, range, delta, fallbackValue = range.min) {
  const base = Number.isFinite(Number(currentValue)) ? Number(currentValue) : fallbackValue;
  return normalizeNumericValue(base + delta, range);
}

function getNumericRatio(value, range) {
  const normalized = normalizeNumericValue(value, range) ?? range.min;
  return clampNumber((normalized - range.min) / (range.max - range.min), 0, 1);
}

function getNumericValueFromPointer(event, range, orientation) {
  return getNumericValueFromPointerTarget(event.currentTarget, event, range, orientation);
}

function getNumericValueFromPointerTarget(target, event, range, orientation) {
  if (!target || typeof target.getBoundingClientRect !== "function") {
    return null;
  }

  const rect = target.getBoundingClientRect();
  const horizontal = orientation !== "vertical";
  const ratio = horizontal
    ? (event.clientX - rect.left) / Math.max(rect.width, 1)
    : 1 - ((event.clientY - rect.top) / Math.max(rect.height, 1));

  return normalizeNumericValue(range.min + (clampNumber(ratio, 0, 1) * (range.max - range.min)), range);
}

export function resolveNumericControlModel(params = {}) {
  const range = normalizeNumericRange(params);
  const required = params.required === true;
  const parsed = params.text !== undefined
    ? parseNumericText(params.text, range, {
        required,
        align: params.align !== false
      })
    : null;
  const valueSource = parsed
    ? parsed.kind === "valid"
      ? parsed.value
      : null
    : params.value;
  const value = normalizeNumericValue(valueSource, range, {
    align: params.align !== false
  });

  return {
    ...range,
    value,
    text: params.text !== undefined
      ? String(params.text)
      : formatNumericValue(value, params.formatValue),
    empty: parsed?.kind === "empty" || value === null,
    invalid: parsed?.kind === "invalid",
    atMin: value !== null && value <= range.min,
    atMax: value !== null && value >= range.max,
    valueText: resolveNumericValueText(value, range, params.valueText, params.formatValue)
  };
}

export function resolveSliderModel(params = {}) {
  const model = resolveNumericControlModel(params);
  const orientation = params.orientation === "vertical" ? "vertical" : "horizontal";

  return {
    ...model,
    orientation,
    ratio: getNumericRatio(model.value, model)
  };
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DEFAULT_WEEK_DAY_LABELS = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const DEFAULT_MONTH_LABELS = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
]);

function padNumber(value, length = 2) {
  return String(value).padStart(length, "0");
}

function parseIsoDateParts(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const match = value.trim().match(ISO_DATE_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    return null;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return null;
  }

  return { year, month, day };
}

function formatIsoDate(parts) {
  if (!parts) {
    return "";
  }

  return `${padNumber(parts.year, 4)}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
}

function compareIsoDates(left, right) {
  const leftParts = parseIsoDateParts(left);
  const rightParts = parseIsoDateParts(right);
  if (!leftParts || !rightParts) {
    return 0;
  }

  return formatIsoDate(leftParts).localeCompare(formatIsoDate(rightParts));
}

function addCalendarMonths(month, delta) {
  const parts = parseIsoDateParts(`${padNumber(month.year, 4)}-${padNumber(month.month)}-01`) ?? {
    year: 1970,
    month: 1,
    day: 1
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}

function addIsoDateDays(value, delta) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return "";
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

function clampIsoDate(value, min, max) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return "";
  }

  const normalized = formatIsoDate(parts);
  if (parseIsoDateParts(min) && compareIsoDates(normalized, min) < 0) {
    return formatIsoDate(parseIsoDateParts(min));
  }
  if (parseIsoDateParts(max) && compareIsoDates(normalized, max) > 0) {
    return formatIsoDate(parseIsoDateParts(max));
  }

  return normalized;
}

function isIsoDateDisabled(value, min, max, isDateDisabled) {
  const normalized = clampIsoDate(value);
  if (!normalized) {
    return true;
  }

  if (parseIsoDateParts(min) && compareIsoDates(normalized, min) < 0) {
    return true;
  }
  if (parseIsoDateParts(max) && compareIsoDates(normalized, max) > 0) {
    return true;
  }
  if (typeof isDateDisabled === "function") {
    return isDateDisabled(normalized) === true;
  }

  return false;
}

function getTodayIsoDate() {
  const date = new Date();
  return formatIsoDate({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  });
}

function resolveCalendarMonth(value, defaultMonth, min, max) {
  const candidate = parseIsoDateParts(value)
    ?? parseIsoDateParts(defaultMonth)
    ?? parseIsoDateParts(clampIsoDate(getTodayIsoDate(), min, max))
    ?? parseIsoDateParts(min)
    ?? parseIsoDateParts(max)
    ?? { year: 1970, month: 1, day: 1 };

  return {
    year: candidate.year,
    month: candidate.month
  };
}

function normalizeWeekStartsOn(weekStartsOn) {
  const numeric = Number(weekStartsOn);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 6 ? numeric : 0;
}

function getWeekDayLabels(labels, weekStartsOn) {
  const source = Array.isArray(labels) && labels.length === 7
    ? labels.map((item) => String(item))
    : DEFAULT_WEEK_DAY_LABELS;
  return source.map((_, index) => source[(index + weekStartsOn) % 7]);
}

function formatCalendarTitle(month, monthLabels) {
  const labels = Array.isArray(monthLabels) && monthLabels.length === 12
    ? monthLabels
    : DEFAULT_MONTH_LABELS;
  return `${labels[month.month - 1] ?? padNumber(month.month)} ${month.year}`;
}

export function resolveDatePickerModel(params = {}) {
  const weekStartsOn = normalizeWeekStartsOn(params.weekStartsOn);
  const min = clampIsoDate(params.min);
  const max = clampIsoDate(params.max);
  const value = clampIsoDate(params.value, min, max);
  const text = params.text !== undefined ? String(params.text) : value;
  const parsedText = parseIsoDateParts(text);
  const textValue = parsedText ? formatIsoDate(parsedText) : "";
  const textInvalid = isNonEmptyString(text) && !parsedText;
  const explicitMonth = parseIsoDateParts(params.month);
  const month = explicitMonth
    ? { year: explicitMonth.year, month: explicitMonth.month }
    : resolveCalendarMonth(value || textValue, params.defaultMonth, min, max);
  const firstOfMonth = new Date(Date.UTC(month.year, month.month - 1, 1));
  const firstDay = firstOfMonth.getUTCDay();
  const leadingDays = (firstDay - weekStartsOn + 7) % 7;
  const gridStart = new Date(Date.UTC(month.year, month.month - 1, 1 - leadingDays));
  const today = getTodayIsoDate();
  const selected = value || textValue;
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart.getTime());
    cellDate.setUTCDate(gridStart.getUTCDate() + index);
    const cellValue = formatIsoDate({
      year: cellDate.getUTCFullYear(),
      month: cellDate.getUTCMonth() + 1,
      day: cellDate.getUTCDate()
    });
    const outsideMonth = cellDate.getUTCMonth() + 1 !== month.month;
    cells.push({
      value: cellValue,
      label: String(cellDate.getUTCDate()),
      selected: selected === cellValue,
      today: today === cellValue,
      outsideMonth,
      disabled: isIsoDateDisabled(cellValue, min, max, params.isDateDisabled)
    });
  }

  const disabledTextValue = textValue
    ? isIsoDateDisabled(textValue, min, max, params.isDateDisabled)
    : false;

  return {
    value,
    text,
    textValue,
    invalid: textInvalid || disabledTextValue || (Boolean(value) && isIsoDateDisabled(value, min, max, params.isDateDisabled)),
    min: min || undefined,
    max: max || undefined,
    month,
    title: formatCalendarTitle(month, params.monthLabels),
    weekDayLabels: getWeekDayLabels(params.weekDayLabels, weekStartsOn),
    cells,
    weekStartsOn
  };
}

function parseIsoTimeParts(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const match = value.trim().match(ISO_TIME_PATTERN);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return null;
  }

  return { hour, minute, second, hasSeconds: match[3] !== undefined };
}

function formatIsoTime(parts, includeSeconds = false) {
  if (!parts) {
    return "";
  }

  const base = `${padNumber(parts.hour)}:${padNumber(parts.minute)}`;
  return includeSeconds || parts.hasSeconds ? `${base}:${padNumber(parts.second)}` : base;
}

function timeToSeconds(value) {
  const parts = parseIsoTimeParts(value);
  return parts ? (parts.hour * 3600) + (parts.minute * 60) + parts.second : null;
}

function secondsToTime(totalSeconds, includeSeconds = false) {
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const hour = Math.floor(normalized / 3600);
  const minute = Math.floor((normalized % 3600) / 60);
  const second = normalized % 60;
  return formatIsoTime({ hour, minute, second }, includeSeconds);
}

function normalizeTimeStep(step) {
  const numeric = Number(step);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.floor(numeric)) : 60;
}

function normalizeIsoTime(value, options = {}) {
  const parts = parseIsoTimeParts(value);
  if (!parts) {
    return "";
  }

  const step = normalizeTimeStep(options.step);
  const includeSeconds = options.showSeconds === true || parts.hasSeconds || step < 60;
  const seconds = timeToSeconds(formatIsoTime(parts, true));
  const aligned = options.align === false
    ? seconds
    : Math.round(seconds / step) * step;
  return secondsToTime(aligned, includeSeconds);
}

function compareIsoTimes(left, right) {
  const leftSeconds = timeToSeconds(left);
  const rightSeconds = timeToSeconds(right);
  if (leftSeconds === null || rightSeconds === null) {
    return 0;
  }

  return leftSeconds - rightSeconds;
}

function clampIsoTime(value, options = {}) {
  const normalized = normalizeIsoTime(value, options);
  if (!normalized) {
    return "";
  }

  const min = normalizeIsoTime(options.min, { ...options, align: false });
  const max = normalizeIsoTime(options.max, { ...options, align: false });
  if (min && compareIsoTimes(normalized, min) < 0) {
    return min;
  }
  if (max && compareIsoTimes(normalized, max) > 0) {
    return max;
  }

  return normalized;
}

function getNextIsoTime(value, deltaSeconds, options = {}) {
  const step = normalizeTimeStep(options.step);
  const includeSeconds = options.showSeconds === true || step < 60;
  const currentSeconds = timeToSeconds(value) ?? timeToSeconds(options.min) ?? 0;
  return clampIsoTime(secondsToTime(currentSeconds + deltaSeconds, includeSeconds), options);
}

function isIsoTimeDisabled(value, options = {}) {
  const normalized = normalizeIsoTime(value, options);
  if (!normalized) {
    return true;
  }

  const min = normalizeIsoTime(options.min, { ...options, align: false });
  const max = normalizeIsoTime(options.max, { ...options, align: false });
  if (min && compareIsoTimes(normalized, min) < 0) {
    return true;
  }
  if (max && compareIsoTimes(normalized, max) > 0) {
    return true;
  }
  if (typeof options.isTimeDisabled === "function") {
    return options.isTimeDisabled(normalized) === true;
  }

  return false;
}

export function resolveTimePickerModel(params = {}) {
  const step = normalizeTimeStep(params.step);
  const optionStep = normalizeTimeStep(params.optionStep ?? Math.max(step, 1800));
  const value = clampIsoTime(params.value, params);
  const text = params.text !== undefined ? String(params.text) : value;
  const textValue = normalizeIsoTime(text, { ...params, align: false });
  const invalid = isNonEmptyString(text) && !textValue;
  const min = normalizeIsoTime(params.min, { ...params, align: false });
  const max = normalizeIsoTime(params.max, { ...params, align: false });
  const includeSeconds = params.showSeconds === true;
  const generatedOptionStep = optionStep;
  const options = Array.isArray(params.options)
    ? params.options
        .map((option) => {
          const optionValue = typeof option === "string" ? option : option?.value;
          const normalizedValue = normalizeIsoTime(optionValue, { ...params, align: false });
          if (!normalizedValue) {
            return null;
          }
          return {
            value: normalizedValue,
            label: typeof option === "string" ? normalizedValue : (option.label ?? normalizedValue),
            disabled: option?.disabled === true || isIsoTimeDisabled(normalizedValue, params)
          };
        })
        .filter(Boolean)
    : Array.from({ length: Math.ceil(86400 / generatedOptionStep) }, (_, index) => {
        const optionValue = secondsToTime(index * generatedOptionStep, includeSeconds);
        return {
          value: optionValue,
          label: optionValue,
          disabled: isIsoTimeDisabled(optionValue, params)
        };
      }).filter((option) => params.limitOptionsToRange === false || !option.disabled);

  const disabledTextValue = textValue ? isIsoTimeDisabled(textValue, params) : false;

  return {
    value,
    text,
    textValue,
    invalid: invalid || disabledTextValue || (Boolean(value) && isIsoTimeDisabled(value, params)),
    min: min || undefined,
    max: max || undefined,
    step,
    optionStep,
    showSeconds: includeSeconds,
    options
  };
}

export function resolveImageModel(params = {}) {
  const src = isNonEmptyString(params.src) ? params.src.trim() : "";
  const alt = isNonEmptyString(params.alt) ? params.alt.trim() : "";
  const decorative = params.decorative === true;
  const fit = normalizeImageFit(params.fit);
  const objectPosition = normalizeObjectPosition(params.objectPosition);
  const width = normalizeDimension(params.width);
  const height = normalizeDimension(params.height);
  const loading = params.loading === true;
  const error = normalizeError(params.error);
  const loaded = params.loaded === true;
  const hasSource = src.length > 0;
  const fallbackVisible = loading || Boolean(error) || !hasSource;

  return {
    src,
    alt: decorative ? "" : alt,
    decorative,
    fit,
    objectPosition,
    width,
    height,
    loading,
    loaded,
    error,
    hasSource,
    fallbackVisible,
    state: resolveInteractiveState({
      disabled: params.disabled === true,
      loading,
      error
    })
  };
}

export function resolveMediaModel(params = {}) {
  const kind = normalizeMediaKind(params.kind);
  const src = isNonEmptyString(params.src) ? params.src.trim() : "";
  const title = isNonEmptyString(params.title) ? params.title.trim() : "";
  const caption = params.caption !== undefined && params.caption !== null
    ? params.caption
    : "";
  const fit = normalizeMediaFit(params.fit);
  const objectPosition = normalizeObjectPosition(params.objectPosition);
  const poster = isNonEmptyString(params.poster) ? params.poster.trim() : "";
  const width = normalizeDimension(params.width);
  const height = normalizeDimension(params.height);
  const muted = params.muted === true;
  const loop = params.loop === true;
  const autoPlay = params.autoPlay === true;
  const controls = params.controls === true;
  const loading = params.loading === true;
  const error = normalizeError(params.error);
  const hasSource = src.length > 0;
  const fallbackVisible = loading || Boolean(error) || !hasSource;

  return {
    kind,
    src,
    title,
    caption,
    fit,
    objectPosition,
    poster,
    width,
    height,
    muted,
    loop,
    autoPlay,
    controls,
    loading,
    error,
    hasSource,
    fallbackVisible,
    state: resolveInteractiveState({
      disabled: params.disabled === true,
      loading,
      error
    })
  };
}

export function resolveErrorStateModel(params = {}) {
  const error = toStandardError(params.error, params.fallbackCode || "ERROR_STATE");
  const retryable = params.retryable === true || error.retryable === true;
  const showDetails = params.showDetails === true;

  return {
    error,
    retryable,
    showDetails,
    tone: normalizeControlTone(params.tone || "error"),
    state: resolveInteractiveState({
      disabled: params.disabled === true,
      loading: params.loading === true,
      error
    })
  };
}

function resolveProgressMetrics(params = {}) {
  const rawMin = toFiniteNumber(params.min, 0);
  const rawMax = toFiniteNumber(params.max, 100);
  const min = rawMax > rawMin ? rawMin : 0;
  const max = rawMax > rawMin ? rawMax : 100;
  const hasValue = params.value !== undefined && params.value !== null && Number.isFinite(Number(params.value));
  const indeterminate = params.indeterminate === true || !hasValue;

  if (indeterminate) {
    return {
      indeterminate: true,
      min,
      max,
      value: undefined,
      ratio: 0
    };
  }

  const value = clampNumber(Number(params.value), min, max);
  const ratio = (value - min) / (max - min);

  return {
    indeterminate: false,
    min,
    max,
    value,
    ratio
  };
}

export const ChipsText = React.forwardRef((props, ref) => {
  const {
    as = "span",
    children,
    text,
    textKey,
    textParams,
    fallbackText,
    tone,
    emphasis,
    truncate = false,
    disabled = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const resolvedTone = normalizedError ? "error" : normalizeTextTone(tone);
  const resolvedEmphasis = normalizeTextEmphasis(emphasis);
  const state = resolveInteractiveState({
    disabled,
    error: normalizedError
  });
  const elementTag = normalizeTextElementTag(as);
  const content = resolveDisplayContent({
    children,
    value: text,
    key: textKey,
    params: textParams,
    fallback: fallbackText,
    i18n,
    onDiagnostic
  });

  return React.createElement(
    elementTag,
    {
      ...rest,
      ...createScopeAttributes("text", "root", state),
      ref,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-tone": resolvedTone,
      "data-emphasis": resolvedEmphasis,
      "data-truncate": truncate ? "true" : "false"
    },
    content
  );
});

ChipsText.displayName = "ChipsText";

export const ChipsLabel = React.forwardRef((props, ref) => {
  const {
    children,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    required = false,
    requiredIndicator = "*",
    disabled = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const state = resolveInteractiveState({
    disabled,
    error: normalizedError
  });
  const content = resolveDisplayContent({
    children,
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });

  return React.createElement(
    "label",
    {
      ...rest,
      ...createScopeAttributes("label", "root", state),
      ref,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "aria-required": required ? "true" : undefined,
      "data-required": required ? "true" : "false"
    },
    content,
    required
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("label", "required-indicator", state),
            "aria-hidden": "true"
          },
          requiredIndicator
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("label", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsLabel.displayName = "ChipsLabel";

export const ChipsIcon = React.forwardRef((props, ref) => {
  const {
    descriptor,
    size,
    color,
    tone,
    style,
    title,
    ...rest
  } = props;

  const normalized = normalizeIconDescriptor(descriptor);
  const iconTone = normalizeIconTone(tone ?? normalized.tone);
  const ariaLabel = normalized.label
    || (isNonEmptyString(rest["aria-label"]) ? rest["aria-label"].trim() : undefined);
  const ariaLabelledBy = isNonEmptyString(rest["aria-labelledby"])
    ? rest["aria-labelledby"].trim()
    : undefined;

  if (!normalized.decorative && !ariaLabel && !ariaLabelledBy) {
    throw new Error("ICON_A11Y_LABEL_REQUIRED");
  }

  const rootStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    lineHeight: 1,
    fontSize: "var(--chips-icon-size, var(--chips-comp-icon-root-size, var(--chips-sys-icon-size, 1em)))",
    width: "var(--chips-icon-size, var(--chips-comp-icon-root-size, var(--chips-sys-icon-size, 1em)))",
    height: "var(--chips-icon-size, var(--chips-comp-icon-root-size, var(--chips-sys-icon-size, 1em)))",
    color: "var(--chips-icon-color, var(--chips-comp-icon-root-color, var(--chips-sys-icon-color, currentColor)))",
    fontVariationSettings:
      "\"FILL\" var(--chips-icon-fill, var(--chips-comp-icon-root-fill, var(--chips-sys-icon-fill, 0))), "
      + "\"wght\" var(--chips-icon-wght, var(--chips-comp-icon-root-wght, var(--chips-sys-icon-wght, 400))), "
      + "\"GRAD\" var(--chips-icon-grad, var(--chips-comp-icon-root-grad, var(--chips-sys-icon-grad, 0))), "
      + "\"opsz\" var(--chips-icon-opsz, var(--chips-comp-icon-root-opsz, var(--chips-sys-icon-opsz, 24)))",
    fontFeatureSettings: "\"liga\"",
    ...style
  };

  if (size !== undefined) {
    rootStyle["--chips-icon-size"] = typeof size === "number" ? `${size}px` : size;
  }
  if (color !== undefined) {
    rootStyle["--chips-icon-color"] = color;
  }
  if (normalized.explicitAxes.fill) {
    rootStyle["--chips-icon-fill"] = String(normalized.fill);
  }
  if (normalized.explicitAxes.wght) {
    rootStyle["--chips-icon-wght"] = String(normalized.wght);
  }
  if (normalized.explicitAxes.grad) {
    rootStyle["--chips-icon-grad"] = String(normalized.grad);
  }
  if (normalized.explicitAxes.opsz) {
    rootStyle["--chips-icon-opsz"] = String(normalized.opsz);
  }

  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("icon", "root", "idle"),
      ref,
      style: rootStyle,
      title: isNonEmptyString(title) ? title.trim() : title,
      "data-icon-name": normalized.name,
      "data-icon-style": normalized.style,
      "data-tone": iconTone,
      role: normalized.decorative ? undefined : "img",
      "aria-hidden": normalized.decorative ? "true" : undefined,
      "aria-label": normalized.decorative ? undefined : ariaLabel,
      "aria-labelledby": normalized.decorative ? undefined : ariaLabelledBy
    },
    normalized.name
  );
});

ChipsIcon.displayName = "ChipsIcon";

function resolveIconContent(content, fallbackType) {
  if (content !== undefined) {
    return content;
  }

  const descriptor = getDefaultIconDescriptor(fallbackType);
  return descriptor
    ? React.createElement(ChipsIcon, {
        descriptor
      })
    : null;
}

function createCompoundContext(scope) {
  const Context = React.createContext(null);
  Context.displayName = `${scope}-compound-context`;

  const usePartContext = (part) => {
    const value = React.useContext(Context);
    if (!value) {
      throw new Error(`${scope.toUpperCase()}_COMPOUND_CONTEXT_MISSING:${part}`);
    }
    return value;
  };

  return [Context, usePartContext];
}

function mergeEventHandlers(ownHandler, contextHandler) {
  return (event) => {
    if (typeof ownHandler === "function") {
      ownHandler(event);
    }
    if (!event.defaultPrevented && typeof contextHandler === "function") {
      contextHandler(event);
    }
  };
}

function normalizeDomIdSegment(value, fallback = "item") {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function hasReactElementType(children, expectedTypes) {
  let matched = false;
  React.Children.forEach(children, (child) => {
    if (matched || !React.isValidElement(child)) {
      return;
    }
    if (expectedTypes.includes(child.type)) {
      matched = true;
      return;
    }
    if (child.type === React.Fragment) {
      matched = hasReactElementType(child.props.children, expectedTypes);
    }
  });
  return matched;
}

export const InteractiveEventType = {
  POINTER_ENTER: "pointer-enter",
  POINTER_LEAVE: "pointer-leave",
  FOCUS: "focus",
  BLUR: "blur",
  PRESS_START: "press-start",
  PRESS_END: "press-end"
};

export const COMPONENT_TOKEN_MAP = {
  ...LAYOUT_COMPONENT_TOKEN_MAP,
  text: [
    "chips.comp.text.root.color.default",
    "chips.comp.text.root.color.muted",
    "chips.comp.text.root.color.accent",
    "chips.comp.text.root.color.error",
    "chips.comp.text.root.font-size",
    "chips.comp.text.root.line-height",
    "chips.comp.text.root.font-weight.regular",
    "chips.comp.text.root.font-weight.strong"
  ],
  label: [
    "chips.comp.label.root.color",
    "chips.comp.label.root.font-size",
    "chips.comp.label.root.line-height",
    "chips.comp.label.root.font-weight",
    "chips.comp.label.required-indicator.color",
    "chips.comp.label.status.color.error"
  ],
  icon: [
    "chips.comp.icon.root.color",
    "chips.comp.icon.root.size",
    "chips.comp.icon.root.fill",
    "chips.comp.icon.root.wght",
    "chips.comp.icon.root.grad",
    "chips.comp.icon.root.opsz"
  ],
  "icon-button": [
    "chips.comp.icon-button.root.size",
    "chips.comp.icon-button.root.radius",
    "chips.comp.icon-button.root.surface.idle",
    "chips.comp.icon-button.root.surface.hover",
    "chips.comp.icon-button.root.surface.active",
    "chips.comp.icon-button.root.surface.disabled",
    "chips.comp.icon-button.icon.color.idle",
    "chips.comp.icon-button.icon.color.disabled",
    "chips.comp.icon-button.focus.outline",
    "chips.comp.icon-button.status.color.error"
  ],
  "toggle-button": [
    "chips.comp.toggle-button.root.radius",
    "chips.comp.toggle-button.root.surface.idle",
    "chips.comp.toggle-button.root.surface.hover",
    "chips.comp.toggle-button.root.surface.active",
    "chips.comp.toggle-button.root.surface.pressed",
    "chips.comp.toggle-button.root.surface.disabled",
    "chips.comp.toggle-button.label.color.idle",
    "chips.comp.toggle-button.label.color.pressed",
    "chips.comp.toggle-button.label.color.disabled",
    "chips.comp.toggle-button.icon.color.idle",
    "chips.comp.toggle-button.icon.color.pressed",
    "chips.comp.toggle-button.icon.color.disabled",
    "chips.comp.toggle-button.focus.outline",
    "chips.comp.toggle-button.status.color.error"
  ],
  badge: [
    "chips.comp.badge.root.radius",
    "chips.comp.badge.root.surface.neutral",
    "chips.comp.badge.root.surface.accent",
    "chips.comp.badge.root.surface.success",
    "chips.comp.badge.root.surface.warning",
    "chips.comp.badge.root.surface.error",
    "chips.comp.badge.label.color.neutral",
    "chips.comp.badge.label.color.accent",
    "chips.comp.badge.label.color.success",
    "chips.comp.badge.label.color.warning",
    "chips.comp.badge.label.color.error",
    "chips.comp.badge.icon.color.neutral",
    "chips.comp.badge.icon.color.accent",
    "chips.comp.badge.icon.color.success",
    "chips.comp.badge.icon.color.warning",
    "chips.comp.badge.icon.color.error",
    "chips.comp.badge.status.color.error"
  ],
  tag: [
    "chips.comp.tag.root.radius",
    "chips.comp.tag.root.surface.idle",
    "chips.comp.tag.root.surface.hover",
    "chips.comp.tag.root.surface.active",
    "chips.comp.tag.root.surface.disabled",
    "chips.comp.tag.root.surface.error",
    "chips.comp.tag.label.color.idle",
    "chips.comp.tag.label.color.disabled",
    "chips.comp.tag.label.color.error",
    "chips.comp.tag.icon.color.idle",
    "chips.comp.tag.icon.color.disabled",
    "chips.comp.tag.close.color.idle",
    "chips.comp.tag.close.color.hover",
    "chips.comp.tag.close.color.disabled",
    "chips.comp.tag.focus.outline",
    "chips.comp.tag.status.color.error"
  ],
  avatar: [
    "chips.comp.avatar.root.size",
    "chips.comp.avatar.root.radius",
    "chips.comp.avatar.root.surface",
    "chips.comp.avatar.root.border.color",
    "chips.comp.avatar.fallback.color",
    "chips.comp.avatar.status.color.error"
  ],
  spinner: [
    "chips.comp.spinner.root.size",
    "chips.comp.spinner.track.color",
    "chips.comp.spinner.indicator.color",
    "chips.comp.spinner.indicator.thickness",
    "chips.comp.spinner.motion.duration",
    "chips.comp.spinner.status.color.info",
    "chips.comp.spinner.status.color.error"
  ],
  progress: [
    "chips.comp.progress.track.height",
    "chips.comp.progress.track.radius",
    "chips.comp.progress.track.surface",
    "chips.comp.progress.range.surface.determinate",
    "chips.comp.progress.range.surface.indeterminate",
    "chips.comp.progress.label.color",
    "chips.comp.progress.value.color",
    "chips.comp.progress.status.color.error",
    "chips.comp.progress.focus.outline"
  ],
  rating: [
    "chips.comp.rating.root.gap",
    "chips.comp.rating.item.size",
    "chips.comp.rating.item.radius",
    "chips.comp.rating.item.surface.idle",
    "chips.comp.rating.item.surface.hover",
    "chips.comp.rating.item.surface.active",
    "chips.comp.rating.item.surface.disabled",
    "chips.comp.rating.icon.color.idle",
    "chips.comp.rating.icon.color.active",
    "chips.comp.rating.icon.color.heart-active",
    "chips.comp.rating.icon.color.disabled",
    "chips.comp.rating.label.color",
    "chips.comp.rating.status.color.error",
    "chips.comp.rating.focus.outline"
  ],
  "text-field": [
    "chips.comp.text-field.root.radius",
    "chips.comp.text-field.root.surface.idle",
    "chips.comp.text-field.root.surface.focus",
    "chips.comp.text-field.root.surface.disabled",
    "chips.comp.text-field.root.border.idle",
    "chips.comp.text-field.root.border.focus",
    "chips.comp.text-field.root.border.error",
    "chips.comp.text-field.label.color",
    "chips.comp.text-field.control.color",
    "chips.comp.text-field.placeholder.color",
    "chips.comp.text-field.description.color",
    "chips.comp.text-field.status.color.error",
    "chips.comp.text-field.focus.outline"
  ],
  "text-area": [
    "chips.comp.text-area.root.radius",
    "chips.comp.text-area.root.surface.idle",
    "chips.comp.text-area.root.surface.focus",
    "chips.comp.text-area.root.surface.disabled",
    "chips.comp.text-area.root.border.idle",
    "chips.comp.text-area.root.border.focus",
    "chips.comp.text-area.root.border.error",
    "chips.comp.text-area.label.color",
    "chips.comp.text-area.control.color",
    "chips.comp.text-area.placeholder.color",
    "chips.comp.text-area.description.color",
    "chips.comp.text-area.status.color.error",
    "chips.comp.text-area.focus.outline"
  ],
  "search-field": [
    "chips.comp.search-field.root.radius",
    "chips.comp.search-field.root.surface.idle",
    "chips.comp.search-field.root.surface.focus",
    "chips.comp.search-field.root.surface.disabled",
    "chips.comp.search-field.root.border.idle",
    "chips.comp.search-field.root.border.focus",
    "chips.comp.search-field.root.border.error",
    "chips.comp.search-field.label.color",
    "chips.comp.search-field.control.color",
    "chips.comp.search-field.placeholder.color",
    "chips.comp.search-field.description.color",
    "chips.comp.search-field.icon.color",
    "chips.comp.search-field.clear.color.idle",
    "chips.comp.search-field.clear.color.hover",
    "chips.comp.search-field.status.color.error",
    "chips.comp.search-field.focus.outline"
  ],
  "secure-field": [
    "chips.comp.secure-field.root.radius",
    "chips.comp.secure-field.root.surface.idle",
    "chips.comp.secure-field.root.surface.focus",
    "chips.comp.secure-field.root.surface.disabled",
    "chips.comp.secure-field.root.border.idle",
    "chips.comp.secure-field.root.border.focus",
    "chips.comp.secure-field.root.border.error",
    "chips.comp.secure-field.label.color",
    "chips.comp.secure-field.control.color",
    "chips.comp.secure-field.placeholder.color",
    "chips.comp.secure-field.description.color",
    "chips.comp.secure-field.toggle.color.idle",
    "chips.comp.secure-field.toggle.color.hover",
    "chips.comp.secure-field.status.color.error",
    "chips.comp.secure-field.focus.outline"
  ],
  "segmented-control": [
    "chips.comp.segmented-control.root.radius",
    "chips.comp.segmented-control.root.surface",
    "chips.comp.segmented-control.root.border",
    "chips.comp.segmented-control.item.surface.idle",
    "chips.comp.segmented-control.item.surface.hover",
    "chips.comp.segmented-control.item.surface.active",
    "chips.comp.segmented-control.item.surface.selected",
    "chips.comp.segmented-control.item.surface.disabled",
    "chips.comp.segmented-control.label.color.idle",
    "chips.comp.segmented-control.label.color.selected",
    "chips.comp.segmented-control.label.color.disabled",
    "chips.comp.segmented-control.indicator.surface",
    "chips.comp.segmented-control.focus.outline",
    "chips.comp.segmented-control.status.color.error"
  ],
  "combo-box": [
    "chips.comp.combo-box.root.radius",
    "chips.comp.combo-box.root.surface.idle",
    "chips.comp.combo-box.root.surface.focus",
    "chips.comp.combo-box.root.surface.disabled",
    "chips.comp.combo-box.root.border.idle",
    "chips.comp.combo-box.root.border.focus",
    "chips.comp.combo-box.root.border.error",
    "chips.comp.combo-box.label.color",
    "chips.comp.combo-box.control.color",
    "chips.comp.combo-box.placeholder.color",
    "chips.comp.combo-box.trigger.color.idle",
    "chips.comp.combo-box.trigger.color.hover",
    "chips.comp.combo-box.list.surface",
    "chips.comp.combo-box.option.surface.idle",
    "chips.comp.combo-box.option.surface.highlighted",
    "chips.comp.combo-box.option.surface.selected",
    "chips.comp.combo-box.option.text.color",
    "chips.comp.combo-box.description.color",
    "chips.comp.combo-box.status.color.error",
    "chips.comp.combo-box.focus.outline"
  ],
  "number-input": [
    "chips.comp.number-input.root.radius",
    "chips.comp.number-input.root.surface.idle",
    "chips.comp.number-input.root.surface.focus",
    "chips.comp.number-input.root.surface.disabled",
    "chips.comp.number-input.root.border.idle",
    "chips.comp.number-input.root.border.focus",
    "chips.comp.number-input.root.border.error",
    "chips.comp.number-input.label.color",
    "chips.comp.number-input.control.color",
    "chips.comp.number-input.placeholder.color",
    "chips.comp.number-input.decrement.color.idle",
    "chips.comp.number-input.decrement.color.hover",
    "chips.comp.number-input.decrement.color.disabled",
    "chips.comp.number-input.increment.color.idle",
    "chips.comp.number-input.increment.color.hover",
    "chips.comp.number-input.increment.color.disabled",
    "chips.comp.number-input.description.color",
    "chips.comp.number-input.status.color.error",
    "chips.comp.number-input.focus.outline"
  ],
  stepper: [
    "chips.comp.stepper.root.radius",
    "chips.comp.stepper.root.gap",
    "chips.comp.stepper.label.color",
    "chips.comp.stepper.value.color",
    "chips.comp.stepper.decrement.surface.idle",
    "chips.comp.stepper.decrement.surface.hover",
    "chips.comp.stepper.decrement.surface.active",
    "chips.comp.stepper.decrement.surface.disabled",
    "chips.comp.stepper.decrement.icon.color.idle",
    "chips.comp.stepper.decrement.icon.color.disabled",
    "chips.comp.stepper.increment.surface.idle",
    "chips.comp.stepper.increment.surface.hover",
    "chips.comp.stepper.increment.surface.active",
    "chips.comp.stepper.increment.surface.disabled",
    "chips.comp.stepper.increment.icon.color.idle",
    "chips.comp.stepper.increment.icon.color.disabled",
    "chips.comp.stepper.status.color.error",
    "chips.comp.stepper.focus.outline"
  ],
  slider: [
    "chips.comp.slider.root.gap",
    "chips.comp.slider.label.color",
    "chips.comp.slider.track.height",
    "chips.comp.slider.track.radius",
    "chips.comp.slider.track.surface.idle",
    "chips.comp.slider.track.surface.disabled",
    "chips.comp.slider.range.surface.idle",
    "chips.comp.slider.range.surface.disabled",
    "chips.comp.slider.thumb.size",
    "chips.comp.slider.thumb.radius",
    "chips.comp.slider.thumb.surface.idle",
    "chips.comp.slider.thumb.surface.hover",
    "chips.comp.slider.thumb.surface.active",
    "chips.comp.slider.thumb.surface.disabled",
    "chips.comp.slider.thumb.border.idle",
    "chips.comp.slider.thumb.border.focus",
    "chips.comp.slider.value.color",
    "chips.comp.slider.status.color.error",
    "chips.comp.slider.focus.outline"
  ],
  "date-picker": [
    "chips.comp.date-picker.root.radius",
    "chips.comp.date-picker.root.surface.idle",
    "chips.comp.date-picker.root.surface.focus",
    "chips.comp.date-picker.root.surface.disabled",
    "chips.comp.date-picker.root.border.idle",
    "chips.comp.date-picker.root.border.focus",
    "chips.comp.date-picker.root.border.error",
    "chips.comp.date-picker.label.color",
    "chips.comp.date-picker.control.color",
    "chips.comp.date-picker.placeholder.color",
    "chips.comp.date-picker.trigger.color.idle",
    "chips.comp.date-picker.trigger.color.hover",
    "chips.comp.date-picker.calendar.surface",
    "chips.comp.date-picker.calendar.border",
    "chips.comp.date-picker.header.color",
    "chips.comp.date-picker.nav.color.idle",
    "chips.comp.date-picker.nav.color.hover",
    "chips.comp.date-picker.grid.gap",
    "chips.comp.date-picker.week-header.color",
    "chips.comp.date-picker.cell.surface.idle",
    "chips.comp.date-picker.cell.surface.hover",
    "chips.comp.date-picker.cell.surface.selected",
    "chips.comp.date-picker.cell.surface.today",
    "chips.comp.date-picker.cell.surface.disabled",
    "chips.comp.date-picker.cell.text.idle",
    "chips.comp.date-picker.cell.text.selected",
    "chips.comp.date-picker.cell.text.muted",
    "chips.comp.date-picker.description.color",
    "chips.comp.date-picker.status.color.error",
    "chips.comp.date-picker.focus.outline"
  ],
  "time-picker": [
    "chips.comp.time-picker.root.radius",
    "chips.comp.time-picker.root.surface.idle",
    "chips.comp.time-picker.root.surface.focus",
    "chips.comp.time-picker.root.surface.disabled",
    "chips.comp.time-picker.root.border.idle",
    "chips.comp.time-picker.root.border.focus",
    "chips.comp.time-picker.root.border.error",
    "chips.comp.time-picker.label.color",
    "chips.comp.time-picker.control.color",
    "chips.comp.time-picker.placeholder.color",
    "chips.comp.time-picker.trigger.color.idle",
    "chips.comp.time-picker.trigger.color.hover",
    "chips.comp.time-picker.list.surface",
    "chips.comp.time-picker.list.border",
    "chips.comp.time-picker.option.surface.idle",
    "chips.comp.time-picker.option.surface.highlighted",
    "chips.comp.time-picker.option.surface.selected",
    "chips.comp.time-picker.option.surface.disabled",
    "chips.comp.time-picker.option.text.color",
    "chips.comp.time-picker.description.color",
    "chips.comp.time-picker.status.color.error",
    "chips.comp.time-picker.focus.outline"
  ],
  image: [
    "chips.comp.image.root.radius",
    "chips.comp.image.root.surface",
    "chips.comp.image.root.border",
    "chips.comp.image.media.surface",
    "chips.comp.image.fallback.surface",
    "chips.comp.image.fallback.color",
    "chips.comp.image.caption.color",
    "chips.comp.image.status.color.error",
    "chips.comp.image.focus.outline"
  ],
  media: [
    "chips.comp.media.root.radius",
    "chips.comp.media.root.surface",
    "chips.comp.media.root.border",
    "chips.comp.media.content.surface",
    "chips.comp.media.controls.surface",
    "chips.comp.media.control.surface.idle",
    "chips.comp.media.control.surface.active",
    "chips.comp.media.control.color",
    "chips.comp.media.caption.color",
    "chips.comp.media.status.color.error",
    "chips.comp.media.focus.outline"
  ],
  "error-state": [
    "chips.comp.error-state.root.radius",
    "chips.comp.error-state.root.surface",
    "chips.comp.error-state.root.border.error",
    "chips.comp.error-state.icon.color",
    "chips.comp.error-state.title.color",
    "chips.comp.error-state.description.color",
    "chips.comp.error-state.details.color",
    "chips.comp.error-state.action.surface.idle",
    "chips.comp.error-state.action.surface.active",
    "chips.comp.error-state.action.text.color",
    "chips.comp.error-state.status.color.error",
    "chips.comp.error-state.focus.outline"
  ],
  button: [
    "chips.comp.button.root.radius",
    "chips.comp.button.root.surface.idle",
    "chips.comp.button.root.surface.hover",
    "chips.comp.button.root.surface.active",
    "chips.comp.button.root.surface.disabled",
    "chips.comp.button.label.color.idle",
    "chips.comp.button.label.color.disabled",
    "chips.comp.button.focus.outline"
  ],
  input: [
    "chips.comp.input.root.radius",
    "chips.comp.input.root.surface.idle",
    "chips.comp.input.root.surface.focus",
    "chips.comp.input.root.border.idle",
    "chips.comp.input.root.border.error",
    "chips.comp.input.value.color",
    "chips.comp.input.placeholder.color"
  ],
  checkbox: [
    "chips.comp.checkbox.control.radius",
    "chips.comp.checkbox.control.surface.unchecked",
    "chips.comp.checkbox.control.surface.checked",
    "chips.comp.checkbox.control.surface.disabled",
    "chips.comp.checkbox.indicator.color.checked",
    "chips.comp.checkbox.label.color"
  ],
  radio: [
    "chips.comp.radio.control.radius",
    "chips.comp.radio.control.surface.unchecked",
    "chips.comp.radio.control.surface.checked",
    "chips.comp.radio.control.surface.disabled",
    "chips.comp.radio.indicator.color.checked",
    "chips.comp.radio.label.color"
  ],
  switch: [
    "chips.comp.switch.track.radius",
    "chips.comp.switch.track.surface.off",
    "chips.comp.switch.track.surface.on",
    "chips.comp.switch.track.surface.disabled",
    "chips.comp.switch.thumb.surface",
    "chips.comp.switch.label.color"
  ],
  select: [
    "chips.comp.select.trigger.radius",
    "chips.comp.select.trigger.surface.idle",
    "chips.comp.select.trigger.surface.focus",
    "chips.comp.select.trigger.border.idle",
    "chips.comp.select.content.radius",
    "chips.comp.select.content.surface",
    "chips.comp.select.option.surface.highlighted",
    "chips.comp.select.option.surface.selected",
    "chips.comp.select.option.text.color"
  ],
  dialog: [
    "chips.comp.dialog.backdrop.surface",
    "chips.comp.dialog.content.radius",
    "chips.comp.dialog.content.surface",
    "chips.comp.dialog.header.color",
    "chips.comp.dialog.body.color",
    "chips.comp.dialog.footer.gap",
    "chips.comp.dialog.actions.gap",
    "chips.comp.dialog.close.color",
    "chips.comp.dialog.focus.outline"
  ],
  popover: [
    "chips.comp.popover.trigger.surface.idle",
    "chips.comp.popover.content.radius",
    "chips.comp.popover.content.surface",
    "chips.comp.popover.content.border",
    "chips.comp.popover.arrow.surface",
    "chips.comp.popover.focus.outline"
  ],
  tabs: [
    "chips.comp.tabs.list.border",
    "chips.comp.tabs.trigger.surface.idle",
    "chips.comp.tabs.trigger.surface.active",
    "chips.comp.tabs.trigger.text.color",
    "chips.comp.tabs.panel.surface",
    "chips.comp.tabs.focus.outline"
  ],
  menu: [
    "chips.comp.menu.content.radius",
    "chips.comp.menu.content.surface",
    "chips.comp.menu.group.label.color",
    "chips.comp.menu.item.surface.hover",
    "chips.comp.menu.item.surface.active",
    "chips.comp.menu.item.text.color",
    "chips.comp.menu.separator.color",
    "chips.comp.menu.separator.thickness",
    "chips.comp.menu.focus.outline"
  ],
  toolbar: [
    "chips.comp.toolbar.root.surface",
    "chips.comp.toolbar.group.gap",
    "chips.comp.toolbar.item.surface.idle",
    "chips.comp.toolbar.item.surface.hover",
    "chips.comp.toolbar.item.surface.active",
    "chips.comp.toolbar.item.surface.disabled",
    "chips.comp.toolbar.item.text.color",
    "chips.comp.toolbar.item.icon.color",
    "chips.comp.toolbar.focus.outline"
  ],
  "menu-bar": [
    "chips.comp.menu-bar.root.surface",
    "chips.comp.menu-bar.menu.surface.idle",
    "chips.comp.menu-bar.menu.surface.hover",
    "chips.comp.menu-bar.item.surface.hover",
    "chips.comp.menu-bar.item.text.color",
    "chips.comp.menu-bar.shortcut.color",
    "chips.comp.menu-bar.focus.outline"
  ],
  "context-menu": [
    "chips.comp.context-menu.root.surface",
    "chips.comp.context-menu.trigger.surface.idle",
    "chips.comp.context-menu.content.surface",
    "chips.comp.context-menu.item.surface.hover",
    "chips.comp.context-menu.item.text.color",
    "chips.comp.context-menu.shortcut.color",
    "chips.comp.context-menu.focus.outline"
  ],
  shortcut: [
    "chips.comp.shortcut.root.surface",
    "chips.comp.shortcut.key.surface",
    "chips.comp.shortcut.key.text.color",
    "chips.comp.shortcut.separator.color"
  ],
  tooltip: [
    "chips.comp.tooltip.content.radius",
    "chips.comp.tooltip.content.surface",
    "chips.comp.tooltip.content.text.color",
    "chips.comp.tooltip.arrow.surface",
    "chips.comp.tooltip.focus.outline"
  ],
  form: [
    "chips.comp.form.root.gap",
    "chips.comp.form.section.gap",
    "chips.comp.form.section.divider.color",
    "chips.comp.form.field.gap",
    "chips.comp.form.label.color",
    "chips.comp.form.label.required.color",
    "chips.comp.form.control.surface.idle",
    "chips.comp.form.control.border.idle",
    "chips.comp.form.control.border.error",
    "chips.comp.form.hint.color",
    "chips.comp.form.error.color",
    "chips.comp.form.status.color.error",
    "chips.comp.form.focus.outline"
  ],
  "virtual-list": [
    "chips.comp.virtual-list.container.surface",
    "chips.comp.virtual-list.item.surface.idle",
    "chips.comp.virtual-list.item.surface.active",
    "chips.comp.virtual-list.item.text.color",
    "chips.comp.virtual-list.scrollbar.thumb",
    "chips.comp.virtual-list.focus.outline"
  ],
  "data-grid": [
    "chips.comp.data-grid.root.surface",
    "chips.comp.data-grid.toolbar.surface",
    "chips.comp.data-grid.toolbar.gap",
    "chips.comp.data-grid.header.surface",
    "chips.comp.data-grid.header.text.color",
    "chips.comp.data-grid.header.sort.color",
    "chips.comp.data-grid.row.surface.idle",
    "chips.comp.data-grid.row.surface.hover",
    "chips.comp.data-grid.row.surface.selected",
    "chips.comp.data-grid.cell.text.color",
    "chips.comp.data-grid.pagination.surface",
    "chips.comp.data-grid.pagination.gap",
    "chips.comp.data-grid.border.color",
    "chips.comp.data-grid.focus.outline"
  ],
  tree: [
    "chips.comp.tree.root.surface",
    "chips.comp.tree.item.surface.idle",
    "chips.comp.tree.item.surface.hover",
    "chips.comp.tree.item.surface.selected",
    "chips.comp.tree.item.surface.disabled",
    "chips.comp.tree.item.text.color",
    "chips.comp.tree.branch.indent",
    "chips.comp.tree.leaf.indent",
    "chips.comp.tree.disclosure.color",
    "chips.comp.tree.group.guide.color",
    "chips.comp.tree.status.color.error",
    "chips.comp.tree.focus.outline"
  ],
  "date-time": [
    "chips.comp.date-time.input.surface.idle",
    "chips.comp.date-time.input.border.idle",
    "chips.comp.date-time.input.border.error",
    "chips.comp.date-time.input.text.color",
    "chips.comp.date-time.icon.color",
    "chips.comp.date-time.focus.outline"
  ],
  "command-palette": [
    "chips.comp.command-palette.root.surface",
    "chips.comp.command-palette.input.surface.idle",
    "chips.comp.command-palette.input.border.idle",
    "chips.comp.command-palette.item.surface.active",
    "chips.comp.command-palette.item.text.color",
    "chips.comp.command-palette.group.label.color",
    "chips.comp.command-palette.shortcut.color",
    "chips.comp.command-palette.focus.outline"
  ],
  "navigation-split-view": [
    "chips.comp.navigation-split-view.root.surface",
    "chips.comp.navigation-split-view.sidebar.surface",
    "chips.comp.navigation-split-view.content.surface",
    "chips.comp.navigation-split-view.detail.surface",
    "chips.comp.navigation-split-view.divider.color",
    "chips.comp.navigation-split-view.status.color.error",
    "chips.comp.navigation-split-view.focus.outline"
  ],
  "split-pane": [
    "chips.comp.split-pane.root.surface",
    "chips.comp.split-pane.pane.surface",
    "chips.comp.split-pane.handle.surface.idle",
    "chips.comp.split-pane.handle.surface.active",
    "chips.comp.split-pane.handle.border.color",
    "chips.comp.split-pane.focus.outline"
  ],
  "dock-panel": [
    "chips.comp.dock-panel.root.surface",
    "chips.comp.dock-panel.tab.surface.idle",
    "chips.comp.dock-panel.tab.surface.active",
    "chips.comp.dock-panel.tab.text.color",
    "chips.comp.dock-panel.content.surface",
    "chips.comp.dock-panel.status.color.error",
    "chips.comp.dock-panel.focus.outline"
  ],
  inspector: [
    "chips.comp.inspector.root.surface",
    "chips.comp.inspector.section.header.surface.idle",
    "chips.comp.inspector.section.header.surface.active",
    "chips.comp.inspector.section.header.text.color",
    "chips.comp.inspector.section.body.surface",
    "chips.comp.inspector.focus.outline"
  ],
  "panel-header": [
    "chips.comp.panel-header.root.surface",
    "chips.comp.panel-header.title.color",
    "chips.comp.panel-header.subtitle.color",
    "chips.comp.panel-header.action.surface.idle",
    "chips.comp.panel-header.action.surface.active",
    "chips.comp.panel-header.focus.outline"
  ],
  "card-shell": [
    "chips.comp.card-shell.root.surface",
    "chips.comp.card-shell.header.surface",
    "chips.comp.card-shell.content.surface",
    "chips.comp.card-shell.footer.surface",
    "chips.comp.card-shell.border.color",
    "chips.comp.card-shell.focus.outline"
  ],
  "tool-window": [
    "chips.comp.tool-window.root.surface",
    "chips.comp.tool-window.header.surface",
    "chips.comp.tool-window.body.surface",
    "chips.comp.tool-window.control.surface.idle",
    "chips.comp.tool-window.control.surface.active",
    "chips.comp.tool-window.status.color.error",
    "chips.comp.tool-window.focus.outline"
  ],
  "error-boundary": [
    "chips.comp.error-boundary.root.surface",
    "chips.comp.error-boundary.root.border.error",
    "chips.comp.error-boundary.title.color",
    "chips.comp.error-boundary.description.color",
    "chips.comp.error-boundary.action.surface.idle",
    "chips.comp.error-boundary.action.surface.active",
    "chips.comp.error-boundary.status.color.error",
    "chips.comp.error-boundary.focus.outline"
  ],
  "loading-boundary": [
    "chips.comp.loading-boundary.root.surface",
    "chips.comp.loading-boundary.fallback.surface",
    "chips.comp.loading-boundary.skeleton.surface.idle",
    "chips.comp.loading-boundary.skeleton.surface.active",
    "chips.comp.loading-boundary.status.color.info",
    "chips.comp.loading-boundary.focus.outline"
  ],
  notification: [
    "chips.comp.notification.root.surface",
    "chips.comp.notification.item.surface.idle",
    "chips.comp.notification.item.surface.active",
    "chips.comp.notification.title.color",
    "chips.comp.notification.message.color",
    "chips.comp.notification.action.surface.active",
    "chips.comp.notification.close.color",
    "chips.comp.notification.focus.outline"
  ],
  toast: [
    "chips.comp.toast.root.surface",
    "chips.comp.toast.item.surface.idle",
    "chips.comp.toast.item.surface.active",
    "chips.comp.toast.message.color",
    "chips.comp.toast.action.surface.active",
    "chips.comp.toast.close.color",
    "chips.comp.toast.focus.outline"
  ],
  "empty-state": [
    "chips.comp.empty-state.root.surface",
    "chips.comp.empty-state.icon.color",
    "chips.comp.empty-state.title.color",
    "chips.comp.empty-state.description.color",
    "chips.comp.empty-state.action.surface.active",
    "chips.comp.empty-state.focus.outline"
  ],
  skeleton: [
    "chips.comp.skeleton.root.surface",
    "chips.comp.skeleton.item.surface.idle",
    "chips.comp.skeleton.item.surface.active",
    "chips.comp.skeleton.status.color.info",
    "chips.comp.skeleton.focus.outline"
  ]
};

export function createComponentMeta({ name, scope, parts, states }) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("COMPONENT_META_INVALID:name");
  }

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("COMPONENT_META_INVALID:parts");
  }

  if (!Array.isArray(states) || states.length === 0) {
    throw new Error("COMPONENT_META_INVALID:states");
  }

  return {
    name,
    scope,
    parts,
    states
  };
}

export function buildComponentContract(component) {
  if (typeof component !== "string" || component.length === 0) {
    throw new Error("COMPONENT_CONTRACT_INVALID:component");
  }

  if (Object.hasOwn(LAYOUT_COMPONENT_TOKEN_MAP, component)) {
    return buildLayoutComponentContract(component);
  }

  if (!Object.hasOwn(COMPONENT_TOKEN_MAP, component)) {
    throw new Error(`COMPONENT_CONTRACT_TOKEN_MAP_MISSING:${component}`);
  }

  const contractMap = {
    text: {
      component: "text",
      scope: "text",
      parts: ["root"],
      states: ["idle", "disabled", "error"]
    },
    label: {
      component: "label",
      scope: "label",
      parts: ["root", "required-indicator", "status"],
      states: ["idle", "disabled", "error"]
    },
    icon: {
      component: "icon",
      scope: "icon",
      parts: ["root"],
      states: ["idle"]
    },
    "icon-button": {
      component: "icon-button",
      scope: "icon-button",
      parts: ["root", "icon", "spinner", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "toggle-button": {
      component: "toggle-button",
      scope: "toggle-button",
      parts: ["root", "icon", "label", "spinner", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    badge: {
      component: "badge",
      scope: "badge",
      parts: ["root", "icon", "label", "status"],
      states: ["idle", "disabled", "error"]
    },
    tag: {
      component: "tag",
      scope: "tag",
      parts: ["root", "icon", "label", "close", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    avatar: {
      component: "avatar",
      scope: "avatar",
      parts: ["root", "image", "fallback", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    spinner: {
      component: "spinner",
      scope: "spinner",
      parts: ["root", "track", "indicator", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    progress: {
      component: "progress",
      scope: "progress",
      parts: ["root", "track", "range", "label", "value", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    rating: {
      component: "rating",
      scope: "rating",
      parts: ["root", "label", "item", "icon", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "text-field": {
      component: "text-field",
      scope: "text-field",
      parts: ["root", "label", "control", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "text-area": {
      component: "text-area",
      scope: "text-area",
      parts: ["root", "label", "control", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "search-field": {
      component: "search-field",
      scope: "search-field",
      parts: ["root", "label", "search-icon", "control", "clear", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "secure-field": {
      component: "secure-field",
      scope: "secure-field",
      parts: ["root", "label", "control", "visibility-toggle", "visibility-icon", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "segmented-control": {
      component: "segmented-control",
      scope: "segmented-control",
      parts: ["root", "item", "indicator", "label", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "combo-box": {
      component: "combo-box",
      scope: "combo-box",
      parts: ["root", "label", "control", "trigger", "list", "option", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "number-input": {
      component: "number-input",
      scope: "number-input",
      parts: ["root", "label", "control", "decrement", "increment", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    stepper: {
      component: "stepper",
      scope: "stepper",
      parts: ["root", "label", "decrement", "value", "increment", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    slider: {
      component: "slider",
      scope: "slider",
      parts: ["root", "label", "track", "range", "thumb", "value", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "date-picker": {
      component: "date-picker",
      scope: "date-picker",
      parts: [
        "root",
        "label",
        "control",
        "input",
        "trigger",
        "calendar",
        "header",
        "previous",
        "next",
        "title",
        "grid",
        "week-header",
        "cell",
        "description",
        "status"
      ],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "time-picker": {
      component: "time-picker",
      scope: "time-picker",
      parts: ["root", "label", "control", "input", "trigger", "list", "option", "description", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    image: {
      component: "image",
      scope: "image",
      parts: ["root", "media", "fallback", "caption", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    media: {
      component: "media",
      scope: "media",
      parts: ["root", "content", "controls", "control", "caption", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    "error-state": {
      component: "error-state",
      scope: "error-state",
      parts: ["root", "icon", "title", "description", "details", "action", "status"],
      states: TASK015_BASE_CONTROL_STATES
    },
    button: {
      component: "button",
      scope: "button",
      parts: ["root", "label", "spinner", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    input: {
      component: "input",
      scope: "input",
      parts: ["root", "control", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    checkbox: {
      component: "checkbox",
      scope: "checkbox",
      parts: ["root", "control", "indicator", "label", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    radio: {
      component: "radio",
      scope: "radio",
      parts: ["root", "item", "control", "indicator", "label", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    switch: {
      component: "switch",
      scope: "switch",
      parts: ["root", "track", "thumb", "label", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    select: {
      component: "select",
      scope: "select",
      parts: ["root", "trigger", "value", "icon", "content", "option", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    dialog: {
      component: "dialog",
      scope: "dialog",
      parts: [
        "root",
        "trigger",
        "backdrop",
        "content",
        "header",
        "body",
        "footer",
        "actions",
        "close",
        "status"
      ],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    popover: {
      component: "popover",
      scope: "popover",
      parts: ["root", "trigger", "content", "arrow", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    tabs: {
      component: "tabs",
      scope: "tabs",
      parts: ["root", "list", "trigger", "panel", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    menu: {
      component: "menu",
      scope: "menu",
      parts: ["root", "trigger", "content", "item", "group", "group-label", "separator", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    toolbar: {
      component: "toolbar",
      scope: "toolbar",
      parts: ["root", "group", "item", "icon", "label", "shortcut", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "menu-bar": {
      component: "menu-bar",
      scope: "menu-bar",
      parts: ["root", "menu", "content", "group", "item", "shortcut", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "context-menu": {
      component: "context-menu",
      scope: "context-menu",
      parts: ["root", "trigger", "content", "group", "item", "shortcut", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    shortcut: {
      component: "shortcut",
      scope: "shortcut",
      parts: ["root", "key", "separator"],
      states: ["idle", "disabled"]
    },
    tooltip: {
      component: "tooltip",
      scope: "tooltip",
      parts: ["root", "trigger", "content", "arrow", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    form: {
      component: "form",
      scope: "form",
      parts: ["root", "section", "field", "label", "required", "control", "error", "hint", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "virtual-list": {
      component: "virtual-list",
      scope: "virtual-list",
      parts: ["root", "viewport", "content", "item", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "data-grid": {
      component: "data-grid",
      scope: "data-grid",
      parts: ["root", "toolbar", "header", "row", "cell", "pagination", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    tree: {
      component: "tree",
      scope: "tree",
      parts: ["root", "item", "branch", "leaf", "disclosure", "label", "group", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "date-time": {
      component: "date-time",
      scope: "date-time",
      parts: ["root", "input", "icon", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "command-palette": {
      component: "command-palette",
      scope: "command-palette",
      parts: ["root", "input", "list", "group", "group-label", "item", "shortcut", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "navigation-split-view": {
      component: "navigation-split-view",
      scope: "navigation-split-view",
      parts: ["root", "sidebar", "content", "detail", "divider", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "split-pane": {
      component: "split-pane",
      scope: "split-pane",
      parts: ["root", "pane-start", "resizer", "pane-end", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "dock-panel": {
      component: "dock-panel",
      scope: "dock-panel",
      parts: ["root", "tab-list", "tab", "content", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    inspector: {
      component: "inspector",
      scope: "inspector",
      parts: ["root", "section", "header", "body", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "panel-header": {
      component: "panel-header",
      scope: "panel-header",
      parts: ["root", "title", "subtitle", "actions", "toggle", "close", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "card-shell": {
      component: "card-shell",
      scope: "card-shell",
      parts: ["root", "header", "toolbar", "content", "footer", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "tool-window": {
      component: "tool-window",
      scope: "tool-window",
      parts: ["root", "header", "controls", "body", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "error-boundary": {
      component: "error-boundary",
      scope: "error-boundary",
      parts: ["root", "title", "description", "action", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "loading-boundary": {
      component: "loading-boundary",
      scope: "loading-boundary",
      parts: ["root", "content", "fallback", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    notification: {
      component: "notification",
      scope: "notification",
      parts: ["root", "list", "item", "title", "message", "action", "close", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    toast: {
      component: "toast",
      scope: "toast",
      parts: ["root", "list", "item", "message", "action", "close", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    "empty-state": {
      component: "empty-state",
      scope: "empty-state",
      parts: ["root", "icon", "title", "description", "action", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    },
    skeleton: {
      component: "skeleton",
      scope: "skeleton",
      parts: ["root", "item", "status"],
      states: [...INTERACTIVE_STATE_PRIORITY]
    }
  };

  if (!Object.hasOwn(contractMap, component)) {
    throw new Error(`COMPONENT_CONTRACT_DEFINITION_MISSING:${component}`);
  }

  return {
    ...contractMap[component],
    tokens: COMPONENT_TOKEN_MAP[component]
  };
}

export function resolveInteractiveState(params) {
  if (params.disabled) {
    return "disabled";
  }

  if (params.loading) {
    return "loading";
  }

  if (params.error) {
    return "error";
  }

  if (params.interaction && params.interaction.active) {
    return "active";
  }

  if (params.interaction && params.interaction.focused) {
    return "focus";
  }

  if (params.interaction && params.interaction.hovered) {
    return "hover";
  }

  return "idle";
}

export function interactiveStateReducer(state, event) {
  if (!event || typeof event.type !== "string") {
    return state;
  }

  if (event.type === InteractiveEventType.POINTER_ENTER) {
    return { ...state, hovered: true };
  }

  if (event.type === InteractiveEventType.POINTER_LEAVE) {
    return { ...state, hovered: false, active: false };
  }

  if (event.type === InteractiveEventType.FOCUS) {
    return { ...state, focused: true };
  }

  if (event.type === InteractiveEventType.BLUR) {
    return { ...state, focused: false, active: false };
  }

  if (event.type === InteractiveEventType.PRESS_START) {
    return { ...state, active: true };
  }

  if (event.type === InteractiveEventType.PRESS_END) {
    return { ...state, active: false };
  }

  return state;
}

function createInteractionHandlers(dispatch, disabled) {
  const safeDispatch = (type) => {
    if (disabled) {
      return;
    }
    dispatch({ type });
  };

  return {
    onPointerEnter: () => safeDispatch(InteractiveEventType.POINTER_ENTER),
    onPointerLeave: () => safeDispatch(InteractiveEventType.POINTER_LEAVE),
    onFocus: () => safeDispatch(InteractiveEventType.FOCUS),
    onBlur: () => safeDispatch(InteractiveEventType.BLUR),
    onMouseDown: () => safeDispatch(InteractiveEventType.PRESS_START),
    onMouseUp: () => safeDispatch(InteractiveEventType.PRESS_END)
  };
}

function useInteractiveState(disabled) {
  const [interaction, dispatch] = React.useReducer(
    interactiveStateReducer,
    INITIAL_INTERACTION_STATE
  );

  React.useEffect(() => {
    if (disabled) {
      dispatch({ type: InteractiveEventType.POINTER_LEAVE });
      dispatch({ type: InteractiveEventType.BLUR });
      dispatch({ type: InteractiveEventType.PRESS_END });
    }
  }, [disabled]);

  const handlers = React.useMemo(
    () => createInteractionHandlers(dispatch, disabled),
    [disabled]
  );

  return {
    interaction,
    handlers
  };
}

function useControllableState({ value, defaultValue, onChange }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  const setValue = React.useCallback(
    (nextValue) => {
      if (!controlled) {
        setInternalValue(nextValue);
      }
      if (typeof onChange === "function") {
        onChange(nextValue);
      }
    },
    [controlled, onChange]
  );

  return [currentValue, setValue, controlled];
}

function mergeHandlers(...handlers) {
  return (event) => {
    for (const handler of handlers) {
      if (typeof handler === "function") {
        handler(event);
      }
    }
  };
}

function normalizeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return {
      code: "COMPONENT_ERROR",
      message: error
    };
  }

  if (typeof error === "object" && typeof error.message === "string") {
    return {
      code: typeof error.code === "string" ? error.code : "COMPONENT_ERROR",
      message: error.message
    };
  }

  return {
    code: "COMPONENT_ERROR",
    message: "Unknown component error"
  };
}

export function toStandardError(error, fallbackCode = "COMPONENT_ERROR") {
  if (error && typeof error === "object") {
    const candidate = error;
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return {
        code: candidate.code,
        message: candidate.message,
        details: candidate.details,
        retryable: candidate.retryable === true
      };
    }
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message,
      details: { name: error.name },
      retryable: false
    };
  }

  if (typeof error === "string" && error.length > 0) {
    return {
      code: fallbackCode,
      message: error,
      details: null,
      retryable: false
    };
  }

  return {
    code: fallbackCode,
    message: "Unknown error",
    details: error,
    retryable: false
  };
}

function getNestedValueByPath(source, pathExpression) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  if (typeof pathExpression !== "string" || pathExpression.length === 0) {
    return undefined;
  }

  const segments = pathExpression.split(".");
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function resolveI18nTranslate(i18nAdapter, key, params, fallback) {
  if (!i18nAdapter) {
    return null;
  }

  try {
    if (typeof i18nAdapter === "function") {
      const result = i18nAdapter(key, params, fallback);
      return typeof result === "string" ? result : null;
    }

    if (typeof i18nAdapter.translate === "function") {
      const byObject = i18nAdapter.translate({ key, params });
      if (typeof byObject === "string") {
        return byObject;
      }
      const byArgs = i18nAdapter.translate(key, params);
      if (typeof byArgs === "string") {
        return byArgs;
      }
    }
  } catch (error) {
    return {
      __error: toStandardError(error, "SYSTEM_UX_I18N_ADAPTER_ERROR")
    };
  }

  return null;
}

export function resolveI18nText(params = {}) {
  const {
    i18n,
    key,
    params: i18nParams,
    fallback = "",
    onDiagnostic
  } = params;

  if (typeof key === "string" && key.length > 0) {
    const translated = resolveI18nTranslate(i18n, key, i18nParams, fallback);
    if (translated && typeof translated === "object" && translated.__error) {
      if (typeof onDiagnostic === "function") {
        onDiagnostic({
          code: "SYSTEM_UX_I18N_ADAPTER_ERROR",
          key,
          error: translated.__error
        });
      }
    } else if (typeof translated === "string" && translated.length > 0) {
      return translated;
    }

    if (typeof onDiagnostic === "function") {
      onDiagnostic({
        code: "SYSTEM_UX_I18N_KEY_FALLBACK",
        key,
        fallback
      });
    }
  }

  return typeof fallback === "string" ? fallback : "";
}

export function resolveConfigValue(params = {}) {
  const {
    configSource,
    key,
    defaultValue,
    parser,
    onDiagnostic
  } = params;

  let rawValue;

  try {
    if (configSource && typeof configSource === "function") {
      rawValue = configSource(key);
    } else if (configSource && typeof configSource.get === "function") {
      rawValue = configSource.get(key);
    } else {
      rawValue = getNestedValueByPath(configSource, key);
    }
  } catch (error) {
    if (typeof onDiagnostic === "function") {
      onDiagnostic({
        code: "SYSTEM_UX_CONFIG_SOURCE_ERROR",
        key,
        error: toStandardError(error, "SYSTEM_UX_CONFIG_SOURCE_ERROR")
      });
    }
    return defaultValue;
  }

  let parsed;
  try {
    parsed = typeof parser === "function" ? parser(rawValue) : rawValue;
  } catch (error) {
    if (typeof onDiagnostic === "function") {
      onDiagnostic({
        code: "SYSTEM_UX_CONFIG_PARSER_ERROR",
        key,
        error: toStandardError(error, "SYSTEM_UX_CONFIG_PARSER_ERROR")
      });
    }
    return defaultValue;
  }
  if (parsed !== undefined && parsed !== null) {
    return parsed;
  }

  if (typeof onDiagnostic === "function") {
    onDiagnostic({
      code: "SYSTEM_UX_CONFIG_FALLBACK",
      key,
      defaultValue
    });
  }

  return defaultValue;
}

export function createObservationRecord(params = {}) {
  const {
    traceId,
    component,
    action,
    error,
    durationMs
  } = params;

  const normalizedError = error ? toStandardError(error, "SYSTEM_UX_OBSERVE_ERROR") : null;

  return {
    traceId:
      typeof traceId === "string" && traceId.length > 0
        ? traceId
        : `trace-${Date.now()}`,
    component: typeof component === "string" && component.length > 0 ? component : "unknown-component",
    action: typeof action === "string" && action.length > 0 ? action : "unknown-action",
    errorCode: normalizedError ? normalizedError.code : null,
    durationMs: typeof durationMs === "number" && durationMs >= 0 ? durationMs : 0
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && (typeof item.value === "string" || typeof item.value === "number"))
    .map((item) => ({
      ...item,
      value: String(item.value),
      disabled: item.disabled === true
    }));
}

function getOptionText(option) {
  if (!option) {
    return "";
  }

  if (typeof option.textValue === "string") {
    return option.textValue;
  }

  if (typeof option.label === "string" || typeof option.label === "number") {
    return String(option.label);
  }

  return option.value;
}

export function getNextEnabledIndex(items, startIndex, direction = "next", loop = true) {
  if (!Array.isArray(items) || items.length === 0) {
    return -1;
  }

  const step = direction === "prev" ? -1 : 1;
  let index = startIndex;

  for (let count = 0; count < items.length; count += 1) {
    index += step;

    if (loop) {
      if (index >= items.length) {
        index = 0;
      }
      if (index < 0) {
        index = items.length - 1;
      }
    } else if (index < 0 || index >= items.length) {
      return -1;
    }

    const candidate = items[index];
    if (candidate && candidate.disabled !== true) {
      return index;
    }
  }

  return -1;
}

function getFirstEnabledIndex(items) {
  return getNextEnabledIndex(items, -1, "next", true);
}

function isCommandRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function commandString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function commandArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCommandShortcutValue(shortcut) {
  const source = Array.isArray(shortcut) ? shortcut[0] : shortcut;
  if (!source) {
    return "";
  }
  if (typeof source === "string") {
    return commandString(source);
  }
  if (isCommandRecord(source)) {
    return commandString(source.accelerator);
  }
  return "";
}

function resolveCommandText(command, field, fallback = "", i18n) {
  const key = commandString(command?.[`${field}Key`]);
  return resolveI18nText({
    i18n,
    key,
    fallback: commandString(fallback) || key
  });
}

function isCommandVisible(command) {
  if (!isCommandRecord(command)) {
    return false;
  }
  if (command.state && isCommandRecord(command.state) && command.state.visible === false) {
    return false;
  }
  if (command.diagnostic && isCommandRecord(command.diagnostic) && command.diagnostic.visible === false) {
    return false;
  }
  return true;
}

function isCommandEnabled(command) {
  if (!isCommandRecord(command)) {
    return false;
  }
  if (command.state && isCommandRecord(command.state) && command.state.enabled === false) {
    return false;
  }
  if (command.diagnostic && isCommandRecord(command.diagnostic) && command.diagnostic.enabled === false) {
    return false;
  }
  return true;
}

function isCommandChecked(command) {
  if (!isCommandRecord(command)) {
    return false;
  }
  if (command.state && isCommandRecord(command.state) && command.state.checked === true) {
    return true;
  }
  if (command.diagnostic && isCommandRecord(command.diagnostic) && command.diagnostic.checked === true) {
    return true;
  }
  return false;
}

function compareCommandOrder(left, right) {
  const leftOrder = typeof left.order === "number" && Number.isFinite(left.order) ? left.order : 0;
  const rightOrder = typeof right.order === "number" && Number.isFinite(right.order) ? right.order : 0;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return String(left.commandId).localeCompare(String(right.commandId));
}

function normalizeCommandView(command, options = {}) {
  if (!isCommandRecord(command)) {
    return null;
  }

  const commandId = commandString(command.commandId);
  const titleKey = commandString(command.titleKey);
  if (!commandId || !titleKey) {
    return null;
  }

  const label = resolveCommandText(command, "title", commandId, options.i18n);
  const description = commandString(command.descriptionKey)
    ? resolveCommandText(command, "description", "", options.i18n)
    : "";
  const ariaLabel = commandString(command.ariaLabelKey)
    ? resolveCommandText(command, "ariaLabel", label, options.i18n)
    : label;

  return {
    ...command,
    commandId,
    titleKey,
    label,
    description,
    ariaLabel,
    disabled: !isCommandEnabled(command),
    hidden: !isCommandVisible(command),
    checked: isCommandChecked(command),
    shortcutLabel: normalizeCommandShortcutValue(command.shortcut),
    disabledReasonKey: commandString(command.disabledReasonKey || command.state?.disabledReasonKey || command.state?.reasonKey),
    hiddenReasonKey: commandString(command.hiddenReasonKey || command.state?.hiddenReasonKey),
    paletteKeywords: commandArray(command.paletteKeywords).filter((keyword) => typeof keyword === "string"),
    menuPlacement: commandArray(command.menuPlacement).filter(isCommandRecord),
    toolbarPlacement: commandArray(command.toolbarPlacement).filter(isCommandRecord)
  };
}

function normalizeCommandViews(commands, options = {}) {
  return commandArray(commands)
    .map((command) => normalizeCommandView(command, options))
    .filter((command) => command && (options.includeHidden === true || !command.hidden));
}

function commandPlacementMatches(placement, targetKey, targetValue) {
  const value = commandString(targetValue);
  if (!value) {
    return true;
  }
  return commandString(placement?.[targetKey]) === value;
}

export function createCommandAdapter(client) {
  const commandApi = client?.command ?? client;
  if (!commandApi || typeof commandApi !== "object") {
    throw new Error("COMMAND_ADAPTER_INVALID:client");
  }
  if (typeof commandApi.list !== "function" || typeof commandApi.invoke !== "function") {
    throw new Error("COMMAND_ADAPTER_INVALID:command-api");
  }

  return {
    listCommands: (options) => commandApi.list(options),
    invokeCommand: (commandId, payload, options) => commandApi.invoke(commandId, payload, options),
    onCommandsChanged:
      typeof commandApi.onChanged === "function"
        ? (handler) => commandApi.onChanged(handler)
        : undefined
  };
}

export function resolveCommandToolbarItems(commands, options = {}) {
  const toolbarId = commandString(options.toolbarId);
  const groupId = commandString(options.groupId);
  const views = normalizeCommandViews(commands, options);
  const rows = [];

  for (const command of views) {
    const placements = command.toolbarPlacement.length > 0 ? command.toolbarPlacement : [{}];
    for (const placement of placements) {
      if (!commandPlacementMatches(placement, "toolbarId", toolbarId)) {
        continue;
      }
      if (groupId && commandString(placement.groupId) !== groupId) {
        continue;
      }
      rows.push({
        ...command,
        placement,
        groupId: commandString(placement.groupId) || "default",
        order: typeof placement.order === "number" ? placement.order : 0
      });
    }
  }

  return rows.sort(compareCommandOrder);
}

export function resolveCommandMenuGroups(commands, options = {}) {
  const menuId = commandString(options.menuId);
  const views = normalizeCommandViews(commands, options);
  const groups = new Map();

  for (const command of views) {
    const placements = command.menuPlacement.length > 0 ? command.menuPlacement : [{}];
    for (const placement of placements) {
      if (!commandPlacementMatches(placement, "menuId", menuId)) {
        continue;
      }
      const groupId = commandString(placement.groupId) || "default";
      const item = {
        ...command,
        placement,
        groupId,
        order: typeof placement.order === "number" ? placement.order : 0
      };
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId).push(item);
    }
  }

  return [...groups.entries()].map(([groupId, items]) => ({
    groupId,
    items: items.sort(compareCommandOrder)
  }));
}

export function resolveCommandPaletteItems(commands, options = {}) {
  return normalizeCommandViews(commands, options)
    .map((command) => ({
      id: command.commandId,
      commandId: command.commandId,
      label: command.label,
      titleKey: command.titleKey,
      subtitle: command.description,
      descriptionKey: command.descriptionKey,
      ariaLabel: command.ariaLabel,
      ariaLabelKey: command.ariaLabelKey,
      icon: command.icon,
      shortcut: command.shortcutLabel,
      keywords: command.paletteKeywords,
      disabled: command.disabled,
      checked: command.checked,
      command
    }))
    .sort((left, right) => String(left.label).localeCompare(String(right.label)));
}

const CommandContext = React.createContext(null);

export function useChipsCommandContext() {
  return React.useContext(CommandContext);
}

export function useChipsCommands(options = {}) {
  const context = useChipsCommandContext();
  const adapter = options.adapter || context?.adapter;
  const hasStaticCommands = Array.isArray(options.commands);
  const [remoteCommands, setRemoteCommands] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const query = {
    ...context?.query,
    ...options.query
  };
  const queryKey = JSON.stringify(query);

  React.useEffect(() => {
    if (hasStaticCommands) {
      setLoading(false);
      setError(null);
      return undefined;
    }
    if (!adapter || typeof adapter.listCommands !== "function") {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await adapter.listCommands(query);
        if (!cancelled) {
          setRemoteCommands(commandArray(result));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(toStandardError(nextError, "COMMAND_LIST_FAILED"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    const dispose = typeof adapter.onCommandsChanged === "function"
      ? adapter.onCommandsChanged(() => {
          load();
        })
      : undefined;

    return () => {
      cancelled = true;
      if (typeof dispose === "function") {
        dispose();
      }
    };
  }, [adapter, hasStaticCommands, queryKey]);

  return {
    commands: hasStaticCommands ? options.commands : remoteCommands,
    loading,
    error
  };
}

function normalizePositiveNumber(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  return value;
}

export function computeVirtualWindow(params) {
  const itemCount = Math.max(0, Number.isInteger(params.itemCount) ? params.itemCount : 0);
  const itemHeight = normalizePositiveNumber(params.itemHeight, 1);
  const viewportHeight = normalizePositiveNumber(params.viewportHeight, itemHeight);
  const scrollTop = Math.max(0, typeof params.scrollTop === "number" ? params.scrollTop : 0);
  const overscan = Math.max(0, Number.isInteger(params.overscan) ? params.overscan : 0);

  if (itemCount === 0) {
    return {
      start: 0,
      end: -1,
      paddingStart: 0,
      paddingEnd: 0
    };
  }

  const visibleCount = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const rawStart = Math.floor(scrollTop / itemHeight);
  const start = Math.max(0, rawStart - overscan);
  const end = Math.min(itemCount - 1, rawStart + visibleCount + overscan - 1);
  const paddingStart = start * itemHeight;
  const renderedCount = end >= start ? end - start + 1 : 0;
  const paddingEnd = Math.max(0, itemCount * itemHeight - paddingStart - renderedCount * itemHeight);

  return {
    start,
    end,
    paddingStart,
    paddingEnd
  };
}

function compareSortValues(a, b) {
  if (a === b) {
    return 0;
  }

  if (a === undefined || a === null) {
    return 1;
  }

  if (b === undefined || b === null) {
    return -1;
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b));
}

export function applyDataGridSort(rows, sort) {
  const normalizedRows = Array.isArray(rows) ? [...rows] : [];
  if (!sort || typeof sort.key !== "string" || sort.key.length === 0) {
    return normalizedRows;
  }

  const direction = sort.direction === "desc" ? "desc" : "asc";
  normalizedRows.sort((left, right) => {
    const result = compareSortValues(left?.[sort.key], right?.[sort.key]);
    return direction === "desc" ? result * -1 : result;
  });
  return normalizedRows;
}

export function flattenTreeNodes(nodes, expandedIds) {
  const list = [];
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const expandedSet = new Set(Array.isArray(expandedIds) ? expandedIds.map((id) => String(id)) : []);

  const walk = (source, depth, parentId) => {
    const entries = source.filter((item) => item && typeof item === "object");
    const setSize = entries.length;
    for (const [index, item] of entries.entries()) {
      const id = String(item.id);
      const children = Array.isArray(item.children) ? item.children : [];
      const isExpanded = children.length > 0 && expandedSet.has(id);
      const label = item.label !== undefined && item.label !== null ? item.label : id;

      list.push({
        id,
        label,
        labelText: getTreeLabelText(label, id),
        depth,
        level: depth + 1,
        parentId,
        disabled: item.disabled === true,
        hasChildren: children.length > 0,
        expanded: isExpanded,
        setSize,
        posInSet: index + 1,
        raw: item
      });

      if (isExpanded) {
        walk(children, depth + 1, id);
      }
    }
  };

  walk(normalizedNodes, 0, null);
  return list;
}

export function findTreeParentId(nodes, targetId) {
  const normalizedNodes = Array.isArray(nodes) ? nodes : [];
  const normalizedTargetId = String(targetId);

  const walk = (source, parentId) => {
    for (const item of source) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const id = String(item.id);
      if (id === normalizedTargetId) {
        return parentId;
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        const found = walk(item.children, id);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return undefined;
  };

  return walk(normalizedNodes, null);
}

function getTreeLabelText(label, fallback) {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  return String(fallback);
}

function getTreeItemPart(item) {
  if (!item || typeof item !== "object") {
    return "item";
  }
  if (item.part === "branch" || item.part === "leaf" || item.part === "item") {
    return item.part;
  }
  return item.hasChildren ? "branch" : "leaf";
}

function getTreeItemState(rootState, item) {
  if (item?.disabled) {
    return "disabled";
  }
  return rootState;
}

export function filterCommandPaletteItems(items, query) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const trimmed = typeof query === "string" ? query.trim().toLowerCase() : "";

  if (trimmed.length === 0) {
    return normalizedItems;
  }

  return normalizedItems.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const label = typeof item.label === "string" ? item.label.toLowerCase() : "";
    const shortcut = typeof item.shortcut === "string" ? item.shortcut.toLowerCase() : "";
    const keywords = Array.isArray(item.keywords)
      ? item.keywords
          .filter((keyword) => typeof keyword === "string")
          .join(" ")
          .toLowerCase()
      : "";

    return label.includes(trimmed) || shortcut.includes(trimmed) || keywords.includes(trimmed);
  });
}

export function clampSplitRatio(value, minRatio = 0.1, maxRatio = 0.9) {
  const min = normalizePositiveNumber(minRatio, 0.1);
  const max = normalizePositiveNumber(maxRatio, 0.9);
  const fallback = Math.max(min, Math.min(max, 0.5));
  const source = typeof value === "number" && !Number.isNaN(value) ? value : fallback;
  return Math.max(min, Math.min(max, source));
}

export function resolveDockPanelStateMap(panels, stateMap) {
  const map = {};
  const normalizedPanels = Array.isArray(panels) ? panels : [];
  const source = stateMap && typeof stateMap === "object" ? stateMap : {};

  for (const panel of normalizedPanels) {
    if (!panel || typeof panel.id !== "string") {
      continue;
    }

    const current = source[panel.id];
    if (current === "hidden" || current === "minimized" || current === "active") {
      map[panel.id] = current;
    } else {
      map[panel.id] = "active";
    }
  }

  return map;
}

export function toggleInspectorSection(sectionIds, targetId) {
  const current = new Set(Array.isArray(sectionIds) ? sectionIds.map((id) => String(id)) : []);
  const id = String(targetId);
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  return [...current];
}

export function normalizeSystemMessageItems(items, idPrefix = "message") {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const tone =
        item.tone === "error" || item.tone === "success" || item.tone === "warning"
          ? item.tone
          : "info";

      return {
        ...item,
        id:
          typeof item.id === "string" || typeof item.id === "number"
            ? String(item.id)
            : `${idPrefix}-${index}`,
        tone,
        durationMs:
          typeof item.durationMs === "number" && item.durationMs > 0
            ? item.durationMs
            : null
      };
    });
}

export function parsePositiveInteger(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

export function resolveSystemMessageQueue(params = {}) {
  const {
    items,
    idPrefix = "message",
    maxVisible = 3,
    defaultDurationMs = null
  } = params;

  const normalized = normalizeSystemMessageItems(items, idPrefix);
  const limit = parsePositiveInteger(maxVisible) || 3;
  const fallbackDuration = parsePositiveInteger(defaultDurationMs);

  return normalized.slice(0, limit).map((item) => ({
    ...item,
    effectiveDurationMs:
      typeof item.durationMs === "number" && item.durationMs > 0
        ? item.durationMs
        : fallbackDuration || null
  }));
}

export function dismissSystemMessage(items, targetId) {
  const normalizedTargetId = String(targetId);
  const normalizedItems = Array.isArray(items) ? items : [];
  return normalizedItems
    .filter((item) => item && String(item.id) !== normalizedTargetId)
    .map((item) => ({
      ...item
    }));
}

class ChipsErrorBoundaryKernel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error, errorInfo) {
    if (typeof this.props.onCapturedError === "function") {
      this.props.onCapturedError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const ChipsButton = React.forwardRef((props, ref) => {
  const {
    children,
    type = "button",
    disabled = false,
    loading = false,
    error = null,
    toggleable = false,
    pressed,
    defaultPressed = false,
    onPress,
    onPressedChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [internalPressed, setInternalPressed] = React.useState(defaultPressed === true);
  const isPressed = toggleable ? (pressed !== undefined ? pressed : internalPressed) : false;

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleClick = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    if (toggleable) {
      const next = !isPressed;
      if (pressed === undefined) {
        setInternalPressed(next);
      }
      if (typeof onPressedChange === "function") {
        onPressedChange(next);
      }
    }

    if (typeof onPress === "function") {
      onPress(event);
    }
  };

  const handleKeyDown = (event) => {
    if (!disabledByState && isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleClick(event);
    }
  };

  return React.createElement(
    "button",
    {
      ...createScopeAttributes("button", "root", state),
      ...handlers,
      type,
      ref,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-busy": loading ? "true" : undefined,
      "aria-pressed": toggleable ? String(isPressed) : undefined,
      "data-pressed": toggleable ? String(isPressed) : undefined,
      disabled: disabledByState,
      onClick: mergeHandlers(handleClick),
      onKeyDown: mergeHandlers(handleKeyDown)
    },
    React.createElement(
      "span",
      createScopeAttributes("button", "label", state),
      children
    ),
    loading
      ? React.createElement("span", {
          ...createScopeAttributes("button", "spinner", state),
          "aria-hidden": "true"
        })
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("button", "status", state),
            ...createAriaStatusProps({
              live: "assertive"
            })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsButton.displayName = "ChipsButton";

export const ChipsIconButton = React.forwardRef((props, ref) => {
  const {
    icon,
    descriptor,
    type = "button",
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    i18n,
    onPress,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const resolvedAriaLabel = resolveAccessibleText({
    value: ariaLabel || rest["aria-label"],
    key: ariaLabelKey,
    params: ariaLabelParams,
    fallback: fallbackAriaLabel,
    i18n,
    onDiagnostic
  });
  const ariaLabelledBy = isNonEmptyString(rest["aria-labelledby"])
    ? rest["aria-labelledby"].trim()
    : undefined;

  if (!resolvedAriaLabel && !ariaLabelledBy) {
    throw new Error("ICON_BUTTON_A11Y_LABEL_REQUIRED");
  }

  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleClick = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    if (typeof onPress === "function") {
      onPress(event);
    }
  };

  const handleKeyDown = (event) => {
    if (!disabledByState && isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleClick(event);
    }
  };

  const iconContent = icon !== undefined
    ? icon
    : descriptor
      ? React.createElement(ChipsIcon, {
          descriptor: {
            ...descriptor,
            decorative: true
          }
        })
      : null;

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("icon-button", "root", state),
      ...handlers,
      type,
      ref,
      disabled: disabledByState,
      "aria-label": resolvedAriaLabel || undefined,
      "aria-labelledby": ariaLabelledBy,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-busy": loading ? "true" : undefined,
      onClick: mergeHandlers(rest.onClick, handleClick),
      onKeyDown: mergeHandlers(rest.onKeyDown, handleKeyDown)
    },
    React.createElement(
      "span",
      {
        ...createScopeAttributes("icon-button", "icon", state),
        "aria-hidden": "true"
      },
      iconContent
    ),
    loading
      ? React.createElement("span", {
          ...createScopeAttributes("icon-button", "spinner", state),
          "aria-hidden": "true"
        })
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("icon-button", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsIconButton.displayName = "ChipsIconButton";

export const ChipsToggleButton = React.forwardRef((props, ref) => {
  const {
    children,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    icon,
    iconPosition = "start",
    type = "button",
    disabled = false,
    loading = false,
    error = null,
    pressed,
    defaultPressed = false,
    i18n,
    onPress,
    onPressedChange,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [internalPressed, setInternalPressed] = React.useState(defaultPressed === true);
  const isPressed = pressed !== undefined ? pressed === true : internalPressed;
  const content = resolveDisplayContent({
    children,
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction: {
      ...interaction,
      active: interaction.active || isPressed
    }
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleToggle = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    const nextPressed = !isPressed;
    if (pressed === undefined) {
      setInternalPressed(nextPressed);
    }
    if (typeof onPressedChange === "function") {
      onPressedChange(nextPressed);
    }
    if (typeof onPress === "function") {
      onPress(event);
    }
  };

  const handleKeyDown = (event) => {
    if (!disabledByState && isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleToggle(event);
    }
  };

  const iconNode = icon !== undefined
    ? React.createElement(
        "span",
        {
          ...createScopeAttributes("toggle-button", "icon", state),
          "aria-hidden": "true"
        },
        icon
      )
    : null;

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("toggle-button", "root", state),
      ...handlers,
      type,
      ref,
      disabled: disabledByState,
      "aria-pressed": String(isPressed),
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-busy": loading ? "true" : undefined,
      "data-pressed": String(isPressed),
      onClick: mergeHandlers(rest.onClick, handleToggle),
      onKeyDown: mergeHandlers(rest.onKeyDown, handleKeyDown)
    },
    iconPosition === "start" ? iconNode : null,
    React.createElement(
      "span",
      createScopeAttributes("toggle-button", "label", state),
      content
    ),
    iconPosition === "end" ? iconNode : null,
    loading
      ? React.createElement("span", {
          ...createScopeAttributes("toggle-button", "spinner", state),
          "aria-hidden": "true"
        })
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("toggle-button", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsToggleButton.displayName = "ChipsToggleButton";

export const ChipsBadge = React.forwardRef((props, ref) => {
  const {
    children,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    count,
    max,
    tone,
    icon,
    decorative = false,
    disabled = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const state = resolveInteractiveState({
    disabled,
    error: normalizedError
  });
  const resolvedTone = normalizedError ? "error" : normalizeControlTone(tone);
  const countText = formatBadgeValue(count, max);
  const content = resolveDisplayContent({
    children,
    value: countText ?? label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const ariaLabel = resolveAccessibleText({
    value: rest["aria-label"],
    fallback: typeof content === "string" ? content : "",
    i18n,
    onDiagnostic
  });

  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("badge", "root", state),
      ref,
      "data-tone": resolvedTone,
      "data-count": countText,
      "aria-hidden": decorative ? "true" : undefined,
      "aria-label": decorative ? undefined : ariaLabel || undefined,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined
    },
    icon
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("badge", "icon", state),
            "aria-hidden": "true"
          },
          icon
        )
      : null,
    React.createElement(
      "span",
      createScopeAttributes("badge", "label", state),
      content
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("badge", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsBadge.displayName = "ChipsBadge";

export const ChipsTag = React.forwardRef((props, ref) => {
  const {
    children,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    icon,
    disabled = false,
    loading = false,
    error = null,
    removable = false,
    closeLabel,
    closeLabelKey,
    fallbackCloseLabel = "Remove tag",
    i18n,
    onRemove,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const content = resolveDisplayContent({
    children,
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const resolvedCloseLabel = resolveAccessibleText({
    value: closeLabel,
    key: closeLabelKey,
    fallback: fallbackCloseLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleRemove = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    if (typeof onRemove === "function") {
      onRemove(event);
    }
  };

  const handleRemoveKeyDown = (event) => {
    if (!disabledByState && isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleRemove(event);
    }
  };

  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("tag", "root", state),
      ...handlers,
      ref,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-busy": loading ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-removable": String(removable === true)
    },
    icon
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("tag", "icon", state),
            "aria-hidden": "true"
          },
          icon
        )
      : null,
    React.createElement(
      "span",
      createScopeAttributes("tag", "label", state),
      content
    ),
    removable
      ? React.createElement(
          "button",
          {
            ...createScopeAttributes("tag", "close", state),
            type: "button",
            disabled: disabledByState,
            "aria-label": resolvedCloseLabel,
            onClick: handleRemove,
            onKeyDown: handleRemoveKeyDown
          },
          resolveIconContent(undefined, "close")
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("tag", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsTag.displayName = "ChipsTag";

export const ChipsAvatar = React.forwardRef((props, ref) => {
  const {
    name,
    nameKey,
    nameParams,
    fallbackName,
    src,
    alt,
    initials,
    shape,
    decorative = false,
    loading = false,
    disabled = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const displayName = resolveAccessibleText({
    value: name,
    key: nameKey,
    params: nameParams,
    fallback: fallbackName || alt,
    i18n,
    onDiagnostic
  });
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError
  });
  const resolvedInitials = resolveAvatarInitials({
    initials,
    name: displayName,
    fallback: "?"
  });
  const imageAlt = decorative ? "" : alt || displayName;

  if (!decorative && !displayName && !imageAlt) {
    throw new Error("AVATAR_A11Y_LABEL_REQUIRED");
  }

  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("avatar", "root", state),
      ref,
      role: decorative ? undefined : "img",
      "aria-label": decorative ? undefined : displayName || imageAlt,
      "aria-hidden": decorative ? "true" : undefined,
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-shape": normalizeAvatarShape(shape)
    },
    src && !normalizedError
      ? React.createElement("img", {
          ...createScopeAttributes("avatar", "image", state),
          src,
          alt: imageAlt,
          "aria-hidden": decorative ? "true" : undefined
        })
      : React.createElement(
          "span",
          {
            ...createScopeAttributes("avatar", "fallback", state),
            "aria-hidden": "true"
          },
          resolvedInitials
        ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("avatar", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsAvatar.displayName = "ChipsAvatar";

export const ChipsImage = React.forwardRef((props, ref) => {
  const {
    src,
    alt,
    decorative = false,
    caption,
    captionKey,
    captionParams,
    fallbackCaption,
    fallback,
    fit = "cover",
    objectPosition = "center",
    width,
    height,
    loading = false,
    loadingStrategy,
    decoding,
    disabled = false,
    error = null,
    i18n,
    onLoad,
    onError,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const effectiveError = normalizeError(error);
  const model = resolveImageModel({
    src,
    alt,
    decorative,
    fit,
    objectPosition,
    width,
    height,
    loading,
    loaded: props.loaded === true,
    disabled,
    error: effectiveError
  });
  const state = model.state;
  const resolvedCaption = resolveDisplayContent({
    value: caption,
    key: captionKey,
    params: captionParams,
    fallback: fallbackCaption,
    i18n,
    onDiagnostic
  });

  if (!model.decorative && !model.alt) {
    throw new Error("IMAGE_A11Y_ALT_REQUIRED");
  }

  if (typeof onStateChange === "function") {
    onStateChange(state);
  }

  const mediaStyle = {
    "--chips-image-fit": model.fit,
    "--chips-image-position": model.objectPosition
  };
  if (model.width !== undefined) {
    mediaStyle["--chips-image-width"] = typeof model.width === "number" ? `${model.width}px` : model.width;
  }
  if (model.height !== undefined) {
    mediaStyle["--chips-image-height"] = typeof model.height === "number" ? `${model.height}px` : model.height;
  }

  const handleLoad = (event) => {
    if (typeof onLoad === "function") {
      onLoad(event);
    }
  };

  const handleError = (event) => {
    const nextError = {
      code: "IMAGE_LOAD_ERROR",
      message: model.src ? `Image failed to load: ${model.src}` : "Image source is missing"
    };
    if (typeof onError === "function") {
      onError(nextError, event);
    }
  };

  const fallbackContent = fallback !== undefined
    ? fallback
    : model.loading
      ? "[[component.image.loading]]"
      : model.error
        ? model.error.message
        : "[[component.image.empty]]";

  return React.createElement(
    "figure",
    {
      ...rest,
      ...createScopeAttributes("image", "root", state),
      ref,
      role: model.decorative ? undefined : "group",
      "aria-label": model.decorative ? undefined : model.alt,
      "aria-hidden": model.decorative ? "true" : undefined,
      "aria-busy": model.loading ? "true" : undefined,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-invalid": model.error ? "true" : undefined,
      "data-fit": model.fit,
      "data-loaded": String(model.loaded),
      "data-has-source": String(model.hasSource)
    },
    model.hasSource && !model.error
      ? React.createElement("img", {
          ...createScopeAttributes("image", "media", state),
          src: model.src,
          alt: model.alt,
          loading: loadingStrategy,
          decoding,
          width: model.width,
          height: model.height,
          style: mediaStyle,
          "aria-hidden": model.decorative ? "true" : undefined,
          onLoad: handleLoad,
          onError: handleError
        })
      : null,
    model.fallbackVisible
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("image", "fallback", state),
            ...createAriaStatusProps({ live: model.error ? "assertive" : "polite" })
          },
          fallbackContent
        )
      : null,
    resolvedCaption
      ? React.createElement(
          "figcaption",
          createScopeAttributes("image", "caption", state),
          resolvedCaption
        )
      : null,
    model.error
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("image", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          model.error.message
        )
      : null
  );
});

ChipsImage.displayName = "ChipsImage";

export const ChipsMedia = React.forwardRef((props, ref) => {
  const {
    kind = "generic",
    src,
    title,
    titleKey,
    titleParams,
    fallbackTitle,
    caption,
    captionKey,
    captionParams,
    fallbackCaption,
    poster,
    fit = "contain",
    objectPosition = "center",
    width,
    height,
    controls = false,
    controlsContent,
    muted = false,
    loop = false,
    autoPlay = false,
    preload = "metadata",
    fallback,
    disabled = false,
    loading = false,
    error = null,
    i18n,
    onLoadStart,
    onLoadedMetadata,
    onError,
    onStateChange,
    onDiagnostic,
    children,
    ...rest
  } = props;

  const resolvedTitle = resolveAccessibleText({
    value: title,
    key: titleKey,
    params: titleParams,
    fallback: fallbackTitle,
    i18n,
    onDiagnostic
  });
  const resolvedCaption = resolveDisplayContent({
    value: caption,
    key: captionKey,
    params: captionParams,
    fallback: fallbackCaption,
    i18n,
    onDiagnostic
  });
  const effectiveError = normalizeError(error);
  const model = resolveMediaModel({
    kind,
    src,
    title: resolvedTitle,
    caption: resolvedCaption,
    fit,
    objectPosition,
    poster,
    width,
    height,
    controls,
    muted,
    loop,
    autoPlay,
    disabled,
    loading,
    error: effectiveError
  });
  const state = model.state;
  const mediaElement = model.kind === "audio"
    ? "audio"
    : model.kind === "video"
      ? "video"
      : "div";
  const mediaStyle = {
    "--chips-media-fit": model.fit,
    "--chips-media-position": model.objectPosition
  };
  if (model.width !== undefined) {
    mediaStyle["--chips-media-width"] = typeof model.width === "number" ? `${model.width}px` : model.width;
  }
  if (model.height !== undefined) {
    mediaStyle["--chips-media-height"] = typeof model.height === "number" ? `${model.height}px` : model.height;
  }

  if (!resolvedTitle && model.kind !== "generic") {
    throw new Error("MEDIA_A11Y_TITLE_REQUIRED");
  }
  if (model.kind === "generic" && !resolvedTitle && children === undefined) {
    throw new Error("MEDIA_A11Y_TITLE_REQUIRED");
  }

  if (typeof onStateChange === "function") {
    onStateChange(state);
  }

  const handleMediaError = (event) => {
    const nextError = {
      code: "MEDIA_LOAD_ERROR",
      message: model.src ? `Media failed to load: ${model.src}` : "Media source is missing"
    };
    if (typeof onError === "function") {
      onError(nextError, event);
    }
  };
  const shouldShowFallback = model.kind === "generic"
    ? model.loading || Boolean(model.error) || (children === undefined && !model.hasSource)
    : model.fallbackVisible;
  const fallbackContent = fallback !== undefined
    ? fallback
    : model.loading
      ? "[[component.media.loading]]"
      : model.error
        ? model.error.message
        : "[[component.media.empty]]";

  return React.createElement(
    "figure",
    {
      ...rest,
      ...createScopeAttributes("media", "root", state),
      ref,
      role: "group",
      "aria-label": resolvedTitle,
      "aria-busy": model.loading ? "true" : undefined,
      "aria-disabled": disabled ? "true" : undefined,
      "aria-invalid": model.error ? "true" : undefined,
      "data-kind": model.kind,
      "data-fit": model.fit,
      "data-has-source": String(model.hasSource),
      "data-controls": String(model.controls)
    },
    model.kind === "generic"
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("media", "content", state),
            style: mediaStyle
          },
          children
        )
      : model.hasSource && !model.error
        ? React.createElement(mediaElement, {
            ...createScopeAttributes("media", "content", state),
            src: model.src,
            title: resolvedTitle,
            poster: model.kind === "video" ? model.poster || undefined : undefined,
            controls: model.controls,
            muted: model.muted,
            loop: model.loop,
            autoPlay: model.autoPlay,
            preload,
            style: mediaStyle,
            onLoadStart,
            onLoadedMetadata,
            onError: handleMediaError
          })
        : null,
    shouldShowFallback
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("media", "status", state),
            ...createAriaStatusProps({ live: model.error ? "assertive" : "polite" })
          },
          fallbackContent
        )
      : null,
    controlsContent
      ? React.createElement(
          "div",
          createScopeAttributes("media", "controls", state),
          controlsContent
        )
      : null,
    resolvedCaption
      ? React.createElement(
          "figcaption",
          createScopeAttributes("media", "caption", state),
          resolvedCaption
        )
      : null,
    model.error
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("media", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          model.error.message
        )
      : null
  );
});

ChipsMedia.displayName = "ChipsMedia";

export const ChipsSpinner = React.forwardRef((props, ref) => {
  const {
    label,
    labelKey,
    labelParams,
    fallbackLabel = "Loading",
    decorative = false,
    loading = true,
    disabled = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const state = resolveInteractiveState({
    disabled,
    loading,
    error: normalizedError
  });
  const resolvedLabel = resolveAccessibleText({
    value: label || rest["aria-label"],
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });

  if (!decorative && !resolvedLabel) {
    throw new Error("SPINNER_A11Y_LABEL_REQUIRED");
  }

  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("spinner", "root", state),
      ref,
      role: decorative ? undefined : "status",
      "aria-label": decorative ? undefined : resolvedLabel,
      "aria-hidden": decorative ? "true" : undefined,
      "aria-busy": decorative ? undefined : String(loading === true),
      "aria-disabled": disabled ? "true" : undefined
    },
    React.createElement("span", {
      ...createScopeAttributes("spinner", "track", state),
      "aria-hidden": "true"
    }),
    React.createElement("span", {
      ...createScopeAttributes("spinner", "indicator", state),
      "aria-hidden": "true"
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("spinner", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSpinner.displayName = "ChipsSpinner";

export const ChipsProgress = React.forwardRef((props, ref) => {
  const {
    value,
    min = 0,
    max = 100,
    indeterminate = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    showValue = false,
    valueText,
    disabled = false,
    loading = false,
    error = null,
    i18n,
    onStateChange: _onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const metrics = resolveProgressMetrics({ value, min, max, indeterminate });
  const state = resolveInteractiveState({
    disabled,
    loading: loading || metrics.indeterminate,
    error: normalizedError
  });
  const resolvedLabel = resolveAccessibleText({
    value: label || rest["aria-label"],
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });

  if (!resolvedLabel && !isNonEmptyString(rest["aria-labelledby"])) {
    throw new Error("PROGRESS_A11Y_LABEL_REQUIRED");
  }

  const resolvedValueText = isNonEmptyString(valueText)
    ? valueText.trim()
    : metrics.indeterminate
      ? undefined
      : `${Math.round(metrics.ratio * 100)}%`;

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("progress", "root", state),
      ref,
      role: "progressbar",
      "aria-label": resolvedLabel || undefined,
      "aria-labelledby": rest["aria-labelledby"],
      "aria-valuemin": metrics.indeterminate ? undefined : metrics.min,
      "aria-valuemax": metrics.indeterminate ? undefined : metrics.max,
      "aria-valuenow": metrics.indeterminate ? undefined : metrics.value,
      "aria-valuetext": resolvedValueText,
      "aria-disabled": disabled ? "true" : undefined,
      "data-mode": metrics.indeterminate ? "indeterminate" : "determinate",
      "data-value": metrics.value === undefined ? undefined : String(metrics.value),
      style: {
        "--chips-progress-ratio": metrics.ratio,
        ...rest.style
      }
    },
    resolvedLabel
      ? React.createElement(
          "span",
          createScopeAttributes("progress", "label", state),
          resolvedLabel
        )
      : null,
    React.createElement(
      "span",
      createScopeAttributes("progress", "track", state),
      React.createElement("span", {
        ...createScopeAttributes("progress", "range", state),
        "aria-hidden": "true"
      })
    ),
    showValue && resolvedValueText
      ? React.createElement(
          "span",
          createScopeAttributes("progress", "value", state),
          resolvedValueText
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("progress", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsProgress.displayName = "ChipsProgress";

function resolveRatingItemDescriptor(shape, active) {
  const name = shape === "heart" ? "favorite" : "star";
  return {
    name,
    decorative: true,
    fill: active ? 1 : 0,
    wght: active ? 500 : 400
  };
}

function normalizeRatingCount(count) {
  const value = Number(count);
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

function normalizeRatingValue(value, count) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(numeric), 0), count);
}

export const ChipsRating = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = 0,
    count = 5,
    shape = "star",
    readOnly = false,
    disabled = false,
    loading = false,
    error = null,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    ariaLabel,
    ariaLabelledBy,
    getItemLabel,
    i18n,
    onValueChange,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedCount = normalizeRatingCount(count);
  const normalizedShape = normalizeRatingShape(shape);
  const [currentValue, setCurrentValue] = useControllableState({
    value: value === undefined ? undefined : normalizeRatingValue(value, normalizedCount),
    defaultValue: normalizeRatingValue(defaultValue, normalizedCount),
    onChange: onValueChange
  });
  const normalizedValue = normalizeRatingValue(currentValue, normalizedCount);
  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const resolvedLabel = resolveAccessibleText({
    value: label || ariaLabel || rest["aria-label"],
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabelledBy = isNonEmptyString(ariaLabelledBy || rest["aria-labelledby"])
    ? String(ariaLabelledBy || rest["aria-labelledby"]).trim()
    : undefined;

  if (!resolvedLabel && !resolvedAriaLabelledBy) {
    throw new Error("RATING_A11Y_LABEL_REQUIRED");
  }

  const [focusedIndex, setFocusedIndex] = React.useState(() => Math.max(normalizedValue - 1, 0));

  React.useEffect(() => {
    setFocusedIndex(Math.max(normalizedValue - 1, 0));
  }, [normalizedValue, normalizedCount]);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const commitValue = (nextValue, event) => {
    const next = normalizeRatingValue(nextValue, normalizedCount);
    if (disabledByState || readOnly) {
      event?.preventDefault?.();
      return;
    }
    setCurrentValue(next);
  };

  const focusAndCommit = (nextIndex, event) => {
    const next = Math.min(Math.max(nextIndex, 0), normalizedCount - 1);
    setFocusedIndex(next);
    commitValue(next + 1, event);
  };

  const handleRootKeyDown = (event) => {
    if (disabledByState || readOnly) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusAndCommit(focusedIndex + 1, event);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAndCommit(focusedIndex - 1, event);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusAndCommit(0, event);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusAndCommit(normalizedCount - 1, event);
    }
  };

  const itemLabel = (itemValue, active) => {
    if (typeof getItemLabel === "function") {
      return getItemLabel(itemValue, {
        active,
        count: normalizedCount,
        shape: normalizedShape
      });
    }
    return `${itemValue} / ${normalizedCount}`;
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("rating", "root", state),
      ...handlers,
      ref,
      role: "radiogroup",
      "aria-label": resolvedLabel || undefined,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-readonly": readOnly ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-value": String(normalizedValue),
      "data-count": String(normalizedCount),
      "data-shape": normalizedShape,
      "data-readonly": String(readOnly),
      onKeyDown: handleRootKeyDown
    },
    resolvedLabel
      ? React.createElement(
          "span",
          createScopeAttributes("rating", "label", state),
          resolvedLabel
        )
      : null,
    Array.from({ length: normalizedCount }, (_, index) => {
      const itemValue = index + 1;
      const selected = itemValue === normalizedValue;
      const active = itemValue <= normalizedValue;
      const itemState = disabledByState
        ? "disabled"
        : selected
          ? "active"
          : state;
      const itemDisabled = disabledByState;
      const itemTabIndex = readOnly
        ? -1
        : index === focusedIndex && !itemDisabled
          ? 0
          : -1;

      return React.createElement(
        "button",
        {
          ...createScopeAttributes("rating", "item", itemState),
          key: itemValue,
          type: "button",
          role: "radio",
          disabled: itemDisabled,
          "aria-checked": String(selected),
          "aria-disabled": itemDisabled ? "true" : undefined,
          "aria-label": itemLabel(itemValue, active),
          "data-selected": String(selected),
          "data-active": String(active),
          tabIndex: itemTabIndex,
          onFocus: () => setFocusedIndex(index),
          onClick: (event) => commitValue(itemValue, event)
        },
        React.createElement(
          "span",
          {
            ...createScopeAttributes("rating", "icon", itemState),
            "data-active": String(active)
          },
          React.createElement(ChipsIcon, {
            descriptor: resolveRatingItemDescriptor(normalizedShape, active)
          })
        )
      );
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("rating", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsRating.displayName = "ChipsRating";

function resolveInputDescriptor(params = {}) {
  const {
    scope,
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    i18n,
    onDiagnostic,
    interaction
  } = params;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const resolvedLabel = resolveAccessibleText({
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const resolvedDescription = resolveAccessibleText({
    value: description,
    key: descriptionKey,
    params: descriptionParams,
    fallback: fallbackDescription,
    i18n,
    onDiagnostic
  });
  const normalizedAriaLabel = resolveAccessibleText({
    value: ariaLabel,
    key: ariaLabelKey,
    params: ariaLabelParams,
    fallback: fallbackAriaLabel || resolvedLabel,
    i18n,
    onDiagnostic
  });
  const normalizedAriaLabelledBy = isNonEmptyString(ariaLabelledBy)
    ? ariaLabelledBy.trim()
    : undefined;
  const descriptionId = resolvedDescription ? `${scope}-description` : undefined;
  const statusId = normalizedError ? `${scope}-status` : undefined;
  const describedBy = buildAriaDescribedBy([
    ariaDescribedBy,
    descriptionId,
    statusId
  ]);
  const controlValueProps = value !== undefined
    ? { value }
    : defaultValue !== undefined
      ? { defaultValue }
      : {};

  return {
    scope,
    state,
    disabledByState,
    normalizedError,
    required: required === true,
    readOnly: readOnly === true,
    label: resolvedLabel,
    description: resolvedDescription,
    descriptionId,
    statusId,
    ariaLabel: normalizedAriaLabel || undefined,
    ariaLabelledBy: normalizedAriaLabelledBy,
    describedBy: describedBy || undefined,
    controlValueProps,
    hasAccessibleName: Boolean(normalizedAriaLabel || normalizedAriaLabelledBy)
  };
}

function assertInputAccessibleName(descriptor, errorCode) {
  if (!descriptor.hasAccessibleName) {
    throw new Error(errorCode);
  }
}

function createInputAdornment(part, scope, state, content) {
  if (content === undefined || content === null) {
    return null;
  }

  return React.createElement(
    "span",
    {
      ...createScopeAttributes(scope, part, state),
      "aria-hidden": "true"
    },
    content
  );
}

function renderInputDescription(descriptor) {
  if (!descriptor.description) {
    return null;
  }

  return React.createElement(
    "span",
    {
      ...createScopeAttributes(descriptor.scope, "description", descriptor.state),
      id: descriptor.descriptionId
    },
    descriptor.description
  );
}

function renderInputStatus(descriptor) {
  if (!descriptor.normalizedError) {
    return null;
  }

  return React.createElement(
    "span",
    {
      ...createScopeAttributes(descriptor.scope, "status", descriptor.state),
      id: descriptor.statusId,
      ...createAriaStatusProps({ live: "assertive" })
    },
    descriptor.normalizedError.message
  );
}

function createTextInputControlProps(params) {
  const {
    scope,
    descriptor,
    ref,
    placeholder,
    name,
    autoComplete,
    maxLength,
    minLength,
    inputMode,
    pattern,
    type = "text",
    rows,
    resize,
    onValueChange,
    onEnterPress,
    onKeyDown,
    onChange
  } = params;

  const handleChange = (event) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    if (typeof onValueChange === "function") {
      onValueChange(event.target.value, event);
    }
  };
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && typeof onEnterPress === "function") {
      onEnterPress(event.target.value, event);
    }
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  return {
    ...createScopeAttributes(scope, "control", descriptor.state),
    ...descriptor.controlValueProps,
    ref,
    type,
    name,
    rows,
    disabled: descriptor.disabledByState,
    readOnly: descriptor.readOnly,
    required: descriptor.required,
    placeholder,
    autoComplete,
    maxLength,
    minLength,
    inputMode,
    pattern,
    "aria-label": descriptor.ariaLabel,
    "aria-labelledby": descriptor.ariaLabelledBy,
    "aria-describedby": descriptor.describedBy,
    "aria-invalid": descriptor.normalizedError ? "true" : undefined,
    "aria-disabled": descriptor.disabledByState ? "true" : undefined,
    "aria-required": descriptor.required ? "true" : undefined,
    "aria-readonly": descriptor.readOnly ? "true" : undefined,
    "data-required": String(descriptor.required),
    "data-readonly": String(descriptor.readOnly),
    "data-invalid": descriptor.normalizedError ? "true" : "false",
    "data-resize": resize,
    onChange: handleChange,
    onKeyDown: handleKeyDown
  };
}

export function resolveTextInputDescriptor(params = {}) {
  return resolveInputDescriptor(params);
}

export const ChipsTextField = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    autoComplete,
    maxLength,
    minLength,
    inputMode,
    pattern,
    i18n,
    onValueChange,
    onStateChange,
    onEnterPress,
    onChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "text-field",
    value,
    defaultValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "TEXT_FIELD_A11Y_LABEL_REQUIRED"
  );

  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const controlProps = createTextInputControlProps({
    scope: "text-field",
    descriptor,
    ref,
    placeholder,
    name,
    autoComplete,
    maxLength,
    minLength,
    inputMode,
    pattern,
    onValueChange,
    onEnterPress,
    onKeyDown,
    onChange
  });

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("text-field", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": descriptor.normalizedError ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("text-field", "label", descriptor.state),
          descriptor.label
        )
      : null,
    React.createElement("input", controlProps),
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsTextField.displayName = "ChipsTextField";

export const ChipsTextArea = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    rows = 3,
    resize = "block",
    maxLength,
    minLength,
    i18n,
    onValueChange,
    onStateChange,
    onEnterPress,
    onChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "text-area",
    value,
    defaultValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "TEXT_AREA_A11Y_LABEL_REQUIRED"
  );

  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const controlProps = createTextInputControlProps({
    scope: "text-area",
    descriptor,
    ref,
    placeholder,
    name,
    rows,
    resize,
    maxLength,
    minLength,
    type: undefined,
    onValueChange,
    onEnterPress,
    onKeyDown,
    onChange
  });
  delete controlProps.type;

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("text-area", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": descriptor.normalizedError ? "true" : "false",
      "data-resize": resize
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("text-area", "label", descriptor.state),
          descriptor.label
        )
      : null,
    React.createElement("textarea", controlProps),
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsTextArea.displayName = "ChipsTextArea";

export const ChipsSearchField = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    searchIcon,
    clearLabel,
    clearLabelKey,
    fallbackClearLabel = "Clear search",
    showClear = true,
    i18n,
    onValueChange,
    onSearch,
    onEnterPress,
    onClear,
    onStateChange,
    onChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "search-field",
    value,
    defaultValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "SEARCH_FIELD_A11Y_LABEL_REQUIRED"
  );

  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const currentValue = value !== undefined ? value : uncontrolledValue;
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    interaction
  });
  const resolvedClearLabel = resolveAccessibleText({
    value: clearLabel,
    key: clearLabelKey,
    fallback: fallbackClearLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const handleValueChange = (nextValue, event) => {
    if (value === undefined) {
      setUncontrolledValue(nextValue);
    }
    if (typeof onValueChange === "function") {
      onValueChange(nextValue, event);
    }
  };
  const handleSearch = (nextValue, event) => {
    if (typeof onSearch === "function") {
      onSearch(nextValue, event);
    }
    if (typeof onEnterPress === "function") {
      onEnterPress(nextValue, event);
    }
  };
  const handleClear = (event) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      event.preventDefault();
      return;
    }
    if (value === undefined) {
      setUncontrolledValue("");
    }
    if (typeof onValueChange === "function") {
      onValueChange("", event);
    }
    if (typeof onClear === "function") {
      onClear(event);
    }
  };
  const handleClearKeyDown = (event) => {
    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleClear(event);
    }
  };

  const controlProps = createTextInputControlProps({
    scope: "search-field",
    descriptor: {
      ...descriptor,
      controlValueProps: { value: currentValue }
    },
    ref,
    placeholder,
    name,
    type: "search",
    onValueChange: handleValueChange,
    onEnterPress: handleSearch,
    onKeyDown,
    onChange
  });

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("search-field", "root", descriptor.state),
      ...handlers,
      role: "search",
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": descriptor.normalizedError ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("search-field", "label", descriptor.state),
          descriptor.label
        )
      : null,
    createInputAdornment(
      "search-icon",
      "search-field",
      descriptor.state,
      searchIcon ?? resolveIconContent(undefined, "search")
    ),
    React.createElement("input", controlProps),
    showClear && currentValue
      ? React.createElement(
          "button",
          {
            ...createScopeAttributes("search-field", "clear", descriptor.state),
            type: "button",
            disabled: descriptor.disabledByState || descriptor.readOnly,
            "aria-label": resolvedClearLabel,
            onClick: handleClear,
            onKeyDown: handleClearKeyDown
          },
          resolveIconContent(undefined, "close")
        )
      : null,
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsSearchField.displayName = "ChipsSearchField";

export const ChipsSecureField = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    autoComplete = "current-password",
    revealLabel,
    revealLabelKey,
    fallbackRevealLabel = "Show password",
    concealLabel,
    concealLabelKey,
    fallbackConcealLabel = "Hide password",
    visible,
    defaultVisible = false,
    i18n,
    onValueChange,
    onVisibilityChange,
    onStateChange,
    onEnterPress,
    onChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "secure-field",
    value,
    defaultValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "SECURE_FIELD_A11Y_LABEL_REQUIRED"
  );

  const [internalVisible, setInternalVisible] = React.useState(defaultVisible === true);
  const isVisible = visible !== undefined ? visible === true : internalVisible;
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    interaction
  });
  const toggleLabel = resolveAccessibleText({
    value: isVisible ? concealLabel : revealLabel,
    key: isVisible ? concealLabelKey : revealLabelKey,
    fallback: isVisible ? fallbackConcealLabel : fallbackRevealLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const handleVisibilityToggle = (event) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      event.preventDefault();
      return;
    }
    const nextVisible = !isVisible;
    if (visible === undefined) {
      setInternalVisible(nextVisible);
    }
    if (typeof onVisibilityChange === "function") {
      onVisibilityChange(nextVisible, event);
    }
  };
  const handleVisibilityKeyDown = (event) => {
    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      handleVisibilityToggle(event);
    }
  };

  const controlProps = createTextInputControlProps({
    scope: "secure-field",
    descriptor,
    ref,
    placeholder,
    name,
    autoComplete,
    type: isVisible ? "text" : "password",
    onValueChange,
    onEnterPress,
    onKeyDown,
    onChange
  });

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("secure-field", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": descriptor.normalizedError ? "true" : "false",
      "data-visible": String(isVisible)
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("secure-field", "label", descriptor.state),
          descriptor.label
        )
      : null,
    React.createElement("input", controlProps),
    React.createElement(
      "button",
      {
        ...createScopeAttributes("secure-field", "visibility-toggle", descriptor.state),
        type: "button",
        disabled: descriptor.disabledByState || descriptor.readOnly,
        "aria-label": toggleLabel,
        "aria-pressed": String(isVisible),
        onClick: handleVisibilityToggle,
        onKeyDown: handleVisibilityKeyDown
      },
      React.createElement(
        "span",
        {
          ...createScopeAttributes("secure-field", "visibility-icon", descriptor.state),
          "aria-hidden": "true"
        },
        resolveIconContent(undefined, isVisible ? "visibility-off" : "visibility")
      )
    ),
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsSecureField.displayName = "ChipsSecureField";

export const ChipsInput = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    placeholder,
    onValueChange,
    onStateChange,
    onEnterPress
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleChange = (event) => {
    if (typeof onValueChange === "function") {
      onValueChange(event.target.value);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && typeof onEnterPress === "function") {
      onEnterPress(event.target.value);
    }
  };

  const inputProps = {
    ...createScopeAttributes("input", "control", state),
    ref,
    disabled: disabledByState,
    readOnly,
    placeholder,
    "aria-invalid": normalizedError ? "true" : undefined,
    "aria-disabled": disabledByState ? "true" : undefined,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onFocus: handlers.onFocus,
    onBlur: handlers.onBlur
  };

  if (value !== undefined) {
    inputProps.value = value;
  } else {
    inputProps.defaultValue = defaultValue;
  }

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("input", "root", state),
      ...handlers
    },
    React.createElement("input", inputProps),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("input", "status", state),
            ...createAriaStatusProps({
              live: "assertive"
            })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsInput.displayName = "ChipsInput";

export const ChipsCheckbox = React.forwardRef((props, ref) => {
  const {
    checked,
    defaultChecked = false,
    disabled = false,
    loading = false,
    error = null,
    label,
    name,
    value,
    onCheckedChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const inputProps = {
    ...createScopeAttributes("checkbox", "control", state),
    ref,
    type: "checkbox",
    disabled: disabledByState,
    name,
    value,
    "aria-invalid": normalizedError ? "true" : undefined,
    onFocus: handlers.onFocus,
    onBlur: handlers.onBlur,
    onChange: (event) => {
      if (typeof onCheckedChange === "function") {
        onCheckedChange(event.target.checked);
      }
    }
  };

  if (checked !== undefined) {
    inputProps.checked = checked;
  } else {
    inputProps.defaultChecked = defaultChecked;
  }

  const currentChecked = checked !== undefined ? checked : defaultChecked;

  return React.createElement(
    "label",
    {
      ...createScopeAttributes("checkbox", "root", state),
      ...handlers,
      "data-checked": String(Boolean(currentChecked)),
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement("input", inputProps),
    React.createElement("span", {
      ...createScopeAttributes("checkbox", "indicator", state),
      "aria-hidden": "true"
    }),
    label
      ? React.createElement(
          "span",
          createScopeAttributes("checkbox", "label", state),
          label
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("checkbox", "status", state),
            ...createAriaStatusProps({
              live: "assertive"
            })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsCheckbox.displayName = "ChipsCheckbox";

export const ChipsRadioGroup = React.forwardRef((props, ref) => {
  const {
    name,
    value,
    defaultValue = "",
    disabled = false,
    loading = false,
    error = null,
    options = [],
    onValueChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value !== undefined ? value : internalValue;

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleValueChange = (nextValue) => {
    if (disabledByState) {
      return;
    }

    if (value === undefined) {
      setInternalValue(nextValue);
    }

    if (typeof onValueChange === "function") {
      onValueChange(nextValue);
    }
  };

  return React.createElement(
    "fieldset",
    {
      ...createScopeAttributes("radio", "root", state),
      ...handlers,
      ref,
      disabled: disabledByState,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    options.map((option, index) => {
      const optionValue = String(option.value);
      const optionDisabled = disabledByState || option.disabled === true;
      const optionChecked = currentValue === optionValue;

      return React.createElement(
        "label",
        {
          ...createScopeAttributes("radio", "item", state),
          key: `${optionValue}-${index}`,
          "data-checked": String(optionChecked),
          "aria-disabled": optionDisabled ? "true" : undefined
        },
        React.createElement("input", {
          ...createScopeAttributes("radio", "control", state),
          type: "radio",
          name,
          checked: optionChecked,
          disabled: optionDisabled,
          "aria-checked": String(optionChecked),
          onFocus: handlers.onFocus,
          onBlur: handlers.onBlur,
          onChange: () => handleValueChange(optionValue)
        }),
        React.createElement("span", {
          ...createScopeAttributes("radio", "indicator", state),
          "aria-hidden": "true"
        }),
        React.createElement(
          "span",
          createScopeAttributes("radio", "label", state),
          option.label
        )
      );
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("radio", "status", state),
            ...createAriaStatusProps({
              live: "assertive"
            })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsRadioGroup.displayName = "ChipsRadioGroup";

export const ChipsSwitch = React.forwardRef((props, ref) => {
  const {
    checked,
    defaultChecked = false,
    disabled = false,
    loading = false,
    error = null,
    label,
    onCheckedChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked === true);
  const currentChecked = checked !== undefined ? checked : internalChecked;

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const toggle = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    const next = !currentChecked;
    if (checked === undefined) {
      setInternalChecked(next);
    }

    if (typeof onCheckedChange === "function") {
      onCheckedChange(next);
    }
  };

  const handleKeyDown = (event) => {
    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      toggle(event);
    }
  };

  return React.createElement(
    "button",
    {
      ...createScopeAttributes("switch", "root", state),
      ...handlers,
      ref,
      type: "button",
      role: "switch",
      "aria-checked": String(currentChecked),
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-busy": loading ? "true" : undefined,
      "data-checked": String(currentChecked),
      disabled: disabledByState,
      onClick: toggle,
      onKeyDown: handleKeyDown
    },
    React.createElement(
      "span",
      {
        ...createScopeAttributes("switch", "track", state),
        "aria-hidden": "true"
      },
      React.createElement("span", {
        ...createScopeAttributes("switch", "thumb", state),
        "aria-hidden": "true"
      })
    ),
    label
      ? React.createElement(
          "span",
          createScopeAttributes("switch", "label", state),
          label
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("switch", "status", state),
            ...createAriaStatusProps({
              live: "assertive"
            })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSwitch.displayName = "ChipsSwitch";

function upsertRegistryEntry(registry, entry) {
  const index = registry.findIndex((item) => item.value === entry.value);
  if (index < 0) {
    return [...registry, entry];
  }
  const next = [...registry];
  next[index] = entry;
  return next;
}

function removeRegistryEntry(registry, value) {
  return registry.filter((item) => item.value !== value);
}

function mergeRegisteredEntries(registered, fallback) {
  const byValue = new Map();
  for (const item of fallback) {
    byValue.set(item.value, item);
  }
  for (const item of registered) {
    byValue.set(item.value, item);
  }
  return Array.from(byValue.values());
}

function getEnabledEntryByValue(items, value) {
  return items.find((item) => item.value === value && item.disabled !== true) || null;
}

function getFirstEnabledEntry(items) {
  return items[getFirstEnabledIndex(items)] || null;
}

function getLastEnabledEntry(items) {
  return items[getNextEnabledIndex(items, 0, "prev", true)] || null;
}

function getNextEnabledEntry(items, currentValue, direction = "next", loop = true) {
  const currentIndex = items.findIndex((item) => item.value === currentValue);
  return items[getNextEnabledIndex(items, currentIndex, direction, loop)] || null;
}

function focusRegistryEntry(entry) {
  const node = entry?.ref?.current;
  if (node && typeof node.focus === "function") {
    node.focus();
  }
}

function assignCssLength(value) {
  if (typeof value === "number") {
    return `${value}px`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function buildSelectContentStyle(style, { gutter, maxBlockSize, minInlineSize }) {
  return {
    "--chips-select-content-gutter": assignCssLength(gutter) ?? "var(--chips-base-space-1, 4px)",
    "--chips-select-content-max-block-size": assignCssLength(maxBlockSize) ?? "min(280px, calc(100vh - 24px))",
    "--chips-select-content-min-inline-size": assignCssLength(minInlineSize) ?? "100%",
    ...style
  };
}

function resolveSelectableEntry(items, preferredValue) {
  return getEnabledEntryByValue(items, preferredValue)
    || getFirstEnabledEntry(items);
}

const [SelectCompoundContext, useSelectCompoundContext] = createCompoundContext("select");

const SelectRoot = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = "",
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    placeholder = "",
    iconContent,
    options = [],
    children,
    onValueChange,
    onOpenChange,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const normalizedOptions = normalizeItems(options);
  const [currentValue, setCurrentValue] = useControllableState({
    value: value !== undefined ? String(value) : undefined,
    defaultValue: defaultValue !== undefined ? String(defaultValue) : "",
    onChange: onValueChange
  });
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const [highlightedValue, setHighlightedValue] = React.useState(null);
  const optionRegistryRef = React.useRef([]);
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const triggerRef = React.useRef(null);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const generatedId = React.useId();
  const baseId = rest.id || generatedId;
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const selectableOptions = React.useMemo(
    () => mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions),
    [registryVersion, normalizedOptions]
  );
  const selectedOption = selectableOptions.find((item) => item.value === String(currentValue))
    || normalizedOptions.find((item) => item.value === String(currentValue))
    || null;
  const highlightedOption = getEnabledEntryByValue(selectableOptions, highlightedValue);
  const rovingModel = React.useMemo(
    () => createRovingTabIndex(selectableOptions, {
      activeId: highlightedValue || currentValue
    }),
    [currentValue, highlightedValue, selectableOptions]
  );

  const registerOption = React.useCallback((entry) => {
    optionRegistryRef.current = upsertRegistryEntry(optionRegistryRef.current, entry);
    setRegistryVersion((version) => version + 1);
    return () => {
      optionRegistryRef.current = removeRegistryEntry(optionRegistryRef.current, entry.value);
      setRegistryVersion((version) => version + 1);
    };
  }, []);

  const updateOpen = React.useCallback(
    (nextOpen) => {
      if (disabledByState) {
        return;
      }
      setCurrentOpen(Boolean(nextOpen));
    },
    [disabledByState, setCurrentOpen]
  );

  const highlightValue = React.useCallback(
    (nextValue, options = {}) => {
      const entry = nextValue === null
        ? null
        : getEnabledEntryByValue(optionRegistryRef.current, String(nextValue))
          || getEnabledEntryByValue(normalizedOptions, String(nextValue));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedOptions]
  );

  const highlightSelectedOrFirst = React.useCallback(
    (options = {}) => {
      const entry = resolveSelectableEntry(
        mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions),
        String(currentValue)
      );
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [currentValue, normalizedOptions]
  );

  const highlightFirst = React.useCallback(
    (options = {}) => {
      const entry = getFirstEnabledEntry(mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedOptions]
  );

  const highlightLast = React.useCallback(
    (options = {}) => {
      const entry = getLastEnabledEntry(mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedOptions]
  );

  const highlightNext = React.useCallback(
    (direction, options = {}) => {
      const entries = mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions);
      const entry = getNextEnabledEntry(entries, highlightedValue, direction, true);
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [highlightedValue, normalizedOptions]
  );

  const selectValue = React.useCallback(
    (nextValue, details = {}) => {
      const option = getEnabledEntryByValue(
        mergeRegisteredEntries(optionRegistryRef.current, normalizedOptions),
        String(nextValue)
      );
      if (!option || disabledByState) {
        details.event?.preventDefault?.();
        return;
      }
      setCurrentValue(option.value);
      setCurrentOpen(false);
      setHighlightedValue(option.value);
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    },
    [disabledByState, normalizedOptions, setCurrentOpen, setCurrentValue]
  );

  const openList = React.useCallback(
    (options = {}) => {
      if (disabledByState) {
        return;
      }
      setCurrentOpen(true);
      highlightSelectedOrFirst(options);
    },
    [disabledByState, highlightSelectedOrFirst, setCurrentOpen]
  );

  const closeList = React.useCallback(
    () => {
      if (!disabledByState) {
        setCurrentOpen(false);
      }
    },
    [disabledByState, setCurrentOpen]
  );

  const toggleOpen = React.useCallback((event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    const nextOpen = !currentOpen;
    setCurrentOpen(nextOpen);
    if (nextOpen) {
      highlightSelectedOrFirst();
    }
  }, [currentOpen, disabledByState, highlightSelectedOrFirst, setCurrentOpen]);

  React.useEffect(() => {
    if (!currentOpen) {
      return;
    }
    const highlightedExists = getEnabledEntryByValue(selectableOptions, highlightedValue);
    if (!highlightedExists) {
      const fallback = resolveSelectableEntry(selectableOptions, String(currentValue));
      setHighlightedValue(fallback ? fallback.value : null);
    }
  }, [currentOpen, currentValue, highlightedValue, selectableOptions]);

  const contextValue = React.useMemo(
    () => ({
      state,
      open: Boolean(currentOpen),
      disabled: disabledByState,
      loading,
      error: normalizedError,
      value: String(currentValue ?? ""),
      highlightedValue,
      selectedOption,
      highlightedOption,
      selectableOptions,
      rovingModel,
      placeholder,
      baseId,
      triggerId,
      contentId,
      triggerRef,
      registerOption,
      updateOpen,
      openList,
      closeList,
      toggleOpen,
      highlightValue,
      highlightSelectedOrFirst,
      highlightFirst,
      highlightLast,
      highlightNext,
      selectValue
    }),
    [
      state,
      currentOpen,
      disabledByState,
      loading,
      normalizedError,
      currentValue,
      highlightedValue,
      selectedOption,
      highlightedOption,
      selectableOptions,
      rovingModel,
      placeholder,
      baseId,
      triggerId,
      contentId,
      registerOption,
      updateOpen,
      openList,
      closeList,
      toggleOpen,
      highlightValue,
      highlightSelectedOrFirst,
      highlightFirst,
      highlightLast,
      highlightNext,
      selectValue
    ]
  );

  const fallbackChildren = React.createElement(
    React.Fragment,
    null,
    React.createElement(
      SelectTrigger,
      null,
      React.createElement(SelectValue, null),
      React.createElement(
        "span",
        {
          ...createScopeAttributes("select", "icon", state),
          "aria-hidden": "true"
        },
        resolveIconContent(iconContent, "chevron-down")
      )
    ),
    React.createElement(
      SelectContent,
      null,
      normalizedOptions.map((option, index) =>
        React.createElement(
          SelectOption,
          {
            key: `${option.value}-${index}`,
            value: option.value,
            disabled: option.disabled,
            textValue: option.textValue,
            index
          },
          option.label
        )
      )
    )
  );

  return React.createElement(
    SelectCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("select", "root", state),
        ...handlers,
        ref,
        "aria-disabled": disabledByState ? "true" : undefined,
        "data-open": String(Boolean(currentOpen))
      },
      children !== undefined ? children : fallbackChildren,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("select", "status", state),
              ...createAriaStatusProps({
                live: "assertive"
              })
            },
            normalizedError.message
          )
        : null
    )
  );
});

SelectRoot.displayName = "ChipsSelect.Root";

const SelectTrigger = React.forwardRef((props, ref) => {
  const { children, onClick, onKeyDown, ...rest } = props;
  const context = useSelectCompoundContext("trigger");
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  React.useEffect(() => {
    context.triggerRef.current = localRef.current;
    return () => {
      if (context.triggerRef.current === localRef.current) {
        context.triggerRef.current = null;
      }
    };
  }, [context.triggerRef]);

  const handleKeyDown = (event) => {
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
    if (event.defaultPrevented || context.disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!context.open) {
        context.openList();
      } else {
        context.highlightNext("next");
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!context.open) {
        context.updateOpen(true);
        context.highlightLast();
      } else {
        context.highlightNext("prev");
      }
      return;
    }

    if (event.key === "Home" && context.open) {
      event.preventDefault();
      context.highlightFirst();
      return;
    }

    if (event.key === "End" && context.open) {
      event.preventDefault();
      context.highlightLast();
      return;
    }

    if (event.key === "Escape" && context.open) {
      event.preventDefault();
      context.closeList();
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      if (context.open && context.highlightedValue !== null) {
        context.selectValue(context.highlightedValue, { source: "keyboard", event });
      } else {
        context.openList();
      }
    }
  };

  return React.createElement(
      "button",
      {
        ...rest,
        ...createScopeAttributes("select", "trigger", context.state),
        ref: localRef,
        id: rest.id || context.triggerId,
        type: "button",
        role: "button",
        disabled: context.disabled,
        "aria-disabled": context.disabled ? "true" : undefined,
        "aria-haspopup": "listbox",
        "aria-expanded": String(context.open),
        "aria-controls": context.contentId,
        "aria-activedescendant": context.open && context.highlightedOption
          ? context.highlightedOption.id
          : undefined,
        onClick: mergeEventHandlers(onClick, context.toggleOpen),
        onKeyDown: handleKeyDown
      },
      children
    );
});

SelectTrigger.displayName = "ChipsSelect.Trigger";

const SelectValue = React.forwardRef((props, ref) => {
  const { children, placeholder, ...rest } = props;
  const context = useSelectCompoundContext("value");
  const fallback = placeholder !== undefined ? placeholder : context.placeholder;
  return React.createElement(
    "span",
    {
      ...rest,
      ...createScopeAttributes("select", "value", context.state),
      ref,
      "data-placeholder": String(!context.selectedOption)
    },
    children !== undefined
      ? children
      : context.selectedOption
        ? context.selectedOption.label
        : fallback
  );
});

SelectValue.displayName = "ChipsSelect.Value";

const SelectContent = React.forwardRef((props, ref) => {
  const {
    children,
    onKeyDown,
    gutter,
    maxBlockSize,
    minInlineSize,
    style,
    ...rest
  } = props;
  const context = useSelectCompoundContext("content");
  const handleKeyDown = (event) => {
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
    if (event.defaultPrevented || context.disabled) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      context.closeList();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      context.highlightNext("next", { focus: true });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      context.highlightNext("prev", { focus: true });
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      context.highlightFirst({ focus: true });
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      context.highlightLast({ focus: true });
      return;
    }
    if (isKeyboardActivationKey(event.key) && context.highlightedValue !== null) {
      event.preventDefault();
      context.selectValue(context.highlightedValue, { source: "keyboard", event });
    }
  };
  if (!context.open) {
    return null;
  }
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("select", "content", context.state),
      ref,
      id: rest.id || context.contentId,
      role: rest.role || "listbox",
      "aria-labelledby": rest["aria-labelledby"] || context.triggerId,
      "data-placement": rest["data-placement"] || "bottom-start",
      tabIndex: rest.tabIndex ?? -1,
      style: buildSelectContentStyle(style, { gutter, maxBlockSize, minInlineSize }),
      onKeyDown: handleKeyDown
    },
    children
  );
});

SelectContent.displayName = "ChipsSelect.Content";

const SelectOption = React.forwardRef((props, ref) => {
  const {
    children,
    value,
    disabled = false,
    textValue,
    index = 0,
    onClick,
    onMouseEnter,
    onFocus,
    ...rest
  } = props;
  const context = useSelectCompoundContext("option");
  const optionValue = String(value);
  const idSegment = normalizeDomIdSegment(optionValue, String(index));
  const optionId = rest.id || `${context.baseId}-option-${idSegment}`;
  const disabledByState = context.disabled || disabled;
  const selected = context.value === optionValue;
  const highlighted = context.highlightedValue === optionValue;
  const rovingItem = getRovingItemByValue(context.rovingModel, optionValue);
  const optionState = disabledByState
    ? "disabled"
    : selected
      ? "active"
      : highlighted
        ? "hover"
        : context.state === "disabled" || context.state === "loading" || context.state === "error"
          ? context.state
          : "idle";
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  const label = children !== undefined ? children : textValue ?? optionValue;

  React.useEffect(
    () => context.registerOption({
      value: optionValue,
      disabled: disabledByState,
      label,
      textValue,
      id: optionId,
      ref: localRef
    }),
    [context.registerOption, disabledByState, label, optionId, optionValue, textValue]
  );

  const selectCurrent = (event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    context.selectValue(optionValue, { source: "pointer", event });
  };

  const highlightCurrent = (event) => {
    if (typeof onMouseEnter === "function" && event.type === "mouseenter") {
      onMouseEnter(event);
    }
    if (typeof onFocus === "function" && event.type === "focus") {
      onFocus(event);
    }
    if (!event.defaultPrevented && !disabledByState) {
      context.highlightValue(optionValue);
    }
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("select", "option", optionState),
      ref: localRef,
      id: optionId,
      role: rest.role || "option",
      ...getRovingTabIndexProps(rovingItem || { active: highlighted, disabled: disabledByState }, { includeAriaDisabled: false }),
      "aria-selected": String(selected),
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-selected": String(selected),
      "data-highlighted": String(highlighted),
      onMouseEnter: highlightCurrent,
      onFocus: highlightCurrent,
      onClick: mergeEventHandlers(onClick, selectCurrent)
    },
    children
  );
});

SelectOption.displayName = "ChipsSelect.Option";

export const ChipsSelect = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Content: SelectContent,
  Option: SelectOption,
  Value: SelectValue
});

ChipsSelect.displayName = "ChipsSelect";

export const ChipsSegmentedControl = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = "",
    disabled = false,
    loading = false,
    error = null,
    options = [],
    ariaLabel,
    ariaLabelledBy,
    i18n,
    onValueChange,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const normalizedOptions = normalizeItems(options);
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange
  });
  const selectedIndex = normalizedOptions.findIndex((item) => item.value === String(currentValue));
  const [focusedIndex, setFocusedIndex] = React.useState(
    selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(normalizedOptions)
  );

  React.useEffect(() => {
    const nextSelectedIndex = normalizedOptions.findIndex((item) => item.value === String(currentValue));
    if (nextSelectedIndex >= 0 && normalizedOptions[nextSelectedIndex]?.disabled !== true) {
      setFocusedIndex(nextSelectedIndex);
      return;
    }

    setFocusedIndex(getFirstEnabledIndex(normalizedOptions));
  }, [currentValue, normalizedOptions]);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const resolvedAriaLabel = resolveAccessibleText({
    value: ariaLabel || rest["aria-label"],
    fallback: "",
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabelledBy = isNonEmptyString(ariaLabelledBy || rest["aria-labelledby"])
    ? String(ariaLabelledBy || rest["aria-labelledby"]).trim()
    : undefined;

  if (!resolvedAriaLabel && !resolvedAriaLabelledBy) {
    throw new Error("SEGMENTED_CONTROL_A11Y_LABEL_REQUIRED");
  }

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const selectOption = (option, event) => {
    if (disabledByState || !option || option.disabled) {
      if (event) {
        event.preventDefault();
      }
      return;
    }

    setCurrentValue(option.value);
  };

  const focusAndSelect = (index, event) => {
    const option = normalizedOptions[index];
    if (!option || option.disabled) {
      return;
    }
    setFocusedIndex(index);
    selectOption(option, event);
  };

  const handleRootKeyDown = (event) => {
    if (disabledByState || normalizedOptions.length === 0) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusAndSelect(getNextEnabledIndex(normalizedOptions, focusedIndex, "next", true), event);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusAndSelect(getNextEnabledIndex(normalizedOptions, focusedIndex, "prev", true), event);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusAndSelect(getFirstEnabledIndex(normalizedOptions), event);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusAndSelect(getNextEnabledIndex(normalizedOptions, 0, "prev", true), event);
    }
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("segmented-control", "root", state),
      ...handlers,
      ref,
      role: "radiogroup",
      "aria-label": resolvedAriaLabel || undefined,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-value": currentValue !== undefined ? String(currentValue) : "",
      onKeyDown: handleRootKeyDown
    },
    normalizedOptions.map((option, index) => {
      const selected = option.value === String(currentValue);
      const optionDisabled = disabledByState || option.disabled;
      const itemState = optionDisabled
        ? "disabled"
        : selected
          ? "active"
          : state;

      return React.createElement(
        "button",
        {
          ...createScopeAttributes("segmented-control", "item", itemState),
          key: `${option.value}-${index}`,
          type: "button",
          role: "radio",
          disabled: optionDisabled,
          "aria-checked": String(selected),
          "aria-disabled": optionDisabled ? "true" : undefined,
          "data-selected": String(selected),
          tabIndex: index === focusedIndex && !optionDisabled ? 0 : -1,
          onFocus: () => setFocusedIndex(index),
          onClick: (event) => selectOption(option, event)
        },
        selected
          ? React.createElement("span", {
              ...createScopeAttributes("segmented-control", "indicator", itemState),
              "aria-hidden": "true"
            })
          : null,
        React.createElement(
          "span",
          createScopeAttributes("segmented-control", "label", itemState),
          option.label
        )
      );
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("segmented-control", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSegmentedControl.displayName = "ChipsSegmentedControl";

export const ChipsComboBox = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = "",
    inputValue,
    defaultInputValue = "",
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    autoComplete = "off",
    options = [],
    emptyLabel,
    emptyLabelKey,
    fallbackEmptyLabel = "No results",
    triggerLabel,
    triggerLabelKey,
    fallbackTriggerLabel = "Toggle options",
    i18n,
    onValueChange,
    onInputValueChange,
    onOpenChange,
    onStateChange,
    onDiagnostic,
    onKeyDown,
    onChange,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "combo-box",
    value: inputValue,
    defaultValue: defaultInputValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "COMBO_BOX_A11Y_LABEL_REQUIRED"
  );

  const normalizedOptions = normalizeItems(options);
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange
  });
  const [currentInputValue, setCurrentInputValue] = useControllableState({
    value: inputValue,
    defaultValue: defaultInputValue,
    onChange: onInputValueChange
  });
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    value: currentInputValue,
    defaultValue: undefined,
    interaction
  });

  const filteredOptions = (() => {
    const query = String(currentInputValue || "").trim().toLocaleLowerCase();
    if (!query) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) =>
      getOptionText(option).toLocaleLowerCase().includes(query)
        || option.value.toLocaleLowerCase().includes(query)
    );
  })();
  const selectedIndex = filteredOptions.findIndex((item) => item.value === String(currentValue));
  const [highlightedIndex, setHighlightedIndex] = React.useState(
    selectedIndex >= 0 ? selectedIndex : getFirstEnabledIndex(filteredOptions)
  );

  React.useEffect(() => {
    if (selectedIndex >= 0 && filteredOptions[selectedIndex]?.disabled !== true) {
      setHighlightedIndex(selectedIndex);
      return;
    }

    setHighlightedIndex(getFirstEnabledIndex(filteredOptions));
  }, [filteredOptions, selectedIndex]);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const listId = React.useId();
  const activeOption = currentOpen && highlightedIndex >= 0 ? filteredOptions[highlightedIndex] : null;
  const activeDescendant = activeOption ? `${listId}-option-${activeOption.value}` : undefined;
  const resolvedEmptyLabel = resolveAccessibleText({
    value: emptyLabel,
    key: emptyLabelKey,
    fallback: fallbackEmptyLabel,
    i18n,
    onDiagnostic
  });
  const resolvedTriggerLabel = resolveAccessibleText({
    value: triggerLabel,
    key: triggerLabelKey,
    fallback: fallbackTriggerLabel,
    i18n,
    onDiagnostic
  });

  const updateOpen = (nextOpen) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      return;
    }
    setCurrentOpen(nextOpen);
  };

  const selectOption = (option, event) => {
    if (!option || option.disabled || descriptor.disabledByState || descriptor.readOnly) {
      if (event) {
        event.preventDefault();
      }
      return;
    }

    setCurrentValue(option.value);
    setCurrentInputValue(getOptionText(option));
    setCurrentOpen(false);
  };

  const handleInputChange = (event) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    setCurrentInputValue(event.target.value);
    if (!currentOpen && !descriptor.disabledByState && !descriptor.readOnly) {
      setCurrentOpen(true);
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Escape" && currentOpen) {
      event.preventDefault();
      setCurrentOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!currentOpen) {
        updateOpen(true);
      } else {
        setHighlightedIndex(getNextEnabledIndex(filteredOptions, highlightedIndex, "next", true));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!currentOpen) {
        updateOpen(true);
      } else {
        setHighlightedIndex(getNextEnabledIndex(filteredOptions, highlightedIndex, "prev", true));
      }
    } else if (event.key === "Home" && currentOpen) {
      event.preventDefault();
      setHighlightedIndex(getFirstEnabledIndex(filteredOptions));
    } else if (event.key === "End" && currentOpen) {
      event.preventDefault();
      setHighlightedIndex(getNextEnabledIndex(filteredOptions, 0, "prev", true));
    } else if (event.key === "Enter" && currentOpen) {
      event.preventDefault();
      selectOption(filteredOptions[highlightedIndex], event);
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("combo-box", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-open": String(currentOpen),
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": descriptor.normalizedError ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("combo-box", "label", descriptor.state),
          descriptor.label
        )
      : null,
    React.createElement("input", {
      ...createScopeAttributes("combo-box", "control", descriptor.state),
      ...descriptor.controlValueProps,
      ref,
      role: "combobox",
      type: "text",
      name,
      placeholder,
      autoComplete,
      disabled: descriptor.disabledByState,
      readOnly: descriptor.readOnly,
      required: descriptor.required,
      "aria-autocomplete": "list",
      "aria-expanded": String(currentOpen),
      "aria-controls": listId,
      "aria-activedescendant": activeDescendant,
      "aria-label": descriptor.ariaLabel,
      "aria-labelledby": descriptor.ariaLabelledBy,
      "aria-describedby": descriptor.describedBy,
      "aria-invalid": descriptor.normalizedError ? "true" : undefined,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "aria-readonly": descriptor.readOnly ? "true" : undefined,
      onFocus: (event) => {
        handlers.onFocus(event);
        if (!descriptor.disabledByState && !descriptor.readOnly) {
          setCurrentOpen(true);
        }
      },
      onBlur: handlers.onBlur,
      onChange: handleInputChange,
      onKeyDown: handleInputKeyDown
    }),
    React.createElement(
      "button",
      {
        ...createScopeAttributes("combo-box", "trigger", descriptor.state),
        type: "button",
        disabled: descriptor.disabledByState || descriptor.readOnly,
        "aria-label": resolvedTriggerLabel,
        "aria-haspopup": "listbox",
        "aria-expanded": String(currentOpen),
        "aria-controls": listId,
        onClick: () => updateOpen(!currentOpen)
      },
      resolveIconContent(undefined, "chevron-down")
    ),
    currentOpen
      ? React.createElement(
          "ul",
          {
            ...createScopeAttributes("combo-box", "list", descriptor.state),
            id: listId,
            role: "listbox"
          },
          filteredOptions.length > 0
            ? filteredOptions.map((option, index) => {
                const selected = option.value === String(currentValue);
                const highlighted = index === highlightedIndex;
                const optionState = option.disabled
                  ? "disabled"
                  : highlighted
                    ? "active"
                    : descriptor.state;

                return React.createElement(
                  "li",
                  {
                    ...createScopeAttributes("combo-box", "option", optionState),
                    id: `${listId}-option-${option.value}`,
                    key: `${option.value}-${index}`,
                    role: "option",
                    "aria-selected": String(selected),
                    "aria-disabled": option.disabled ? "true" : undefined,
                    "data-highlighted": String(highlighted),
                    "data-selected": String(selected),
                    onMouseEnter: () => {
                      if (!option.disabled) {
                        setHighlightedIndex(index);
                      }
                    },
                    onMouseDown: (event) => {
                      event.preventDefault();
                      selectOption(option, event);
                    }
                  },
                  option.label
                );
              })
            : React.createElement(
                "li",
                {
                  ...createScopeAttributes("combo-box", "option", "disabled"),
                  role: "option",
                  "aria-disabled": "true",
                  "aria-selected": "false",
                  "data-empty": "true"
                },
                resolvedEmptyLabel
              )
        )
      : null,
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsComboBox.displayName = "ChipsComboBox";

function createNumericChangeDetails(params) {
  const { model, previousValue, source, text } = params;
  return {
    source,
    previousValue,
    value: model.value,
    text: text ?? model.text,
    min: model.min,
    max: model.max,
    step: model.step,
    largeStep: model.largeStep,
    atMin: model.atMin,
    atMax: model.atMax,
    empty: model.empty,
    invalid: model.invalid
  };
}

function resolveNumericError(params) {
  const {
    error,
    invalid,
    invalidMessage,
    invalidMessageKey,
    fallbackInvalidMessage,
    i18n,
    onDiagnostic
  } = params;
  const normalizedError = normalizeError(error);
  if (normalizedError || !invalid) {
    return normalizedError;
  }

  const message = resolveAccessibleText({
    value: invalidMessage,
    key: invalidMessageKey,
    fallback: fallbackInvalidMessage,
    i18n,
    onDiagnostic
  });

  return message
    ? {
        code: "NUMERIC_VALUE_INVALID",
        message
      }
    : null;
}

function assertNumericAccessibleName(descriptor, errorCode) {
  if (!descriptor.hasAccessibleName) {
    throw new Error(errorCode);
  }
}

export const ChipsNumberInput = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = null,
    textValue,
    defaultTextValue,
    min,
    max,
    step,
    largeStep,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    inputMode = "decimal",
    autoComplete,
    valueText,
    formatValue,
    invalidMessage,
    invalidMessageKey = "component.numberInput.invalid",
    fallbackInvalidMessage = "Invalid number",
    decrementLabel,
    decrementLabelKey,
    fallbackDecrementLabel = "Decrease value",
    incrementLabel,
    incrementLabelKey,
    fallbackIncrementLabel = "Increase value",
    decrementContent,
    incrementContent,
    i18n,
    onValueChange,
    onInputChange,
    onStateChange,
    onEnterPress,
    onKeyDown,
    onChange,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "number-input",
    value: textValue,
    defaultValue: defaultTextValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertNumericAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "NUMBER_INPUT_A11Y_LABEL_REQUIRED"
  );

  const range = normalizeNumericRange({ min, max, step, largeStep });
  const normalizedDefaultValue = normalizeNumericValue(defaultValue, range, { align: false });
  const controlledValue = value !== undefined;
  const controlledText = textValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(normalizedDefaultValue);
  const [internalText, setInternalText] = React.useState(() => {
    if (defaultTextValue !== undefined) {
      return String(defaultTextValue);
    }
    return formatNumericValue(normalizedDefaultValue, formatValue);
  });
  const currentValue = controlledValue
    ? normalizeNumericValue(value, range, { align: false })
    : internalValue;
  const currentText = controlledText
    ? String(textValue)
    : internalText;
  const currentModel = resolveNumericControlModel({
    value: currentValue,
    text: currentText,
    min,
    max,
    step,
    largeStep,
    required,
    valueText,
    formatValue,
    align: false
  });
  const effectiveError = resolveNumericError({
    error,
    invalid: currentModel.invalid,
    invalidMessage,
    invalidMessageKey,
    fallbackInvalidMessage,
    i18n,
    onDiagnostic
  });
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    value: currentText,
    defaultValue: undefined,
    error: effectiveError,
    interaction
  });
  const invalid = Boolean(effectiveError) || currentModel.invalid;
  const empty = currentText.trim().length === 0;
  const resolvedDecrementLabel = resolveAccessibleText({
    value: decrementLabel,
    key: decrementLabelKey,
    fallback: fallbackDecrementLabel,
    i18n,
    onDiagnostic
  });
  const resolvedIncrementLabel = resolveAccessibleText({
    value: incrementLabel,
    key: incrementLabelKey,
    fallback: fallbackIncrementLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  React.useEffect(() => {
    if (!controlledText && controlledValue) {
      setInternalText(formatNumericValue(currentValue, formatValue));
    }
  }, [controlledText, controlledValue, currentValue, formatValue]);

  const updateText = (nextText, event) => {
    if (!controlledText) {
      setInternalText(nextText);
    }
    if (typeof onInputChange === "function") {
      onInputChange(nextText, event);
    }
  };

  const commitValue = (nextValue, event, source, nextText) => {
    const normalizedValue = nextValue === null
      ? null
      : normalizeNumericValue(nextValue, range, { align: true });
    const model = resolveNumericControlModel({
      value: normalizedValue,
      min,
      max,
      step,
      largeStep,
      required,
      valueText,
      formatValue
    });
    const displayText = nextText !== undefined
      ? nextText
      : formatNumericValue(model.value, formatValue);

    if (!controlledValue) {
      setInternalValue(model.value);
    }
    if (!controlledText) {
      setInternalText(displayText);
    }
    if (typeof onValueChange === "function") {
      onValueChange(
        model.value,
        createNumericChangeDetails({
          model,
          previousValue: currentValue,
          source,
          text: displayText
        }),
        event
      );
    }
  };

  const commitText = (event, source) => {
    const parsed = parseNumericText(currentText, range, { required, align: true });
    if (parsed.kind === "invalid") {
      return false;
    }
    if (parsed.kind === "empty") {
      commitValue(null, event, source, "");
      return true;
    }
    commitValue(parsed.value, event, source);
    return true;
  };

  const stepValue = (delta, event, source) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      event?.preventDefault?.();
      return;
    }
    const parsed = parseNumericText(currentText, range, { required: false, align: true });
    const base = parsed.kind === "valid" ? parsed.value : currentValue;
    const nextValue = getNextNumericValue(base, range, delta, range.min);
    commitValue(nextValue, event, source);
  };

  const handleChange = (event) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    updateText(event.target.value, event);
  };

  const handleKeyDown = (event) => {
    const delta = getNumericStepForKey(event.key, range);
    if (delta !== 0) {
      event.preventDefault();
      stepValue(delta, event, "keyboard");
    } else if (event.key === "Home") {
      event.preventDefault();
      commitValue(range.min, event, "keyboard");
    } else if (event.key === "End") {
      event.preventDefault();
      commitValue(range.max, event, "keyboard");
    } else if (event.key === "Enter") {
      if (commitText(event, "commit") && typeof onEnterPress === "function") {
        onEnterPress(currentModel.value, event);
      }
    } else if (event.key === "Escape") {
      updateText(formatNumericValue(currentValue, formatValue), event);
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  const decrementDisabled = descriptor.disabledByState || descriptor.readOnly || currentModel.atMin;
  const incrementDisabled = descriptor.disabledByState || descriptor.readOnly || currentModel.atMax;

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("number-input", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": invalid ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": invalid ? "true" : "false",
      "data-empty": empty ? "true" : "false",
      "data-at-min": currentModel.atMin ? "true" : "false",
      "data-at-max": currentModel.atMax ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "span",
          createScopeAttributes("number-input", "label", descriptor.state),
          descriptor.label
        )
      : null,
    React.createElement("input", {
      ...createScopeAttributes("number-input", "control", descriptor.state),
      ref,
      role: "spinbutton",
      type: "text",
      name,
      placeholder,
      inputMode,
      autoComplete,
      disabled: descriptor.disabledByState,
      readOnly: descriptor.readOnly,
      required: descriptor.required,
      value: currentText,
      "aria-label": descriptor.ariaLabel,
      "aria-labelledby": descriptor.ariaLabelledBy,
      "aria-describedby": descriptor.describedBy,
      "aria-invalid": invalid ? "true" : undefined,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "aria-readonly": descriptor.readOnly ? "true" : undefined,
      "aria-valuemin": range.min,
      "aria-valuemax": range.max,
      "aria-valuenow": currentModel.value !== null && !currentModel.invalid ? currentModel.value : undefined,
      "aria-valuetext": currentModel.valueText,
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": invalid ? "true" : "false",
      "data-empty": empty ? "true" : "false",
      onChange: handleChange,
      onFocus: handlers.onFocus,
      onBlur: (event) => {
        handlers.onBlur(event);
        commitText(event, "blur");
      },
      onKeyDown: handleKeyDown
    }),
    React.createElement(
      "button",
      {
        ...createScopeAttributes("number-input", "decrement", descriptor.state),
        type: "button",
        disabled: decrementDisabled,
        "aria-label": resolvedDecrementLabel,
        "aria-disabled": decrementDisabled ? "true" : undefined,
        onClick: (event) => stepValue(-range.step, event, "decrement")
      },
      resolveIconContent(decrementContent, "collapse")
    ),
    React.createElement(
      "button",
      {
        ...createScopeAttributes("number-input", "increment", descriptor.state),
        type: "button",
        disabled: incrementDisabled,
        "aria-label": resolvedIncrementLabel,
        "aria-disabled": incrementDisabled ? "true" : undefined,
        onClick: (event) => stepValue(range.step, event, "increment")
      },
      resolveIconContent(incrementContent, "expand")
    ),
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsNumberInput.displayName = "ChipsNumberInput";

export const ChipsStepper = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = 0,
    min,
    max,
    step,
    largeStep,
    orientation = "horizontal",
    disabled = false,
    loading = false,
    error = null,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy,
    valueText,
    formatValue,
    decrementLabel,
    decrementLabelKey,
    fallbackDecrementLabel = "Decrease value",
    incrementLabel,
    incrementLabelKey,
    fallbackIncrementLabel = "Increase value",
    decrementContent,
    incrementContent,
    i18n,
    onValueChange,
    onStateChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const resolvedLabel = resolveAccessibleText({
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabel = resolveAccessibleText({
    value: ariaLabel || rest["aria-label"],
    key: ariaLabelKey,
    params: ariaLabelParams,
    fallback: fallbackAriaLabel || resolvedLabel,
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabelledBy = isNonEmptyString(ariaLabelledBy || rest["aria-labelledby"])
    ? String(ariaLabelledBy || rest["aria-labelledby"]).trim()
    : undefined;

  if (!resolvedAriaLabel && !resolvedAriaLabelledBy) {
    throw new Error("STEPPER_A11Y_LABEL_REQUIRED");
  }

  const range = normalizeNumericRange({ min, max, step, largeStep });
  const normalizedDefaultValue = normalizeNumericValue(defaultValue, range) ?? range.min;
  const [currentValue, setCurrentValue] = useControllableState({
    value: value === undefined ? undefined : (normalizeNumericValue(value, range) ?? range.min),
    defaultValue: normalizedDefaultValue
  });
  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const model = resolveNumericControlModel({
    value: currentValue,
    min,
    max,
    step,
    largeStep,
    valueText,
    formatValue
  });
  const resolvedDecrementLabel = resolveAccessibleText({
    value: decrementLabel,
    key: decrementLabelKey,
    fallback: fallbackDecrementLabel,
    i18n,
    onDiagnostic
  });
  const resolvedIncrementLabel = resolveAccessibleText({
    value: incrementLabel,
    key: incrementLabelKey,
    fallback: fallbackIncrementLabel,
    i18n,
    onDiagnostic
  });
  const normalizedOrientation = orientation === "vertical" ? "vertical" : "horizontal";

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const commitValue = (nextValue, event, source) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    const nextModel = resolveNumericControlModel({
      value: nextValue,
      min,
      max,
      step,
      largeStep,
      valueText,
      formatValue
    });
    setCurrentValue(nextModel.value);
    if (typeof onValueChange === "function") {
      onValueChange(
        nextModel.value,
        createNumericChangeDetails({
          model: nextModel,
          previousValue: model.value,
          source
        }),
        event
      );
    }
  };

  const stepValue = (delta, event, source) => {
    const nextValue = getNextNumericValue(model.value, range, delta, range.min);
    commitValue(nextValue, event, source);
  };

  const handleKeyDown = (event) => {
    const delta = getNumericStepForKey(event.key, range);
    if (delta !== 0) {
      event.preventDefault();
      stepValue(delta, event, "keyboard");
    } else if (event.key === "Home") {
      event.preventDefault();
      commitValue(range.min, event, "keyboard");
    } else if (event.key === "End") {
      event.preventDefault();
      commitValue(range.max, event, "keyboard");
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  const decrementDisabled = disabledByState || model.atMin;
  const incrementDisabled = disabledByState || model.atMax;

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("stepper", "root", state),
      ...handlers,
      ref,
      role: "group",
      tabIndex: disabledByState ? undefined : 0,
      "aria-label": resolvedAriaLabel || undefined,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-orientation": normalizedOrientation,
      "data-at-min": model.atMin ? "true" : "false",
      "data-at-max": model.atMax ? "true" : "false",
      onKeyDown: handleKeyDown
    },
    resolvedLabel
      ? React.createElement(
          "span",
          createScopeAttributes("stepper", "label", state),
          resolvedLabel
        )
      : null,
    React.createElement(
      "button",
      {
        ...createScopeAttributes("stepper", "decrement", state),
        type: "button",
        disabled: decrementDisabled,
        "aria-label": resolvedDecrementLabel,
        "aria-disabled": decrementDisabled ? "true" : undefined,
        onClick: (event) => stepValue(-range.step, event, "decrement")
      },
      resolveIconContent(decrementContent, "collapse")
    ),
    React.createElement(
      "output",
      {
        ...createScopeAttributes("stepper", "value", state),
        "aria-live": "polite",
        "data-value": model.value !== null ? String(model.value) : ""
      },
      model.valueText ?? formatNumericValue(model.value, formatValue)
    ),
    React.createElement(
      "button",
      {
        ...createScopeAttributes("stepper", "increment", state),
        type: "button",
        disabled: incrementDisabled,
        "aria-label": resolvedIncrementLabel,
        "aria-disabled": incrementDisabled ? "true" : undefined,
        onClick: (event) => stepValue(range.step, event, "increment")
      },
      resolveIconContent(incrementContent, "expand")
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("stepper", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsStepper.displayName = "ChipsStepper";

export const ChipsSlider = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue = 0,
    min,
    max,
    step,
    largeStep,
    orientation = "horizontal",
    disabled = false,
    loading = false,
    error = null,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy,
    valueText,
    formatValue,
    showValue = false,
    i18n,
    onValueChange,
    onStateChange,
    onKeyDown,
    onDiagnostic,
    ...rest
  } = props;

  const resolvedLabel = resolveAccessibleText({
    value: label,
    key: labelKey,
    params: labelParams,
    fallback: fallbackLabel,
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabel = resolveAccessibleText({
    value: ariaLabel || rest["aria-label"],
    key: ariaLabelKey,
    params: ariaLabelParams,
    fallback: fallbackAriaLabel || resolvedLabel,
    i18n,
    onDiagnostic
  });
  const resolvedAriaLabelledBy = isNonEmptyString(ariaLabelledBy || rest["aria-labelledby"])
    ? String(ariaLabelledBy || rest["aria-labelledby"]).trim()
    : undefined;

  if (!resolvedAriaLabel && !resolvedAriaLabelledBy) {
    throw new Error("SLIDER_A11Y_LABEL_REQUIRED");
  }

  const range = normalizeNumericRange({ min, max, step, largeStep });
  const normalizedDefaultValue = normalizeNumericValue(defaultValue, range) ?? range.min;
  const [currentValue, setCurrentValue] = useControllableState({
    value: value === undefined ? undefined : (normalizeNumericValue(value, range) ?? range.min),
    defaultValue: normalizedDefaultValue
  });
  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const model = resolveSliderModel({
    value: currentValue,
    min,
    max,
    step,
    largeStep,
    orientation,
    valueText,
    formatValue
  });
  const normalizedOrientation = orientation === "vertical" ? "vertical" : "horizontal";
  const ratio = model.ratio;
  const resolvedValueText = model.valueText ?? formatNumericValue(model.value, formatValue);
  const trackRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const commitValue = (nextValue, event, source) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    const nextModel = resolveNumericControlModel({
      value: nextValue,
      min,
      max,
      step,
      largeStep,
      valueText,
      formatValue
    });
    setCurrentValue(nextModel.value);
    if (typeof onValueChange === "function") {
      onValueChange(
        nextModel.value,
        createNumericChangeDetails({
          model: nextModel,
          previousValue: model.value,
          source
        }),
        event
      );
    }
  };

  const stepValue = (delta, event, source) => {
    const nextValue = getNextNumericValue(model.value, range, delta, range.min);
    commitValue(nextValue, event, source);
  };

  const handleKeyDown = (event) => {
    const delta = getNumericStepForKey(event.key, range);
    if (delta !== 0) {
      event.preventDefault();
      stepValue(delta, event, "keyboard");
    } else if (event.key === "Home") {
      event.preventDefault();
      commitValue(range.min, event, "keyboard");
    } else if (event.key === "End") {
      event.preventDefault();
      commitValue(range.max, event, "keyboard");
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  const handleTrackPointerDown = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }
    const nextValue = getNumericValueFromPointer(event, range, normalizedOrientation);
    if (nextValue !== null) {
      commitValue(nextValue, event, "pointer");
    }
  };

  const handleThumbPointerDown = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }
    const track = trackRef.current;
    if (!track) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const nextValue = getNumericValueFromPointerTarget(track, moveEvent, range, normalizedOrientation);
      if (nextValue !== null) {
        commitValue(nextValue, moveEvent, "pointer");
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("slider", "root", state),
      ...handlers,
      "aria-disabled": disabledByState ? "true" : undefined,
      "aria-invalid": normalizedError ? "true" : undefined,
      "data-orientation": normalizedOrientation,
      "data-value": model.value !== null ? String(model.value) : "",
      "data-ratio": String(ratio),
      "data-at-min": model.atMin ? "true" : "false",
      "data-at-max": model.atMax ? "true" : "false",
      style: {
        "--chips-slider-ratio": ratio,
        ...rest.style
      }
    },
    resolvedLabel
      ? React.createElement(
          "span",
          createScopeAttributes("slider", "label", state),
          resolvedLabel
        )
      : null,
    React.createElement(
      "span",
      {
        ...createScopeAttributes("slider", "track", state),
        ref: trackRef,
        onPointerDown: handleTrackPointerDown
      },
      React.createElement("span", {
        ...createScopeAttributes("slider", "range", state),
        "aria-hidden": "true"
      }),
      React.createElement("button", {
        ...createScopeAttributes("slider", "thumb", state),
        ref,
        type: "button",
        role: "slider",
        disabled: disabledByState,
        "aria-label": resolvedAriaLabel || undefined,
        "aria-labelledby": resolvedAriaLabelledBy,
        "aria-orientation": normalizedOrientation,
        "aria-valuemin": range.min,
        "aria-valuemax": range.max,
        "aria-valuenow": model.value ?? range.min,
        "aria-valuetext": resolvedValueText,
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-invalid": normalizedError ? "true" : undefined,
        onPointerDown: handleThumbPointerDown,
        onKeyDown: handleKeyDown
      })
    ),
    showValue && resolvedValueText
      ? React.createElement(
          "output",
          {
            ...createScopeAttributes("slider", "value", state),
            "aria-live": "polite",
            "data-value": model.value !== null ? String(model.value) : ""
          },
          resolvedValueText
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("slider", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSlider.displayName = "ChipsSlider";

function createPickerChangeDetails(params) {
  return {
    source: params.source,
    previousValue: params.previousValue,
    value: params.value,
    text: params.text,
    invalid: params.invalid === true
  };
}

function getDateKeyTarget(currentValue, key, model) {
  const base = parseIsoDateParts(currentValue)
    ? currentValue
    : model.value || model.textValue || formatIsoDate({ ...model.month, day: 1 });

  if (key === "ArrowRight") {
    return addIsoDateDays(base, 1);
  }
  if (key === "ArrowLeft") {
    return addIsoDateDays(base, -1);
  }
  if (key === "ArrowDown") {
    return addIsoDateDays(base, 7);
  }
  if (key === "ArrowUp") {
    return addIsoDateDays(base, -7);
  }
  if (key === "Home") {
    const parts = parseIsoDateParts(base);
    return parts ? formatIsoDate({ ...parts, day: 1 }) : base;
  }
  if (key === "End") {
    const parts = parseIsoDateParts(base);
    return parts
      ? formatIsoDate({
          ...parts,
          day: new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate()
        })
      : base;
  }
  if (key === "PageUp" || key === "PageDown") {
    const parts = parseIsoDateParts(base);
    if (!parts) {
      return base;
    }
    const nextMonth = addCalendarMonths(parts, key === "PageUp" ? -1 : 1);
    const maxDay = new Date(Date.UTC(nextMonth.year, nextMonth.month, 0)).getUTCDate();
    return formatIsoDate({ ...nextMonth, day: Math.min(parts.day, maxDay) });
  }

  return "";
}

export const ChipsDatePicker = React.forwardRef((props, ref) => {
  const {
    id,
    value,
    defaultValue = "",
    textValue,
    defaultTextValue,
    open,
    defaultOpen = false,
    min,
    max,
    defaultMonth,
    weekStartsOn = 0,
    weekDayLabels,
    monthLabels,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    triggerLabel,
    triggerLabelKey,
    fallbackTriggerLabel = "Open calendar",
    invalidMessage,
    invalidMessageKey = "component.datePicker.invalid",
    fallbackInvalidMessage = "Invalid date",
    previousLabel,
    previousLabelKey,
    fallbackPreviousLabel = "Previous month",
    nextLabel,
    nextLabelKey,
    fallbackNextLabel = "Next month",
    triggerContent,
    isDateDisabled,
    i18n,
    onValueChange,
    onInputChange,
    onOpenChange,
    onMonthChange,
    onStateChange,
    onKeyDown,
    onChange,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "date-picker",
    value: textValue,
    defaultValue: defaultTextValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "DATE_PICKER_A11Y_LABEL_REQUIRED"
  );

  const controlledValue = value !== undefined;
  const controlledText = textValue !== undefined;
  const controlledOpen = open !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => clampIsoDate(defaultValue, min, max));
  const [internalText, setInternalText] = React.useState(() => {
    if (defaultTextValue !== undefined) {
      return String(defaultTextValue);
    }
    return clampIsoDate(defaultValue, min, max);
  });
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen === true);
  const [visibleMonth, setVisibleMonth] = React.useState(() =>
    resolveCalendarMonth(clampIsoDate(defaultValue, min, max), defaultMonth, min, max)
  );
  const currentValue = controlledValue ? clampIsoDate(value, min, max) : internalValue;
  const currentText = controlledText ? String(textValue) : internalText;
  const currentOpen = controlledOpen ? open === true : internalOpen;
  const baseModel = resolveDatePickerModel({
    value: currentValue,
    text: currentText,
    min,
    max,
    month: formatIsoDate({ ...visibleMonth, day: 1 }),
    weekStartsOn,
    weekDayLabels,
    monthLabels,
    isDateDisabled
  });
  const resolvedInvalidMessage = resolveAccessibleText({
    value: invalidMessage,
    key: invalidMessageKey,
    fallback: fallbackInvalidMessage,
    i18n,
    onDiagnostic
  });
  const effectiveError = normalizeError(error) || (
    baseModel.invalid
      ? { code: "DATE_PICKER_VALUE_INVALID", message: resolvedInvalidMessage }
      : null
  );
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    value: currentText,
    defaultValue: undefined,
    error: effectiveError,
    interaction
  });
  const model = resolveDatePickerModel({
    value: currentValue,
    text: currentText,
    min,
    max,
    month: formatIsoDate({ ...visibleMonth, day: 1 }),
    weekStartsOn,
    weekDayLabels,
    monthLabels,
    isDateDisabled
  });
  const generatedInputId = React.useId();
  const inputId = id || generatedInputId;
  const calendarId = `${inputId}-calendar`;
  const gridId = `${calendarId}-grid`;
  const activeCell = model.cells.find((cell) => cell.selected && !cell.disabled)
    ?? model.cells.find((cell) => cell.today && !cell.disabled)
    ?? model.cells.find((cell) => !cell.outsideMonth && !cell.disabled)
    ?? model.cells.find((cell) => !cell.disabled);
  const activeCellValue = activeCell?.value ?? "";
  const activeCellId = activeCellValue ? `${calendarId}-cell-${activeCellValue}` : undefined;
  const resolvedTriggerLabel = resolveAccessibleText({
    value: triggerLabel,
    key: triggerLabelKey,
    fallback: fallbackTriggerLabel,
    i18n,
    onDiagnostic
  });
  const resolvedPreviousLabel = resolveAccessibleText({
    value: previousLabel,
    key: previousLabelKey,
    fallback: fallbackPreviousLabel,
    i18n,
    onDiagnostic
  });
  const resolvedNextLabel = resolveAccessibleText({
    value: nextLabel,
    key: nextLabelKey,
    fallback: fallbackNextLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const updateOpen = (nextOpen, event) => {
    if (!controlledOpen) {
      setInternalOpen(nextOpen);
    }
    if (typeof onOpenChange === "function") {
      onOpenChange(nextOpen, event);
    }
  };

  const updateMonth = (nextMonth, event, source) => {
    setVisibleMonth(nextMonth);
    if (typeof onMonthChange === "function") {
      onMonthChange(nextMonth, { source }, event);
    }
  };

  const commitDate = (nextValue, event, source) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      event?.preventDefault?.();
      return false;
    }

    const normalized = clampIsoDate(nextValue, min, max);
    const invalid = !normalized || isIsoDateDisabled(normalized, min, max, isDateDisabled);
    if (invalid) {
      return false;
    }

    if (!controlledValue) {
      setInternalValue(normalized);
    }
    if (!controlledText) {
      setInternalText(normalized);
    }
    const parts = parseIsoDateParts(normalized);
    if (parts) {
      updateMonth({ year: parts.year, month: parts.month }, event, source);
    }
    if (typeof onValueChange === "function") {
      onValueChange(
        normalized,
        createPickerChangeDetails({
          source,
          previousValue: currentValue,
          value: normalized,
          text: normalized,
          invalid: false
        }),
        event
      );
    }
    return true;
  };

  const commitText = (event, source) => {
    const normalized = clampIsoDate(currentText, min, max);
    if (!normalized) {
      return false;
    }
    return commitDate(normalized, event, source);
  };

  const handleTextChange = (event) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    if (!controlledText) {
      setInternalText(event.target.value);
    }
    if (typeof onInputChange === "function") {
      onInputChange(event.target.value, event);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (currentOpen && activeCellValue) {
        event.preventDefault();
        if (commitDate(activeCellValue, event, "calendar")) {
          updateOpen(false, event);
        }
      } else if (commitText(event, "commit")) {
        updateOpen(false, event);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      updateOpen(false, event);
      if (!controlledText) {
        setInternalText(currentValue);
      }
    } else if (event.key === "ArrowDown" && !currentOpen) {
      event.preventDefault();
      updateOpen(true, event);
    } else {
      const target = getDateKeyTarget(model.value || model.textValue || activeCellValue || currentText || currentValue, event.key, model);
      if (target) {
        event.preventDefault();
        const parts = parseIsoDateParts(target);
        if (parts) {
          updateMonth({ year: parts.year, month: parts.month }, event, "keyboard");
          if (!isIsoDateDisabled(target, min, max, isDateDisabled)) {
            commitDate(target, event, "keyboard");
          }
        }
      }
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("date-picker", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": model.invalid ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-open": String(currentOpen),
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": model.invalid ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "label",
          {
            ...createScopeAttributes("date-picker", "label", descriptor.state),
            htmlFor: inputId
          },
          descriptor.label
        )
      : null,
    React.createElement(
      "span",
      createScopeAttributes("date-picker", "control", descriptor.state),
      React.createElement("input", {
        ...createScopeAttributes("date-picker", "input", descriptor.state),
        ref,
        id: inputId,
        role: "combobox",
        type: "text",
        name,
        placeholder,
        inputMode: "numeric",
        autoComplete: "off",
        disabled: descriptor.disabledByState,
        readOnly: descriptor.readOnly,
        required: descriptor.required,
        value: currentText,
        "aria-label": descriptor.ariaLabel,
        "aria-labelledby": descriptor.ariaLabelledBy,
        "aria-describedby": descriptor.describedBy,
        "aria-invalid": model.invalid ? "true" : undefined,
        "aria-disabled": descriptor.disabledByState ? "true" : undefined,
        "aria-required": descriptor.required ? "true" : undefined,
        "aria-readonly": descriptor.readOnly ? "true" : undefined,
        "aria-expanded": String(currentOpen),
        "aria-controls": calendarId,
        "aria-activedescendant": currentOpen ? activeCellId : undefined,
        onChange: handleTextChange,
        onFocus: handlers.onFocus,
        onBlur: handlers.onBlur,
        onKeyDown: handleKeyDown
      }),
      React.createElement(
        "button",
        {
          ...createScopeAttributes("date-picker", "trigger", descriptor.state),
          type: "button",
          disabled: descriptor.disabledByState || descriptor.readOnly,
          "aria-label": resolvedTriggerLabel,
          "aria-haspopup": "grid",
          "aria-expanded": String(currentOpen),
          "aria-controls": calendarId,
          onClick: (event) => updateOpen(!currentOpen, event)
        },
        resolveIconContent(triggerContent, "calendar")
      )
    ),
    currentOpen
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("date-picker", "calendar", descriptor.state),
            id: calendarId,
            role: "dialog",
            "aria-modal": "false"
          },
          React.createElement(
            "div",
            createScopeAttributes("date-picker", "header", descriptor.state),
            React.createElement(
              "button",
              {
                ...createScopeAttributes("date-picker", "previous", descriptor.state),
                type: "button",
                "aria-label": resolvedPreviousLabel,
                onClick: (event) => updateMonth(addCalendarMonths(model.month, -1), event, "previous")
              },
              resolveIconContent(undefined, "collapse")
            ),
            React.createElement(
              "span",
              createScopeAttributes("date-picker", "title", descriptor.state),
              model.title
            ),
            React.createElement(
              "button",
              {
                ...createScopeAttributes("date-picker", "next", descriptor.state),
                type: "button",
                "aria-label": resolvedNextLabel,
                onClick: (event) => updateMonth(addCalendarMonths(model.month, 1), event, "next")
              },
              resolveIconContent(undefined, "expand")
            )
          ),
          React.createElement(
            "div",
            {
              ...createScopeAttributes("date-picker", "grid", descriptor.state),
              id: gridId,
              role: "grid",
              "aria-label": model.title
            },
            model.weekDayLabels.map((dayLabel, index) =>
              React.createElement(
                "span",
                {
                  ...createScopeAttributes("date-picker", "week-header", descriptor.state),
                  key: `${dayLabel}-${index}`,
                  role: "columnheader"
                },
                dayLabel
              )
            ),
            model.cells.map((cell) => {
              const cellState = cell.disabled
                ? "disabled"
                : cell.selected
                  ? "active"
                  : descriptor.state;
              return React.createElement(
                "button",
                {
                  ...createScopeAttributes("date-picker", "cell", cellState),
                  id: `${calendarId}-cell-${cell.value}`,
                  key: cell.value,
                  type: "button",
                  role: "gridcell",
                  disabled: cell.disabled,
                  tabIndex: cell.selected ? 0 : -1,
                  "aria-selected": String(cell.selected),
                  "aria-disabled": cell.disabled ? "true" : undefined,
                  "data-date": cell.value,
                  "data-selected": String(cell.selected),
                  "data-today": String(cell.today),
                  "data-outside-month": String(cell.outsideMonth),
                  onClick: (event) => {
                    if (commitDate(cell.value, event, "calendar")) {
                      updateOpen(false, event);
                    }
                  }
                },
                cell.label
              );
            })
          )
        )
      : null,
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsDatePicker.displayName = "ChipsDatePicker";

function getTimeKeyTarget(currentValue, key, model) {
  if (key === "ArrowUp" || key === "ArrowRight") {
    return getNextIsoTime(currentValue || model.value || model.min || "00:00", model.step, model);
  }
  if (key === "ArrowDown" || key === "ArrowLeft") {
    return getNextIsoTime(currentValue || model.value || model.min || "00:00", -model.step, model);
  }
  if (key === "PageUp") {
    return getNextIsoTime(currentValue || model.value || model.min || "00:00", model.step * 10, model);
  }
  if (key === "PageDown") {
    return getNextIsoTime(currentValue || model.value || model.min || "00:00", -model.step * 10, model);
  }
  if (key === "Home") {
    return model.min || model.options.find((option) => !option.disabled)?.value || "00:00";
  }
  if (key === "End") {
    return model.max || [...model.options].reverse().find((option) => !option.disabled)?.value || "23:59";
  }
  return "";
}

export const ChipsTimePicker = React.forwardRef((props, ref) => {
  const {
    id,
    value,
    defaultValue = "",
    textValue,
    defaultTextValue,
    open,
    defaultOpen = false,
    min,
    max,
    step = 60,
    optionStep,
    showSeconds = false,
    options,
    limitOptionsToRange = true,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel,
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    placeholder,
    name,
    triggerLabel,
    triggerLabelKey,
    fallbackTriggerLabel = "Open time list",
    invalidMessage,
    invalidMessageKey = "component.timePicker.invalid",
    fallbackInvalidMessage = "Invalid time",
    triggerContent,
    isTimeDisabled,
    i18n,
    onValueChange,
    onInputChange,
    onOpenChange,
    onStateChange,
    onKeyDown,
    onChange,
    onDiagnostic,
    ...rest
  } = props;

  const descriptorParams = {
    scope: "time-picker",
    value: textValue,
    defaultValue: defaultTextValue,
    disabled,
    loading,
    error,
    readOnly,
    required,
    label,
    labelKey,
    labelParams,
    fallbackLabel,
    description,
    descriptionKey,
    descriptionParams,
    fallbackDescription,
    ariaLabel: ariaLabel || rest["aria-label"],
    ariaLabelKey,
    ariaLabelParams,
    fallbackAriaLabel,
    ariaLabelledBy: rest["aria-labelledby"],
    ariaDescribedBy: rest["aria-describedby"],
    i18n,
    onDiagnostic
  };
  assertInputAccessibleName(
    resolveInputDescriptor(descriptorParams),
    "TIME_PICKER_A11Y_LABEL_REQUIRED"
  );

  const controlledValue = value !== undefined;
  const controlledText = textValue !== undefined;
  const controlledOpen = open !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => clampIsoTime(defaultValue, { min, max, step, showSeconds, isTimeDisabled }));
  const [internalText, setInternalText] = React.useState(() => {
    if (defaultTextValue !== undefined) {
      return String(defaultTextValue);
    }
    return clampIsoTime(defaultValue, { min, max, step, showSeconds, isTimeDisabled });
  });
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen === true);
  const currentValue = controlledValue
    ? clampIsoTime(value, { min, max, step, showSeconds, isTimeDisabled })
    : internalValue;
  const currentText = controlledText ? String(textValue) : internalText;
  const currentOpen = controlledOpen ? open === true : internalOpen;
  const baseModel = resolveTimePickerModel({
    value: currentValue,
    text: currentText,
    min,
    max,
    step,
    optionStep,
    showSeconds,
    options,
    limitOptionsToRange,
    isTimeDisabled
  });
  const resolvedInvalidMessage = resolveAccessibleText({
    value: invalidMessage,
    key: invalidMessageKey,
    fallback: fallbackInvalidMessage,
    i18n,
    onDiagnostic
  });
  const effectiveError = normalizeError(error) || (
    baseModel.invalid
      ? { code: "TIME_PICKER_VALUE_INVALID", message: resolvedInvalidMessage }
      : null
  );
  const disabledForInteraction = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledForInteraction);
  const descriptor = resolveInputDescriptor({
    ...descriptorParams,
    value: currentText,
    defaultValue: undefined,
    error: effectiveError,
    interaction
  });
  const model = resolveTimePickerModel({
    value: currentValue,
    text: currentText,
    min,
    max,
    step,
    optionStep,
    showSeconds,
    options,
    limitOptionsToRange,
    isTimeDisabled
  });
  const generatedInputId = React.useId();
  const inputId = id || generatedInputId;
  const listId = `${inputId}-list`;
  const activeOption = model.options.find((option) => option.value === model.value && !option.disabled)
    ?? model.options.find((option) => option.value === model.textValue && !option.disabled)
    ?? model.options.find((option) => !option.disabled);
  const activeOptionValue = activeOption?.value ?? "";
  const activeOptionId = activeOptionValue ? `${listId}-option-${activeOptionValue}` : undefined;
  const resolvedTriggerLabel = resolveAccessibleText({
    value: triggerLabel,
    key: triggerLabelKey,
    fallback: fallbackTriggerLabel,
    i18n,
    onDiagnostic
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(descriptor.state);
    }
  }, [descriptor.state, onStateChange]);

  const updateOpen = (nextOpen, event) => {
    if (!controlledOpen) {
      setInternalOpen(nextOpen);
    }
    if (typeof onOpenChange === "function") {
      onOpenChange(nextOpen, event);
    }
  };

  const commitTime = (nextValue, event, source) => {
    if (descriptor.disabledByState || descriptor.readOnly) {
      event?.preventDefault?.();
      return false;
    }

    const normalized = clampIsoTime(nextValue, { min, max, step, showSeconds, isTimeDisabled });
    const invalid = !normalized || isIsoTimeDisabled(normalized, { min, max, step, showSeconds, isTimeDisabled });
    if (invalid) {
      return false;
    }

    if (!controlledValue) {
      setInternalValue(normalized);
    }
    if (!controlledText) {
      setInternalText(normalized);
    }
    if (typeof onValueChange === "function") {
      onValueChange(
        normalized,
        createPickerChangeDetails({
          source,
          previousValue: currentValue,
          value: normalized,
          text: normalized,
          invalid: false
        }),
        event
      );
    }
    return true;
  };

  const commitText = (event, source) => {
    const normalized = clampIsoTime(currentText, { min, max, step, showSeconds, isTimeDisabled });
    if (!normalized) {
      return false;
    }
    return commitTime(normalized, event, source);
  };

  const handleTextChange = (event) => {
    if (typeof onChange === "function") {
      onChange(event);
    }
    if (!controlledText) {
      setInternalText(event.target.value);
    }
    if (typeof onInputChange === "function") {
      onInputChange(event.target.value, event);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      if (commitText(event, "commit")) {
        updateOpen(false, event);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      updateOpen(false, event);
      if (!controlledText) {
        setInternalText(currentValue);
      }
    } else if (event.key === "ArrowDown" && !currentOpen) {
      event.preventDefault();
      updateOpen(true, event);
    } else {
      const target = getTimeKeyTarget(activeOptionValue || currentText || currentValue, event.key, model);
      if (target) {
        event.preventDefault();
        commitTime(target, event, "keyboard");
      }
    }

    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("time-picker", "root", descriptor.state),
      ...handlers,
      "aria-disabled": descriptor.disabledByState ? "true" : undefined,
      "aria-invalid": model.invalid ? "true" : undefined,
      "aria-required": descriptor.required ? "true" : undefined,
      "data-open": String(currentOpen),
      "data-required": String(descriptor.required),
      "data-readonly": String(descriptor.readOnly),
      "data-invalid": model.invalid ? "true" : "false"
    },
    descriptor.label
      ? React.createElement(
          "label",
          {
            ...createScopeAttributes("time-picker", "label", descriptor.state),
            htmlFor: inputId
          },
          descriptor.label
        )
      : null,
    React.createElement(
      "span",
      createScopeAttributes("time-picker", "control", descriptor.state),
      React.createElement("input", {
        ...createScopeAttributes("time-picker", "input", descriptor.state),
        ref,
        id: inputId,
        role: "combobox",
        type: "text",
        name,
        placeholder,
        inputMode: "numeric",
        autoComplete: "off",
        disabled: descriptor.disabledByState,
        readOnly: descriptor.readOnly,
        required: descriptor.required,
        value: currentText,
        "aria-label": descriptor.ariaLabel,
        "aria-labelledby": descriptor.ariaLabelledBy,
        "aria-describedby": descriptor.describedBy,
        "aria-invalid": model.invalid ? "true" : undefined,
        "aria-disabled": descriptor.disabledByState ? "true" : undefined,
        "aria-required": descriptor.required ? "true" : undefined,
        "aria-readonly": descriptor.readOnly ? "true" : undefined,
        "aria-expanded": String(currentOpen),
        "aria-controls": listId,
        "aria-activedescendant": currentOpen ? activeOptionId : undefined,
        onChange: handleTextChange,
        onFocus: handlers.onFocus,
        onBlur: handlers.onBlur,
        onKeyDown: handleKeyDown
      }),
      React.createElement(
        "button",
        {
          ...createScopeAttributes("time-picker", "trigger", descriptor.state),
          type: "button",
          disabled: descriptor.disabledByState || descriptor.readOnly,
          "aria-label": resolvedTriggerLabel,
          "aria-haspopup": "listbox",
          "aria-expanded": String(currentOpen),
          "aria-controls": listId,
          onClick: (event) => updateOpen(!currentOpen, event)
        },
        resolveIconContent(triggerContent, "time")
      )
    ),
    currentOpen
      ? React.createElement(
          "ul",
          {
            ...createScopeAttributes("time-picker", "list", descriptor.state),
            id: listId,
            role: "listbox"
          },
          model.options.map((option) => {
            const selected = option.value === currentValue;
            const highlighted = option.value === activeOptionValue;
            const optionState = option.disabled
              ? "disabled"
              : highlighted
                ? "active"
                : descriptor.state;
            return React.createElement(
              "li",
              {
                ...createScopeAttributes("time-picker", "option", optionState),
                id: `${listId}-option-${option.value}`,
                key: option.value,
                role: "option",
                "aria-selected": String(selected),
                "aria-disabled": option.disabled ? "true" : undefined,
                "data-selected": String(selected),
                "data-highlighted": String(highlighted),
                "data-value": option.value,
                onMouseDown: (event) => {
                  event.preventDefault();
                  if (!option.disabled && commitTime(option.value, event, "list")) {
                    updateOpen(false, event);
                  }
                }
              },
              option.label
            );
          })
        )
      : null,
    renderInputDescription(descriptor),
    renderInputStatus(descriptor)
  );
});

ChipsTimePicker.displayName = "ChipsTimePicker";

const [DialogCompoundContext, useDialogCompoundContext] = createCompoundContext("dialog");

const DialogRoot = React.forwardRef((props, ref) => {
  const {
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    title,
    description,
    children,
    triggerContent,
    closeButtonLabel,
    closeButtonContent,
    closeOnBackdrop = true,
    closeOnEscape = true,
    modal = true,
    labelledBy,
    describedBy,
    contentId: contentIdProp,
    onOpenChange,
    onStateChange,
    onCloseReason,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const rootRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const triggerRef = React.useRef(null);
  const restorePointRef = React.useRef(null);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  React.useEffect(() => {
    if (currentOpen) {
      return;
    }
    if (restorePointRef.current) {
      restorePointRef.current.restore();
      restorePointRef.current = null;
    }
  }, [currentOpen]);

  React.useEffect(() => {
    if (!currentOpen || !contentRef.current) {
      return;
    }
    const scope = createFocusScope(contentRef.current, {
      restorePoint: restorePointRef.current
    });
    scope.focusFirst() || contentRef.current.focus?.();
  }, [currentOpen]);

  const closeDialog = (reason) => {
    if (disabledByState) {
      return;
    }
    setCurrentOpen(false);
    if (typeof onCloseReason === "function") {
      onCloseReason(reason);
    }
  };

  const openDialog = (event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    restorePointRef.current = createFocusRestorePoint(event?.currentTarget || triggerRef.current || rootRef.current);
    setCurrentOpen(true);
  };

  const handleDialogKeyDown = (event) => {
    if (event.key === "Tab" && modal && contentRef.current) {
      createFocusScope(contentRef.current, {
        restorePoint: restorePointRef.current
      }).trap(event);
      return;
    }

    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      closeDialog("escape-key");
    }
  };

  const generatedId = React.useId();
  const contentId = contentIdProp || (props.id ? `${props.id}-content` : `${generatedId}-content`);
  const fallbackLabelId = `${contentId}-header`;
  const fallbackDescriptionId = `${contentId}-body`;
  const contextValue = React.useMemo(
    () => ({
      state,
      open: Boolean(currentOpen),
      disabled: disabledByState,
      modal,
      contentId,
      contentRef,
      triggerRef,
      fallbackLabelId,
      fallbackDescriptionId,
      labelledBy,
      describedBy,
      closeOnEscape,
      openDialog,
      closeDialog,
      handleDialogKeyDown
    }),
    [
      state,
      currentOpen,
      disabledByState,
      modal,
      contentId,
      contentRef,
      triggerRef,
      fallbackLabelId,
      fallbackDescriptionId,
      labelledBy,
      describedBy,
      closeOnEscape
    ]
  );
  const shouldRenderDialogFallback = triggerContent !== undefined
    || title !== undefined
    || description !== undefined
    || closeButtonLabel !== undefined
    || closeButtonContent !== undefined;

  return React.createElement(
    DialogCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("dialog", "root", state),
        ...handlers,
        ref: mergeRefs(ref, rootRef),
        "data-open": String(Boolean(currentOpen)),
        "aria-disabled": disabledByState ? "true" : undefined
      },
      shouldRenderDialogFallback && triggerContent !== undefined
        ? React.createElement(DialogTrigger, { "aria-label": rest["aria-label"] }, triggerContent)
        : null,
      currentOpen
        ? React.createElement("div", {
            ...createScopeAttributes("dialog", "backdrop", state),
            "aria-hidden": "true",
            onClick: closeOnBackdrop ? () => closeDialog("backdrop") : undefined
          })
        : null,
      shouldRenderDialogFallback
        ? React.createElement(
            DialogContent,
            {
              "aria-labelledby": title !== undefined ? fallbackLabelId : undefined,
              "aria-describedby": description !== undefined ? fallbackDescriptionId : undefined
            },
            title !== undefined ? React.createElement(DialogHeader, null, title) : null,
            description !== undefined ? React.createElement(DialogBody, null, description) : null,
            children,
            closeButtonLabel !== undefined || closeButtonContent !== undefined
              ? React.createElement(DialogClose, { "aria-label": closeButtonLabel }, resolveIconContent(closeButtonContent, "close"))
              : null
          )
        : children,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("dialog", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

DialogRoot.displayName = "ChipsDialog.Root";

const DialogTrigger = React.forwardRef((props, ref) => {
  const { children, onClick, ...rest } = props;
  const context = useDialogCompoundContext("trigger");
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  React.useEffect(() => {
    context.triggerRef.current = localRef.current;
    return () => {
      if (context.triggerRef.current === localRef.current) {
        context.triggerRef.current = null;
      }
    };
  }, [context.triggerRef]);

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("dialog", "trigger", context.state),
      ref: localRef,
      type: rest.type || "button",
      disabled: context.disabled,
      role: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": String(context.open),
      "aria-controls": context.contentId,
      onClick: mergeEventHandlers(onClick, context.openDialog)
    },
    children
  );
});

DialogTrigger.displayName = "ChipsDialog.Trigger";

const DialogContent = React.forwardRef((props, ref) => {
  const { children, onKeyDown, ...rest } = props;
  const context = useDialogCompoundContext("content");
  const hasHeader = hasReactElementType(children, [DialogHeader]);
  const hasBody = hasReactElementType(children, [DialogBody]);
  const labelledBy = rest["aria-labelledby"] || context.labelledBy || (hasHeader ? context.fallbackLabelId : undefined);
  const describedBy = rest["aria-describedby"] || context.describedBy || (hasBody ? context.fallbackDescriptionId : undefined);
  if (!context.open) {
    return null;
  }
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("dialog", "content", context.state),
      ref: mergeRefs(ref, context.contentRef),
      id: rest.id || context.contentId,
      role: rest.role || "dialog",
      "aria-modal": context.modal ? "true" : "false",
      "aria-labelledby": labelledBy,
      "aria-describedby": describedBy,
      tabIndex: rest.tabIndex ?? -1,
      onKeyDown: mergeEventHandlers(onKeyDown, context.handleDialogKeyDown)
    },
    children
  );
});

DialogContent.displayName = "ChipsDialog.Content";

function createDialogSection(part, tag = "div") {
  const Component = React.forwardRef((props, ref) => {
    const { as: Element = tag, children, ...rest } = props;
    const context = useDialogCompoundContext(part);
    const fallbackId = part === "header"
      ? context.fallbackLabelId
      : part === "body"
        ? context.fallbackDescriptionId
        : undefined;
    return React.createElement(
      Element,
      {
        ...rest,
        ...createScopeAttributes("dialog", part, context.state),
        ref,
        id: rest.id || fallbackId
      },
      children
    );
  });
  Component.displayName = `ChipsDialog.${part}`;
  return Component;
}

const DialogHeader = createDialogSection("header", "header");
const DialogBody = createDialogSection("body", "section");
const DialogFooter = createDialogSection("footer", "footer");
const DialogActions = createDialogSection("actions", "div");

const DialogClose = React.forwardRef((props, ref) => {
  const { children, onClick, ...rest } = props;
  const context = useDialogCompoundContext("close");
  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("dialog", "close", context.state),
      ref,
      type: rest.type || "button",
      onClick: mergeEventHandlers(onClick, () => context.closeDialog("close-button"))
    },
    children
  );
});

DialogClose.displayName = "ChipsDialog.Close";

export const ChipsDialog = Object.assign(DialogRoot, {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Actions: DialogActions,
  Close: DialogClose
});

ChipsDialog.displayName = "ChipsDialog";

const [PopoverCompoundContext, usePopoverCompoundContext] = createCompoundContext("popover");

const PopoverRoot = React.forwardRef((props, ref) => {
  const {
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    triggerContent,
    children,
    closeOnEscape = true,
    contentId: contentIdProp,
    onOpenChange,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const toggle = (event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    setCurrentOpen(!currentOpen);
  };

  const closePopover = () => {
    if (disabledByState) {
      return;
    }
    setCurrentOpen(false);
  };

  const handleContentKeyDown = (event) => {
    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      closePopover();
    }
  };

  const generatedId = React.useId();
  const contentId = contentIdProp || (props.id ? `${props.id}-content` : `${generatedId}-content`);
  const contextValue = React.useMemo(
    () => ({
      state,
      open: Boolean(currentOpen),
      disabled: disabledByState,
      contentId,
      toggle,
      closePopover,
      handleContentKeyDown
    }),
    [state, currentOpen, disabledByState, contentId]
  );
  const shouldRenderPopoverFallback = triggerContent !== undefined;

  return React.createElement(
    PopoverCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("popover", "root", state),
        ...handlers,
        ref,
        "data-open": String(Boolean(currentOpen)),
        "aria-disabled": disabledByState ? "true" : undefined
      },
      shouldRenderPopoverFallback
        ? React.createElement(PopoverTrigger, null, triggerContent)
        : null,
      shouldRenderPopoverFallback
        ? React.createElement(PopoverContent, null, React.createElement(PopoverArrow, null), children)
        : children,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("popover", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

PopoverRoot.displayName = "ChipsPopover.Root";

const PopoverTrigger = React.forwardRef((props, ref) => {
  const { children, onClick, ...rest } = props;
  const context = usePopoverCompoundContext("trigger");
  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("popover", "trigger", context.state),
      ref,
      type: rest.type || "button",
      role: "button",
      disabled: context.disabled,
      "aria-haspopup": "dialog",
      "aria-expanded": String(context.open),
      "aria-controls": context.contentId,
      onClick: mergeEventHandlers(onClick, context.toggle)
    },
    children
  );
});

PopoverTrigger.displayName = "ChipsPopover.Trigger";

const PopoverContent = React.forwardRef((props, ref) => {
  const { children, onKeyDown, ...rest } = props;
  const context = usePopoverCompoundContext("content");
  if (!context.open) {
    return null;
  }
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("popover", "content", context.state),
      ref,
      id: rest.id || context.contentId,
      role: rest.role || "dialog",
      "aria-modal": "false",
      tabIndex: rest.tabIndex ?? -1,
      onKeyDown: mergeEventHandlers(onKeyDown, context.handleContentKeyDown)
    },
    children
  );
});

PopoverContent.displayName = "ChipsPopover.Content";

const PopoverArrow = React.forwardRef((props, ref) => {
  const context = usePopoverCompoundContext("arrow");
  return React.createElement("span", {
    ...props,
    ...createScopeAttributes("popover", "arrow", context.state),
    ref,
    "aria-hidden": "true"
  });
});

PopoverArrow.displayName = "ChipsPopover.Arrow";

export const ChipsPopover = Object.assign(PopoverRoot, {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Arrow: PopoverArrow
});

ChipsPopover.displayName = "ChipsPopover";

const [TabsCompoundContext, useTabsCompoundContext] = createCompoundContext("tabs");

function getRovingItemByValue(model, value) {
  return model?.items?.find((item) => item.id === String(value)) || null;
}

const TabsRoot = React.forwardRef((props, ref) => {
  const {
    value,
    defaultValue,
    disabled = false,
    loading = false,
    error = null,
    items = [],
    orientation = "horizontal",
    children,
    onValueChange,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const normalizedItems = normalizeItems(items);

  const initialTabValue = defaultValue !== undefined
    ? String(defaultValue)
    : normalizedItems[getFirstEnabledIndex(normalizedItems)]?.value;

  const [currentValue, setCurrentValue, isControlled] = useControllableState({
    value: value !== undefined ? String(value) : undefined,
    defaultValue: initialTabValue,
    onChange: onValueChange
  });

  React.useEffect(() => {
    if (isControlled) {
      return;
    }
    if (normalizedItems.length === 0) {
      return;
    }
    const activeExists = normalizedItems.some(
      (item) => item.value === currentValue && item.disabled !== true
    );
    if (!activeExists) {
      const fallbackIndex = getFirstEnabledIndex(normalizedItems);
      if (fallbackIndex >= 0) {
        setCurrentValue(normalizedItems[fallbackIndex].value);
      }
    }
  }, [currentValue, isControlled, normalizedItems, setCurrentValue]);

  const selectedIndex = normalizedItems.findIndex((item) => item.value === currentValue);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const baseId = React.useId();
  const triggerRegistryRef = React.useRef([]);

  const registerTrigger = React.useCallback((entry) => {
    triggerRegistryRef.current = [
      ...triggerRegistryRef.current.filter((item) => item.value !== entry.value),
      entry
    ];
    return () => {
      triggerRegistryRef.current = triggerRegistryRef.current.filter((item) => item.value !== entry.value);
    };
  }, []);

  const selectValue = React.useCallback(
    (nextValue) => {
      if (!disabledByState) {
        setCurrentValue(String(nextValue));
      }
    },
    [disabledByState, setCurrentValue]
  );

  const moveFocus = React.useCallback(
    (currentTriggerValue, direction) => {
      if (disabledByState) {
        return;
      }
      const registry = triggerRegistryRef.current;
      if (registry.length === 0) {
        return;
      }
      const currentIndex = registry.findIndex((item) => item.value === currentTriggerValue);
      const nextIndex = getNextEnabledIndex(registry, currentIndex, direction, true);
      const nextEntry = registry[nextIndex];
      if (!nextEntry) {
        return;
      }
      setCurrentValue(nextEntry.value);
      if (nextEntry.ref?.current && typeof nextEntry.ref.current.focus === "function") {
        nextEntry.ref.current.focus();
      }
    },
    [disabledByState, setCurrentValue]
  );

  const rovingModel = React.useMemo(
    () => createRovingTabIndex(normalizedItems, {
      activeId: currentValue,
      orientation: orientation === "vertical" ? "vertical" : "horizontal"
    }),
    [currentValue, normalizedItems, orientation]
  );

  const baseValue = React.useMemo(
    () => ({
      state,
      value: currentValue,
      orientation,
      disabled: disabledByState,
      baseId,
      rovingModel,
      selectValue,
      registerTrigger,
      moveFocus
    }),
    [state, currentValue, orientation, disabledByState, baseId, rovingModel, selectValue, registerTrigger, moveFocus]
  );

  const selectIndex = (index) => {
    const item = normalizedItems[index];
    if (!item || item.disabled || disabledByState) {
      return;
    }
    setCurrentValue(item.value);
  };

  const handleListKeyDown = (event) => {
    if (disabledByState || normalizedItems.length === 0) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectIndex(getFirstEnabledIndex(normalizedItems));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = getNextEnabledIndex(normalizedItems, 0, "prev", true);
      selectIndex(last);
      return;
    }

    const isHorizontal = orientation !== "vertical";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

    if (event.key === nextKey) {
      event.preventDefault();
      const nextIndex = getNextEnabledIndex(normalizedItems, selectedIndex, "next", true);
      selectIndex(nextIndex);
      return;
    }

    if (event.key === prevKey) {
      event.preventDefault();
      const prevIndex = getNextEnabledIndex(normalizedItems, selectedIndex, "prev", true);
      selectIndex(prevIndex);
    }
  };

  return React.createElement(
    TabsCompoundContext.Provider,
    { value: baseValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("tabs", "root", state),
        ...handlers,
        ref,
        "aria-disabled": disabledByState ? "true" : undefined
      },
      children !== undefined
        ? children
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              TabsList,
              { onKeyDown: handleListKeyDown },
              normalizedItems.map((item, index) =>
                React.createElement(
                  TabsTrigger,
                  {
                    key: `${item.value}-${index}`,
                    value: item.value,
                    disabled: item.disabled,
                    index
                  },
                  item.label
                )
              )
            ),
            normalizedItems.map((item, index) =>
              React.createElement(
                TabsPanel,
                {
                  key: `${item.value}-${index}`,
                  value: item.value,
                  index
                },
                item.content
              )
            )
          ),
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("tabs", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

TabsRoot.displayName = "ChipsTabs.Root";

const TabsList = React.forwardRef((props, ref) => {
  const { children, onKeyDown, ...rest } = props;
  const context = useTabsCompoundContext("list");
  const handleKeyDown = (event) => {
    if (!event.defaultPrevented && typeof onKeyDown === "function") {
      onKeyDown(event);
    }
  };
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("tabs", "list", context.state),
      ref,
      role: "tablist",
      "aria-orientation": context.orientation,
      onKeyDown: handleKeyDown
    },
    children
  );
});

TabsList.displayName = "ChipsTabs.List";

const TabsTrigger = React.forwardRef((props, ref) => {
  const { children, value, disabled = false, index = 0, onClick, onKeyDown, ...rest } = props;
  const context = useTabsCompoundContext("trigger");
  const tabValue = String(value);
  const selected = context.value === tabValue;
  const idSegment = normalizeDomIdSegment(tabValue, String(index));
  const tabId = rest.id || `${context.baseId}-tab-${idSegment}`;
  const panelId = rest["aria-controls"] || `${context.baseId}-panel-${idSegment}`;
  const disabledByState = context.disabled || disabled;
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  React.useEffect(
    () => context.registerTrigger({
      value: tabValue,
      disabled: disabledByState,
      ref: localRef
    }),
    [context, tabValue, disabledByState]
  );
  const selectCurrent = (event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    context.selectValue(tabValue);
  };
  const handleKeyDown = (event) => {
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }

    if (event.defaultPrevented) {
      return;
    }

    if (context.disabled) {
      return;
    }

    const isHorizontal = context.orientation !== "vertical";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

    if (event.key === nextKey) {
      event.preventDefault();
      context.moveFocus(tabValue, "next");
      return;
    }

    if (event.key === prevKey) {
      event.preventDefault();
      context.moveFocus(tabValue, "prev");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      context.moveFocus("", "next");
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      context.moveFocus("", "prev");
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      selectCurrent(event);
    }
  };
  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("tabs", "trigger", selected ? "active" : context.state),
      ref: localRef,
      id: tabId,
      role: "tab",
      type: rest.type || "button",
      ...getRovingTabIndexProps(
        getRovingItemByValue(context.rovingModel, tabValue) || { active: selected, disabled: disabledByState },
        { includeAriaDisabled: false }
      ),
      "aria-selected": String(selected),
      "aria-controls": panelId,
      "aria-disabled": disabled ? "true" : undefined,
      disabled: disabledByState,
      onClick: mergeEventHandlers(onClick, selectCurrent),
      onKeyDown: handleKeyDown
    },
    children
  );
});

TabsTrigger.displayName = "ChipsTabs.Trigger";

const TabsPanel = React.forwardRef((props, ref) => {
  const { children, value, index = 0, ...rest } = props;
  const context = useTabsCompoundContext("panel");
  const panelValue = String(value);
  const selected = context.value === panelValue;
  const idSegment = normalizeDomIdSegment(panelValue, String(index));
  const panelId = rest.id || `${context.baseId}-panel-${idSegment}`;
  const tabId = rest["aria-labelledby"] || `${context.baseId}-tab-${idSegment}`;
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("tabs", "panel", selected ? "active" : context.state),
      ref,
      id: panelId,
      role: "tabpanel",
      "aria-labelledby": tabId,
      hidden: !selected
    },
    selected ? children : null
  );
});

TabsPanel.displayName = "ChipsTabs.Panel";

export const ChipsTabs = Object.assign(TabsRoot, {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel
});

ChipsTabs.displayName = "ChipsTabs";

const [MenuCompoundContext, useMenuCompoundContext] = createCompoundContext("menu");

const MenuRoot = React.forwardRef((props, ref) => {
  const {
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    triggerContent,
    items = [],
    children,
    closeOnSelect = true,
    onOpenChange,
    onSelect,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const normalizedItems = normalizeItems(items);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const [highlightedValue, setHighlightedValue] = React.useState(
    normalizedItems[getFirstEnabledIndex(normalizedItems)]?.value ?? null
  );
  const itemRegistryRef = React.useRef([]);
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const triggerRef = React.useRef(null);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const generatedId = React.useId();
  const baseId = rest.id || generatedId;
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const selectableItems = React.useMemo(
    () => mergeRegisteredEntries(itemRegistryRef.current, normalizedItems),
    [registryVersion, normalizedItems]
  );

  const registerItem = React.useCallback((entry) => {
    itemRegistryRef.current = upsertRegistryEntry(itemRegistryRef.current, entry);
    setRegistryVersion((version) => version + 1);
    return () => {
      itemRegistryRef.current = removeRegistryEntry(itemRegistryRef.current, entry.value);
      setRegistryVersion((version) => version + 1);
    };
  }, []);

  const openMenu = React.useCallback((options = {}) => {
    if (disabledByState) {
      return;
    }
    setCurrentOpen(true);
    const entry = getFirstEnabledEntry(mergeRegisteredEntries(itemRegistryRef.current, normalizedItems));
    setHighlightedValue(entry ? entry.value : null);
    if (options.focus) {
      focusRegistryEntry(entry);
    }
  }, [disabledByState, normalizedItems, setCurrentOpen]);

  const closeMenu = React.useCallback(() => {
    if (!disabledByState) {
      setCurrentOpen(false);
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    }
  }, [disabledByState, setCurrentOpen]);

  const highlightValue = React.useCallback(
    (nextValue, options = {}) => {
      const entry = nextValue === null
        ? null
        : getEnabledEntryByValue(itemRegistryRef.current, String(nextValue))
          || getEnabledEntryByValue(normalizedItems, String(nextValue));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedItems]
  );

  const highlightFirst = React.useCallback(
    (options = {}) => {
      const entry = getFirstEnabledEntry(mergeRegisteredEntries(itemRegistryRef.current, normalizedItems));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedItems]
  );

  const highlightLast = React.useCallback(
    (options = {}) => {
      const entry = getLastEnabledEntry(mergeRegisteredEntries(itemRegistryRef.current, normalizedItems));
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [normalizedItems]
  );

  const highlightNext = React.useCallback(
    (direction, options = {}) => {
      const entries = mergeRegisteredEntries(itemRegistryRef.current, normalizedItems);
      const entry = getNextEnabledEntry(entries, highlightedValue, direction, true);
      setHighlightedValue(entry ? entry.value : null);
      if (options.focus) {
        focusRegistryEntry(entry);
      }
    },
    [highlightedValue, normalizedItems]
  );

  const selectValue = React.useCallback((nextValue, details = {}) => {
    const item = getEnabledEntryByValue(
      mergeRegisteredEntries(itemRegistryRef.current, normalizedItems),
      String(nextValue)
    );
    if (!item || item.disabled || disabledByState) {
      details.event?.preventDefault?.();
      return;
    }
    if (typeof onSelect === "function") {
      onSelect(item.value, {
        source: details.source || "programmatic",
        value: item.value
      });
    }
    if (closeOnSelect) {
      closeMenu();
    }
  }, [closeMenu, closeOnSelect, disabledByState, normalizedItems, onSelect]);

  const toggleOpen = React.useCallback((event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    const nextOpen = !currentOpen;
    setCurrentOpen(nextOpen);
    if (nextOpen) {
      const entry = getFirstEnabledEntry(mergeRegisteredEntries(itemRegistryRef.current, normalizedItems));
      setHighlightedValue(entry ? entry.value : null);
    }
  }, [currentOpen, disabledByState, normalizedItems, setCurrentOpen]);

  React.useEffect(() => {
    if (!currentOpen) {
      return;
    }
    const highlightedExists = getEnabledEntryByValue(selectableItems, highlightedValue);
    if (!highlightedExists) {
      const fallback = getFirstEnabledEntry(selectableItems);
      setHighlightedValue(fallback ? fallback.value : null);
    }
  }, [currentOpen, highlightedValue, selectableItems]);

  const rovingModel = React.useMemo(
    () => createRovingTabIndex(selectableItems, {
      activeId: highlightedValue
    }),
    [highlightedValue, selectableItems]
  );

  const contextValue = React.useMemo(
    () => ({
      state,
      open: Boolean(currentOpen),
      disabled: disabledByState,
      loading,
      error: normalizedError,
      highlightedValue,
      rovingModel,
      baseId,
      triggerId,
      contentId,
      triggerRef,
      closeOnSelect,
      registerItem,
      openMenu,
      closeMenu,
      toggleOpen,
      highlightValue,
      highlightFirst,
      highlightLast,
      highlightNext,
      selectValue
    }),
    [
      state,
      currentOpen,
      disabledByState,
      loading,
      normalizedError,
      highlightedValue,
      rovingModel,
      baseId,
      triggerId,
      contentId,
      closeOnSelect,
      registerItem,
      openMenu,
      closeMenu,
      toggleOpen,
      highlightValue,
      highlightFirst,
      highlightLast,
      highlightNext,
      selectValue
    ]
  );

  const fallbackChildren = React.createElement(
    React.Fragment,
    null,
    React.createElement(MenuTrigger, null, triggerContent),
    React.createElement(
      MenuContent,
      null,
      normalizedItems.map((item, index) =>
        React.createElement(
          MenuItem,
          {
            key: `${item.value}-${index}`,
            value: item.value,
            disabled: item.disabled,
            index
          },
          item.label
        )
      )
    )
  );

  return React.createElement(
    MenuCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("menu", "root", state),
        ...handlers,
        ref,
        "data-open": String(Boolean(currentOpen)),
        "aria-disabled": disabledByState ? "true" : undefined
      },
      children !== undefined ? children : fallbackChildren,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("menu", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

MenuRoot.displayName = "ChipsMenu.Root";

const MenuTrigger = React.forwardRef((props, ref) => {
  const { children, onClick, onKeyDown, ...rest } = props;
  const context = useMenuCompoundContext("trigger");
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  React.useEffect(() => {
    context.triggerRef.current = localRef.current;
    return () => {
      if (context.triggerRef.current === localRef.current) {
        context.triggerRef.current = null;
      }
    };
  }, [context.triggerRef]);

  const handleKeyDown = (event) => {
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
    if (event.defaultPrevented || context.disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      context.openMenu();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!context.open) {
        context.openMenu();
      }
      context.highlightLast();
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      context.toggleOpen(event);
    }
  };

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("menu", "trigger", context.state),
      ref: localRef,
      id: rest.id || context.triggerId,
      type: rest.type || "button",
      role: "button",
      disabled: context.disabled,
      "aria-haspopup": "menu",
      "aria-expanded": String(context.open),
      "aria-controls": context.contentId,
      onClick: mergeEventHandlers(onClick, context.toggleOpen),
      onKeyDown: handleKeyDown
    },
    children
  );
});

MenuTrigger.displayName = "ChipsMenu.Trigger";

const MenuContent = React.forwardRef((props, ref) => {
  const { children, onKeyDown, ...rest } = props;
  const context = useMenuCompoundContext("content");
  const handleKeyDown = (event) => {
    if (typeof onKeyDown === "function") {
      onKeyDown(event);
    }
    if (event.defaultPrevented || context.disabled) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      context.closeMenu();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      context.highlightNext("next", { focus: true });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      context.highlightNext("prev", { focus: true });
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      context.highlightFirst({ focus: true });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      context.highlightLast({ focus: true });
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      if (context.highlightedValue !== null) {
        context.selectValue(context.highlightedValue, { source: "keyboard", event });
      }
    }
  };

  if (!context.open) {
    return null;
  }

  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("menu", "content", context.state),
      ref,
      id: rest.id || context.contentId,
      role: rest.role || "menu",
      "aria-labelledby": rest["aria-labelledby"] || context.triggerId,
      tabIndex: rest.tabIndex ?? -1,
      onKeyDown: handleKeyDown
    },
    children
  );
});

MenuContent.displayName = "ChipsMenu.Content";

const MenuItem = React.forwardRef((props, ref) => {
  const {
    children,
    value,
    disabled = false,
    textValue,
    index = 0,
    onClick,
    onMouseEnter,
    onFocus,
    ...rest
  } = props;
  const context = useMenuCompoundContext("item");
  const itemValue = String(value);
  const idSegment = normalizeDomIdSegment(itemValue, String(index));
  const itemId = rest.id || `${context.baseId}-item-${idSegment}`;
  const disabledByState = context.disabled || disabled;
  const highlighted = context.highlightedValue === itemValue;
  const rovingItem = getRovingItemByValue(context.rovingModel, itemValue);
  const itemState = disabledByState
    ? "disabled"
    : highlighted
      ? "hover"
      : context.state === "disabled" || context.state === "loading" || context.state === "error"
        ? context.state
        : "idle";
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current);
  const label = children !== undefined ? children : textValue ?? itemValue;

  React.useEffect(
    () => context.registerItem({
      value: itemValue,
      disabled: disabledByState,
      label,
      textValue,
      id: itemId,
      ref: localRef
    }),
    [context.registerItem, disabledByState, itemId, itemValue, label, textValue]
  );

  const highlightCurrent = (event) => {
    if (typeof onMouseEnter === "function" && event.type === "mouseenter") {
      onMouseEnter(event);
    }
    if (typeof onFocus === "function" && event.type === "focus") {
      onFocus(event);
    }
    if (!event.defaultPrevented && !disabledByState) {
      context.highlightValue(itemValue);
    }
  };

  const selectCurrent = (event) => {
    if (disabledByState) {
      event?.preventDefault?.();
      return;
    }
    context.selectValue(itemValue, { source: "pointer", event });
  };

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("menu", "item", itemState),
      ref: localRef,
      id: itemId,
      type: rest.type || "button",
      role: "menuitem",
      ...getRovingTabIndexProps(rovingItem || { active: highlighted, disabled: disabledByState }, { includeAriaDisabled: false }),
      disabled: disabledByState,
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-highlighted": String(highlighted),
      onMouseEnter: highlightCurrent,
      onFocus: highlightCurrent,
      onClick: mergeEventHandlers(onClick, selectCurrent)
    },
    label
  );
});

MenuItem.displayName = "ChipsMenu.Item";

const MenuGroup = React.forwardRef((props, ref) => {
  const { children, label, labelId, ...rest } = props;
  const context = useMenuCompoundContext("group");
  const generatedId = React.useId();
  const groupLabelId = labelId || (label !== undefined ? `${rest.id || generatedId}-label` : undefined);
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("menu", "group", context.state),
      ref,
      role: rest.role || "group",
      "aria-labelledby": rest["aria-labelledby"] || groupLabelId
    },
    label !== undefined
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("menu", "group-label", context.state),
            id: groupLabelId
          },
          label
        )
      : null,
    children
  );
});

MenuGroup.displayName = "ChipsMenu.Group";

const MenuSeparator = React.forwardRef((props, ref) => {
  const context = useMenuCompoundContext("separator");
  return React.createElement("div", {
    ...props,
    ...createScopeAttributes("menu", "separator", context.state),
    ref,
    role: props.role || "separator",
    "aria-orientation": props["aria-orientation"] || "horizontal"
  });
});

MenuSeparator.displayName = "ChipsMenu.Separator";

export const ChipsMenu = Object.assign(MenuRoot, {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  Group: MenuGroup,
  Separator: MenuSeparator
});

ChipsMenu.displayName = "ChipsMenu";

function renderCommandIcon(command, scope, state) {
  if (!command?.icon) {
    return null;
  }
  return React.createElement(
    "span",
    {
      ...createScopeAttributes(scope, "icon", state),
      "aria-hidden": "true"
    },
    React.createElement(ChipsIcon, {
      descriptor: {
        ...command.icon,
        decorative: true
      }
    })
  );
}

function renderCommandLabel(command, scope, state) {
  return React.createElement(
    "span",
    createScopeAttributes(scope, "label", state),
    command.label
  );
}

function renderCommandShortcut(shortcut, scope, state) {
  if (!shortcut) {
    return null;
  }
  return React.createElement(
    "span",
    createScopeAttributes(scope, "shortcut", state),
    shortcut
  );
}

function resolveCommandAdapter(props, context) {
  return props.adapter || context?.adapter || null;
}

function invokeCommand(adapter, command, source, payload, context) {
  if (!adapter || typeof adapter.invokeCommand !== "function") {
    return undefined;
  }
  return adapter.invokeCommand(command.commandId, payload, {
    source,
    context
  });
}

export const ChipsCommandProvider = (props) => {
  const {
    adapter,
    commands,
    query,
    i18n,
    children
  } = props;

  const value = React.useMemo(
    () => ({
      adapter,
      commands: Array.isArray(commands) ? commands : undefined,
      query: query && typeof query === "object" ? query : undefined,
      i18n
    }),
    [adapter, commands, query, i18n]
  );

  return React.createElement(CommandContext.Provider, { value }, children);
};

ChipsCommandProvider.displayName = "ChipsCommandProvider";

export const ChipsShortcut = React.forwardRef((props, ref) => {
  const {
    shortcut,
    command,
    disabled = false,
    ariaLabel,
    separator = "+",
    onStateChange
  } = props;

  const shortcutLabel = command
    ? normalizeCommandShortcutValue(command.shortcut)
    : normalizeCommandShortcutValue(shortcut);
  const keys = shortcutLabel
    .split("+")
    .map((item) => item.trim())
    .filter(Boolean);
  const state = disabled ? "disabled" : "idle";

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  return React.createElement(
    "kbd",
    {
      ...createScopeAttributes("shortcut", "root", state),
      ref,
      "aria-label": ariaLabel || shortcutLabel,
      "aria-disabled": disabled ? "true" : undefined
    },
    keys.map((key, index) =>
      React.createElement(
        React.Fragment,
        { key: `${key}-${index}` },
        index > 0
          ? React.createElement(
              "span",
              {
                ...createScopeAttributes("shortcut", "separator", state),
                "aria-hidden": "true"
              },
              separator
            )
          : null,
        React.createElement(
          "span",
          createScopeAttributes("shortcut", "key", state),
          key
        )
      )
    )
  );
});

ChipsShortcut.displayName = "ChipsShortcut";

export const ChipsToolbarItem = React.forwardRef((props, ref) => {
  const context = useChipsCommandContext();
  const {
    command,
    adapter,
    i18n = context?.i18n,
    disabled = false,
    loading = false,
    error = null,
    payload,
    invocationContext,
    visualState,
    onCommandInvoke,
    onStateChange
  } = props;

  const resolvedCommand = normalizeCommandView(command, { i18n });
  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading || !resolvedCommand || resolvedCommand.disabled;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = visualState || resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });
  const commandAdapter = resolveCommandAdapter({ adapter }, context);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const selectCommand = () => {
    if (!resolvedCommand || resolvedCommand.disabled || disabledByState) {
      return;
    }
    if (typeof onCommandInvoke === "function") {
      onCommandInvoke(resolvedCommand);
    }
    invokeCommand(commandAdapter, resolvedCommand, "toolbar", payload, invocationContext);
  };

  return React.createElement(
    "button",
    {
      ...createScopeAttributes("toolbar", "item", state),
      ...handlers,
      ref,
      type: "button",
      disabled: disabledByState,
      "aria-label": resolvedCommand?.ariaLabel,
      "aria-pressed": resolvedCommand?.checked ? "true" : undefined,
      "aria-disabled": resolvedCommand?.disabled ? "true" : undefined,
      "data-command-id": resolvedCommand?.commandId,
      "data-checked": String(Boolean(resolvedCommand?.checked)),
      onClick: selectCommand
    },
    resolvedCommand ? renderCommandIcon(resolvedCommand, "toolbar", state) : null,
    resolvedCommand ? renderCommandLabel(resolvedCommand, "toolbar", state) : null,
    resolvedCommand ? renderCommandShortcut(resolvedCommand.shortcutLabel, "toolbar", state) : null
  );
});

ChipsToolbarItem.displayName = "ChipsToolbarItem";

export const ChipsToolbar = React.forwardRef((props, ref) => {
  const context = useChipsCommandContext();
  const {
    commands = context?.commands,
    toolbarId,
    groupId,
    adapter,
    i18n = context?.i18n,
    query,
    disabled = false,
    loading: loadingProp = false,
    error: errorProp = null,
    ariaLabel,
    payload,
    invocationContext,
    onCommandInvoke,
    onStateChange
  } = props;

  const { commands: commandSource, loading, error } = useChipsCommands({
    adapter: resolveCommandAdapter({ adapter }, context),
    commands,
    query: {
      source: "toolbar",
      ...query
    }
  });
  const normalizedError = normalizeError(errorProp || error);
  const disabledByState = disabled || loadingProp || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const items = resolveCommandToolbarItems(commandSource, {
    toolbarId,
    groupId,
    i18n
  });
  const commandAdapter = resolveCommandAdapter({ adapter }, context);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loadingProp || loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.groupId)) {
      groups.set(item.groupId, []);
    }
    groups.get(item.groupId).push(item);
  }

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("toolbar", "root", state),
      ...handlers,
      ref,
      role: "toolbar",
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    [...groups.entries()].map(([currentGroupId, groupItems]) =>
      React.createElement(
        "div",
        {
          ...createScopeAttributes("toolbar", "group", state),
          key: currentGroupId,
          role: "group",
          "data-group-id": currentGroupId
        },
        groupItems.map((command) =>
          React.createElement(
            ChipsToolbarItem,
            {
              key: command.commandId,
              command,
              adapter: commandAdapter,
              i18n,
              disabled: disabledByState,
              payload,
              invocationContext,
              visualState: state,
              onCommandInvoke
            }
          )
        )
      )
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("toolbar", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsToolbar.displayName = "ChipsToolbar";

function renderCommandMenuItems(params) {
  const {
    scope,
    state,
    groups,
    disabled,
    selectCommand
  } = params;

  return groups.map((group) =>
    React.createElement(
      "li",
      {
        ...createScopeAttributes(scope, "group", state),
        key: group.groupId,
        role: "none",
        "data-group-id": group.groupId
      },
      React.createElement(
        "ul",
        { role: "group" },
        group.items.map((command) =>
          React.createElement(
            "li",
            {
              key: command.commandId,
              role: "none"
            },
            React.createElement(
              "button",
              {
                ...createScopeAttributes(scope, "item", state),
                type: "button",
                role: "menuitem",
                disabled: disabled || command.disabled,
                "aria-label": command.ariaLabel,
                "aria-disabled": command.disabled ? "true" : undefined,
                "aria-checked": command.checked ? "true" : undefined,
                "data-command-id": command.commandId,
                onClick: () => selectCommand(command)
              },
              renderCommandIcon(command, scope, state),
              renderCommandLabel(command, scope, state),
              renderCommandShortcut(command.shortcutLabel, scope, state)
            )
          )
        )
      )
    )
  );
}

export const ChipsMenuBar = React.forwardRef((props, ref) => {
  const context = useChipsCommandContext();
  const {
    commands = context?.commands,
    adapter,
    i18n = context?.i18n,
    menus = [],
    query,
    disabled = false,
    loading: loadingProp = false,
    error: errorProp = null,
    ariaLabel,
    payload,
    invocationContext,
    onCommandInvoke,
    onStateChange
  } = props;

  const { commands: commandSource, loading, error } = useChipsCommands({
    adapter: resolveCommandAdapter({ adapter }, context),
    commands,
    query: {
      source: "menu",
      ...query
    }
  });
  const normalizedError = normalizeError(errorProp || error);
  const disabledByState = disabled || loadingProp || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const commandAdapter = resolveCommandAdapter({ adapter }, context);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loadingProp || loading,
    error: normalizedError,
    interaction
  });
  const [openMenuId, setOpenMenuId] = React.useState(null);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const normalizedMenus = Array.isArray(menus) && menus.length > 0
    ? menus
    : [...new Set(
        normalizeCommandViews(commandSource, { i18n })
          .flatMap((command) => command.menuPlacement.map((placement) => commandString(placement.menuId) || "app"))
      )].map((menuId) => ({ menuId, label: menuId }));

  const selectCommand = (command) => {
    if (command.disabled || disabledByState) {
      return;
    }
    if (typeof onCommandInvoke === "function") {
      onCommandInvoke(command);
    }
    invokeCommand(commandAdapter, command, "menu", payload, invocationContext);
    setOpenMenuId(null);
  };

  return React.createElement(
    "nav",
    {
      ...createScopeAttributes("menu-bar", "root", state),
      ...handlers,
      ref,
      role: "menubar",
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    normalizedMenus.map((menu) => {
      const menuId = commandString(menu.menuId) || "app";
      const groups = resolveCommandMenuGroups(commandSource, {
        menuId,
        i18n
      });
      const open = openMenuId === menuId;
      return React.createElement(
        "div",
        {
          ...createScopeAttributes("menu-bar", "menu", state),
          key: menuId,
          role: "none",
          "data-menu-id": menuId
        },
        React.createElement(
          "button",
          {
            ...createScopeAttributes("menu-bar", "menu", state),
            type: "button",
            role: "menuitem",
            disabled: disabledByState,
            "aria-haspopup": "menu",
            "aria-expanded": String(open),
            onClick: () => setOpenMenuId(open ? null : menuId)
          },
          menu.label || menuId
        ),
        open
          ? React.createElement(
              "ul",
              {
                ...createScopeAttributes("menu-bar", "content", state),
                role: "menu"
              },
              renderCommandMenuItems({
                scope: "menu-bar",
                state,
                groups,
                disabled: disabledByState,
                selectCommand
              })
            )
          : null
      );
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("menu-bar", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsMenuBar.displayName = "ChipsMenuBar";

export const ChipsContextMenu = React.forwardRef((props, ref) => {
  const context = useChipsCommandContext();
  const {
    commands = context?.commands,
    adapter,
    i18n = context?.i18n,
    menuId,
    query,
    disabled = false,
    loading: loadingProp = false,
    error: errorProp = null,
    triggerContent,
    children,
    payload,
    invocationContext,
    onCommandInvoke,
    onStateChange
  } = props;

  const { commands: commandSource, loading, error } = useChipsCommands({
    adapter: resolveCommandAdapter({ adapter }, context),
    commands,
    query: {
      source: "context-menu",
      ...query
    }
  });
  const normalizedError = normalizeError(errorProp || error);
  const disabledByState = disabled || loadingProp || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [open, setOpen] = React.useState(false);
  const commandAdapter = resolveCommandAdapter({ adapter }, context);
  const groups = resolveCommandMenuGroups(commandSource, {
    menuId,
    i18n
  });
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loadingProp || loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const selectCommand = (command) => {
    if (command.disabled || disabledByState) {
      return;
    }
    if (typeof onCommandInvoke === "function") {
      onCommandInvoke(command);
    }
    invokeCommand(commandAdapter, command, "context-menu", payload, invocationContext);
    setOpen(false);
  };

  const handleContextMenu = (event) => {
    if (disabledByState) {
      return;
    }
    event.preventDefault();
    setOpen(true);
  };

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("context-menu", "root", state),
      ...handlers,
      ref,
      "data-open": String(open),
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "button",
      {
        ...createScopeAttributes("context-menu", "trigger", state),
        type: "button",
        role: "button",
        disabled: disabledByState,
        "aria-haspopup": "menu",
        "aria-expanded": String(open),
        onContextMenu: handleContextMenu,
        onClick: () => setOpen(!open)
      },
      triggerContent || children
    ),
    open
      ? React.createElement(
          "ul",
          {
            ...createScopeAttributes("context-menu", "content", state),
            role: "menu"
          },
          renderCommandMenuItems({
            scope: "context-menu",
            state,
            groups,
            disabled: disabledByState,
            selectCommand
          })
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("context-menu", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsContextMenu.displayName = "ChipsContextMenu";

export const ChipsTooltip = React.forwardRef((props, ref) => {
  const {
    open,
    defaultOpen = false,
    disabled = false,
    loading = false,
    error = null,
    triggerContent,
    content,
    onOpenChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const contentId = React.useId();

  const show = () => {
    if (!disabledByState) {
      setCurrentOpen(true);
    }
  };

  const hide = () => {
    setCurrentOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }

    if (isKeyboardActivationKey(event.key)) {
      show();
    }
  };

  return React.createElement(
    "span",
    {
      ...createScopeAttributes("tooltip", "root", state),
      ...handlers,
      ref,
      "data-open": String(Boolean(currentOpen)),
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "button",
      {
        ...createScopeAttributes("tooltip", "trigger", state),
        type: "button",
        disabled: disabledByState,
        "aria-describedby": currentOpen ? contentId : undefined,
        onPointerEnter: show,
        onPointerLeave: hide,
        onFocus: show,
        onBlur: hide,
        onKeyDown: handleKeyDown
      },
      triggerContent
    ),
    currentOpen && content
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("tooltip", "content", state),
            id: contentId,
            role: "tooltip"
          },
          React.createElement("span", {
            ...createScopeAttributes("tooltip", "arrow", state),
            "aria-hidden": "true"
          }),
          content
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("tooltip", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsTooltip.displayName = "ChipsTooltip";

const [FormCompoundContext] = createCompoundContext("form");
const FormFieldCompoundContext = React.createContext(null);
FormFieldCompoundContext.displayName = "form-compound-field-context";

function useFormFieldCompoundContext(part) {
  const value = React.useContext(FormFieldCompoundContext);
  if (!value) {
    throw new Error(`FORM_COMPOUND_FIELD_CONTEXT_MISSING:${part}`);
  }
  return value;
}

function mergeAriaDescribedBy(...values) {
  return buildAriaDescribedBy(
    values
      .flatMap((value) => (typeof value === "string" ? value.split(/\s+/) : []))
      .filter(Boolean)
  );
}

function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }
      if (typeof ref === "function") {
        ref(node);
      } else {
        ref.current = node;
      }
    }
  };
}

function isNativeFormControlElementType(type) {
  return ["input", "textarea", "select", "button"].includes(type);
}

function resolveFormCustomControlProps(context, existingProps = {}) {
  return {
    id: existingProps.id || context.controlId,
    required: existingProps.required ?? context.required,
    disabled: existingProps.disabled ?? context.disabled,
    readOnly: existingProps.readOnly ?? context.readOnly,
    "aria-required": existingProps["aria-required"] ?? (context.required ? "true" : undefined),
    "aria-labelledby": existingProps["aria-labelledby"] ?? context.labelId,
    "aria-invalid": existingProps["aria-invalid"] ?? (context.invalid ? "true" : undefined),
    "aria-describedby": mergeAriaDescribedBy(existingProps["aria-describedby"], context.describedBy)
  };
}

function resolveFormControlProps(context, existingProps = {}, options = {}) {
  return {
    id: existingProps.id || context.controlId,
    required: options.includeNativeRequired === false ? existingProps.required : (existingProps.required ?? context.required),
    disabled: options.includeDisabled === false ? existingProps.disabled : (existingProps.disabled ?? context.disabled),
    readOnly: options.includeReadOnly === false ? existingProps.readOnly : (existingProps.readOnly ?? context.readOnly),
    "aria-required": existingProps["aria-required"] ?? (context.required ? "true" : undefined),
    "aria-invalid": existingProps["aria-invalid"] ?? (context.invalid ? "true" : undefined),
    "aria-describedby": mergeAriaDescribedBy(existingProps["aria-describedby"], context.describedBy)
  };
}

const FormRoot = React.forwardRef((props, ref) => {
  const {
    children,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    required = false,
    onSubmit,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const contextValue = React.useMemo(
    () => ({
      state,
      disabled: disabledByState,
      loading,
      error: normalizedError,
      readOnly,
      required
    }),
    [state, disabledByState, loading, normalizedError, readOnly, required]
  );

  const handleSubmit = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }
    if (typeof onSubmit === "function") {
      onSubmit(event);
    }
  };

  return React.createElement(
    FormCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "form",
      {
        ...rest,
        ...createScopeAttributes("form", "root", state),
        ...handlers,
        ref,
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-invalid": normalizedError ? "true" : undefined,
        "data-required": String(required === true),
        "data-readonly": String(readOnly === true),
        onSubmit: mergeEventHandlers(rest.onSubmit, handleSubmit)
      },
      children,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("form", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

FormRoot.displayName = "ChipsForm.Root";

const FormSection = React.forwardRef((props, ref) => {
  const {
    children,
    title,
    titleId,
    description,
    descriptionId,
    error = null,
    disabled,
    loading,
    required,
    readOnly,
    onStateChange,
    ...rest
  } = props;
  const formContext = React.useContext(FormCompoundContext) ?? {};
  const normalizedError = normalizeError(error) || formContext.error;
  const disabledByState = disabled ?? formContext.disabled;
  const loadingByState = loading ?? formContext.loading;
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loadingByState,
    error: normalizedError
  });
  const generatedId = React.useId();
  const resolvedTitleId = titleId || (title !== undefined ? `${rest.id || generatedId}-title` : undefined);
  const resolvedDescriptionId = descriptionId || (description !== undefined ? `${rest.id || generatedId}-description` : undefined);

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const sectionContext = React.useMemo(
    () => ({
      ...formContext,
      state,
      disabled: disabledByState,
      loading: loadingByState,
      error: normalizedError,
      readOnly: readOnly ?? formContext.readOnly,
      required: required ?? formContext.required
    }),
    [formContext, state, disabledByState, loadingByState, normalizedError, readOnly, required]
  );

  return React.createElement(
    FormCompoundContext.Provider,
    { value: sectionContext },
    React.createElement(
      "section",
      {
        ...rest,
        ...createScopeAttributes("form", "section", state),
        ref,
        "aria-labelledby": rest["aria-labelledby"] || resolvedTitleId,
        "aria-describedby": mergeAriaDescribedBy(rest["aria-describedby"], resolvedDescriptionId),
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-invalid": normalizedError ? "true" : undefined
      },
      title !== undefined
        ? React.createElement(
            "h3",
            {
              id: resolvedTitleId,
              ...createScopeAttributes("form", "label", state)
            },
            title
          )
        : null,
      description !== undefined
        ? React.createElement(
            "p",
            {
              id: resolvedDescriptionId,
              ...createScopeAttributes("form", "hint", state)
            },
            description
          )
        : null,
      children,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("form", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

FormSection.displayName = "ChipsForm.Section";

const FormField = React.forwardRef((props, ref) => {
  const {
    children,
    id,
    name,
    required,
    disabled,
    loading,
    error = null,
    readOnly,
    onStateChange,
    ...rest
  } = props;
  const formContext = React.useContext(FormCompoundContext) ?? {};
  const generatedId = React.useId();
  const baseId = id || name || generatedId;
  const normalizedBaseId = normalizeDomIdSegment(baseId, "field");
  const normalizedError = normalizeError(error) || formContext.error;
  const disabledByState = disabled ?? formContext.disabled;
  const loadingByState = loading ?? formContext.loading;
  const requiredByState = required ?? formContext.required;
  const readOnlyByState = readOnly ?? formContext.readOnly;
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loadingByState,
    error: normalizedError
  });
  const labelId = `${normalizedBaseId}-label`;
  const controlId = `${normalizedBaseId}-control`;
  const hintId = `${normalizedBaseId}-hint`;
  const errorId = `${normalizedBaseId}-error`;
  const hasHintChild = hasReactElementType(children, [FormHint]);
  const hasErrorChild = hasReactElementType(children, [FormError]);
  const describedBy = mergeAriaDescribedBy(
    hasHintChild ? hintId : undefined,
    hasErrorChild || normalizedError ? errorId : undefined
  );

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const contextValue = React.useMemo(
    () => ({
      state,
      disabled: disabledByState,
      loading: loadingByState,
      error: normalizedError,
      invalid: Boolean(normalizedError),
      readOnly: readOnlyByState,
      required: requiredByState,
      baseId: normalizedBaseId,
      labelId,
      controlId,
      hintId,
      errorId,
      describedBy
    }),
    [
      state,
      disabledByState,
      loadingByState,
      normalizedError,
      readOnlyByState,
      requiredByState,
      normalizedBaseId,
      labelId,
      controlId,
      hintId,
      errorId,
      describedBy
    ]
  );

  return React.createElement(
    FormFieldCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("form", "field", state),
        ref,
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-invalid": normalizedError ? "true" : undefined,
        "aria-describedby": mergeAriaDescribedBy(rest["aria-describedby"], describedBy),
        "data-required": String(requiredByState === true),
        "data-readonly": String(readOnlyByState === true)
      },
      children
    )
  );
});

FormField.displayName = "ChipsForm.Field";

const FormLabel = React.forwardRef((props, ref) => {
  const { children, requiredIndicator = "*", ...rest } = props;
  const context = useFormFieldCompoundContext("label");
  return React.createElement(
    "label",
    {
      ...rest,
      ...createScopeAttributes("form", "label", context.state),
      ref,
      id: rest.id || context.labelId,
      htmlFor: rest.htmlFor || context.controlId
    },
    children,
    context.required
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("form", "required", context.state),
            "aria-hidden": "true"
          },
          requiredIndicator
        )
      : null
  );
});

FormLabel.displayName = "ChipsForm.Label";

const FormControl = React.forwardRef((props, ref) => {
  const { children, as: Element = "input", ...rest } = props;
  const context = useFormFieldCompoundContext("control");
  const injectedProps = resolveFormControlProps(context, rest);

  if (React.isValidElement(children)) {
    const childProps = isNativeFormControlElementType(children.type)
      ? resolveFormControlProps(context, children.props)
      : resolveFormCustomControlProps(context, children.props);
    return React.cloneElement(children, {
      ...childProps,
      ref: mergeRefs(children.ref, ref)
    });
  }

  const controlProps = {
    ...rest,
    ...injectedProps,
    ref
  };

  if (isNativeFormControlElementType(Element)) {
    Object.assign(controlProps, createScopeAttributes("form", "control", context.state));
  }

  return React.createElement(Element, controlProps, children);
});

FormControl.displayName = "ChipsForm.Control";

const FormError = React.forwardRef((props, ref) => {
  const { children, live = "assertive", ...rest } = props;
  const context = useFormFieldCompoundContext("error");
  const content = children !== undefined ? children : context.error?.message;
  if (content === undefined || content === null) {
    return null;
  }
  return React.createElement(
    "p",
    {
      ...rest,
      ...createScopeAttributes("form", "error", context.state),
      ...createAriaStatusProps({ live }),
      ref,
      id: rest.id || context.errorId
    },
    content
  );
});

FormError.displayName = "ChipsForm.Error";

const FormHint = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  const context = useFormFieldCompoundContext("hint");
  if (children === undefined || children === null) {
    return null;
  }
  return React.createElement(
    "p",
    {
      ...rest,
      ...createScopeAttributes("form", "hint", context.state),
      ref,
      id: rest.id || context.hintId
    },
    children
  );
});

FormHint.displayName = "ChipsForm.Hint";

export const ChipsForm = Object.assign(FormRoot, {
  Root: FormRoot,
  Section: FormSection,
  Field: FormField,
  Label: FormLabel,
  Control: FormControl,
  Error: FormError,
  Hint: FormHint
});

ChipsForm.displayName = "ChipsForm";

export const ChipsVirtualList = React.forwardRef((props, ref) => {
  const {
    items = [],
    itemHeight = 44,
    height = 320,
    overscan = 3,
    ariaLabel,
    disabled = false,
    loading = false,
    error = null,
    activeIndex,
    defaultActiveIndex = -1,
    renderItem,
    onActiveIndexChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);

  const normalizedItems = React.useMemo(
    () =>
      (Array.isArray(items) ? items : []).map((item, index) => {
        const source =
          item && typeof item === "object"
            ? item
            : {
                value: String(index),
                label: item === undefined || item === null ? "" : String(item)
              };

        return {
          ...source,
          value:
            typeof source.value === "string" || typeof source.value === "number"
              ? String(source.value)
              : String(index),
          disabled: source.disabled === true
        };
      }),
    [items]
  );

  const [scrollTop, setScrollTop] = React.useState(0);
  const [currentActiveIndex, setCurrentActiveIndex] = useControllableState({
    value: activeIndex,
    defaultValue: defaultActiveIndex,
    onChange: onActiveIndexChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const viewportHeight = normalizePositiveNumber(height, 320);
  const normalizedItemHeight = normalizePositiveNumber(itemHeight, 44);

  const windowed = React.useMemo(
    () =>
      computeVirtualWindow({
        itemCount: normalizedItems.length,
        itemHeight: normalizedItemHeight,
        viewportHeight,
        scrollTop,
        overscan
      }),
    [normalizedItems.length, normalizedItemHeight, overscan, scrollTop, viewportHeight]
  );

  const visibleItems = React.useMemo(
    () =>
      normalizedItems
        .slice(windowed.start, windowed.end + 1)
        .map((item, offset) => ({ item, index: windowed.start + offset })),
    [normalizedItems, windowed.end, windowed.start]
  );

  const totalHeight = normalizedItems.length * normalizedItemHeight;

  const setActive = (index) => {
    if (disabledByState || index < 0 || index >= normalizedItems.length) {
      return;
    }
    if (normalizedItems[index].disabled) {
      return;
    }
    setCurrentActiveIndex(index);
  };

  const handleKeyDown = (event) => {
    if (disabledByState || normalizedItems.length === 0) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActive(getFirstEnabledIndex(normalizedItems));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActive(getNextEnabledIndex(normalizedItems, 0, "prev", true));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(getNextEnabledIndex(normalizedItems, currentActiveIndex, "next", true));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(getNextEnabledIndex(normalizedItems, currentActiveIndex, "prev", true));
    }
  };

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("virtual-list", "root", state),
      ...handlers,
      ref,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "div",
      {
        ...createScopeAttributes("virtual-list", "viewport", state),
        role: "list",
        "aria-label": ariaLabel,
        tabIndex: 0,
        style: {
          maxHeight: `${viewportHeight}px`,
          overflowY: "auto"
        },
        onScroll: (event) => {
          setScrollTop(event.target.scrollTop);
        },
        onKeyDown: handleKeyDown
      },
      React.createElement(
        "div",
        {
          ...createScopeAttributes("virtual-list", "content", state),
          style: {
            height: `${totalHeight}px`,
            paddingTop: `${windowed.paddingStart}px`,
            paddingBottom: `${windowed.paddingEnd}px`,
            boxSizing: "border-box"
          }
        },
        visibleItems.map(({ item, index }) =>
          React.createElement(
            "div",
            {
              ...createScopeAttributes("virtual-list", "item", state),
              key: `${item.value}-${index}`,
              role: "listitem",
              "aria-disabled": item.disabled ? "true" : undefined,
              "data-active": String(index === currentActiveIndex),
              "data-index": String(index),
              style: {
                minHeight: `${normalizedItemHeight}px`
              },
              onMouseDown: () => setActive(index)
            },
            typeof renderItem === "function" ? renderItem(item, index) : item.label || item.value
          )
        )
      )
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("virtual-list", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsVirtualList.displayName = "ChipsVirtualList";

const [DataGridCompoundContext, useDataGridCompoundContext] = createCompoundContext("data-grid");

function resolveDataGridLabelProps(props) {
  if (props["aria-label"] || props["aria-labelledby"]) {
    return props;
  }
  return {
    ...props,
    "aria-label": props.ariaLabel
  };
}

function flattenReactChildren(children) {
  const flattened = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      flattened.push(...flattenReactChildren(child.props.children));
      return;
    }
    if (child !== null && child !== undefined && child !== false) {
      flattened.push(child);
    }
  });
  return flattened;
}

function resolveDataGridSortName(direction) {
  if (direction === "desc") {
    return "descending";
  }
  if (direction === "asc") {
    return "ascending";
  }
  return "none";
}

const DataGridRoot = React.forwardRef((props, ref) => {
  const {
    children,
    columns = [],
    rows = [],
    sort,
    defaultSort = null,
    selectedRowIds,
    defaultSelectedRowIds = [],
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    onSortChange,
    onSelectedRowIdsChange,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentSort, setCurrentSort] = useControllableState({
    value: sort,
    defaultValue: defaultSort,
    onChange: onSortChange
  });
  const [currentSelectedRowIds, setCurrentSelectedRowIds] = useControllableState({
    value: selectedRowIds,
    defaultValue: defaultSelectedRowIds,
    onChange: onSelectedRowIdsChange
  });
  const [activeRowIndex, setActiveRowIndex] = React.useState(0);

  const normalizedColumns = React.useMemo(
    () =>
      (Array.isArray(columns) ? columns : [])
        .filter((column) => column && typeof column.key === "string")
        .map((column) => ({
          key: column.key,
          label: typeof column.label === "string" ? column.label : column.key,
          sortable: column.sortable !== false
        })),
    [columns]
  );

  const normalizedRows = React.useMemo(
    () =>
      (Array.isArray(rows) ? rows : []).map((row, index) => ({
        ...(row && typeof row === "object" ? row : {}),
        __rowId:
          row && (typeof row.id === "string" || typeof row.id === "number")
            ? String(row.id)
            : String(index)
      })),
    [rows]
  );

  const sortedRows = React.useMemo(
    () => applyDataGridSort(normalizedRows, currentSort),
    [normalizedRows, currentSort]
  );

  React.useEffect(() => {
    if (activeRowIndex >= sortedRows.length) {
      setActiveRowIndex(Math.max(0, sortedRows.length - 1));
    }
  }, [activeRowIndex, sortedRows.length]);

  const selectedSet = React.useMemo(
    () => new Set((Array.isArray(currentSelectedRowIds) ? currentSelectedRowIds : []).map((id) => String(id))),
    [currentSelectedRowIds]
  );

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const gridLabelProps = resolveDataGridLabelProps(rest);

  const toggleSort = (columnKey) => {
    if (disabledByState) {
      return;
    }

    if (!currentSort || currentSort.key !== columnKey) {
      setCurrentSort({ key: columnKey, direction: "asc" });
      return;
    }

    setCurrentSort({
      key: columnKey,
      direction: currentSort.direction === "asc" ? "desc" : "asc"
    });
  };

  const toggleRowSelection = (rowId) => {
    if (disabledByState) {
      return;
    }

    const normalizedId = String(rowId);
    const next = new Set(selectedSet);
    if (next.has(normalizedId)) {
      next.delete(normalizedId);
    } else {
      next.add(normalizedId);
    }
    setCurrentSelectedRowIds([...next]);
  };

  const handleGridKeyDown = (event) => {
    if (disabledByState || sortedRows.length === 0) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveRowIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveRowIndex(sortedRows.length - 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveRowIndex((index) => Math.min(sortedRows.length - 1, index + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveRowIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      const activeRow = sortedRows[activeRowIndex];
      if (activeRow) {
        toggleRowSelection(activeRow.__rowId);
      }
    }
  };

  const renderHeaderCell = (column) =>
    React.createElement(
      DataGridCell,
      {
        as: "th",
        key: column.key,
        header: true,
        columnKey: column.key,
        sortable: column.sortable,
        sortDirection: currentSort && currentSort.key === column.key ? currentSort.direction : null,
        onClick: column.sortable ? () => toggleSort(column.key) : undefined
      },
      column.label
    );

  const renderDataRow = (row, index) => {
    const selected = selectedSet.has(row.__rowId);
    const active = index === activeRowIndex;
    return React.createElement(
      DataGridRow,
      {
        as: "tr",
        key: row.__rowId,
        rowId: row.__rowId,
        selected,
        active,
        onMouseDown: () => setActiveRowIndex(index),
        onClick: () => toggleRowSelection(row.__rowId)
      },
      normalizedColumns.map((column) =>
        React.createElement(
          DataGridCell,
          {
            as: "td",
            key: `${row.__rowId}-${column.key}`,
            columnKey: column.key
          },
          row[column.key]
        )
      )
    );
  };

  const contextValue = React.useMemo(
    () => ({
      state,
      disabled: disabledByState,
      loading,
      error: normalizedError
    }),
    [state, disabledByState, loading, normalizedError]
  );

  const hasCustomChildren = children !== undefined && children !== null;
  const renderGridContainer = (gridChildren) =>
    React.createElement(
      "div",
      {
        key: "grid",
        role: "grid",
        tabIndex: 0,
        "aria-label": gridLabelProps["aria-label"] || ariaLabel,
        "aria-labelledby": gridLabelProps["aria-labelledby"],
        "aria-disabled": disabledByState ? "true" : undefined,
        onKeyDown: handleGridKeyDown
      },
      gridChildren
    );

  const renderCompoundChildren = () => {
    const beforeGrid = [];
    const gridChildren = [];
    const afterGrid = [];

    for (const child of flattenReactChildren(children)) {
      if (React.isValidElement(child) && child.type === DataGridToolbar) {
        beforeGrid.push(child);
        continue;
      }
      if (React.isValidElement(child) && child.type === DataGridPagination) {
        afterGrid.push(child);
        continue;
      }
      gridChildren.push(child);
    }

    return [
      ...beforeGrid,
      gridChildren.length > 0 ? renderGridContainer(gridChildren) : null,
      ...afterGrid
    ];
  };

  return React.createElement(
    DataGridCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("data-grid", "root", state),
        ...handlers,
        ref,
        role: rest.role || "group",
        "aria-label": rest["aria-label"] || ariaLabel,
        "aria-labelledby": rest["aria-labelledby"],
        "aria-disabled": disabledByState ? "true" : undefined
      },
      hasCustomChildren
        ? renderCompoundChildren()
        : React.createElement(
            "table",
            {
              role: "grid",
              tabIndex: 0,
              "aria-label": gridLabelProps["aria-label"] || ariaLabel,
              "aria-labelledby": gridLabelProps["aria-labelledby"],
              "aria-disabled": disabledByState ? "true" : undefined,
              onKeyDown: handleGridKeyDown
            },
            React.createElement(
              "thead",
              null,
              React.createElement(DataGridHeader, { as: "tr" }, normalizedColumns.map(renderHeaderCell))
            ),
            React.createElement("tbody", null, sortedRows.map(renderDataRow))
          ),
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("data-grid", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
      )
  );
});

DataGridRoot.displayName = "ChipsDataGrid.Root";

const DataGridToolbar = React.forwardRef((props, ref) => {
  const { children, ariaLabel, ...rest } = props;
  const context = useDataGridCompoundContext("toolbar");
  return React.createElement(
    "div",
    {
      ...rest,
      ...createScopeAttributes("data-grid", "toolbar", context.state),
      ref,
      role: rest.role || "toolbar",
      "aria-label": rest["aria-label"] || ariaLabel,
      "aria-labelledby": rest["aria-labelledby"]
    },
    children
  );
});

DataGridToolbar.displayName = "ChipsDataGrid.Toolbar";

const DataGridHeader = React.forwardRef((props, ref) => {
  const { children, as: Element = "div", ...rest } = props;
  const context = useDataGridCompoundContext("header");
  return React.createElement(
    Element,
    {
      ...rest,
      ...createScopeAttributes("data-grid", "header", context.state),
      ref,
      role: rest.role || "row"
    },
    children
  );
});

DataGridHeader.displayName = "ChipsDataGrid.Header";

const DataGridRow = React.forwardRef((props, ref) => {
  const { children, rowId, selected = false, active = false, as: Element = "div", ...rest } = props;
  const context = useDataGridCompoundContext("row");
  return React.createElement(
    Element,
    {
      ...rest,
      ...createScopeAttributes("data-grid", "row", context.state),
      ref,
      role: rest.role || "row",
      "aria-selected": rest["aria-selected"] ?? String(selected === true),
      "data-row-id": rowId,
      "data-selected": String(selected === true),
      "data-active": String(active === true)
    },
    children
  );
});

DataGridRow.displayName = "ChipsDataGrid.Row";

const DataGridCell = React.forwardRef((props, ref) => {
  const {
    children,
    columnKey,
    header = false,
    sortable = false,
    sortDirection = null,
    as: Element = "div",
    ...rest
  } = props;
  const context = useDataGridCompoundContext("cell");
  const sortName = header ? resolveDataGridSortName(sortDirection) : undefined;
  return React.createElement(
    Element,
    {
      ...rest,
      ...createScopeAttributes("data-grid", "cell", context.state),
      ref,
      role: rest.role || (header ? "columnheader" : "gridcell"),
      "aria-sort": rest["aria-sort"] || sortName,
      "data-column-key": columnKey,
      "data-header": String(header === true),
      "data-sort": sortName,
      "data-sortable": header ? String(sortable === true) : undefined
    },
    children
  );
});

DataGridCell.displayName = "ChipsDataGrid.Cell";

const DataGridPagination = React.forwardRef((props, ref) => {
  const { children, page, pageCount, ariaLabel, ...rest } = props;
  const context = useDataGridCompoundContext("pagination");
  return React.createElement(
    "nav",
    {
      ...rest,
      ...createScopeAttributes("data-grid", "pagination", context.state),
      ref,
      role: rest.role || "navigation",
      "aria-label": rest["aria-label"] || ariaLabel,
      "aria-labelledby": rest["aria-labelledby"],
      "data-page": page === undefined ? undefined : String(page),
      "data-page-count": pageCount === undefined ? undefined : String(pageCount)
    },
    children
  );
});

DataGridPagination.displayName = "ChipsDataGrid.Pagination";

export const ChipsDataGrid = Object.assign(DataGridRoot, {
  Root: DataGridRoot,
  Toolbar: DataGridToolbar,
  Header: DataGridHeader,
  Row: DataGridRow,
  Cell: DataGridCell,
  Pagination: DataGridPagination
});

ChipsDataGrid.displayName = "ChipsDataGrid";

const [TreeCompoundContext, useTreeCompoundContext] = createCompoundContext("tree");
const TreeItemCompoundContext = React.createContext(null);
TreeItemCompoundContext.displayName = "tree-compound-item-context";

function useTreeItemCompoundContext(part) {
  const value = React.useContext(TreeItemCompoundContext);
  if (!value) {
    throw new Error(`TREE_COMPOUND_ITEM_CONTEXT_MISSING:${part}`);
  }
  return value;
}

function sortRegisteredTreeItems(items) {
  return [...items].sort((left, right) => {
    const leftNode = left.ref?.current;
    const rightNode = right.ref?.current;
    if (leftNode && rightNode && leftNode !== rightNode && typeof leftNode.compareDocumentPosition === "function") {
      const position = leftNode.compareDocumentPosition(rightNode);
      if ((position & 4) !== 0) {
        return -1;
      }
      if ((position & 2) !== 0) {
        return 1;
      }
    }
    return left.order - right.order;
  });
}

function getFirstVisibleTreeItem(items) {
  const firstIndex = getFirstEnabledIndex(items);
  return firstIndex >= 0 ? items[firstIndex] : null;
}

function renderTreeDataNodes(nodes, depth = 0, parentId = null) {
  const entries = (Array.isArray(nodes) ? nodes : []).filter((node) => node && typeof node === "object");
  const setSize = entries.length;
  return entries.map((node, index) => {
    const id = String(node.id);
    const children = Array.isArray(node.children) ? node.children : [];
    const label = node.label !== undefined && node.label !== null ? node.label : id;
    const sharedProps = {
      key: id,
      id,
      label,
      disabled: node.disabled === true,
      level: depth + 1,
      parentId,
      posInSet: index + 1,
      setSize
    };

    if (children.length > 0) {
      return React.createElement(
        TreeBranch,
        sharedProps,
        renderTreeDataNodes(children, depth + 1, id)
      );
    }

    return React.createElement(TreeLeaf, sharedProps);
  });
}

const TreeRoot = React.forwardRef((props, ref) => {
  const {
    children,
    nodes = [],
    expandedIds,
    defaultExpandedIds = [],
    selectedId,
    defaultSelectedId = null,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    expandIconContent,
    collapseIconContent,
    onExpandedIdsChange,
    onSelectedIdChange,
    onStateChange,
    ...rest
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const rootRef = React.useRef(null);
  const registryRef = React.useRef(new Map());
  const registryOrderRef = React.useRef(0);
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const [currentExpandedIds, setCurrentExpandedIds] = useControllableState({
    value: expandedIds,
    defaultValue: defaultExpandedIds,
    onChange: onExpandedIdsChange
  });
  const [currentSelectedId, setCurrentSelectedId] = useControllableState({
    value: selectedId,
    defaultValue: defaultSelectedId,
    onChange: onSelectedIdChange
  });

  const hasDataNodes = Array.isArray(nodes) && nodes.length > 0;
  const hasCustomChildren = children !== undefined && children !== null;
  const renderedChildren = hasCustomChildren ? children : renderTreeDataNodes(nodes);

  const visibleDataItems = React.useMemo(
    () => (hasCustomChildren ? [] : flattenTreeNodes(nodes, currentExpandedIds)),
    [hasCustomChildren, nodes, currentExpandedIds]
  );

  const registeredItems = React.useMemo(
    () => sortRegisteredTreeItems([...registryRef.current.values()]),
    [registryVersion]
  );

  const visibleItems = hasDataNodes && !hasCustomChildren ? visibleDataItems : registeredItems;

  const [activeNodeId, setActiveNodeId] = React.useState(
    () => currentSelectedId || visibleItems[0]?.id || null
  );

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const expandedSet = React.useMemo(
    () => new Set((Array.isArray(currentExpandedIds) ? currentExpandedIds : []).map((id) => String(id))),
    [currentExpandedIds]
  );

  const registerItem = React.useCallback((item) => {
    const id = String(item.id);
    const previous = registryRef.current.get(id);
    const order = previous?.order ?? registryOrderRef.current;
    if (!previous) {
      registryOrderRef.current += 1;
    }
    registryRef.current.set(id, {
      ...item,
      id,
      order
    });
    setRegistryVersion((version) => version + 1);

    return () => {
      registryRef.current.delete(id);
      setRegistryVersion((version) => version + 1);
    };
  }, []);

  const updateExpanded = React.useCallback((nodeId, shouldExpand) => {
    const id = String(nodeId);
    const next = new Set(expandedSet);
    if (shouldExpand) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setCurrentExpandedIds([...next]);
  }, [expandedSet, setCurrentExpandedIds]);

  const selectNode = React.useCallback((nodeId) => {
    const candidate = visibleItems.find((item) => item.id === String(nodeId));
    if (!candidate || candidate.disabled || disabledByState) {
      return;
    }
    setCurrentSelectedId(candidate.id);
    setActiveNodeId(candidate.id);
  }, [disabledByState, setCurrentSelectedId, visibleItems]);

  React.useEffect(() => {
    if (visibleItems.length === 0) {
      setActiveNodeId(null);
      return;
    }

    const targetId = activeNodeId || currentSelectedId;
    const exists = visibleItems.some((item) => item.id === targetId && item.disabled !== true);
    if (!exists) {
      setActiveNodeId(getFirstVisibleTreeItem(visibleItems)?.id ?? null);
    }
  }, [activeNodeId, currentSelectedId, visibleItems]);

  React.useEffect(() => {
    if (!activeNodeId || !rootRef.current || typeof document === "undefined") {
      return;
    }
    const rootElement = rootRef.current;
    const activeElement = document.activeElement;
    const activeItem = registryRef.current.get(activeNodeId);
    if (!activeItem?.ref?.current || !activeElement || !rootElement.contains(activeElement)) {
      return;
    }
    if (activeElement !== activeItem.ref.current) {
      activeItem.ref.current.focus();
    }
  }, [activeNodeId, registryVersion]);

  const moveActiveBy = React.useCallback((direction) => {
    const activeIndex = visibleItems.findIndex((item) => item.id === activeNodeId);
    const nextIndex = getNextEnabledIndex(visibleItems, activeIndex, direction, true);
    if (nextIndex >= 0 && visibleItems[nextIndex]) {
      setActiveNodeId(visibleItems[nextIndex].id);
    }
  }, [activeNodeId, visibleItems]);

  const handleKeyDown = React.useCallback((event) => {
    if (disabledByState || visibleItems.length === 0) {
      return;
    }

    const currentIndex = visibleItems.findIndex((item) => item.id === activeNodeId);
    const currentItem = currentIndex >= 0 ? visibleItems[currentIndex] : getFirstVisibleTreeItem(visibleItems);
    if (!currentItem) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveBy("next");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveBy("prev");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveNodeId(getFirstVisibleTreeItem(visibleItems)?.id ?? null);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const lastIndex = getNextEnabledIndex(visibleItems, 0, "prev", true);
      if (lastIndex >= 0) {
        setActiveNodeId(visibleItems[lastIndex].id);
      }
      return;
    }

    if (event.key === "ArrowRight" && currentItem.hasChildren) {
      event.preventDefault();
      if (!expandedSet.has(currentItem.id)) {
        updateExpanded(currentItem.id, true);
      } else if (visibleItems[currentIndex + 1]) {
        setActiveNodeId(visibleItems[currentIndex + 1].id);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (currentItem.hasChildren && expandedSet.has(currentItem.id)) {
        updateExpanded(currentItem.id, false);
        return;
      }
      if (currentItem.parentId) {
        setActiveNodeId(currentItem.parentId);
      }
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      selectNode(currentItem.id);
    }
  }, [activeNodeId, disabledByState, expandedSet, moveActiveBy, selectNode, updateExpanded, visibleItems]);

  const contextValue = React.useMemo(
    () => ({
      state,
      disabled: disabledByState,
      selectedId: currentSelectedId === null || currentSelectedId === undefined ? null : String(currentSelectedId),
      activeId: activeNodeId,
      expandedSet,
      registerItem,
      setActiveId: setActiveNodeId,
      selectItem: selectNode,
      updateExpanded,
      expandIconContent,
      collapseIconContent
    }),
    [
      activeNodeId,
      collapseIconContent,
      currentSelectedId,
      disabledByState,
      expandIconContent,
      expandedSet,
      registerItem,
      selectNode,
      state,
      updateExpanded
    ]
  );

  return React.createElement(
    TreeCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("tree", "root", state),
        ref: mergeRefs(ref, rootRef),
        role: "tree",
        tabIndex: visibleItems.length === 0 ? 0 : undefined,
        "aria-label": rest["aria-label"] || ariaLabel,
        "aria-labelledby": rest["aria-labelledby"],
        "aria-disabled": disabledByState ? "true" : undefined,
        onPointerEnter: mergeEventHandlers(rest.onPointerEnter, handlers.onPointerEnter),
        onPointerLeave: mergeEventHandlers(rest.onPointerLeave, handlers.onPointerLeave),
        onFocus: mergeEventHandlers(rest.onFocus, handlers.onFocus),
        onBlur: mergeEventHandlers(rest.onBlur, handlers.onBlur),
        onMouseDown: mergeEventHandlers(rest.onMouseDown, handlers.onMouseDown),
        onMouseUp: mergeEventHandlers(rest.onMouseUp, handlers.onMouseUp),
        onKeyDown: mergeEventHandlers(rest.onKeyDown, handleKeyDown)
      },
      renderedChildren,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("tree", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

TreeRoot.displayName = "ChipsTree.Root";

const TreeItemBase = React.forwardRef((props, ref) => {
  const {
    as: Element = "div",
    children,
    id,
    label,
    textValue,
    disabled = false,
    level,
    parentId,
    posInSet,
    setSize,
    part = "item",
    hasChildren = false,
    controlsId,
    onClick,
    onMouseDown,
    style,
    ...rest
  } = props;
  const treeContext = useTreeCompoundContext(part);
  const parentContext = React.useContext(TreeItemCompoundContext);
  const generatedId = React.useId();
  const itemId = String(id ?? rest.id ?? generatedId);
  const itemLevel = typeof level === "number" ? level : (parentContext?.level ?? 0) + 1;
  const itemParentId = parentId === undefined ? parentContext?.id ?? null : parentId;
  const disabledByState = disabled || treeContext.disabled;
  const expanded = treeContext.expandedSet.has(itemId);
  const selected = treeContext.selectedId === itemId;
  const active = treeContext.activeId === itemId;
  const labelContent = children !== undefined && children !== null ? children : label;
  const labelText = isNonEmptyString(textValue) ? textValue.trim() : getTreeLabelText(labelContent, itemId);
  const localRef = React.useRef(null);
  const itemPart = part === "branch" || part === "leaf" || part === "item" ? part : getTreeItemPart({ part, hasChildren });
  const itemState = getTreeItemState(treeContext.state, { disabled: disabledByState });
  const itemStyle = {
    ...style,
    "--chips-tree-level": String(Math.max(1, itemLevel))
  };

  React.useEffect(
    () =>
      treeContext.registerItem({
        id: itemId,
        parentId: itemParentId,
        disabled: disabledByState,
        hasChildren,
        expanded,
        level: itemLevel,
        setSize,
        posInSet,
        part: itemPart,
        labelText,
        ref: localRef
      }),
    [
      disabledByState,
      expanded,
      hasChildren,
      itemId,
      itemLevel,
      itemParentId,
      itemPart,
      labelText,
      posInSet,
      setSize,
      treeContext.registerItem
    ]
  );

  const itemContextValue = React.useMemo(
    () => ({
      id: itemId,
      level: itemLevel,
      parentId: itemParentId,
      disabled: disabledByState,
      hasChildren,
      expanded,
      labelText,
      state: itemState
    }),
    [disabledByState, expanded, hasChildren, itemId, itemLevel, itemParentId, itemState, labelText]
  );

  return React.createElement(
    TreeItemCompoundContext.Provider,
    { value: itemContextValue },
    React.createElement(
      Element,
      {
        ...rest,
        ...createScopeAttributes("tree", itemPart, itemState),
        ref: mergeRefs(ref, localRef),
        id: rest.id || itemId,
        role: "treeitem",
        tabIndex: active && !disabledByState ? 0 : -1,
        "aria-level": itemLevel,
        "aria-setsize": setSize,
        "aria-posinset": posInSet,
        "aria-expanded": hasChildren ? String(expanded) : undefined,
        "aria-selected": String(selected),
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-controls": hasChildren && controlsId ? controlsId : undefined,
        "data-active": String(active),
        "data-selected": String(selected),
        "data-expanded": hasChildren ? String(expanded) : undefined,
        "data-level": String(itemLevel),
        style: itemStyle,
        onMouseDown: mergeEventHandlers(onMouseDown, () => {
          if (!disabledByState) {
            treeContext.setActiveId(itemId);
          }
        }),
        onClick: mergeEventHandlers(onClick, () => treeContext.selectItem(itemId))
      },
      React.createElement(
        "span",
        createScopeAttributes("tree", "label", itemState),
        labelContent
      )
    )
  );
});

TreeItemBase.displayName = "ChipsTree.ItemBase";

const TreeItem = React.forwardRef((props, ref) =>
  React.createElement(TreeItemBase, {
    ...props,
    ref,
    part: "item",
    hasChildren: false
  })
);

TreeItem.displayName = "ChipsTree.Item";

const TreeDisclosure = React.forwardRef((props, ref) => {
  const { children, onClick, ...rest } = props;
  const treeContext = useTreeCompoundContext("disclosure");
  const itemContext = useTreeItemCompoundContext("disclosure");
  const expanded = treeContext.expandedSet.has(itemContext.id);
  const disabledByState = itemContext.disabled || treeContext.disabled;
  const state = getTreeItemState(treeContext.state, { disabled: disabledByState });

  return React.createElement(
    "button",
    {
      ...rest,
      ...createScopeAttributes("tree", "disclosure", state),
      ref,
      type: "button",
      tabIndex: -1,
      disabled: disabledByState,
      "aria-label": rest["aria-label"] || itemContext.labelText,
      "aria-expanded": String(expanded),
      "aria-controls": rest["aria-controls"],
      "data-expanded": String(expanded),
      onClick: mergeEventHandlers(onClick, (event) => {
        event.stopPropagation();
        treeContext.updateExpanded(itemContext.id, !expanded);
      })
    },
    children !== undefined
      ? children
      : expanded
        ? resolveIconContent(treeContext.collapseIconContent, "collapse")
        : resolveIconContent(treeContext.expandIconContent, "expand")
  );
});

TreeDisclosure.displayName = "ChipsTree.Disclosure";

const TreeBranch = React.forwardRef((props, ref) => {
  const {
    children,
    id,
    label,
    textValue,
    groupId,
    as: Element = "div",
    disabled = false,
    level,
    parentId,
    posInSet,
    setSize,
    onClick,
    onMouseDown,
    style,
    ...rest
  } = props;
  const treeContext = useTreeCompoundContext("branch");
  const parentContext = React.useContext(TreeItemCompoundContext);
  const generatedId = React.useId();
  const itemId = String(id ?? rest.id ?? generatedId);
  const itemLevel = typeof level === "number" ? level : (parentContext?.level ?? 0) + 1;
  const itemParentId = parentId === undefined ? parentContext?.id ?? null : parentId;
  const normalizedItemId = normalizeDomIdSegment(itemId, "branch");
  const resolvedGroupId = groupId || `${normalizedItemId}-group`;
  const expanded = treeContext.expandedSet.has(itemId);
  const selected = treeContext.selectedId === itemId;
  const active = treeContext.activeId === itemId;
  const childArray = React.Children.toArray(children);
  const disclosure = childArray.find((child) => React.isValidElement(child) && child.type === TreeDisclosure);
  const groupChildren = childArray.filter((child) => !(React.isValidElement(child) && child.type === TreeDisclosure));
  const labelContent = label !== undefined && label !== null ? label : itemId;
  const labelText = isNonEmptyString(textValue) ? textValue.trim() : getTreeLabelText(labelContent, itemId);
  const disabledByState = disabled || treeContext.disabled;
  const branchState = getTreeItemState(treeContext.state, { disabled: disabledByState });
  const localRef = React.useRef(null);
  const itemStyle = {
    ...style,
    "--chips-tree-level": String(Math.max(1, itemLevel))
  };

  React.useEffect(
    () =>
      treeContext.registerItem({
        id: itemId,
        parentId: itemParentId,
        disabled: disabledByState,
        hasChildren: true,
        expanded,
        level: itemLevel,
        setSize,
        posInSet,
        part: "branch",
        labelText,
        ref: localRef
      }),
    [
      disabledByState,
      expanded,
      itemId,
      itemLevel,
      itemParentId,
      labelText,
      posInSet,
      setSize,
      treeContext.registerItem
    ]
  );

  return React.createElement(
    TreeItemCompoundContext.Provider,
    {
      value: {
        id: itemId,
        level: itemLevel,
        parentId: itemParentId,
        disabled: disabledByState,
        hasChildren: true,
        expanded,
        labelText,
        state: branchState
      }
    },
    React.createElement(
      Element,
      {
        ...rest,
        ...createScopeAttributes("tree", "branch", branchState),
        ref: mergeRefs(ref, localRef),
        id: rest.id || itemId,
        role: "treeitem",
        tabIndex: active && !disabledByState ? 0 : -1,
        "aria-level": itemLevel,
        "aria-setsize": setSize,
        "aria-posinset": posInSet,
        "aria-expanded": String(expanded),
        "aria-selected": String(selected),
        "aria-disabled": disabledByState ? "true" : undefined,
        "aria-controls": resolvedGroupId,
        "data-active": String(active),
        "data-selected": String(selected),
        "data-expanded": String(expanded),
        "data-level": String(itemLevel),
        style: itemStyle,
        onMouseDown: mergeEventHandlers(onMouseDown, () => {
          if (!disabledByState) {
            treeContext.setActiveId(itemId);
          }
        }),
        onClick: mergeEventHandlers(onClick, () => treeContext.selectItem(itemId))
      },
      React.createElement(
        "span",
        createScopeAttributes("tree", "label", branchState),
        disclosure || React.createElement(TreeDisclosure, {
          "aria-controls": resolvedGroupId
        }),
        labelContent
      ),
      expanded && groupChildren.length > 0
        ? React.createElement(
            "div",
            {
              ...createScopeAttributes("tree", "group", branchState),
              id: resolvedGroupId,
              role: "group",
              "data-level": String(itemLevel + 1)
            },
            groupChildren
          )
        : null
    )
  );
});

TreeBranch.displayName = "ChipsTree.Branch";

const TreeLeaf = React.forwardRef((props, ref) => {
  const { children, label, textValue, ...rest } = props;
  return React.createElement(TreeItemBase, {
    ...rest,
    ref,
    label: label !== undefined && label !== null ? label : children,
    textValue,
    part: "leaf",
    hasChildren: false
  });
});

TreeLeaf.displayName = "ChipsTree.Leaf";

export const ChipsTree = Object.assign(TreeRoot, {
  Root: TreeRoot,
  Item: TreeItem,
  Branch: TreeBranch,
  Leaf: TreeLeaf,
  Disclosure: TreeDisclosure
});

ChipsTree.displayName = "ChipsTree";

export const ChipsDateTime = React.forwardRef((props, ref) => {
  const {
    id,
    label,
    ariaLabel,
    value,
    defaultValue = "",
    min,
    max,
    step,
    disabled = false,
    loading = false,
    error = null,
    readOnly = false,
    iconContent,
    onValueChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue,
    onChange: onValueChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const inputId = id || React.useId();

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("date-time", "root", state),
      ...handlers,
      ref,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    label
      ? React.createElement(
          "label",
          {
            ...createScopeAttributes("date-time", "icon", state),
            htmlFor: inputId
          },
          label
        )
      : null,
    React.createElement("input", {
      ...createScopeAttributes("date-time", "input", state),
      id: inputId,
      type: "datetime-local",
      value: currentValue,
      min,
      max,
      step,
      disabled: disabledByState,
      readOnly,
      "aria-label": ariaLabel,
      "aria-invalid": normalizedError ? "true" : undefined,
      onFocus: handlers.onFocus,
      onBlur: handlers.onBlur,
      onChange: (event) => setCurrentValue(event.target.value)
    }),
    React.createElement(
      "span",
      {
        ...createScopeAttributes("date-time", "icon", state),
        "aria-hidden": "true"
      },
      resolveIconContent(iconContent, "calendar")
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("date-time", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsDateTime.displayName = "ChipsDateTime";

const [CommandPaletteCompoundContext, useCommandPaletteCompoundContext] = createCompoundContext("command-palette");
const EMPTY_COMMAND_PALETTE_ITEM = Object.freeze({});

function normalizeCommandPaletteItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      ...item,
      id:
        typeof item.id === "string" || typeof item.id === "number"
          ? String(item.id)
          : String(index),
      disabled: item.disabled === true
    }));
}

function resolveCommandPaletteItemLabel(item) {
  if (item?.label !== undefined && item.label !== null) {
    return item.label;
  }
  if (item?.title !== undefined && item.title !== null) {
    return item.title;
  }
  return item?.id ?? item?.commandId ?? "";
}

function resolveCommandPaletteTextValue(item) {
  const label = resolveCommandPaletteItemLabel(item);
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  if (typeof item?.commandId === "string") {
    return item.commandId;
  }
  return String(item?.id ?? "");
}

function sortRegisteredCommandPaletteItems(items) {
  return [...items].sort((left, right) => {
    const leftNode = left.ref?.current;
    const rightNode = right.ref?.current;
    if (leftNode && rightNode && leftNode !== rightNode && typeof leftNode.compareDocumentPosition === "function") {
      const position = leftNode.compareDocumentPosition(rightNode);
      if ((position & 4) !== 0) {
        return -1;
      }
      if ((position & 2) !== 0) {
        return 1;
      }
    }
    return left.order - right.order;
  });
}

function getFirstCommandPaletteItemId(items) {
  const firstIndex = getFirstEnabledIndex(items);
  return firstIndex >= 0 ? items[firstIndex]?.id ?? null : null;
}

function renderCommandPaletteDataItems(items) {
  return items.map((item) =>
    React.createElement(CommandPaletteItem, {
      key: item.id,
      item,
      id: item.id,
      disabled: item.disabled
    })
  );
}

const CommandPaletteRoot = React.forwardRef((props, ref) => {
  const context = useChipsCommandContext();
  const {
    children,
    open,
    defaultOpen = true,
    query,
    defaultQuery = "",
    items = [],
    commands = context?.commands,
    adapter,
    i18n = context?.i18n,
    commandQuery,
    payload,
    invocationContext,
    disabled = false,
    loading = false,
    error = null,
    inputPlaceholder = "",
    ariaLabel,
    listId: listIdProp,
    role,
    onOpenChange,
    onQueryChange,
    onSelect,
    onStateChange,
    ...rest
  } = props;

  const { commands: commandSource, loading: commandLoading, error: commandError } = useChipsCommands({
    adapter: resolveCommandAdapter({ adapter }, context),
    commands,
    query: {
      source: "palette",
      ...commandQuery
    }
  });
  const commandAdapter = resolveCommandAdapter({ adapter }, context);
  const hasCommandSource = Array.isArray(commands) || !!commandAdapter;
  const sourceItems = hasCommandSource
    ? resolveCommandPaletteItems(commandSource, { i18n })
    : items;
  const normalizedError = normalizeError(error || commandError);
  const disabledByState = disabled || loading || commandLoading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const registryRef = React.useRef(new Map());
  const registryOrderRef = React.useRef(0);
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const [currentQuery, setCurrentQuery] = useControllableState({
    value: query,
    defaultValue: defaultQuery,
    onChange: onQueryChange
  });

  const filteredItems = React.useMemo(
    () => normalizeCommandPaletteItems(filterCommandPaletteItems(sourceItems, currentQuery)),
    [sourceItems, currentQuery]
  );

  const hasCustomChildren = children !== undefined && children !== null;
  const registeredItems = React.useMemo(
    () => sortRegisteredCommandPaletteItems([...registryRef.current.values()]),
    [registryVersion]
  );
  const activeItems = hasCustomChildren ? registeredItems : filteredItems;

  const [highlightedId, setHighlightedId] = React.useState(
    () => getFirstCommandPaletteItemId(activeItems)
  );

  React.useEffect(() => {
    const exists = activeItems.some((item) => item.id === highlightedId && item.disabled !== true);
    if (!exists) {
      setHighlightedId(getFirstCommandPaletteItemId(activeItems));
    }
  }, [activeItems, highlightedId]);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loading || commandLoading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const generatedListId = React.useId();
  const listId = listIdProp || `${generatedListId}-list`;
  const highlightedItem = activeItems.find((item) => item.id === highlightedId) || null;
  const activeDescendantId = highlightedItem
    ? highlightedItem.elementId || `${listId}-item-${normalizeDomIdSegment(highlightedItem.id)}`
    : undefined;

  const registerItem = React.useCallback((item) => {
    const id = String(item.id);
    const previous = registryRef.current.get(id);
    const order = previous?.order ?? registryOrderRef.current;
    if (!previous) {
      registryOrderRef.current += 1;
    }
    registryRef.current.set(id, {
      ...item,
      id,
      order
    });
    setRegistryVersion((version) => version + 1);

    return () => {
      registryRef.current.delete(id);
      setRegistryVersion((version) => version + 1);
    };
  }, []);

  const selectItem = React.useCallback((item) => {
    if (!item || item.disabled || disabledByState) {
      return;
    }
    if (typeof onSelect === "function") {
      onSelect(item);
    }
    if (item.command && !item.disabled) {
      invokeCommand(commandAdapter, item.command, "palette", payload, invocationContext);
    }
    setCurrentOpen(false);
  }, [commandAdapter, disabledByState, invocationContext, onSelect, payload, setCurrentOpen]);

  const selectItemById = React.useCallback((itemId) => {
    const item = activeItems.find((candidate) => candidate.id === String(itemId));
    selectItem(item);
  }, [activeItems, selectItem]);

  const setHighlightedItemByIndex = React.useCallback((index) => {
    const item = activeItems[index];
    setHighlightedId(item?.id ?? null);
  }, [activeItems]);

  const moveHighlight = React.useCallback((direction) => {
    const currentIndex = activeItems.findIndex((item) => item.id === highlightedId);
    const nextIndex = getNextEnabledIndex(activeItems, currentIndex, direction, true);
    setHighlightedItemByIndex(nextIndex);
  }, [activeItems, highlightedId, setHighlightedItemByIndex]);

  const handleSearchKeyDown = React.useCallback((event) => {
    if (!currentOpen || activeItems.length === 0) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setCurrentOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight("next");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight("prev");
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setHighlightedId(getFirstCommandPaletteItemId(activeItems));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = getNextEnabledIndex(activeItems, 0, "prev", true);
      setHighlightedItemByIndex(last);
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      selectItem(highlightedItem);
    }
  }, [
    activeItems,
    currentOpen,
    highlightedItem,
    moveHighlight,
    selectItem,
    setCurrentOpen,
    setHighlightedItemByIndex
  ]);

  const contextValue = React.useMemo(
    () => ({
      state,
      open: Boolean(currentOpen),
      disabled: disabledByState,
      query: currentQuery,
      listId,
      activeDescendantId,
      highlightedId,
      setOpen: setCurrentOpen,
      setQuery: setCurrentQuery,
      setHighlightedId,
      registerItem,
      selectItem,
      selectItemById,
      handleInputKeyDown: handleSearchKeyDown,
      ariaLabel,
      inputPlaceholder
    }),
    [
      activeDescendantId,
      ariaLabel,
      currentOpen,
      currentQuery,
      disabledByState,
      highlightedId,
      handleSearchKeyDown,
      inputPlaceholder,
      listId,
      registerItem,
      selectItem,
      selectItemById,
      setCurrentOpen,
      setCurrentQuery,
      state
    ]
  );

  const renderedChildren = hasCustomChildren
    ? children
    : React.createElement(
        React.Fragment,
        null,
        React.createElement(CommandPaletteInput, {
          placeholder: inputPlaceholder,
          "aria-label": ariaLabel
        }),
        React.createElement(
          CommandPaletteList,
          null,
          renderCommandPaletteDataItems(filteredItems)
        )
      );

  return React.createElement(
    CommandPaletteCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("command-palette", "root", state),
        ...handlers,
        ref,
        role: role || "group",
        "aria-label": rest["aria-label"] || ariaLabel,
        "data-open": String(Boolean(currentOpen)),
        "aria-disabled": disabledByState ? "true" : undefined
      },
      currentOpen ? renderedChildren : null,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("command-palette", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

CommandPaletteRoot.displayName = "ChipsCommandPalette.Root";

const CommandPaletteInput = React.forwardRef((props, ref) => {
  const { onChange, onKeyDown, placeholder, ...rest } = props;
  const context = useCommandPaletteCompoundContext("input");

  return React.createElement("input", {
    ...rest,
    ...createScopeAttributes("command-palette", "input", context.state),
    ref,
    role: "combobox",
    value: context.query,
    placeholder: placeholder ?? context.inputPlaceholder,
    "aria-label": rest["aria-label"] || context.ariaLabel,
    "aria-controls": rest["aria-controls"] || context.listId,
    "aria-expanded": String(context.open),
    "aria-activedescendant": context.activeDescendantId,
    disabled: context.disabled || rest.disabled === true,
    onChange: mergeEventHandlers(onChange, (event) => context.setQuery(event.target.value)),
    onKeyDown: mergeEventHandlers(onKeyDown, context.handleInputKeyDown)
  });
});

CommandPaletteInput.displayName = "ChipsCommandPalette.Input";

const CommandPaletteList = React.forwardRef((props, ref) => {
  const { children, ...rest } = props;
  const context = useCommandPaletteCompoundContext("list");

  return React.createElement(
    "ul",
    {
      ...rest,
      ...createScopeAttributes("command-palette", "list", context.state),
      ref,
      id: rest.id || context.listId,
      role: rest.role || "listbox"
    },
    children
  );
});

CommandPaletteList.displayName = "ChipsCommandPalette.List";

const CommandPaletteGroup = React.forwardRef((props, ref) => {
  const { children, label, labelId, ...rest } = props;
  const context = useCommandPaletteCompoundContext("group");
  const generatedId = React.useId();
  const groupLabelId = labelId || (label !== undefined ? `${rest.id || generatedId}-label` : undefined);

  return React.createElement(
    "li",
    {
      ...rest,
      ...createScopeAttributes("command-palette", "group", context.state),
      ref,
      role: rest.role || "group",
      "aria-labelledby": rest["aria-labelledby"] || groupLabelId
    },
    label !== undefined
      ? React.createElement(
          "div",
          {
            ...createScopeAttributes("command-palette", "group-label", context.state),
            id: groupLabelId
          },
          label
        )
      : null,
    React.createElement("ul", { role: "presentation" }, children)
  );
});

CommandPaletteGroup.displayName = "ChipsCommandPalette.Group";

const CommandPaletteItem = React.forwardRef((props, ref) => {
  const {
    children,
    item,
    id,
    label,
    shortcut,
    disabled = false,
    textValue,
    onMouseEnter,
    onMouseDown,
    ...rest
  } = props;
  const context = useCommandPaletteCompoundContext("item");
  const generatedId = React.useId();
  const paletteItem = item && typeof item === "object" ? item : EMPTY_COMMAND_PALETTE_ITEM;
  const itemId = String(id ?? paletteItem.id ?? generatedId);
  const elementId = rest.id || `${context.listId}-item-${normalizeDomIdSegment(itemId)}`;
  const disabledByState = context.disabled || disabled || paletteItem.disabled === true;
  const highlighted = context.highlightedId === itemId;
  const itemState = disabledByState
    ? "disabled"
    : highlighted
      ? "active"
      : context.state === "disabled" || context.state === "loading" || context.state === "error"
        ? context.state
        : "idle";
  const labelContent = children !== undefined && children !== null
    ? children
    : label ?? resolveCommandPaletteItemLabel(paletteItem);
  const shortcutContent = shortcut ?? paletteItem.shortcut;
  const itemRecord = React.useMemo(
    () => ({
      ...paletteItem,
      id: itemId,
      label: labelContent,
      shortcut: shortcutContent,
      disabled: disabledByState
    }),
    [disabledByState, itemId, labelContent, paletteItem, shortcutContent]
  );
  const localRef = React.useRef(null);

  React.useEffect(
    () =>
      context.registerItem({
        ...itemRecord,
        id: itemId,
        elementId,
        textValue: textValue || resolveCommandPaletteTextValue(itemRecord),
        ref: localRef
      }),
    [context.registerItem, elementId, itemId, itemRecord, textValue]
  );

  return React.createElement(
    "li",
    {
      ...rest,
      ...createScopeAttributes("command-palette", "item", itemState),
      ref: mergeRefs(ref, localRef),
      id: elementId,
      role: rest.role || "option",
      "aria-selected": String(highlighted),
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-highlighted": String(highlighted),
      onMouseEnter: mergeEventHandlers(onMouseEnter, () => {
        if (!disabledByState) {
          context.setHighlightedId(itemId);
        }
      }),
      onMouseDown: mergeEventHandlers(onMouseDown, (event) => {
        event.preventDefault();
        context.selectItem(itemRecord);
      })
    },
    labelContent,
    shortcutContent
      ? React.createElement(
          "span",
          createScopeAttributes("command-palette", "shortcut", itemState),
          shortcutContent
        )
      : null
  );
});

CommandPaletteItem.displayName = "ChipsCommandPalette.Item";

export const ChipsCommandPalette = Object.assign(CommandPaletteRoot, {
  Root: CommandPaletteRoot,
  Input: CommandPaletteInput,
  List: CommandPaletteList,
  Item: CommandPaletteItem,
  Group: CommandPaletteGroup
});

ChipsCommandPalette.displayName = "ChipsCommandPalette";

const [NavigationSplitViewCompoundContext, useNavigationSplitViewCompoundContext] = createCompoundContext("navigation-split-view");

function getNavigationSplitViewChildPart(child) {
  if (!React.isValidElement(child)) {
    return null;
  }
  if (child.type === NavigationSplitViewSidebar) {
    return "sidebar";
  }
  if (child.type === NavigationSplitViewContent) {
    return "content";
  }
  if (child.type === NavigationSplitViewDetail) {
    return "detail";
  }
  return null;
}

function renderNavigationSplitViewDivider(state, key) {
  return React.createElement("div", {
    key,
    ...createScopeAttributes("navigation-split-view", "divider", state),
    "aria-hidden": "true"
  });
}

function flattenNavigationSplitViewChildren(children) {
  const flattened = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      flattened.push(...flattenNavigationSplitViewChildren(child.props.children));
      return;
    }
    flattened.push(child);
  });
  return flattened;
}

function renderNavigationSplitViewChildren(children, state) {
  const childArray = flattenNavigationSplitViewChildren(children);
  const rendered = [];
  let previousPart = null;

  for (const child of childArray) {
    const part = getNavigationSplitViewChildPart(child);
    if (previousPart && part && previousPart !== part) {
      rendered.push(renderNavigationSplitViewDivider(state, `divider-${previousPart}-${part}-${rendered.length}`));
    }
    rendered.push(child);
    if (part) {
      previousPart = part;
    }
  }

  return rendered;
}

const NavigationSplitViewRoot = React.forwardRef((props, ref) => {
  const {
    children,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    ariaLabel,
    ariaLabelledBy,
    role,
    onStateChange,
    onFocus,
    onBlur,
    ...rest
  } = props;
  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction: active ? { active: true } : null
  });
  const resolvedAriaLabel = rest["aria-label"] || ariaLabel;
  const resolvedAriaLabelledBy = rest["aria-labelledby"] || ariaLabelledBy;
  const renderedChildren = renderNavigationSplitViewChildren(children, state);
  const contextValue = {
    state,
    disabled: disabledByState
  };

  return React.createElement(
    NavigationSplitViewCompoundContext.Provider,
    { value: contextValue },
    React.createElement(
      "div",
      {
        ...rest,
        ...createScopeAttributes("navigation-split-view", "root", state),
        ref,
        role: role || "group",
        "aria-label": resolvedAriaLabel,
        "aria-labelledby": resolvedAriaLabelledBy,
        "aria-disabled": disabledByState ? "true" : undefined,
        onFocus: mergeEventHandlers(onFocus, () => {
          if (typeof onStateChange === "function") {
            onStateChange("focus");
          }
        }),
        onBlur: mergeEventHandlers(onBlur, () => {
          if (typeof onStateChange === "function") {
            onStateChange(state);
          }
        })
      },
      renderedChildren,
      normalizedError
        ? React.createElement(
            "span",
            {
              ...createScopeAttributes("navigation-split-view", "status", state),
              ...createAriaStatusProps({ live: "assertive" })
            },
            normalizedError.message
          )
        : null
    )
  );
});

NavigationSplitViewRoot.displayName = "ChipsNavigationSplitView.Root";

function renderNavigationSplitViewRegion(part, defaultElement, defaultRole, props, ref) {
  const {
    as,
    children,
    ariaLabel,
    ariaLabelledBy,
    role,
    ...rest
  } = props;
  const context = useNavigationSplitViewCompoundContext(part);
  const Element = as || defaultElement;
  const resolvedAriaLabel = rest["aria-label"] || ariaLabel;
  const resolvedAriaLabelledBy = rest["aria-labelledby"] || ariaLabelledBy;

  return React.createElement(
    Element,
    {
      ...rest,
      ...createScopeAttributes("navigation-split-view", part, context.state),
      ref,
      role: role || defaultRole,
      "aria-label": resolvedAriaLabel,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": context.disabled ? "true" : undefined
    },
    children
  );
}

const NavigationSplitViewSidebar = React.forwardRef((props, ref) =>
  renderNavigationSplitViewRegion("sidebar", "nav", "navigation", props, ref)
);

NavigationSplitViewSidebar.displayName = "ChipsNavigationSplitView.Sidebar";

const NavigationSplitViewContent = React.forwardRef((props, ref) =>
  renderNavigationSplitViewRegion("content", "section", "region", props, ref)
);

NavigationSplitViewContent.displayName = "ChipsNavigationSplitView.Content";

const NavigationSplitViewDetail = React.forwardRef((props, ref) =>
  renderNavigationSplitViewRegion("detail", "section", "region", props, ref)
);

NavigationSplitViewDetail.displayName = "ChipsNavigationSplitView.Detail";

export const ChipsNavigationSplitView = Object.assign(NavigationSplitViewRoot, {
  Root: NavigationSplitViewRoot,
  Sidebar: NavigationSplitViewSidebar,
  Content: NavigationSplitViewContent,
  Detail: NavigationSplitViewDetail
});

ChipsNavigationSplitView.displayName = "ChipsNavigationSplitView";

export const ChipsSplitPane = React.forwardRef((props, ref) => {
  const {
    orientation = "horizontal",
    ratio,
    defaultRatio = 0.5,
    minRatio = 0.1,
    maxRatio = 0.9,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    start,
    end,
    onRatioChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentRatio, setCurrentRatio] = useControllableState({
    value: ratio,
    defaultValue: defaultRatio,
    onChange: onRatioChange
  });

  const resolvedRatio = clampSplitRatio(currentRatio, minRatio, maxRatio);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const updateRatio = (nextRatio) => {
    if (disabledByState) {
      return;
    }
    setCurrentRatio(clampSplitRatio(nextRatio, minRatio, maxRatio));
  };

  const handleResizerMouseDown = (event) => {
    if (disabledByState) {
      return;
    }

    const container = event.currentTarget.parentElement;
    if (!container || typeof container.getBoundingClientRect !== "function") {
      return;
    }

    const rect = container.getBoundingClientRect();
    const horizontal = orientation !== "vertical";

    const move = (moveEvent) => {
      const nextRatio = horizontal
        ? (moveEvent.clientX - rect.left) / Math.max(rect.width, 1)
        : (moveEvent.clientY - rect.top) / Math.max(rect.height, 1);
      updateRatio(nextRatio);
    };

    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const handleResizerKeyDown = (event) => {
    if (disabledByState) {
      return;
    }

    const horizontal = orientation !== "vertical";
    const decreaseKey = horizontal ? "ArrowLeft" : "ArrowUp";
    const increaseKey = horizontal ? "ArrowRight" : "ArrowDown";

    if (event.key === decreaseKey) {
      event.preventDefault();
      updateRatio(resolvedRatio - 0.05);
      return;
    }

    if (event.key === increaseKey) {
      event.preventDefault();
      updateRatio(resolvedRatio + 0.05);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      updateRatio(minRatio);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      updateRatio(maxRatio);
    }
  };

  const horizontal = orientation !== "vertical";
  const startStyle = horizontal
    ? { width: `${resolvedRatio * 100}%` }
    : { height: `${resolvedRatio * 100}%` };
  const endStyle = horizontal
    ? { width: `${(1 - resolvedRatio) * 100}%` }
    : { height: `${(1 - resolvedRatio) * 100}%` };

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("split-pane", "root", state),
      ...handlers,
      ref,
      role: "group",
      "aria-label": ariaLabel,
      "aria-orientation": orientation,
      "aria-disabled": disabledByState ? "true" : undefined,
      style: {
        display: "flex",
        flexDirection: horizontal ? "row" : "column"
      }
    },
    React.createElement(
      "div",
      {
        ...createScopeAttributes("split-pane", "pane-start", state),
        style: {
          ...startStyle,
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0
        }
      },
      start
    ),
    React.createElement("button", {
      ...createScopeAttributes("split-pane", "resizer", state),
      type: "button",
      role: "separator",
      tabIndex: 0,
      "aria-label": ariaLabel,
      "aria-valuemin": String(Math.round(minRatio * 100)),
      "aria-valuemax": String(Math.round(maxRatio * 100)),
      "aria-valuenow": String(Math.round(resolvedRatio * 100)),
      "aria-orientation": orientation,
      onMouseDown: handleResizerMouseDown,
      onKeyDown: handleResizerKeyDown
    }),
    React.createElement(
      "div",
      {
        ...createScopeAttributes("split-pane", "pane-end", state),
        style: {
          ...endStyle,
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0
        }
      },
      end
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("split-pane", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSplitPane.displayName = "ChipsSplitPane";

export const ChipsDockPanel = React.forwardRef((props, ref) => {
  const {
    panels = [],
    panelStates,
    defaultPanelStates = {},
    activePanelId,
    defaultActivePanelId,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    onPanelStatesChange,
    onActivePanelIdChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentPanelStates, setCurrentPanelStates] = useControllableState({
    value: panelStates,
    defaultValue: defaultPanelStates,
    onChange: onPanelStatesChange
  });
  const [currentActivePanelId, setCurrentActivePanelId] = useControllableState({
    value: activePanelId,
    defaultValue: defaultActivePanelId,
    onChange: onActivePanelIdChange
  });

  const normalizedPanels = React.useMemo(
    () =>
      (Array.isArray(panels) ? panels : [])
        .filter((panel) => panel && typeof panel.id === "string")
        .map((panel) => ({
          ...panel,
          title: typeof panel.title === "string" ? panel.title : panel.id
        })),
    [panels]
  );

  const normalizedStateMap = React.useMemo(
    () => resolveDockPanelStateMap(normalizedPanels, currentPanelStates),
    [normalizedPanels, currentPanelStates]
  );

  React.useEffect(() => {
    if (normalizedPanels.length === 0) {
      return;
    }

    if (
      !currentActivePanelId ||
      !normalizedPanels.some((panel) => panel.id === currentActivePanelId)
    ) {
      const firstActive = normalizedPanels.find(
        (panel) => normalizedStateMap[panel.id] !== "hidden"
      );
      if (firstActive) {
        setCurrentActivePanelId(firstActive.id);
      }
    }
  }, [currentActivePanelId, normalizedPanels, normalizedStateMap, setCurrentActivePanelId]);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const updatePanelState = (panelId, panelState) => {
    if (disabledByState) {
      return;
    }
    const next = { ...normalizedStateMap, [panelId]: panelState };
    setCurrentPanelStates(next);
    if (panelState === "active") {
      setCurrentActivePanelId(panelId);
    }
  };

  const visiblePanels = normalizedPanels.filter(
    (panel) => normalizedStateMap[panel.id] !== "hidden"
  );
  const activePanel =
    visiblePanels.find((panel) => panel.id === currentActivePanelId) || visiblePanels[0];

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("dock-panel", "root", state),
      ...handlers,
      ref,
      role: "group",
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "div",
      {
        ...createScopeAttributes("dock-panel", "tab-list", state),
        role: "tablist",
        "aria-label": ariaLabel
      },
      normalizedPanels.map((panel) => {
        const panelState = normalizedStateMap[panel.id];
        const selected = activePanel && activePanel.id === panel.id && panelState !== "hidden";
        const panelId = `dock-panel-${panel.id}`;

        return React.createElement(
          "button",
          {
            ...createScopeAttributes("dock-panel", "tab", state),
            key: panel.id,
            id: `${panelId}-tab`,
            type: "button",
            role: "tab",
            tabIndex: selected ? 0 : -1,
            "aria-selected": String(Boolean(selected)),
            "aria-controls": panelId,
            "data-panel-state": panelState,
            disabled: disabledByState,
            onClick: () => updatePanelState(panel.id, "active")
          },
          panel.title
        );
      })
    ),
    activePanel
      ? React.createElement(
          "section",
          {
            ...createScopeAttributes("dock-panel", "content", state),
            id: `dock-panel-${activePanel.id}`,
            role: "tabpanel",
            "aria-labelledby": `dock-panel-${activePanel.id}-tab`
          },
          activePanel.content
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("dock-panel", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsDockPanel.displayName = "ChipsDockPanel";

export const ChipsInspector = React.forwardRef((props, ref) => {
  const {
    sections = [],
    openSectionIds,
    defaultOpenSectionIds = [],
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    onOpenSectionIdsChange,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentOpenSectionIds, setCurrentOpenSectionIds] = useControllableState({
    value: openSectionIds,
    defaultValue: defaultOpenSectionIds,
    onChange: onOpenSectionIdsChange
  });
  const [activeIndex, setActiveIndex] = React.useState(0);

  const normalizedSections = React.useMemo(
    () =>
      (Array.isArray(sections) ? sections : [])
        .filter((section) => section && typeof section.id === "string")
        .map((section) => ({
          ...section,
          title: typeof section.title === "string" ? section.title : section.id
        })),
    [sections]
  );

  React.useEffect(() => {
    if (activeIndex >= normalizedSections.length) {
      setActiveIndex(Math.max(0, normalizedSections.length - 1));
    }
  }, [activeIndex, normalizedSections.length]);

  const openSet = React.useMemo(
    () => new Set((Array.isArray(currentOpenSectionIds) ? currentOpenSectionIds : []).map((id) => String(id))),
    [currentOpenSectionIds]
  );

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const toggleSection = (sectionId) => {
    if (disabledByState) {
      return;
    }
    setCurrentOpenSectionIds(toggleInspectorSection(currentOpenSectionIds, sectionId));
  };

  const handleRootKeyDown = (event) => {
    if (disabledByState || normalizedSections.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(normalizedSections.length - 1, index + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(normalizedSections.length - 1);
      return;
    }

    if (isKeyboardActivationKey(event.key)) {
      event.preventDefault();
      const section = normalizedSections[activeIndex];
      if (section) {
        toggleSection(section.id);
      }
    }
  };

  return React.createElement(
    "aside",
    {
      ...createScopeAttributes("inspector", "root", state),
      ...handlers,
      ref,
      role: "complementary",
      tabIndex: 0,
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined,
      onKeyDown: handleRootKeyDown
    },
    normalizedSections.map((section, index) => {
      const opened = openSet.has(section.id);
      const sectionId = `inspector-section-${section.id}`;
      const headerId = `${sectionId}-header`;
      return React.createElement(
        "section",
        {
          ...createScopeAttributes("inspector", "section", state),
          key: section.id,
          id: sectionId
        },
        React.createElement(
          "button",
          {
            ...createScopeAttributes("inspector", "header", state),
            id: headerId,
            type: "button",
            tabIndex: index === activeIndex ? 0 : -1,
            "aria-expanded": String(opened),
            "aria-controls": `${sectionId}-body`,
            onClick: () => toggleSection(section.id)
          },
          section.title
        ),
        opened
          ? React.createElement(
              "div",
              {
                ...createScopeAttributes("inspector", "body", state),
                id: `${sectionId}-body`,
                role: "region",
                "aria-labelledby": headerId
              },
              section.content
            )
          : null
      );
    }),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("inspector", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsInspector.displayName = "ChipsInspector";

export const ChipsPanelHeader = React.forwardRef((props, ref) => {
  const {
    title,
    subtitle,
    actions,
    collapsed,
    defaultCollapsed = false,
    collapsible = false,
    closable = false,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    expandIconContent,
    collapseIconContent,
    closeIconContent,
    onCollapsedChange,
    onClose,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentCollapsed, setCurrentCollapsed] = useControllableState({
    value: collapsed,
    defaultValue: defaultCollapsed === true,
    onChange: onCollapsedChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  return React.createElement(
    "header",
    {
      ...createScopeAttributes("panel-header", "root", state),
      ...handlers,
      ref,
      role: "group",
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "div",
      createScopeAttributes("panel-header", "title", state),
      title
    ),
    subtitle
      ? React.createElement(
          "div",
          createScopeAttributes("panel-header", "subtitle", state),
          subtitle
        )
      : null,
    React.createElement(
      "div",
      createScopeAttributes("panel-header", "actions", state),
      actions,
      collapsible
        ? React.createElement(
            "button",
            {
              ...createScopeAttributes("panel-header", "toggle", state),
              type: "button",
              "aria-label": ariaLabel,
              "aria-pressed": String(currentCollapsed),
              disabled: disabledByState,
              onClick: () => setCurrentCollapsed(!currentCollapsed)
            },
            currentCollapsed
              ? resolveIconContent(expandIconContent, "expand")
              : resolveIconContent(collapseIconContent, "collapse")
          )
        : null,
      closable
        ? React.createElement(
            "button",
            {
              ...createScopeAttributes("panel-header", "close", state),
              type: "button",
              "aria-label": ariaLabel,
              disabled: disabledByState,
              onClick: onClose
            },
            resolveIconContent(closeIconContent, "close")
          )
        : null
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("panel-header", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsPanelHeader.displayName = "ChipsPanelHeader";

export const ChipsCardShell = React.forwardRef((props, ref) => {
  const {
    title,
    toolbar,
    footer,
    children,
    active = false,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction: {
      ...interaction,
      active: interaction.active || active
    }
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  return React.createElement(
    "article",
    {
      ...createScopeAttributes("card-shell", "root", state),
      ...handlers,
      ref,
      role: "article",
      "aria-label": ariaLabel,
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-active": String(active)
    },
    React.createElement(
      "header",
      createScopeAttributes("card-shell", "header", state),
      title
    ),
    React.createElement(
      "div",
      createScopeAttributes("card-shell", "toolbar", state),
      toolbar
    ),
    React.createElement(
      "section",
      createScopeAttributes("card-shell", "content", state),
      children
    ),
    React.createElement(
      "footer",
      createScopeAttributes("card-shell", "footer", state),
      footer
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("card-shell", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsCardShell.displayName = "ChipsCardShell";

export const ChipsToolWindow = React.forwardRef((props, ref) => {
  const {
    title,
    open,
    defaultOpen = true,
    minimized,
    defaultMinimized = false,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    expandIconContent,
    collapseIconContent,
    closeIconContent,
    children,
    onOpenChange,
    onMinimizedChange,
    onFocus,
    onStateChange
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentOpen, setCurrentOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen === true,
    onChange: onOpenChange
  });
  const [currentMinimized, setCurrentMinimized] = useControllableState({
    value: minimized,
    defaultValue: defaultMinimized === true,
    onChange: onMinimizedChange
  });

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  if (!currentOpen) {
    return null;
  }

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("tool-window", "root", state),
      ...handlers,
      ref,
      role: "dialog",
      "aria-label": ariaLabel,
      "aria-modal": "false",
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-minimized": String(Boolean(currentMinimized)),
      onFocus: onFocus
    },
    React.createElement(
      "header",
      createScopeAttributes("tool-window", "header", state),
      title
    ),
    React.createElement(
      "div",
      createScopeAttributes("tool-window", "controls", state),
      React.createElement(
        "button",
        {
          ...createScopeAttributes("tool-window", "controls", state),
          type: "button",
          disabled: disabledByState,
          "aria-label": ariaLabel,
          onClick: () => setCurrentMinimized(!currentMinimized)
        },
        currentMinimized
          ? resolveIconContent(expandIconContent, "expand")
          : resolveIconContent(collapseIconContent, "collapse")
      ),
      React.createElement(
        "button",
        {
          ...createScopeAttributes("tool-window", "controls", state),
          type: "button",
          disabled: disabledByState,
          "aria-label": ariaLabel,
          onClick: () => setCurrentOpen(false)
        },
        resolveIconContent(closeIconContent, "close")
      )
    ),
    !currentMinimized
      ? React.createElement(
          "div",
          createScopeAttributes("tool-window", "body", state),
          children
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("tool-window", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsToolWindow.displayName = "ChipsToolWindow";

export const ChipsErrorBoundary = React.forwardRef((props, ref) => {
  const {
    children,
    fallback,
    resetKeys = [],
    error = null,
    disabled = false,
    loading = false,
    title,
    titleKey = "systemUx.errorBoundary.title",
    description,
    descriptionKey = "systemUx.errorBoundary.description",
    retryLabel,
    retryLabelKey = "systemUx.errorBoundary.retry",
    showErrorMessage = true,
    ariaLabel,
    i18n,
    traceId,
    onError,
    onRetry,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedInputError = normalizeError(error);
  const controlledError = normalizedInputError
    ? toStandardError(normalizedInputError, "SYSTEM_UX_ERROR_BOUNDARY_INPUT_ERROR")
    : null;
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [capturedError, setCapturedError] = React.useState(null);
  const [boundaryVersion, setBoundaryVersion] = React.useState(0);
  const effectiveError = capturedError || controlledError;

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: effectiveError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resetSignature = React.useMemo(
    () => JSON.stringify(Array.isArray(resetKeys) ? resetKeys : []),
    [resetKeys]
  );
  const previousResetSignatureRef = React.useRef(resetSignature);

  React.useEffect(() => {
    if (previousResetSignatureRef.current === resetSignature) {
      return;
    }
    previousResetSignatureRef.current = resetSignature;

    if (!capturedError) {
      return;
    }
    setCapturedError(null);
    setBoundaryVersion((prev) => prev + 1);
  }, [capturedError, resetSignature]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: "systemUx.errorBoundary.ariaLabel",
    fallback: ariaLabel || "[[systemUx.errorBoundary.ariaLabel]]",
    onDiagnostic
  });
  const resolvedTitle = resolveI18nText({
    i18n,
    key: titleKey,
    fallback: title || "[[systemUx.errorBoundary.title]]",
    onDiagnostic
  });
  const resolvedDescription = resolveI18nText({
    i18n,
    key: descriptionKey,
    fallback: description || "[[systemUx.errorBoundary.description]]",
    onDiagnostic
  });
  const resolvedRetryLabel = resolveI18nText({
    i18n,
    key: retryLabelKey,
    fallback: retryLabel || "[[systemUx.errorBoundary.retry]]",
    onDiagnostic
  });

  const handleRetry = () => {
    if (disabledByState) {
      return;
    }

    setCapturedError(null);
    setBoundaryVersion((prev) => prev + 1);

    if (typeof onRetry === "function") {
      onRetry(effectiveError);
    }

    if (typeof onDiagnostic === "function") {
      onDiagnostic(
        createObservationRecord({
          traceId,
          component: "error-boundary",
          action: "retry",
          error: effectiveError,
          durationMs: 0
        })
      );
    }
  };

  const handleCapturedError = (rawError, errorInfo) => {
    const startedAt = Date.now();
    const normalized = toStandardError(rawError, "SYSTEM_UX_ERROR_BOUNDARY_CAUGHT");
    setCapturedError(normalized);

    if (typeof onError === "function") {
      onError(normalized, errorInfo);
    }

    if (typeof onDiagnostic === "function") {
      onDiagnostic(
        createObservationRecord({
          traceId,
          component: "error-boundary",
          action: "capture",
          error: normalized,
          durationMs: Date.now() - startedAt
        })
      );
    }
  };

  const fallbackContent =
    typeof fallback === "function"
      ? fallback({
          error: effectiveError,
          retry: handleRetry,
          state,
          title: resolvedTitle,
          description: resolvedDescription,
          retryLabel: resolvedRetryLabel
        })
      : fallback;

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("error-boundary", "root", state),
      ...handlers,
      ref,
      role: effectiveError ? "alert" : "region",
      "aria-label": resolvedAriaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    effectiveError
      ? fallbackContent ||
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              "h2",
              createScopeAttributes("error-boundary", "title", state),
              resolvedTitle
            ),
            React.createElement(
              "p",
              createScopeAttributes("error-boundary", "description", state),
              resolvedDescription
            ),
            showErrorMessage
              ? React.createElement(
                  "p",
                  createScopeAttributes("error-boundary", "description", state),
                  effectiveError.message
                )
              : null,
            React.createElement(
              "button",
              {
                ...createScopeAttributes("error-boundary", "action", state),
                type: "button",
                disabled: disabledByState,
                onClick: handleRetry
              },
              resolvedRetryLabel
            )
          )
      : React.createElement(
          ChipsErrorBoundaryKernel,
          {
            key: String(boundaryVersion),
            onCapturedError: handleCapturedError
          },
          children
        ),
    effectiveError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("error-boundary", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          effectiveError.message
        )
      : null
  );
});

ChipsErrorBoundary.displayName = "ChipsErrorBoundary";

export const ChipsSkeleton = React.forwardRef((props, ref) => {
  const {
    lines = 3,
    animated = true,
    shape = "line",
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    ariaLabelKey = "systemUx.skeleton.ariaLabel",
    i18n,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const count = Number.isInteger(lines) && lines > 0 ? lines : 3;

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: ariaLabelKey,
    fallback: ariaLabel || "[[systemUx.skeleton.ariaLabel]]",
    onDiagnostic
  });

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("skeleton", "root", state),
      ...handlers,
      ref,
      role: "status",
      "aria-label": resolvedAriaLabel,
      "aria-busy": "true",
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-shape": shape,
      "data-animated": String(animated === true)
    },
    Array.from({ length: count }).map((_, index) =>
      React.createElement("span", {
        ...createScopeAttributes("skeleton", "item", state),
        key: `skeleton-item-${index}`,
        "aria-hidden": "true",
        "data-shape": shape
      })
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("skeleton", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsSkeleton.displayName = "ChipsSkeleton";

export const ChipsLoadingBoundary = React.forwardRef((props, ref) => {
  const {
    children,
    loading = false,
    delayMs,
    skeletonLines,
    fallback,
    disabled = false,
    error = null,
    ariaLabel,
    ariaLabelKey = "systemUx.loadingBoundary.ariaLabel",
    loadingText,
    loadingTextKey = "systemUx.loadingBoundary.status",
    i18n,
    configSource,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [visibleLoading, setVisibleLoading] = React.useState(false);

  const resolvedDelay = resolveConfigValue({
    configSource,
    key: "systemUx.loadingBoundary.delayMs",
    defaultValue: parsePositiveInteger(delayMs) || 120,
    parser: parsePositiveInteger,
    onDiagnostic
  });
  const resolvedSkeletonLines = resolveConfigValue({
    configSource,
    key: "systemUx.loadingBoundary.skeletonLines",
    defaultValue: parsePositiveInteger(skeletonLines) || 3,
    parser: parsePositiveInteger,
    onDiagnostic
  });

  React.useEffect(() => {
    if (!loading) {
      setVisibleLoading(false);
      return undefined;
    }

    if (resolvedDelay <= 0) {
      setVisibleLoading(true);
      return undefined;
    }

    const timer = setTimeout(() => {
      setVisibleLoading(true);
    }, resolvedDelay);

    return () => clearTimeout(timer);
  }, [loading, resolvedDelay]);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading: loading && visibleLoading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: ariaLabelKey,
    fallback: ariaLabel || "[[systemUx.loadingBoundary.ariaLabel]]",
    onDiagnostic
  });
  const resolvedLoadingText = resolveI18nText({
    i18n,
    key: loadingTextKey,
    fallback: loadingText || "[[systemUx.loadingBoundary.status]]",
    onDiagnostic
  });

  const fallbackContent =
    typeof fallback === "function"
      ? fallback({ state, loading: loading && visibleLoading })
      : fallback;

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("loading-boundary", "root", state),
      ...handlers,
      ref,
      role: "region",
      "aria-label": resolvedAriaLabel,
      "aria-busy": loading ? "true" : "false",
      "aria-disabled": disabledByState ? "true" : undefined
    },
    loading && visibleLoading
      ? React.createElement(
          "div",
          createScopeAttributes("loading-boundary", "fallback", state),
          fallbackContent ||
            React.createElement(ChipsSkeleton, {
              lines: resolvedSkeletonLines,
              loading: true,
              i18n,
              onDiagnostic
            })
        )
      : React.createElement(
          "div",
          createScopeAttributes("loading-boundary", "content", state),
          children
        ),
    loading
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("loading-boundary", "status", state),
            ...createAriaStatusProps({ live: "polite" })
          },
          resolvedLoadingText
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("loading-boundary", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsLoadingBoundary.displayName = "ChipsLoadingBoundary";

export const ChipsEmptyState = React.forwardRef((props, ref) => {
  const {
    icon,
    title,
    titleKey = "systemUx.emptyState.title",
    description,
    descriptionKey = "systemUx.emptyState.description",
    actionLabel,
    actionLabelKey = "systemUx.emptyState.action",
    children,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    i18n,
    onAction,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: "systemUx.emptyState.ariaLabel",
    fallback: ariaLabel || "[[systemUx.emptyState.ariaLabel]]",
    onDiagnostic
  });
  const resolvedTitle = resolveI18nText({
    i18n,
    key: titleKey,
    fallback: title || "[[systemUx.emptyState.title]]",
    onDiagnostic
  });
  const resolvedDescription = resolveI18nText({
    i18n,
    key: descriptionKey,
    fallback: description || "[[systemUx.emptyState.description]]",
    onDiagnostic
  });
  const resolvedActionLabel = resolveI18nText({
    i18n,
    key: actionLabelKey,
    fallback: actionLabel || "[[systemUx.emptyState.action]]",
    onDiagnostic
  });

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("empty-state", "root", state),
      ...handlers,
      ref,
      role: "region",
      "aria-label": resolvedAriaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    icon
      ? React.createElement(
          "div",
          createScopeAttributes("empty-state", "icon", state),
          icon
        )
      : null,
    React.createElement(
      "h2",
      createScopeAttributes("empty-state", "title", state),
      resolvedTitle
    ),
    React.createElement(
      "p",
      createScopeAttributes("empty-state", "description", state),
      resolvedDescription
    ),
    children
      ? React.createElement(
          "div",
          createScopeAttributes("empty-state", "description", state),
          children
        )
      : null,
    typeof onAction === "function"
      ? React.createElement(
          "button",
          {
            ...createScopeAttributes("empty-state", "action", state),
            type: "button",
            disabled: disabledByState,
            onClick: onAction
          },
          resolvedActionLabel
        )
      : null,
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("empty-state", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsEmptyState.displayName = "ChipsEmptyState";

export const ChipsErrorState = React.forwardRef((props, ref) => {
  const {
    error,
    code,
    message,
    details,
    title,
    titleKey = "systemUx.errorState.title",
    description,
    descriptionKey = "systemUx.errorState.description",
    actionLabel,
    actionLabelKey = "systemUx.errorState.action",
    fallbackTitle = "Something went wrong",
    fallbackDescription,
    fallbackActionLabel = "Try again",
    icon,
    children,
    disabled = false,
    loading = false,
    retryable,
    showDetails = false,
    ariaLabel,
    i18n,
    traceId,
    onAction,
    onStateChange,
    onDiagnostic,
    ...rest
  } = props;

  const inputError = error || {
    code: isNonEmptyString(code) ? code.trim() : "ERROR_STATE",
    message: isNonEmptyString(message) ? message.trim() : fallbackDescription || fallbackTitle,
    details
  };
  const model = resolveErrorStateModel({
    error: inputError,
    retryable,
    showDetails,
    disabled,
    loading
  });
  const disabledByState = disabled || loading;
  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: model.error
  });
  const resolvedTitle = resolveI18nText({
    i18n,
    key: titleKey,
    fallback: title || fallbackTitle,
    onDiagnostic
  });
  const resolvedDescription = resolveI18nText({
    i18n,
    key: descriptionKey,
    fallback: description || fallbackDescription || model.error.message,
    onDiagnostic
  });
  const resolvedActionLabel = resolveI18nText({
    i18n,
    key: actionLabelKey,
    fallback: actionLabel || fallbackActionLabel,
    onDiagnostic
  });
  const resolvedAriaLabel = ariaLabel || resolvedTitle || model.error.message;
  const detailContent = details !== undefined
    ? details
    : model.error.details !== undefined
      ? model.error.details
      : model.error.code;

  if (typeof onStateChange === "function") {
    onStateChange(state);
  }

  const handleAction = (event) => {
    if (disabledByState) {
      event.preventDefault();
      return;
    }

    if (typeof onAction === "function") {
      onAction(model.error, event);
    }

    if (typeof onDiagnostic === "function") {
      onDiagnostic(
        createObservationRecord({
          traceId,
          component: "error-state",
          action: "action",
          error: model.error,
          durationMs: 0
        })
      );
    }
  };

  return React.createElement(
    "section",
    {
      ...rest,
      ...createScopeAttributes("error-state", "root", state),
      ref,
      role: "alert",
      "aria-label": resolvedAriaLabel,
      "aria-busy": loading ? "true" : undefined,
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-retryable": String(model.retryable),
      "data-error-code": model.error.code
    },
    icon
      ? React.createElement(
          "div",
          createScopeAttributes("error-state", "icon", state),
          icon
        )
      : null,
    React.createElement(
      "h2",
      createScopeAttributes("error-state", "title", state),
      resolvedTitle
    ),
    React.createElement(
      "p",
      createScopeAttributes("error-state", "description", state),
      resolvedDescription
    ),
    children
      ? React.createElement(
          "div",
          createScopeAttributes("error-state", "description", state),
          children
        )
      : null,
    model.showDetails && detailContent !== undefined
      ? React.createElement(
          "pre",
          createScopeAttributes("error-state", "details", state),
          typeof detailContent === "string" ? detailContent : JSON.stringify(detailContent, null, 2)
        )
      : null,
    typeof onAction === "function"
      ? React.createElement(
          "button",
          {
            ...createScopeAttributes("error-state", "action", state),
            type: "button",
            disabled: disabledByState,
            onClick: handleAction
          },
          resolvedActionLabel
        )
      : null,
    React.createElement(
      "span",
      {
        ...createScopeAttributes("error-state", "status", state),
        ...createAriaStatusProps({ live: "assertive" })
      },
      model.error.message
    )
  );
});

ChipsErrorState.displayName = "ChipsErrorState";

export const ChipsNotification = React.forwardRef((props, ref) => {
  const {
    items,
    defaultItems = [],
    maxVisible,
    defaultDurationMs,
    closeButtonLabel,
    closeButtonLabelKey = "systemUx.notification.close",
    closeIconContent,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    i18n,
    configSource,
    traceId,
    onItemsChange,
    onDismiss,
    onAction,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentItems, setCurrentItems] = useControllableState({
    value: items,
    defaultValue: defaultItems,
    onChange: onItemsChange
  });

  const resolvedMaxVisible = resolveConfigValue({
    configSource,
    key: "systemUx.notification.maxVisible",
    defaultValue: parsePositiveInteger(maxVisible) || 3,
    parser: parsePositiveInteger,
    onDiagnostic
  });
  const resolvedDefaultDuration = resolveConfigValue({
    configSource,
    key: "systemUx.notification.defaultDurationMs",
    defaultValue: parsePositiveInteger(defaultDurationMs) || 5000,
    parser: parsePositiveInteger,
    onDiagnostic
  });
  const normalizedItems = React.useMemo(
    () => normalizeSystemMessageItems(currentItems, "notification"),
    [currentItems]
  );
  const visibleItems = React.useMemo(
    () =>
      resolveSystemMessageQueue({
        items: normalizedItems,
        idPrefix: "notification",
        maxVisible: resolvedMaxVisible,
        defaultDurationMs: resolvedDefaultDuration
      }),
    [normalizedItems, resolvedDefaultDuration, resolvedMaxVisible]
  );

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: "systemUx.notification.ariaLabel",
    fallback: ariaLabel || "[[systemUx.notification.ariaLabel]]",
    onDiagnostic
  });
  const resolvedCloseLabel = resolveI18nText({
    i18n,
    key: closeButtonLabelKey,
    fallback: closeButtonLabel || "[[systemUx.notification.close]]",
    onDiagnostic
  });

  const dismissItem = React.useCallback(
    (targetId, reason) => {
      const target = normalizedItems.find((item) => item.id === targetId);
      if (!target) {
        return;
      }

      const nextItems = dismissSystemMessage(normalizedItems, targetId);
      setCurrentItems(nextItems);

      if (typeof onDismiss === "function") {
        onDismiss(target, reason);
      }

      if (typeof onDiagnostic === "function") {
        onDiagnostic(
          createObservationRecord({
            traceId,
            component: "notification",
            action: reason || "dismiss",
            error: null,
            durationMs: 0
          })
        );
      }
    },
    [normalizedItems, onDiagnostic, onDismiss, setCurrentItems, traceId]
  );

  React.useEffect(() => {
    if (disabledByState || visibleItems.length === 0) {
      return undefined;
    }

    const timers = [];
    for (const item of visibleItems) {
      const durationMs = item.effectiveDurationMs;
      if (!durationMs || durationMs <= 0) {
        continue;
      }

      const timer = setTimeout(() => {
        dismissItem(item.id, "timeout");
      }, durationMs);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [disabledByState, dismissItem, visibleItems]);

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("notification", "root", state),
      ...handlers,
      ref,
      role: "region",
      "aria-label": resolvedAriaLabel,
      "aria-disabled": disabledByState ? "true" : undefined
    },
    React.createElement(
      "ul",
      createScopeAttributes("notification", "list", state),
      visibleItems.map((item) =>
        React.createElement(
          "li",
          {
            ...createScopeAttributes("notification", "item", state),
            key: item.id,
            role: item.tone === "error" ? "alert" : "status",
            "data-tone": item.tone
          },
          item.title
            ? React.createElement(
                "div",
                createScopeAttributes("notification", "title", state),
                item.title
              )
            : null,
          item.message
            ? React.createElement(
                "div",
                createScopeAttributes("notification", "message", state),
                item.message
              )
            : null,
          React.createElement(
            "div",
            createScopeAttributes("notification", "action", state),
            item.actionLabel || item.actionKey
              ? React.createElement(
                  "button",
                  {
                    ...createScopeAttributes("notification", "action", state),
                    type: "button",
                    disabled: disabledByState,
                    onClick: () => {
                      if (typeof onAction === "function") {
                        onAction(item);
                      }
                    }
                  },
                  resolveI18nText({
                    i18n,
                    key: item.actionKey,
                    fallback: item.actionLabel || "[[systemUx.notification.action]]",
                    onDiagnostic
                  })
                )
              : null,
            React.createElement(
              "button",
              {
                ...createScopeAttributes("notification", "close", state),
                type: "button",
                "aria-label": resolvedCloseLabel,
                disabled: disabledByState,
                onClick: () => dismissItem(item.id, "manual")
              },
              resolveIconContent(closeIconContent, "close")
            )
          )
        )
      )
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("notification", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsNotification.displayName = "ChipsNotification";

export const ChipsToast = React.forwardRef((props, ref) => {
  const {
    entries,
    defaultEntries = [],
    maxStack,
    defaultDurationMs,
    placement = "bottom-right",
    closeButtonLabel,
    closeButtonLabelKey = "systemUx.toast.close",
    closeIconContent,
    disabled = false,
    loading = false,
    error = null,
    ariaLabel,
    i18n,
    configSource,
    traceId,
    onEntriesChange,
    onDismiss,
    onAction,
    onStateChange,
    onDiagnostic
  } = props;

  const normalizedError = normalizeError(error);
  const disabledByState = disabled || loading;
  const { interaction, handlers } = useInteractiveState(disabledByState);
  const [currentEntries, setCurrentEntries] = useControllableState({
    value: entries,
    defaultValue: defaultEntries,
    onChange: onEntriesChange
  });

  const resolvedMaxStack = resolveConfigValue({
    configSource,
    key: "systemUx.toast.maxStack",
    defaultValue: parsePositiveInteger(maxStack) || 3,
    parser: parsePositiveInteger,
    onDiagnostic
  });
  const resolvedDefaultDuration = resolveConfigValue({
    configSource,
    key: "systemUx.toast.defaultDurationMs",
    defaultValue: parsePositiveInteger(defaultDurationMs) || 3500,
    parser: parsePositiveInteger,
    onDiagnostic
  });
  const normalizedEntries = React.useMemo(
    () => normalizeSystemMessageItems(currentEntries, "toast"),
    [currentEntries]
  );
  const visibleEntries = React.useMemo(
    () =>
      resolveSystemMessageQueue({
        items: normalizedEntries,
        idPrefix: "toast",
        maxVisible: resolvedMaxStack,
        defaultDurationMs: resolvedDefaultDuration
      }),
    [normalizedEntries, resolvedDefaultDuration, resolvedMaxStack]
  );

  const state = resolveInteractiveState({
    disabled: disabledByState,
    loading,
    error: normalizedError,
    interaction
  });

  React.useEffect(() => {
    if (typeof onStateChange === "function") {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const resolvedAriaLabel = resolveI18nText({
    i18n,
    key: "systemUx.toast.ariaLabel",
    fallback: ariaLabel || "[[systemUx.toast.ariaLabel]]",
    onDiagnostic
  });
  const resolvedCloseLabel = resolveI18nText({
    i18n,
    key: closeButtonLabelKey,
    fallback: closeButtonLabel || "[[systemUx.toast.close]]",
    onDiagnostic
  });

  const dismissEntry = React.useCallback(
    (targetId, reason) => {
      const target = normalizedEntries.find((item) => item.id === targetId);
      if (!target) {
        return;
      }

      const nextEntries = dismissSystemMessage(normalizedEntries, targetId);
      setCurrentEntries(nextEntries);

      if (typeof onDismiss === "function") {
        onDismiss(target, reason);
      }

      if (typeof onDiagnostic === "function") {
        onDiagnostic(
          createObservationRecord({
            traceId,
            component: "toast",
            action: reason || "dismiss",
            durationMs: 0
          })
        );
      }
    },
    [normalizedEntries, onDiagnostic, onDismiss, setCurrentEntries, traceId]
  );

  React.useEffect(() => {
    if (disabledByState || visibleEntries.length === 0) {
      return undefined;
    }

    const timers = [];
    for (const entry of visibleEntries) {
      const durationMs = entry.effectiveDurationMs;
      if (!durationMs || durationMs <= 0) {
        continue;
      }
      const timer = setTimeout(() => {
        dismissEntry(entry.id, "timeout");
      }, durationMs);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [disabledByState, dismissEntry, visibleEntries]);

  return React.createElement(
    "section",
    {
      ...createScopeAttributes("toast", "root", state),
      ...handlers,
      ref,
      role: "status",
      "aria-label": resolvedAriaLabel,
      "aria-disabled": disabledByState ? "true" : undefined,
      "data-placement": placement
    },
    React.createElement(
      "ul",
      createScopeAttributes("toast", "list", state),
      visibleEntries.map((entry) =>
        React.createElement(
          "li",
          {
            ...createScopeAttributes("toast", "item", state),
            key: entry.id,
            role: entry.tone === "error" ? "alert" : "status",
            "data-tone": entry.tone
          },
          React.createElement(
            "span",
            createScopeAttributes("toast", "message", state),
            entry.message || entry.title || ""
          ),
          React.createElement(
            "div",
            createScopeAttributes("toast", "action", state),
            entry.actionLabel || entry.actionKey
              ? React.createElement(
                  "button",
                  {
                    ...createScopeAttributes("toast", "action", state),
                    type: "button",
                    disabled: disabledByState,
                    onClick: () => {
                      if (typeof onAction === "function") {
                        onAction(entry);
                      }
                    }
                  },
                  resolveI18nText({
                    i18n,
                    key: entry.actionKey,
                    fallback: entry.actionLabel || "[[systemUx.toast.action]]",
                    onDiagnostic
                  })
                )
              : null,
            React.createElement(
              "button",
              {
                ...createScopeAttributes("toast", "close", state),
                type: "button",
                "aria-label": resolvedCloseLabel,
                disabled: disabledByState,
                onClick: () => dismissEntry(entry.id, "manual")
              },
              resolveIconContent(closeIconContent, "close")
            )
          )
        )
      )
    ),
    normalizedError
      ? React.createElement(
          "span",
          {
            ...createScopeAttributes("toast", "status", state),
            ...createAriaStatusProps({ live: "assertive" })
          },
          normalizedError.message
        )
      : null
  );
});

ChipsToast.displayName = "ChipsToast";

export function validateComponentA11y(component, props) {
  if (Object.hasOwn(LAYOUT_COMPONENT_TOKEN_MAP, component)) {
    return validateLayoutComponentA11y(component, props);
  }

  if (component === "text") {
    return true;
  }

  if (component === "label") {
    const hasFor = isNonEmptyString(props.htmlFor);
    const hasLabel = isNonEmptyString(props["aria-label"]) || isNonEmptyString(props["aria-labelledby"]);

    if (!hasFor && !hasLabel) {
      const error = new Error("Label must be associated with a control or provide an accessible name.");
      error.code = "A11Y_LABEL_ASSOCIATION_MISSING";
      throw error;
    }

    return true;
  }

  if (component === "icon") {
    const decorative = props["aria-hidden"] === "true";
    const hasLabel = isNonEmptyString(props["aria-label"]) || isNonEmptyString(props["aria-labelledby"]);

    if (!decorative && !hasLabel) {
      const error = new Error("Either aria-hidden=true or an accessible label is required.");
      error.code = "A11Y_ICON_LABEL_MISSING";
      throw error;
    }

    return true;
  }

  if (component === "icon-button") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "toggle-button") {
    assertAriaProps(props, {
      requireLabel: true
    });
    if (props["aria-pressed"] !== "true" && props["aria-pressed"] !== "false") {
      const error = new Error("Toggle button must expose aria-pressed.");
      error.code = "A11Y_TOGGLE_BUTTON_PRESSED_MISSING";
      throw error;
    }
    return true;
  }

  if (component === "badge") {
    if (props["aria-hidden"] === "true") {
      return true;
    }
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "tag") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "avatar") {
    if (props["aria-hidden"] === "true") {
      return true;
    }
    assertAriaProps(props, {
      role: "img",
      requireLabel: true
    });
    return true;
  }

  if (component === "spinner") {
    if (props["aria-hidden"] === "true") {
      return true;
    }
    assertAriaProps(props, {
      role: "status",
      requireLabel: true
    });
    return true;
  }

  if (component === "progress") {
    assertAriaProps(props, {
      role: "progressbar",
      requireLabel: true
    });
    return true;
  }

  if (component === "rating") {
    assertAriaProps(props, {
      role: "radiogroup",
      requireLabel: true
    });
    return true;
  }

  if (component === "text-field" || component === "text-area") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "search-field") {
    assertAriaProps(props, {
      role: "search",
      requireLabel: true
    });
    return true;
  }

  if (component === "secure-field") {
    assertAriaProps(props, {
      requireLabel: true
    });
    if (props["aria-pressed"] !== undefined
      && props["aria-pressed"] !== "true"
      && props["aria-pressed"] !== "false") {
      const error = new Error("Secure field visibility toggle must expose a boolean aria-pressed value.");
      error.code = "A11Y_SECURE_FIELD_VISIBILITY_PRESSED_INVALID";
      throw error;
    }
    return true;
  }

  if (component === "button") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true
    });
    return true;
  }

  if (component === "checkbox") {
    assertAriaProps(props, {
      role: "checkbox",
      requireLabel: true
    });
    return true;
  }

  if (component === "input") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "radio") {
    assertAriaProps(props, {
      role: "radio",
      requireLabel: true
    });
    return true;
  }

  if (component === "switch") {
    assertAriaProps(props, {
      role: "switch",
      requireLabel: true
    });
    return true;
  }

  if (component === "select") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "segmented-control") {
    assertAriaProps(props, {
      role: "radiogroup",
      requireLabel: true
    });
    return true;
  }

  if (component === "combo-box") {
    assertAriaProps(props, {
      role: "combobox",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "number-input") {
    assertAriaProps(props, {
      role: "spinbutton",
      requireLabel: true
    });
    return true;
  }

  if (component === "stepper") {
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "slider") {
    assertAriaProps(props, {
      role: "slider",
      requireLabel: true
    });
    return true;
  }

  if (component === "date-picker") {
    assertAriaProps(props, {
      role: "combobox",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    if (props["aria-expanded"] !== "true" && props["aria-expanded"] !== "false") {
      const error = new Error("Date picker input must expose aria-expanded.");
      error.code = "A11Y_DATE_PICKER_EXPANDED_MISSING";
      throw error;
    }
    return true;
  }

  if (component === "time-picker") {
    assertAriaProps(props, {
      role: "combobox",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    if (props["aria-expanded"] !== "true" && props["aria-expanded"] !== "false") {
      const error = new Error("Time picker input must expose aria-expanded.");
      error.code = "A11Y_TIME_PICKER_EXPANDED_MISSING";
      throw error;
    }
    return true;
  }

  if (component === "image") {
    if (props["aria-hidden"] === "true") {
      return true;
    }
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "media") {
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "error-state") {
    assertAriaProps(props, {
      role: "alert",
      requireLabel: true
    });
    return true;
  }

  if (component === "dialog") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "popover") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "tabs") {
    assertAriaProps(props, {
      role: "tab",
      requireLabel: true
    });
    return true;
  }

  if (component === "menu") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "toolbar") {
    assertAriaProps(props, {
      role: "toolbar",
      requireLabel: true
    });
    return true;
  }

  if (component === "menu-bar") {
    assertAriaProps(props, {
      role: "menubar",
      requireLabel: true
    });
    return true;
  }

  if (component === "context-menu") {
    assertAriaProps(props, {
      role: "button",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "shortcut") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "tooltip") {
    assertAriaProps(props, {
      role: "tooltip"
    });
    return true;
  }

  if (component === "form") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "virtual-list") {
    assertAriaProps(props, {
      role: "list",
      requireLabel: true
    });
    return true;
  }

  if (component === "data-grid") {
    if (props.part === "root" || props["data-part"] === "root") {
      assertAriaProps(props, {
        role: "group",
        requireLabel: true
      });
      return true;
    }

    assertAriaProps(props, {
      role: "grid",
      requireLabel: true
    });
    return true;
  }

  if (component === "tree") {
    assertAriaProps(props, {
      role: "tree",
      requireLabel: true
    });
    return true;
  }

  if (component === "date-time") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "command-palette") {
    assertAriaProps(props, {
      role: "combobox",
      requireLabel: true,
      requireControlsWhenExpanded: true
    });
    return true;
  }

  if (component === "navigation-split-view") {
    const part = props.part || props["data-part"];
    if (part === "sidebar") {
      assertAriaProps(props, {
        role: "navigation",
        requireLabel: true
      });
      return true;
    }
    if (part === "content" || part === "detail") {
      assertAriaProps(props, {
        role: "region",
        requireLabel: true
      });
      return true;
    }
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "split-pane") {
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "dock-panel") {
    assertAriaProps(props, {
      role: "tablist",
      requireLabel: true
    });
    return true;
  }

  if (component === "inspector") {
    assertAriaProps(props, {
      role: "complementary",
      requireLabel: true
    });
    return true;
  }

  if (component === "panel-header") {
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "card-shell") {
    assertAriaProps(props, {
      role: "article",
      requireLabel: true
    });
    return true;
  }

  if (component === "tool-window") {
    assertAriaProps(props, {
      role: "dialog",
      requireLabel: true
    });
    return true;
  }

  if (component === "error-boundary") {
    assertAriaProps(props, {
      requireLabel: true
    });
    return true;
  }

  if (component === "loading-boundary") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "notification") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "toast") {
    assertAriaProps(props, {
      role: "status",
      requireLabel: true
    });
    return true;
  }

  if (component === "empty-state") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "skeleton") {
    assertAriaProps(props, {
      role: "status",
      requireLabel: true
    });
    return true;
  }

  throw new Error(`COMPONENT_A11Y_RULE_MISSING:${component}`);
}

export const P0_DISPLAY_COMPONENTS = [
  createComponentMeta({
    name: "ChipsText",
    scope: "text",
    parts: ["root"],
    states: ["idle", "disabled", "error"]
  }),
  createComponentMeta({
    name: "ChipsLabel",
    scope: "label",
    parts: ["root", "required-indicator", "status"],
    states: ["idle", "disabled", "error"]
  }),
  createComponentMeta({
    name: "ChipsIcon",
    scope: "icon",
    parts: ["root"],
    states: ["idle"]
  })
];

export const TASK015_BASE_CONTROL_COMPONENTS = [
  createComponentMeta({
    name: "ChipsIconButton",
    scope: "icon-button",
    parts: ["root", "icon", "spinner", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsToggleButton",
    scope: "toggle-button",
    parts: ["root", "icon", "label", "spinner", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsBadge",
    scope: "badge",
    parts: ["root", "icon", "label", "status"],
    states: ["idle", "disabled", "error"]
  }),
  createComponentMeta({
    name: "ChipsTag",
    scope: "tag",
    parts: ["root", "icon", "label", "close", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsAvatar",
    scope: "avatar",
    parts: ["root", "image", "fallback", "status"],
    states: TASK015_BASE_CONTROL_STATES
  }),
  createComponentMeta({
    name: "ChipsSpinner",
    scope: "spinner",
    parts: ["root", "track", "indicator", "status"],
    states: TASK015_BASE_CONTROL_STATES
  }),
  createComponentMeta({
    name: "ChipsProgress",
    scope: "progress",
    parts: ["root", "track", "range", "label", "value", "status"],
    states: TASK015_BASE_CONTROL_STATES
  }),
  createComponentMeta({
    name: "ChipsRating",
    scope: "rating",
    parts: ["root", "label", "item", "icon", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsTextField",
    scope: "text-field",
    parts: ["root", "label", "control", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsTextArea",
    scope: "text-area",
    parts: ["root", "label", "control", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSearchField",
    scope: "search-field",
    parts: ["root", "label", "search-icon", "control", "clear", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSecureField",
    scope: "secure-field",
    parts: ["root", "label", "control", "visibility-toggle", "visibility-icon", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSegmentedControl",
    scope: "segmented-control",
    parts: ["root", "item", "indicator", "label", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsComboBox",
    scope: "combo-box",
    parts: ["root", "label", "control", "trigger", "list", "option", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsNumberInput",
    scope: "number-input",
    parts: ["root", "label", "control", "decrement", "increment", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsStepper",
    scope: "stepper",
    parts: ["root", "label", "decrement", "value", "increment", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSlider",
    scope: "slider",
    parts: ["root", "label", "track", "range", "thumb", "value", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsDatePicker",
    scope: "date-picker",
    parts: [
      "root",
      "label",
      "control",
      "input",
      "trigger",
      "calendar",
      "header",
      "previous",
      "next",
      "title",
      "grid",
      "week-header",
      "cell",
      "description",
      "status"
    ],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsTimePicker",
    scope: "time-picker",
    parts: ["root", "label", "control", "input", "trigger", "list", "option", "description", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsImage",
    scope: "image",
    parts: ["root", "media", "fallback", "caption", "status"],
    states: TASK015_BASE_CONTROL_STATES
  }),
  createComponentMeta({
    name: "ChipsMedia",
    scope: "media",
    parts: ["root", "content", "controls", "control", "caption", "status"],
    states: TASK015_BASE_CONTROL_STATES
  }),
  createComponentMeta({
    name: "ChipsErrorState",
    scope: "error-state",
    parts: ["root", "icon", "title", "description", "details", "action", "status"],
    states: TASK015_BASE_CONTROL_STATES
  })
];

export const P0_BASE_INTERACTIVE_COMPONENTS = [
  createComponentMeta({
    name: "ChipsButton",
    scope: "button",
    parts: ["root", "label", "spinner", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsInput",
    scope: "input",
    parts: ["root", "control", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsCheckbox",
    scope: "checkbox",
    parts: ["root", "control", "indicator", "label", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsRadioGroup",
    scope: "radio",
    parts: ["root", "item", "control", "indicator", "label", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSwitch",
    scope: "switch",
    parts: ["root", "track", "thumb", "label", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSelect",
    scope: "select",
    parts: ["root", "trigger", "value", "icon", "content", "option", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsDialog",
    scope: "dialog",
    parts: [
      "root",
      "trigger",
      "backdrop",
      "content",
      "header",
      "body",
      "footer",
      "actions",
      "close",
      "status"
    ],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsPopover",
    scope: "popover",
    parts: ["root", "trigger", "content", "arrow", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsTabs",
    scope: "tabs",
    parts: ["root", "list", "trigger", "panel", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsMenu",
    scope: "menu",
    parts: ["root", "trigger", "content", "item", "group", "group-label", "separator", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsToolbar",
    scope: "toolbar",
    parts: ["root", "group", "item", "icon", "label", "shortcut", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsMenuBar",
    scope: "menu-bar",
    parts: ["root", "menu", "content", "group", "item", "shortcut", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsContextMenu",
    scope: "context-menu",
    parts: ["root", "trigger", "content", "group", "item", "shortcut", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsShortcut",
    scope: "shortcut",
    parts: ["root", "key", "separator"],
    states: ["idle", "disabled"]
  }),
  createComponentMeta({
    name: "ChipsTooltip",
    scope: "tooltip",
    parts: ["root", "trigger", "content", "arrow", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  })
];

export const P0_DATA_FORM_COMPONENTS = [
  createComponentMeta({
    name: "ChipsForm",
    scope: "form",
    parts: ["root", "section", "field", "label", "required", "control", "error", "hint", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsVirtualList",
    scope: "virtual-list",
    parts: ["root", "viewport", "content", "item", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  })
];

export const STAGE7_DATA_ADVANCED_COMPONENTS = [
  createComponentMeta({
    name: "ChipsDataGrid",
    scope: "data-grid",
    parts: ["root", "toolbar", "header", "row", "cell", "pagination", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsTree",
    scope: "tree",
    parts: ["root", "item", "branch", "leaf", "disclosure", "label", "group", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsDateTime",
    scope: "date-time",
    parts: ["root", "input", "icon", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsCommandPalette",
    scope: "command-palette",
    parts: ["root", "input", "list", "group", "group-label", "item", "shortcut", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsNavigationSplitView",
    scope: "navigation-split-view",
    parts: ["root", "sidebar", "content", "detail", "divider", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  })
];

export const STAGE7_WORKBENCH_COMPONENTS = [
  createComponentMeta({
    name: "ChipsSplitPane",
    scope: "split-pane",
    parts: ["root", "pane-start", "resizer", "pane-end", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsDockPanel",
    scope: "dock-panel",
    parts: ["root", "tab-list", "tab", "content", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsInspector",
    scope: "inspector",
    parts: ["root", "section", "header", "body", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsPanelHeader",
    scope: "panel-header",
    parts: ["root", "title", "subtitle", "actions", "toggle", "close", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsCardShell",
    scope: "card-shell",
    parts: ["root", "header", "toolbar", "content", "footer", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsToolWindow",
    scope: "tool-window",
    parts: ["root", "header", "controls", "body", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  })
];

export const STAGE8_SYSTEM_UX_COMPONENTS = [
  createComponentMeta({
    name: "ChipsErrorBoundary",
    scope: "error-boundary",
    parts: ["root", "title", "description", "action", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsLoadingBoundary",
    scope: "loading-boundary",
    parts: ["root", "content", "fallback", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsNotification",
    scope: "notification",
    parts: ["root", "list", "item", "title", "message", "action", "close", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsToast",
    scope: "toast",
    parts: ["root", "list", "item", "message", "action", "close", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsEmptyState",
    scope: "empty-state",
    parts: ["root", "icon", "title", "description", "action", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  }),
  createComponentMeta({
    name: "ChipsSkeleton",
    scope: "skeleton",
    parts: ["root", "item", "status"],
    states: [...INTERACTIVE_STATE_PRIORITY]
  })
];
