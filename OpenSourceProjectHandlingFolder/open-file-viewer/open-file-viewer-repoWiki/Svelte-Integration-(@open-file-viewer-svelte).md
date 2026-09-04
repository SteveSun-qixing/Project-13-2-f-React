# Svelte Integration (@open-file-viewer/svelte)

> **Relevant source files**
> * [examples/svelte/index.html](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/index.html)
> * [examples/svelte/package.json](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/package.json)
> * [examples/svelte/src/App.svelte](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/src/App.svelte)
> * [examples/svelte/src/main.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/src/main.ts)
> * [examples/svelte/src/style.css](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/src/style.css)
> * [examples/svelte/vite.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/vite.config.ts)
> * [packages/svelte/src/OpenFileViewer.svelte](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte)
> * [packages/svelte/src/index.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/index.ts)
> * [packages/svelte/src/types.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/types.ts)
> * [packages/svelte/svelte.config.js](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/svelte.config.js)
> * [packages/svelte/test/OpenFileViewer.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts)

The `@open-file-viewer/svelte` package provides a Svelte component wrapper for the core Open File Viewer engine. It manages the lifecycle of the `FileViewer` instance, mapping Svelte's reactive props to the underlying `createViewer` API and providing idiomatic access to the toolbar system via slots.

## Component Overview

The primary export is the `OpenFileViewer` component [packages/svelte/src/index.ts L1](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/index.ts#L1-L1)

 It encapsulates the imperative `createViewer` logic within Svelte's declarative framework.

### Exported Props

The component props closely mirror the `PreviewOptions` interface from `@open-file-viewer/core`, excluding the `container` property which is handled internally via `bind:this` [packages/svelte/src/OpenFileViewer.svelte L10-L26](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L10-L26)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | `PreviewSource` | `undefined` | The primary file to render. |
| `files` | `PreviewSource[]` | `undefined` | A queue of files for multi-file navigation. |
| `plugins` | `PreviewPlugin[]` | `[]` | Array of plugins to enable. |
| `theme` | `"light" \| "dark" \| "auto"` | `"light"` | Visual theme. |
| `toolbar` | `boolean \| PreviewToolbarOptions` | `false` | Toolbar configuration. |
| `width` / `height` | `string` | `"100%"` / `"600px"` | Container dimensions. |
| `className` | `string` | `undefined` | CSS class for the root element. |

**Sources:** [packages/svelte/src/OpenFileViewer.svelte L10-L26](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L10-L26)

 [packages/svelte/src/types.ts L3-L7](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/types.ts#L3-L7)

## Implementation Details

### Dependency Diffing Pattern

Svelte 5 components often use `$effect` or `afterUpdate` to synchronize with imperative libraries. This component uses a manual dependency tracking mechanism to determine when the `FileViewer` instance needs to be destroyed and recreated.

The `getDeps()` function collects all reactive inputs into an array [packages/svelte/src/OpenFileViewer.svelte L64-L85](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L64-L85)

 The `depsChanged()` function performs a shallow comparison using `Object.is` against the `previousDeps` cache [packages/svelte/src/OpenFileViewer.svelte L87-L89](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L87-L89)

### Lifecycle Management

1. **`onMount`**: Sets the `mounted` flag, captures initial dependencies, and calls `mountViewer()` [packages/svelte/src/OpenFileViewer.svelte L126-L136](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L126-L136)
2. **`afterUpdate`**: Checks if dependencies have changed. If so, it cleans up the old instance and initializes a new one [packages/svelte/src/OpenFileViewer.svelte L138-L148](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L138-L148)
3. **`onDestroy` (via return in `onMount`)**: Ensures `viewer.destroy()` is called to prevent memory leaks and remove DOM listeners [packages/svelte/src/OpenFileViewer.svelte L131-L135](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L131-L135)

### Data Flow and Initialization

Title: Svelte Component Initialization Flow

```

```

**Sources:** [packages/svelte/src/OpenFileViewer.svelte L98-L148](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L98-L148)

## Toolbar Integration

The component supports three ways to render a toolbar:

1. **Default**: Passing `toolbar: true` uses the core's built-in UI.
2. **Render Prop**: Passing `renderToolbar` function [packages/svelte/src/OpenFileViewer.svelte L54-L59](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L54-L59)
3. **Named Slot**: Using `<slot name="toolbar">` for idiomatic Svelte UI [packages/svelte/src/OpenFileViewer.svelte L42-L52](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L42-L52)

### The Toolbar Slot Pattern

When the `toolbar` slot is detected via `$$slots.toolbar`, the component overrides the `toolbar.render` configuration [packages/svelte/src/OpenFileViewer.svelte L45-L50](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L45-L50)

 It creates a hidden `toolbarMount` element that is passed to the core. Inside the Svelte template, a `toolbarSlotHost` contains the actual slot content.

The `syncToolbarSlot()` function is called during `afterUpdate` to physically move the Svelte-rendered DOM into the core-managed toolbar container [packages/svelte/src/OpenFileViewer.svelte L91-L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L91-L96)

Title: Toolbar Slot Portal Mapping

```

```

**Sources:** [packages/svelte/src/OpenFileViewer.svelte L41-L62](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L41-L62)

 [packages/svelte/src/OpenFileViewer.svelte L91-L96](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L91-L96)

 [packages/svelte/src/OpenFileViewer.svelte L154-L158](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/src/OpenFileViewer.svelte#L154-L158)

## Project Configuration

To use the Svelte adapter in a project, ensure the following setup:

### svelte.config.js

The package requires `vitePreprocess` to handle TypeScript within the Svelte files [packages/svelte/svelte.config.js L1-L5](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/svelte.config.js#L1-L5)

### Example Usage

```

```

**Sources:** [examples/svelte/src/App.svelte L1-L75](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/examples/svelte/src/App.svelte#L1-L75)

 [packages/svelte/test/OpenFileViewer.test.ts L78-L98](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts#L78-L98)