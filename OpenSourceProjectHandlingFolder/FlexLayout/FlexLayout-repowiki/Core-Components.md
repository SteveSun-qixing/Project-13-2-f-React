# Core Components

> **Relevant source files**
> * [src/view/BorderButton.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx)
> * [src/view/BorderTabSet.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx)
> * [src/view/Layout.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx)
> * [src/view/Splitter.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx)
> * [src/view/TabButton.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx)
> * [src/view/TabSet.tsx](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx)

This page provides an overview of the main React components that comprise the FlexLayout user interface. These components work together to render the layout structure, handle user interactions, and coordinate with the data model. For detailed documentation of individual components, see their respective sub-pages ([Layout Component](/caplin/FlexLayout/3.1-layout-component), [TabSet Component](/caplin/FlexLayout/3.2-tabset-component), [Tab and Button Components](/caplin/FlexLayout/3.3-tab-and-button-components), [Splitter Component](/caplin/FlexLayout/3.4-splitter-component), [Tab Overflow](/caplin/FlexLayout/3.5-tab-overflow)). For information about the underlying data structures, see [Data Model](/caplin/FlexLayout/4-data-model).

## Component Hierarchy

FlexLayout uses a hierarchical component structure where the `Layout` component serves as the public API, delegating rendering to `LayoutInternal`, which then orchestrates all other view components.

```

```

**Sources:** [src/view/Layout.tsx L87-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L87-L166)

 [src/view/Layout.tsx L191-L255](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L191-L255)

 [src/view/Layout.tsx L343-L401](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L343-L401)

## Component Responsibilities

The following table summarizes the primary responsibilities of each core component:

| Component | File | Primary Responsibility |
| --- | --- | --- |
| `Layout` | [src/view/Layout.tsx L87-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L87-L166) | Public API facade providing simple interface for consumers |
| `LayoutInternal` | [src/view/Layout.tsx L191-L1943](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L191-L1943) | Rendering orchestrator, event coordinator, drag-and-drop management |
| `Row` | Referenced in [src/view/Layout.tsx L490](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L490-L490) | Recursive container rendering hierarchical node structure |
| `TabSet` | [src/view/TabSet.tsx L23-L485](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L23-L485) | Renders tabset with header, tabs, content area, and toolbar buttons |
| `BorderTabSet` | [src/view/BorderTabSet.tsx L23-L272](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L23-L272) | Renders border tabs with orientation-aware layout |
| `TabButton` | [src/view/TabButton.tsx L20-L200](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L20-L200) | Individual tab header with drag, close, and rename capabilities |
| `BorderButton` | [src/view/BorderButton.tsx L21-L201](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx#L21-L201) | Border tab header with orientation-specific styling |
| `Splitter` | [src/view/Splitter.tsx L23-L261](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L23-L261) | Resizable divider between layout regions |

**Sources:** [src/view/Layout.tsx L1-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1-L166)

 [src/view/TabSet.tsx L1-L30](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L1-L30)

 [src/view/BorderTabSet.tsx L1-L30](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L1-L30)

 [src/view/TabButton.tsx L1-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L1-L20)

 [src/view/BorderButton.tsx L1-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx#L1-L20)

 [src/view/Splitter.tsx L1-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L1-L20)

## Rendering Pipeline

The rendering pipeline follows a top-down traversal of the model tree, with components reading from the model and delegating to child components:

```

```

**Sources:** [src/view/Layout.tsx L343-L401](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L343-L401)

 [src/view/Layout.tsx L487-L494](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L487-L494)

 [src/view/TabSet.tsx L153-L178](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L153-L178)

## Layout and LayoutInternal

The `Layout` component is a thin wrapper that provides the public API, while `LayoutInternal` performs all actual rendering and coordination work.

### Layout Component

The `Layout` component ([src/view/Layout.tsx L87-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L87-L166)

) exposes public methods for programmatic control:

* `addTabToTabSet(tabsetId, json)` - Add a tab to a specific tabset
* `addTabToActiveTabSet(json)` - Add a tab to the currently active tabset
* `addTabWithDragAndDrop(event, json, onDrop)` - Initiate drag-and-drop for adding a tab
* `moveTabWithDragAndDrop(event, node)` - Initiate drag-and-drop for moving a tab/tabset
* `setDragComponent(event, component, x, y)` - Customize drag image
* `redraw()` - Force a re-render
* `getRootDiv()` - Get the root DOM element

### LayoutInternal Component

`LayoutInternal` ([src/view/Layout.tsx L191-L1943](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L191-L1943)

) is the rendering engine with these key responsibilities:

1. **Model Traversal**: Visits model nodes and instantiates appropriate view components
2. **Event Handling**: Manages drag-and-drop, pointer events, keyboard events
3. **Window Management**: Coordinates main window and popout windows
4. **Action Dispatching**: Intercepts and dispatches actions to the model
5. **Layout Metrics**: Calculates sizes and positions for components
6. **React Portals**: Manages portals for tab content and maximized tabsets

**Sources:** [src/view/Layout.tsx L87-L166](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L87-L166)

 [src/view/Layout.tsx L191-L330](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L191-L330)

## TabSet and BorderTabSet

These components render groups of tabs with their headers and content areas.

### TabSet Component

The `TabSet` component ([src/view/TabSet.tsx L23-L485](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L23-L485)

) renders a standard tabset with:

* Tab strip (header area containing tab buttons)
* Content area (displays selected tab's content)
* Toolbar buttons (maximize, close, popout, custom buttons)
* Overflow menu (for hidden tabs when space is limited)
* Mini scrollbar (for horizontal scrolling)

Key features:

* Supports horizontal and vertical tab orientations
* Tab wrapping or scrolling modes
* Single tab stretch mode
* Customizable via `onRenderTabSet` callback

### BorderTabSet Component

The `BorderTabSet` component ([src/view/BorderTabSet.tsx L23-L272](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L23-L272)

) renders border-docked tabs with:

* Orientation-aware layout (vertical for left/right borders, horizontal for top/bottom)
* Rotated or upright icon display
* Tab scrolling with mini scrollbar
* Toolbar buttons (popout, custom buttons)

**Sources:** [src/view/TabSet.tsx L23-L178](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L23-L178)

 [src/view/TabSet.tsx L323-L439](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L323-L439)

 [src/view/BorderTabSet.tsx L23-L116](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L23-L116)

## Tab Button Components

### TabButton Component

The `TabButton` component ([src/view/TabButton.tsx L20-L200](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L20-L200)

) renders individual tab headers in a tabset with:

* Leading icon area
* Content area (tab name or rename input)
* Close button (conditional visibility based on `closeType`)
* Drag-and-drop support
* Selection state styling
* Context menu and auxiliary mouse click handling

Supports inline rename: double-clicking a tab enters edit mode if `enableRename` is true.

### BorderButton Component

The `BorderButton` component ([src/view/BorderButton.tsx L21-L201](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx#L21-L201)

) is similar to `TabButton` but adapted for border tabs:

* Orientation-specific styling for left/right/top/bottom borders
* Optional icon rotation for vertical borders
* Similar drag, close, and interaction capabilities

**Sources:** [src/view/TabButton.tsx L20-L118](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L20-L118)

 [src/view/BorderButton.tsx L21-L141](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx#L21-L141)

## Splitter Component

The `Splitter` component ([src/view/Splitter.tsx L23-L261](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L23-L261)

) renders resizable dividers between layout regions:

* Horizontal or vertical orientation based on parent node
* Drag handle (optional, configurable via model)
* Visual feedback during dragging
* Bounded movement within calculated limits
* Optional realtime resize during drag
* Extended hit area on mobile devices

The splitter interacts with the model to calculate valid bounds ([src/view/Splitter.tsx L69](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L69-L69)

) and dispatches `Actions.adjustWeights` or `Actions.adjustBorderSplit` actions when dragging completes.

**Sources:** [src/view/Splitter.tsx L23-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L23-L100)

 [src/view/Splitter.tsx L132-L171](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L132-L171)

## Component Communication Patterns

FlexLayout components follow these communication patterns:

```

```

1. **Read Pattern**: Components receive a `node` prop and read attributes via getter methods
2. **Event Pattern**: User interactions are captured by components and forwarded to `LayoutInternal`
3. **Action Pattern**: `LayoutInternal` creates `Action` objects and dispatches them via `doAction()`
4. **Update Pattern**: Model notifies `LayoutInternal` of changes, triggering React re-render

**Sources:** [src/view/Layout.tsx L750-L760](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L750-L760)

 [src/view/Layout.tsx L733-L738](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L733-L738)

 [src/view/TabButton.tsx L56-L58](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L56-L58)

 [src/view/Splitter.tsx L147-L171](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L147-L171)

## Component Props and Interfaces

### ILayoutProps

The `Layout` component accepts these props ([src/view/Layout.tsx L32-L82](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L32-L82)

):

| Prop | Type | Purpose |
| --- | --- | --- |
| `model` | `Model` | The data model instance |
| `factory` | `(node: TabNode) => React.ReactNode` | Factory function for rendering tab content |
| `icons` | `IIcons` | Custom icon overrides |
| `onAction` | `(action: Action) => Action \| undefined` | Action interceptor for validation/logging |
| `onRenderTab` | Callback | Customize tab rendering |
| `onRenderTabSet` | Callback | Customize tabset rendering |
| `onModelChange` | `(model: Model, action: Action) => void` | Model change notification |
| `onExternalDrag` | Callback | Handle external drag-and-drop |
| `classNameMapper` | `(className: string) => string` | CSS class name mapping for CSS modules |
| `i18nMapper` | Callback | Internationalization string mapping |
| `supportsPopout` | `boolean` | Enable/disable popout window support |
| `popoutURL` | `string` | URL for popout window (default: "popout.html") |
| `realtimeResize` | `boolean` | Update layout during splitter drag |

### Internal Component Props

Internal components receive props from their parent components:

* `TabSet`: `{ layout: LayoutInternal, node: TabSetNode }`
* `TabButton`: `{ layout: LayoutInternal, node: TabNode, selected: boolean, path: string }`
* `BorderTabSet`: `{ layout: LayoutInternal, border: BorderNode, size: number }`
* `BorderButton`: `{ layout: LayoutInternal, node: TabNode, selected: boolean, border: string, icons: IIcons, path: string }`
* `Splitter`: `{ layout: LayoutInternal, node: RowNode | BorderNode, index: number, horizontal: boolean }`

All internal components receive a reference to `LayoutInternal` for coordinating actions and accessing shared state.

**Sources:** [src/view/Layout.tsx L32-L82](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L32-L82)

 [src/view/TabSet.tsx L17-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L17-L20)

 [src/view/TabButton.tsx L12-L17](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L12-L17)

 [src/view/BorderTabSet.tsx L16-L20](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L16-L20)

 [src/view/BorderButton.tsx L11-L18](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderButton.tsx#L11-L18)

 [src/view/Splitter.tsx L12-L17](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L12-L17)

## Component Lifecycle and Hooks

FlexLayout components use React hooks for lifecycle management:

### useLayoutEffect

Used extensively to measure DOM elements and update the model's cached rectangles:

* `TabSet` measures tabset and content rectangles ([src/view/TabSet.tsx L37-L58](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L37-L58) )
* `TabButton` measures tab rectangle ([src/view/TabButton.tsx L26-L31](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L26-L31) )
* `BorderTabSet` measures border header rectangle ([src/view/BorderTabSet.tsx L34-L36](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L34-L36) )

### useTabOverflow Hook

The `useTabOverflow` hook ([src/view/TabSet.tsx L62-L64](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L62-L64)

) manages tab overflow behavior:

* Tracks scroll position
* Identifies hidden tabs
* Manages mini scrollbar
* Determines when to show overflow menu
* Controls sticky button docking

This hook is used by both `TabSet` and `BorderTabSet` to provide consistent overflow behavior.

### useRef

Components use refs to:

* Access DOM elements for measurement
* Store mutable values across renders (without triggering re-renders)
* Maintain timers and transient state

**Sources:** [src/view/TabSet.tsx L26-L64](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L26-L64)

 [src/view/TabButton.tsx L22-L31](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L22-L31)

 [src/view/BorderTabSet.tsx L26-L41](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/BorderTabSet.tsx#L26-L41)

 [src/view/Splitter.tsx L26-L34](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Splitter.tsx#L26-L34)

## Drag-and-Drop Integration

Components integrate with the drag-and-drop system coordinated by `LayoutInternal`:

1. **Drag Source**: `TabButton`, `BorderButton`, and `TabSet` components implement `onDragStart` handlers that call `layout.setDragNode(event, node)` to initiate dragging
2. **Drag Target**: `LayoutInternal` handles `onDragEnter`, `onDragOver`, and `onDrop` events to determine valid drop locations and execute drop actions
3. **Visual Feedback**: Drag outline and overlay are managed by `LayoutInternal` and rendered at the layout root level

**Sources:** [src/view/TabButton.tsx L33-L40](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L33-L40)

 [src/view/TabSet.tsx L89-L100](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L89-L100)

 [src/view/Layout.tsx L1081-L1208](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L1081-L1208)

## Component Styling

Components use CSS class names that follow the `CLASSES.FLEXLAYOUT__*` naming convention ([src/Types.ts](https://github.com/caplin/FlexLayout/blob/40753f37/src/Types.ts)

). The `classNameMapper` prop allows customization for CSS modules support.

Each component applies:

* Base structural classes (e.g., `flexlayout__tabset`)
* State-specific classes (e.g., `flexlayout__tabset--selected`)
* Location-specific classes (e.g., `flexlayout__tabset_top`)
* Custom classes from model attributes (e.g., `node.getClassName()`)

For theming details, see [Styling and Theming](/caplin/FlexLayout/5-styling-and-theming).

**Sources:** [src/view/TabSet.tsx L325-L344](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabSet.tsx#L325-L344)

 [src/view/TabButton.tsx L119-L137](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/TabButton.tsx#L119-L137)

 [src/view/Layout.tsx L802-L808](https://github.com/caplin/FlexLayout/blob/40753f37/src/view/Layout.tsx#L802-L808)