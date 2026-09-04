# Vue Integration (@open-file-viewer/vue)

> **Relevant source files**
> * [examples/vue/src/main.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/vue/src/main.ts)
> * [packages/svelte/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/package.json)
> * [packages/vue/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/package.json)
> * [packages/vue/src/index.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts)
> * [packages/vue/src/index.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts)

The `@open-file-viewer/vue` package provides a Vue 3 adapter for the Open File Viewer core engine. It wraps the imperative `createViewer` API into a declarative `OpenFileViewer` component, managing the lifecycle of the viewer instance in sync with Vue's reactivity system.

## Component Overview

The `OpenFileViewer` component acts as a bridge between Vue's virtual DOM and the core's direct DOM manipulation. It handles initialization on mount, updates via watchers, and proper cleanup to prevent memory leaks.

### Props and Configuration

The component supports a comprehensive set of props that mirror the `PreviewOptions` interface from `@open-file-viewer/core`.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | `PreviewSource` | `undefined` | The file to preview (URL, Blob, File, or ArrayBuffer). |
| `files` | `PreviewFile[]` | `undefined` | A list of files for the viewer queue. |
| `plugins` | `PreviewPlugin[]` | `[]` | Array of plugins used to render different file types. |
| `theme` | `PreviewTheme` | `"light"` | UI theme: `"light"`, `"dark"`, or `"auto"`. |
| `width` | `string \| number` | `"100%"` | Container width. |
| `height` | `string \| number` | `"600px"` | Container height. |
| `toolbar` | `boolean \| object` | `false` | Toolbar configuration or toggle. |
| `className` | `string` | `undefined` | CSS class applied to the root element. |

**Sources:** [packages/vue/src/index.ts L24-L68](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L24-L68)

 [packages/vue/src/index.ts L187](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L187-L187)

### Events (Emits)

The component emits standard lifecycle events. If a corresponding callback prop (e.g., `onLoad`) is provided, the callback takes precedence and the event is not emitted.

* `load`: Emitted when a file is successfully rendered. [packages/vue/src/index.ts L70](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L70-L70)
* `error`: Emitted when rendering fails. [packages/vue/src/index.ts L71](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L71-L71)
* `unsupported`: Emitted when no plugin matches the file. [packages/vue/src/index.ts L72](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L72-L72)

## Implementation Details

### Lifecycle Management

The component uses a `mount` function to orchestrate the `FileViewer` instance. This function is triggered during the `onMounted` hook and whenever reactive props change via a deep `watch`.

1. **Cleanup**: Before creating a new viewer, any existing `viewer` instance is destroyed via `viewer.destroy()`. [packages/vue/src/index.ts L89](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L89-L89)
2. **Initialization**: `createViewer` is called with the current props and a reference to the container `div`. [packages/vue/src/index.ts L90-L133](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L90-L133)
3. **Unmount**: During `onBeforeUnmount`, the viewer and any custom toolbar mounts are explicitly destroyed. [packages/vue/src/index.ts L161-L168](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L161-L168)

### Toolbar Slot Pattern

The Vue adapter supports a custom toolbar via a named `#toolbar` slot. This implementation uses a manual `render()` call from Vue to mount the slot content into a DOM element managed by the core engine.

**Vue Toolbar Rendering Flow**

```

```

**Sources:** [packages/vue/src/index.ts L100-L110](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L100-L110)

 [packages/vue/src/index.ts L174-L185](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L174-L185)

### Component Architecture

The following diagram illustrates how the Vue component interacts with the Core library and manages its internal state.

**OpenFileViewer Internal Structure**

```

```

**Sources:** [packages/vue/src/index.ts L22-L172](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L22-L172)

 [packages/vue/src/index.ts L1](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L1-L1)

## Usage Example

To use the viewer in a Vue application, import the component and provide the necessary plugins.

```

```

**Sources:** [examples/vue/src/main.ts L1-L21](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/vue/src/main.ts#L1-L21)

 [examples/vue/src/main.ts L35-L52](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/vue/src/main.ts#L35-L52)

### Custom Toolbar via Slot

You can access the viewer's state (index, length, file info) and commands (next, prev) directly within the template.

```

```

**Sources:** [packages/vue/src/index.test.ts L99-L105](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts#L99-L105)

## Technical Constraints

* **Re-mounting**: The adapter currently re-mounts the entire viewer instance (destroy and create) when any major prop changes to ensure a clean state. [packages/vue/src/index.ts L136-L157](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L136-L157)
* **CSS Namespace**: All Vue-specific toolbar wrappers are assigned the `.ofv-vue-toolbar` and `.ofv-vue-toolbar-content` classes for styling isolation. [packages/vue/src/index.ts L105-L183](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L105-L183)
* **Peer Dependencies**: Requires `@open-file-viewer/core` and `vue` (version 3 or higher). [packages/vue/package.json L37-L40](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/package.json#L37-L40)

**Sources:** [packages/vue/src/index.ts L105](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L105-L105)

 [packages/vue/src/index.ts L183](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.ts#L183-L183)