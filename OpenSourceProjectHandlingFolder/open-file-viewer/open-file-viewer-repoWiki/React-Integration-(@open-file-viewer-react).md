# React Integration (@open-file-viewer/react)

> **Relevant source files**
> * [examples/react/src/main.tsx](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/react/src/main.tsx)
> * [examples/vanilla/src/main.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/vanilla/src/main.ts)
> * [packages/react/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/package.json)
> * [packages/react/src/index.test.tsx](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx)
> * [packages/react/src/index.tsx](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx)

The `@open-file-viewer/react` package provides a React adapter for the Open File Viewer core. It wraps the imperative `createViewer` API into a declarative `FileViewer` component, managing the viewer's lifecycle, prop synchronization, and React-based toolbar rendering.

## Component Overview

The `FileViewer` component serves as the primary entry point for React applications. It mirrors the `PreviewOptions` from the core library but removes the requirement for a manual `container` element, instead utilizing an internal `useRef` to manage the mounting point.

### Props Definition

The `FileViewerProps` type extends `PreviewOptions` (excluding `container`) and adds React-specific styling and rendering hooks.

| Prop | Type | Description |
| --- | --- | --- |
| `file` | `PreviewFile` | The file to be previewed. |
| `plugins` | `PreviewPlugin[]` | Array of plugins to use for rendering. |
| `className` | `string` | Optional CSS class for the root container. |
| `style` | `CSSProperties` | Inline styles for the container. |
| `renderToolbar` | `(ctx) => ReactNode` | A hook to render a custom toolbar using React components. |
| `theme` | `PreviewTheme` | "light", "dark", or "auto". |

Sources: [packages/react/src/index.tsx L12-L16](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L12-L16)

 [packages/react/src/index.tsx L18-L25](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L18-L25)

## Lifecycle Management

The component utilizes a `useEffect` hook to synchronize the React component state with the underlying `@open-file-viewer/core` instance.

### Initialization and Updates

When the component mounts or any of its reactive dependencies change (such as `file`, `plugins`, or `theme`), the following flow occurs:

1. **Cleanup**: Any existing `CoreFileViewer` instance stored in `viewerRef` is destroyed via `viewerRef.current?.destroy()` [packages/react/src/index.tsx L50](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L50-L50)
2. **Toolbar Preparation**: If `renderToolbar` is provided, a bridge is created between the core's DOM-based toolbar system and React's `createRoot` [packages/react/src/index.tsx L35-L48](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L35-L48)
3. **Core Initialization**: `createViewer` is called with the merged options and the `containerRef.current` [packages/react/src/index.tsx L51-L58](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L51-L58)

### Data Flow and Lifecycle

The following diagram illustrates how the React component orchestrates the core viewer lifecycle.

**Diagram: React to Core Lifecycle Bridge**

```

```

Sources: [packages/react/src/index.tsx L26-L65](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L26-L65)

 [packages/react/src/index.tsx L66-L84](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L66-L84)

## Toolbar Integration

One of the key features of the React adapter is the ability to render complex toolbars using React components while maintaining access to the core viewer's internal state (e.g., zoom levels, page numbers, or file navigation).

### Custom Toolbar Rendering

When the `renderToolbar` prop is used, the adapter implements a "portal-like" pattern:

1. It overrides the `toolbar.render` method passed to the core [packages/react/src/index.tsx L40-L47](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L40-L47)
2. Inside this method, it creates a new `div` with the class `ofv-react-toolbar`.
3. It uses `createRoot` from `react-dom/client` to mount the React-rendered toolbar into that `div`.
4. It passes the `PreviewToolbarRenderContext` (containing methods like `next()`, `prev()`, and state like `index`) directly to the React function [packages/react/src/index.tsx L45](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L45-L45)

**Diagram: Toolbar Mount Pattern**

```

```

Sources: [packages/react/src/index.tsx L34-L48](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L34-L48)

 [packages/react/src/index.test.tsx L73-L94](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L73-L94)

## Implementation Details

### Performance Optimization

Because `createViewer` re-initializes the entire rendering pipeline, it is critical that the `plugins` array remains stable. Users are encouraged to use `useMemo` for plugin arrays to prevent unnecessary re-renders of the viewer.

```

```

Sources: [examples/react/src/main.tsx L34-L54](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/react/src/main.tsx#L34-L54)

 [packages/react/src/index.test.tsx L12-L33](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L12-L33)

### Clean-up Logic

The `useEffect` return block ensures that all resources are released when the component unmounts:

* `toolbarRoot?.unmount()`: Unmounts the React-rendered toolbar [packages/react/src/index.tsx L61](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L61-L61)
* `viewerRef.current?.destroy()`: Calls the core's destroy method to clean up event listeners, ResizeObservers, and plugin-specific DOM elements [packages/react/src/index.tsx L63](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L63-L63)

### Prop Mapping

The adapter maps React-specific props to the core `PreviewOptions`:

* `className`: Passed to `createViewer` to allow the core to apply the class to the root `.ofv-root` element [packages/react/src/index.tsx L56](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L56-L56)
* `width`/`height`: Defaults to `100%` and `600px` respectively [packages/react/src/index.tsx L21-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L21-L22)

Sources: [packages/react/src/index.tsx L18-L25](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.tsx#L18-L25)

 [packages/react/src/index.test.tsx L51-L71](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L51-L71)