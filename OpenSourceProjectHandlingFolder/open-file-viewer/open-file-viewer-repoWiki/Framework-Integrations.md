# Framework Integrations

> **Relevant source files**
> * [packages/react/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/package.json)
> * [packages/svelte/README.md](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/README.md?plain=1)
> * [packages/svelte/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/package.json)
> * [packages/vue/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/package.json)

The Open File Viewer project provides first-class support for popular modern web frameworks through dedicated adapter packages. These adapters act as thin wrappers around the `@open-file-viewer/core` engine, specifically the `createViewer` orchestration function, to provide a declarative component-based API.

Each adapter handles the imperative lifecycle of the viewer—initialization, property updates, and cleanup—within the framework's native idiomatic patterns (e.g., Hooks, Slots, or Props).

### Framework Adapter Architecture

The adapters bridge the gap between the framework's reactive state and the core's DOM-based rendering. They primarily manage the `PreviewOptions` configuration and the lifecycle of the `PreviewInstance`.

#### Conceptual Bridge: Framework to Core

The following diagram illustrates how framework components map their internal state to core entities.

"Framework Component to Core Engine Mapping"

```

```

Sources: [packages/react/package.json L38-L40](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/package.json#L38-L40)

 [packages/vue/package.json L37-L39](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/package.json#L37-L39)

 [packages/svelte/package.json L36-L38](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/package.json#L36-L38)

### Adapter Package Overview

| Package | Framework | Primary Component | Key Integration Pattern |
| --- | --- | --- | --- |
| `@open-file-viewer/react` | React 18+ | `FileViewer` | `useEffect` for lifecycle, `useMemo` for plugin stability. |
| `@open-file-viewer/vue` | Vue 3+ | `OpenFileViewer` | `watch` for prop changes, `slots` for toolbar customization. |
| `@open-file-viewer/svelte` | Svelte 4/5 | `OpenFileViewer` | `afterUpdate` for dependency diffing, named slots for toolbar. |

### Common Features

Across all adapters, the following core capabilities are preserved:

* **Prop Mirroring**: Components accept almost all `PreviewOptions` as props, excluding the `container` (which the adapter manages internally).
* **Plugin Injection**: Plugins created via core factory functions (e.g., `pdfPlugin()`) are passed directly to the component.
* **Theming**: Support for `light`, `dark`, and `auto` themes via the `theme` prop.
* **Toolbar Customization**: Each adapter provides a mechanism to override the default toolbar using framework-native templating (Slots or Render Props).

---

### React Integration (@open-file-viewer/react)

The React adapter provides the `FileViewer` component. It uses a `useMemo` pattern for plugin configuration to prevent unnecessary re-renders and leverages `createRoot` for mounting React-rendered toolbars into the core's DOM structure.

For details, see [React Integration (@open-file-viewer/react)](/xushanpei/open-file-viewer/4.1-react-integration-(@open-file-viewerreact)).

### Vue Integration (@open-file-viewer/vue)

The Vue adapter provides the `OpenFileViewer` component. It utilizes Vue's reactivity system to watch for changes in file or plugin props, triggering a clean re-mount of the underlying core instance. It supports a flexible `toolbar` slot for custom UI.

For details, see [Vue Integration (@open-file-viewer/vue)](/xushanpei/open-file-viewer/4.2-vue-integration-(@open-file-viewervue)).

### Svelte Integration (@open-file-viewer/svelte)

The Svelte adapter provides the `OpenFileViewer` component. It uses Svelte's lifecycle hooks (`onMount`, `onDestroy`) and a dependency-diffing pattern in `afterUpdate` to ensure the viewer stays in sync with Svelte's state.

For details, see [Svelte Integration (@open-file-viewer/svelte)](/xushanpei/open-file-viewer/4.3-svelte-integration-(@open-file-viewersvelte)).

"Adapter Implementation Flow"

```

```

Sources: [packages/svelte/README.md L47-L57](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/README.md?plain=1#L47-L57)

 [packages/svelte/README.md L59-L72](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/README.md?plain=1#L59-L72)