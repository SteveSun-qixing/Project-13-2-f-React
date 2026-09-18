# TabSet Component

> **Relevant source files**
> * [src/view/BorderTabSet.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx)
> * [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)
> * [src/view/TabSet.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx)

## Purpose

This document describes the `TabSet` and `BorderTabSet` components, which are responsible for rendering collections of tabs with their headers, toolbars, and content areas. These components handle tab strip layout, button rendering, overflow management, and customization hooks.

For information about individual tab button rendering, see [Tab and Button Components](/caplin/FlexLayout/3.3-tab-and-button-components). For details on tab overflow and scrolling behavior, see [Tab Overflow](/caplin/FlexLayout/3.5-tab-overflow). For the overall layout system, see [Layout Component](/caplin/FlexLayout/3.1-layout-component).

## Overview

FlexLayout provides two tab container components that serve different layout purposes:

| Component | Purpose | Location | Node Type |
| --- | --- | --- | --- |
| `TabSet` | Main content area tabsets | Center layout area | `TabSetNode` |
| `BorderTabSet` | Edge-docked tab bars | Top/Left/Right/Bottom borders | `BorderNode` |

Both components share similar functionality but differ in rendering orientation, styling classes, and layout constraints. The `LayoutInternal` component determines which to render based on the node hierarchy.

**Sources:** [src/view/TabSet.tsx L1-L488](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L1-L488)

 [src/view/BorderTabSet.tsx L1-L273](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L1-L273)

## Component Hierarchy

```

```

**Sources:** [src/view/Layout.tsx L403-L485](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L403-L485)

 [src/view/TabSet.tsx L17-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L17-L20)

 [src/view/BorderTabSet.tsx L16-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L16-L20)

## TabSet Component Structure

The `TabSet` component is the primary tab container for the main layout area. It accepts props through the `ITabSetProps` interface:

```

```

The component structure consists of three main regions:

```

```

**Sources:** [src/view/TabSet.tsx L155-L466](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L155-L466)

## TabSet Rendering Process

The TabSet component follows this rendering sequence:

```

```

**Sources:** [src/view/TabSet.tsx L23-L485](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L23-L485)

## Key TabSet Features

### Tab Strip Modes

The TabSet supports two layout modes controlled by `node.isEnableTabWrap()`:

| Mode | Behavior | Scroll Support | Overflow Button |
| --- | --- | --- | --- |
| Wrap Mode | Tabs wrap to multiple rows | No | No |
| Scroll Mode | Single row with horizontal scroll | Yes | Yes (when tabs hidden) |

In scroll mode, the component uses the `useTabOverflow` hook to track hidden tabs and render an overflow menu button.

**Sources:** [src/view/TabSet.tsx L355-L420](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L355-L420)

### Single Tab Stretch

When `node.isEnableSingleTabStretch()` returns true and only one tab exists, the tab stretches to fill the available width:

```

```

In this mode, the single tab's close button appears in the toolbar instead of on the tab itself, and custom CSS classes from `TabNode.getTabSetClassName()` are applied to the tab strip.

**Sources:** [src/view/TabSet.tsx L191-L193](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L191-L193)

 [src/view/TabSet.tsx L339-L344](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L339-L344)

### Tab Location

Tabs can be positioned at the top or bottom of the content area via `node.getTabLocation()`:

* **"top"**: Tab strip appears above content (default)
* **"bottom"**: Tab strip appears below content

The component conditionally orders the elements:

```

```

**Sources:** [src/view/TabSet.tsx L435-L439](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L435-L439)

## Toolbar Buttons

The TabSet toolbar contains several optional buttons rendered based on node attributes:

```

```

### Button Generation Logic

| Button | Condition | Icon | Action |
| --- | --- | --- | --- |
| Overflow | `isShowHiddenTabs && hiddenTabs.length > 0` | `icons.more` | Opens overflow menu |
| Popout | `selectedTabNode.isEnablePopout()` | `icons.popout` | `Actions.popoutTab()` |
| Maximize | `node.canMaximize()` | `icons.maximize`/`icons.restore` | `Actions.maximizeToggle()` |
| Close | `node.isEnableClose()` or single stretched tab | `icons.closeTabset` | `Actions.deleteTabset()` or `Actions.deleteTab()` |
| Active Indicator | `node.isActive() && node.isEnableActiveIcon()` | `icons.activeTabset` | Display only |

**Sources:** [src/view/TabSet.tsx L180-L311](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L180-L311)

### Button Event Handlers

```

```

**Sources:** [src/view/TabSet.tsx L66-L145](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L66-L145)

## Customization Interface

The TabSet allows external customization through the `ITabSetRenderValues` interface:

```

```

The customization flow:

```

```

**Sources:** [src/view/TabSet.tsx L180-L189](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L180-L189)

 [src/view/Layout.tsx L1260-L1271](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1260-L1271)

### Sticky Buttons Behavior

Sticky buttons have special positioning logic:

```

```

When `isDockStickyButtons` is true (computed by `useTabOverflow`), sticky buttons move from the tab strip to the toolbar.

**Sources:** [src/view/TabSet.tsx L198-L212](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L198-L212)

## BorderTabSet Component

The `BorderTabSet` component renders tabs in the border areas (top, left, right, bottom edges). It shares similar structure with `TabSet` but has key differences:

### BorderTabSet Props

```

```

**Sources:** [src/view/BorderTabSet.tsx L16-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L16-L20)

### Border-Specific Differences

```

```

| Aspect | TabSet | BorderTabSet |
| --- | --- | --- |
| Node Type | `TabSetNode` | `BorderNode` |
| Button Component | `TabButton` | `BorderButton` |
| CSS Classes | `FLEXLAYOUT__TABSET_*` | `FLEXLAYOUT__BORDER_*` |
| Orientation | Always horizontal | Varies by `border.getLocation()` |
| Content Area | Separate content div | Handled by `BorderTab` component |
| Drag and Drop | Supports tabset dragging | No tabset dragging |

**Sources:** [src/view/BorderTabSet.tsx L23-L272](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L23-L272)

### Border Layout Orientation

The BorderTabSet applies different styles based on border location:

```

```

Left and right borders use vertical scrolling with rotated tab buttons, while top and bottom borders use horizontal scrolling.

**Sources:** [src/view/BorderTabSet.tsx L204-L216](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L204-L216)

## Tab Strip Layout

Both components delegate tab strip layout to the `useTabOverflow` hook, which handles:

* Scroll position management
* Hidden tab tracking
* Mini scrollbar rendering
* User vs. automatic scroll control

The hook returns critical layout information:

```

```

**Sources:** [src/view/TabSet.tsx L62-L64](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L62-L64)

 [src/view/BorderTabSet.tsx L38-L41](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L38-L41)

## Empty TabSet Placeholder

When a TabSet has no children, it can render a placeholder through the `onTabSetPlaceHolder` callback:

```

```

This allows applications to display custom content in empty tabsets, such as "Drop tabs here" messages.

**Sources:** [src/view/TabSet.tsx L423-L429](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L423-L429)

## Maximization Handling

When a TabSet is maximized, it renders in a React Portal positioned over the main layout area:

```

```

Non-maximized tabsets are hidden via `style.display = "none"` when another tabset in the same window is maximized.

**Sources:** [src/view/TabSet.tsx L468-L480](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L468-L480)

 [src/view/TabSet.tsx L449-L451](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L449-L451)

## Lifecycle and Measurement

Both components use `React.useLayoutEffect` to measure and update node rectangles synchronously during render:

```

```

This ensures the model has accurate dimensions for drag-and-drop target calculations and tab content positioning.

**Sources:** [src/view/TabSet.tsx L37-L59](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L37-L59)

 [src/view/BorderTabSet.tsx L34-L36](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L34-L36)

## Event Handling

### TabSet Events

| Event | Handler | Purpose |
| --- | --- | --- |
| `onDragStart` | Tab strip drag | Initiates tabset dragging if `node.isEnableDrag()` |
| `onPointerDown` | Tab strip click | Sets active tabset via `Actions.setActiveTabset()` |
| `onDoubleClick` | Tab strip double-click | Toggles maximize if `node.canMaximize()` |
| `onContextMenu` | Right-click | Calls `layout.showContextMenu(node, event)` |
| `onAuxMouseClick` | Middle-click/Alt-click | Calls `layout.auxMouseClick(node, event)` |

**Sources:** [src/view/TabSet.tsx L89-L151](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L89-L151)

### BorderTabSet Events

BorderTabSet handles similar events but excludes drag-start (border tabsets cannot be dragged as a whole):

```

```

**Sources:** [src/view/BorderTabSet.tsx L43-L51](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L43-L51)

## CSS Class Structure

The components apply nested CSS classes for styling:

```yaml
TabSet:
├── FLEXLAYOUT__TABSET_CONTAINER
│   └── FLEXLAYOUT__TABSET
│       ├── FLEXLAYOUT__TABSET_TABBAR_OUTER
│       │   ├── FLEXLAYOUT__TABSET_TABBAR_OUTER_top/bottom
│       │   ├── FLEXLAYOUT__TABSET_SELECTED (if active)
│       │   ├── FLEXLAYOUT__TABSET_MAXIMIZED (if maximized)
│       │   ├── FLEXLAYOUT__TABSET_LEADING (optional)
│       │   ├── FLEXLAYOUT__TABSET_TABBAR_INNER
│       │   │   └── FLEXLAYOUT__TABSET_TABBAR_INNER_TAB_CONTAINER
│       │   └── FLEXLAYOUT__TAB_TOOLBAR
│       └── FLEXLAYOUT__TABSET_CONTENT

BorderTabSet:
├── FLEXLAYOUT__BORDER
│   ├── FLEXLAYOUT__BORDER_top/left/right/bottom
│   ├── FLEXLAYOUT__BORDER_LEADING (optional)
│   ├── FLEXLAYOUT__BORDER_INNER
│   │   └── FLEXLAYOUT__BORDER_INNER_TAB_CONTAINER
│   └── FLEXLAYOUT__BORDER_TOOLBAR
```

**Sources:** [src/view/TabSet.tsx L325-L344](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L325-L344)

 [src/view/BorderTabSet.tsx L118-L121](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L118-L121)