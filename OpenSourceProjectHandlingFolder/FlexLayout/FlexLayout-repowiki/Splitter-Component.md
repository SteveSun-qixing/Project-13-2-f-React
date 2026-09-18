# Splitter Component

> **Relevant source files**
> * [src/view/BorderButton.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx)
> * [src/view/Splitter.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx)
> * [src/view/TabButton.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx)

## Purpose and Scope

The Splitter component provides resizable dividers between panels in the FlexLayout system. It enables users to adjust the relative sizes of adjacent panels by dragging the divider between them. This document covers the Splitter component's rendering, drag-and-drop mechanics, and integration with the Model's action system.

For information about the overall component hierarchy, see [Core Components](/caplin/FlexLayout/3-core-components). For details about how Model attributes control splitter behavior, see [Attributes System](/caplin/FlexLayout/6.4-attributes-system).

## Overview

The Splitter component renders a thin, draggable divider element positioned between child nodes within a `RowNode` or between the main layout area and a `BorderNode`. When dragged, it calculates new size distributions and dispatches actions to update the Model's layout tree.

The component is defined in [src/view/Splitter.tsx L23-L261](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L23-L261)

 and implements the `ISplitterProps` interface:

| Property | Type | Description |
| --- | --- | --- |
| `layout` | `LayoutInternal` | Reference to the layout rendering engine |
| `node` | `RowNode \| BorderNode` | Parent node containing the children being split |
| `index` | `number` | Position of this splitter in the parent's children array |
| `horizontal` | `boolean` | Whether splitter divides horizontally (vertical line) or vertically (horizontal line) |

A global `splitterDragging` boolean [src/view/Splitter.tsx L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L20-L20)

 is exported to allow other components (TabSet and BorderTabSet) to detect when a splitter drag is in progress.

**Sources:** [src/view/Splitter.tsx L1-L261](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L1-L261)

## Component Rendering

The Splitter renders as a `div` element with cursor styling and optional visual elements:

```

```

### Base Splitter Rendering

The base splitter div [src/view/Splitter.tsx L221-L228](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L221-L228)

 applies:

* **CSS Classes**: `FLEXLAYOUT__SPLITTER` plus orientation-specific class (`FLEXLAYOUT__SPLITTER_horz` or `FLEXLAYOUT__SPLITTER_vert`) [src/view/Splitter.tsx L191](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L191-L191)
* **Cursor Style**: `ew-resize` for horizontal splitters, `ns-resize` for vertical splitters [src/view/Splitter.tsx L188](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L188-L188)
* **Size**: Width or height set to `Model.getSplitterSize()` [src/view/Splitter.tsx L37](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L37-L37)
* **Data Attribute**: `data-layout-path` for identifying the splitter in the layout tree [src/view/Splitter.tsx L225](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L225-L225)

### Extended Hit Area

On mobile devices or when `Model.getSplitterExtra()` returns a non-zero value, an extended transparent div increases the touchable area [src/view/Splitter.tsx L230-L259](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L230-L259)

 The hit area is expanded to at least 20px on mobile devices [src/view/Splitter.tsx L40-L43](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L40-L43)

### Handle Display

When `Model.isSplitterEnableHandle()` returns `true`, a visual handle element is rendered [src/view/Splitter.tsx L210-L218](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L210-L218)

 to indicate the splitter's draggable nature. The handle has orientation-specific styling (`FLEXLAYOUT__SPLITTER_HANDLE_HORZ` or `FLEXLAYOUT__SPLITTER_HANDLE_VERT`).

**Sources:** [src/view/Splitter.tsx L37-L43](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L37-L43)

 [src/view/Splitter.tsx L186-L218](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L186-L218)

 [src/view/Splitter.tsx L220-L260](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L220-L260)

## Drag Interaction System

The Splitter implements a sophisticated drag system with visual feedback and bounds checking:

```

```

### Drag Initialization

When `onPointerDown` is triggered [src/view/Splitter.tsx L60-L101](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L60-L101)

:

1. **Capture Initial State**: For `RowNode` splitters, `node.getSplitterInitials(index)` returns initial sizes, sum, and start position [src/view/Splitter.tsx L63](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L63-L63)
2. **Disable IFrame Pointer Events**: Prevents drag events from being lost to iframes [src/view/Splitter.tsx L66](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L66-L66)
3. **Start Drag**: Call `startDrag()` utility with callbacks [src/view/Splitter.tsx L67](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L67-L67)
4. **Get Bounds**: `node.getSplitterBounds(index, true)` returns minimum and maximum positions [src/view/Splitter.tsx L69](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L69-L69)
5. **Create Outline**: An outline div is created and positioned at the splitter's current location [src/view/Splitter.tsx L71-L96](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L71-L96)
6. **Set State**: Update `dragging` state and global `splitterDragging` flag [src/view/Splitter.tsx L99-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L99-L100)

### Drag Movement

During drag, `onDragMove(x, y)` [src/view/Splitter.tsx L113-L130](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L113-L130)

:

1. **Calculate Bounded Position**: `getBoundPosition()` clamps the position to valid bounds [src/view/Splitter.tsx L173-L184](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L173-L184)
2. **Update Outline**: Position the outline div based on orientation [src/view/Splitter.tsx L120-L124](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L120-L124)
3. **Realtime Resize**: If `layout.isRealtimeResize()` is true, update layout immediately [src/view/Splitter.tsx L126-L128](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L126-L128)

### Drag Completion

When drag ends, `onDragEnd()` [src/view/Splitter.tsx L132-L145](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L132-L145)

:

1. **Update Layout**: Call `updateLayout(false)` to finalize the resize [src/view/Splitter.tsx L134](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L134-L134)
2. **Cleanup**: Remove outline div and restore iframe pointer events [src/view/Splitter.tsx L136-L142](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L136-L142)
3. **Reset State**: Clear dragging state [src/view/Splitter.tsx L143-L144](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L143-L144)

**Sources:** [src/view/Splitter.tsx L60-L145](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L60-L145)

 [src/view/Splitter.tsx L173-L184](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L173-L184)

## Resize Calculation and Action Dispatch

The `updateLayout()` function [src/view/Splitter.tsx L147-L171](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L147-L171)

 calculates new sizes and dispatches appropriate actions:

```

```

### For RowNode Splitters

When splitting between children in a `RowNode` [src/view/Splitter.tsx L163-L165](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L163-L165)

:

1. **Calculate Weights**: `node.calculateSplit(index, value, initialSizes, sum, startPosition)` returns new weight distribution
2. **Dispatch Action**: `Actions.adjustWeights(nodeId, weights)` updates the children's weights

The weights array determines the relative sizes of all children in the row, maintaining proportional distribution.

### For BorderNode Splitters

When splitting between a border panel and the main layout [src/view/Splitter.tsx L159-L161](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L159-L161)

:

1. **Calculate Position**: `BorderNode.calculateSplit(node, value)` returns the new border size
2. **Dispatch Action**: `Actions.adjustBorderSplit(nodeId, pos)` updates the border's size

**Sources:** [src/view/Splitter.tsx L147-L171](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L147-L171)

## Model Configuration

The Splitter component's behavior is controlled by Model-level attributes:

| Method | Return Type | Purpose | Default |
| --- | --- | --- | --- |
| `getSplitterSize()` | `number` | Width/height of the splitter in pixels | Varies by theme |
| `getSplitterExtra()` | `number` | Additional transparent hit area in pixels | 0 |
| `isSplitterEnableHandle()` | `boolean` | Whether to show a visual handle | `false` |
| `isRealtimeResize()` | `boolean` | Whether to update layout during drag | `false` |

These methods are called on the Model instance accessed via `node.getModel()`.

### Mobile Optimization

The component automatically adjusts for mobile devices [src/view/Splitter.tsx L40-L43](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L40-L43)

:

```
if (!isDesktop()) {    extra = Math.max(20, extra + size) - size;}
```

This ensures a minimum 20px hit area on touch devices, overriding the configured `splitterExtra` value if necessary.

**Sources:** [src/view/Splitter.tsx L37-L43](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L37-L43)

 [src/view/Splitter.tsx L76-L81](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L76-L81)

 [src/view/Splitter.tsx L126](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L126-L126)

 [src/view/Splitter.tsx L196-L198](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L196-L198)

## Visual Feedback During Drag

The Splitter creates an outline element during drag to provide visual feedback:

```

```

### Outline Creation

[src/view/Splitter.tsx L71-L96](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L71-L96)

:

1. **Create Element**: A new `div` element is created in the current document
2. **Apply Styling**: * Class: `FLEXLAYOUT__SPLITTER_DRAG` * Cursor: Matches orientation (`ns-resize` or `ew-resize`) * Flex direction: Matches splitter orientation
3. **Position**: Positioned to match the static splitter's current location
4. **Handle**: If handles are enabled, a handle div is cloned into the outline
5. **Append**: Added to the layout root div

### Outline Updates

During drag movement [src/view/Splitter.tsx L115-L124](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L115-L124)

 only the `top` or `left` CSS property is updated based on orientation, keeping the outline aligned with the mouse/touch position within bounds.

**Sources:** [src/view/Splitter.tsx L71-L96](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L71-L96)

 [src/view/Splitter.tsx L113-L130](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L113-L130)

## Touch Support

The Splitter implements special handling for touch devices:

### Passive Event Prevention

[src/view/Splitter.tsx L45-L58](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L45-L58)

:

```javascript
React.useEffect(() => {    selfRef.current?.addEventListener("touchstart", onTouchStart, { passive: false });    extendedRef.current?.addEventListener("touchstart", onTouchStart, { passive: false });    // cleanup...}, []); const onTouchStart = (event: TouchEvent) => {    event.preventDefault();    event.stopImmediatePropagation();}
```

This prevents the browser's default touch handling (such as scrolling) from interfering with splitter dragging. The `passive: false` option is required on Android to allow `preventDefault()`.

### Extended Hit Area

As mentioned in the Model Configuration section, mobile devices automatically receive a larger hit area to accommodate imprecise touch input.

**Sources:** [src/view/Splitter.tsx L40-L58](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L40-L58)

## Integration with Layout System

The Splitter integrates with several FlexLayout systems:

```

```

### Coordination with Other Components

The global `splitterDragging` variable [src/view/Splitter.tsx L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L20-L20)

 allows TabSet and BorderTabSet components to detect when splitter dragging is in progress. This prevents conflicting interactions during resize operations.

### Visibility During Maximize

When a tabset is maximized, splitters in the main layout area are hidden [src/view/Splitter.tsx L196-L198](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L196-L198)

:

```
if (node.getModel().getMaximizedTabset(layout.getWindowId()) !== undefined) {    style.display = "none";}
```

Border splitters remain visible during maximize operations.

**Sources:** [src/view/Splitter.tsx L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L20-L20)

 [src/view/Splitter.tsx L62-L64](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L62-L64)

 [src/view/Splitter.tsx L159-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L159-L166)

 [src/view/Splitter.tsx L193-L198](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L193-L198)

## CSS Classes Reference

The Splitter component uses the following CSS classes:

| Class | Applied To | Purpose |
| --- | --- | --- |
| `FLEXLAYOUT__SPLITTER` | Main splitter div | Base splitter styling |
| `FLEXLAYOUT__SPLITTER_horz` | Main div (horizontal) | Horizontal orientation styling |
| `FLEXLAYOUT__SPLITTER_vert` | Main div (vertical) | Vertical orientation styling |
| `FLEXLAYOUT__SPLITTER_BORDER` | Main div (border splitter) | Additional styling for border splitters |
| `FLEXLAYOUT__SPLITTER_EXTRA` | Extended hit area div | Transparent extended hit area |
| `FLEXLAYOUT__SPLITTER_DRAG` | Outline div | Drag outline visual feedback |
| `FLEXLAYOUT__SPLITTER_HANDLE` | Handle div | Base handle styling |
| `FLEXLAYOUT__SPLITTER_HANDLE_HORZ` | Handle (horizontal) | Horizontal handle styling |
| `FLEXLAYOUT__SPLITTER_HANDLE_VERT` | Handle (vertical) | Vertical handle styling |

All classes are accessed via `layout.getClassName()` [src/view/Splitter.tsx L186](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L186-L186)

 to support class name customization.

**Sources:** [src/view/Splitter.tsx L73-L80](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L73-L80)

 [src/view/Splitter.tsx L186-L194](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L186-L194)

 [src/view/Splitter.tsx L212-L217](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L212-L217)

 [src/view/Splitter.tsx L243](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L243-L243)