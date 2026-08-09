import * as React from "react";

export type ChipsLayoutState = "idle" | "hover" | "focus" | "active" | "disabled" | "loading" | "error";
export type ChipsLayoutSize = string | number;
export type ChipsLayoutAlign = "start" | "center" | "end" | "stretch" | "baseline";
export type ChipsLayoutJustify = "start" | "center" | "end" | "between" | "around" | "evenly";
export type ChipsStackDirection = "vertical" | "horizontal";
export type ChipsOrientation = "horizontal" | "vertical";
export type ChipsScrollAxis = "vertical" | "horizontal" | "both" | "auto" | "scroll" | "hidden";
export type ChipsSplitViewVariant = "two-column" | "three-column" | "sidebar-detail";

export interface ChipsLayoutErrorLike {
  code?: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export interface ChipsLayoutStateProps {
  disabled?: boolean;
  loading?: boolean;
  error?: ChipsLayoutErrorLike | null;
  active?: boolean;
  onStateChange?: (state: ChipsLayoutState) => void;
}

export interface ChipsLayoutA11yProps {
  ariaLabel?: string;
  ariaLabelledBy?: string;
}

export interface LayoutComponentContract {
  component: string;
  scope: string;
  parts: string[];
  states: string[];
  tokens: string[];
}

export interface ChipsViewProps extends ChipsLayoutStateProps, ChipsLayoutA11yProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  title?: React.ReactNode;
  titleId?: string;
  titleKey?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export interface ChipsBoxProps extends ChipsLayoutStateProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  padding?: ChipsLayoutSize;
  radius?: ChipsLayoutSize;
  children?: React.ReactNode;
}

export interface ChipsStackProps extends ChipsLayoutStateProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  direction?: ChipsStackDirection;
  gap?: ChipsLayoutSize;
  align?: ChipsLayoutAlign;
  justify?: ChipsLayoutJustify;
  wrap?: boolean;
  children?: React.ReactNode;
}

export interface ChipsInlineProps extends ChipsLayoutStateProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  gap?: ChipsLayoutSize;
  align?: ChipsLayoutAlign;
  justify?: ChipsLayoutJustify;
  wrap?: boolean;
  children?: React.ReactNode;
}

export interface ChipsGridProps extends ChipsLayoutStateProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  columns?: number;
  minItemSize?: ChipsLayoutSize;
  gap?: ChipsLayoutSize;
  children?: React.ReactNode;
}

export interface ChipsSectionProps extends ChipsLayoutStateProps, ChipsLayoutA11yProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  title?: React.ReactNode;
  titleId?: string;
  titleKey?: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export interface ChipsScrollViewProps extends ChipsLayoutStateProps, ChipsLayoutA11yProps, React.HTMLAttributes<HTMLElement> {
  as?: string;
  axis?: ChipsScrollAxis;
  maxBlockSize?: ChipsLayoutSize;
  children?: React.ReactNode;
}

export interface ChipsSpacerProps extends React.HTMLAttributes<HTMLElement> {
  as?: string;
  size?: ChipsLayoutSize;
  inline?: boolean;
}

export interface ChipsDividerProps extends React.HTMLAttributes<HTMLElement> {
  as?: string;
  orientation?: ChipsOrientation;
  label?: React.ReactNode;
  decorative?: boolean;
}

export interface ChipsSplitViewProps extends ChipsLayoutStateProps, ChipsLayoutA11yProps, React.HTMLAttributes<HTMLDivElement> {
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  detail?: React.ReactNode;
  children?: React.ReactNode;
  variant?: ChipsSplitViewVariant;
}

export const LAYOUT_INTERACTIVE_STATES: readonly ChipsLayoutState[];
export const LAYOUT_COMPONENT_TOKEN_MAP: Readonly<Record<string, readonly string[]>>;
export const LAYOUT_PRIMITIVE_COMPONENTS: LayoutComponentContract[];

export const ChipsView: React.ForwardRefExoticComponent<ChipsViewProps & React.RefAttributes<HTMLElement>>;
export const ChipsBox: React.ForwardRefExoticComponent<ChipsBoxProps & React.RefAttributes<HTMLElement>>;
export const ChipsStack: React.ForwardRefExoticComponent<ChipsStackProps & React.RefAttributes<HTMLElement>>;
export const ChipsInline: React.ForwardRefExoticComponent<ChipsInlineProps & React.RefAttributes<HTMLElement>>;
export const ChipsGrid: React.ForwardRefExoticComponent<ChipsGridProps & React.RefAttributes<HTMLElement>>;
export const ChipsSection: React.ForwardRefExoticComponent<ChipsSectionProps & React.RefAttributes<HTMLElement>>;
export const ChipsScrollView: React.ForwardRefExoticComponent<ChipsScrollViewProps & React.RefAttributes<HTMLElement>>;
export const ChipsSpacer: React.ForwardRefExoticComponent<ChipsSpacerProps & React.RefAttributes<HTMLElement>>;
export const ChipsDivider: React.ForwardRefExoticComponent<ChipsDividerProps & React.RefAttributes<HTMLElement>>;
export const ChipsSplitView: React.ForwardRefExoticComponent<ChipsSplitViewProps & React.RefAttributes<HTMLDivElement>>;

export function buildLayoutComponentContract(component: string): LayoutComponentContract;
export function validateLayoutComponentA11y(component: string, props: Record<string, unknown>): boolean;
