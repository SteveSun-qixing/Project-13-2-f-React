# Framework Adapter Tests & Smoke Tests

> **Relevant source files**
> * [packages/core/src/plugins/render-smoke.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts)
> * [packages/core/src/style.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.test.ts)
> * [packages/react/src/index.test.tsx](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx)
> * [packages/svelte/test/OpenFileViewer.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts)
> * [packages/svelte/test/ToolbarHarness.test.svelte](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/ToolbarHarness.test.svelte)
> * [packages/vue/src/index.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts)

This section documents the integration and framework-specific testing infrastructure for Open File Viewer. These tests ensure that the core engine interacts correctly with framework lifecycles (React, Vue, Svelte) and that CSS layout constraints remain robust across all supported file types.

## 1. Core Render Smoke Tests

The `render-smoke.test.ts` file performs end-to-end integration testing by instantiating the viewer with real plugins and verifying DOM output under constrained conditions.

### Implementation Details

The smoke tests verify two primary conditions:

1. **Narrow Host Rendering**: The viewer is mounted in a container with a fixed narrow width (e.g., 240px or 280px) to ensure that content wraps correctly and does not cause horizontal overflow of the host [packages/core/src/plugins/render-smoke.test.ts L108-L112](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L108-L112)  [packages/core/src/plugins/render-smoke.test.ts L145-L148](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L145-L148)
2. **Plugin Selection & Text Presence**: It validates that the correct plugin matches the file and that expected text content is rendered within the specific CSS selector for that plugin [packages/core/src/plugins/render-smoke.test.ts L126-L130](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L126-L130)

### Mocking Strategy

To avoid heavy dependencies during smoke tests, several complex libraries are mocked:

* **Office**: `docx-preview` and `@aiden0z/pptx-renderer` are mocked to append simple text nodes [packages/core/src/plugins/render-smoke.test.ts L23-L51](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L23-L51)
* **GIS**: `leaflet`, `topojson-client`, and `shpjs` are mocked to simulate map initialization without a browser graphics context [packages/core/src/plugins/render-smoke.test.ts L63-L95](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L63-L95)

### Smoke Test Data Flow

The following diagram illustrates how `createViewer` is exercised during a smoke test:

**Viewer Smoke Test Pipeline**

```

```

Sources: [packages/core/src/plugins/render-smoke.test.ts L53-L61](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L53-L61)

, [packages/core/src/plugins/render-smoke.test.ts L115-L141](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L115-L141)

---

## 2. Framework Adapter Tests

Each framework package (@open-file-viewer/react, vue, and svelte) has a dedicated test suite to verify component lifecycle management and prop-to-core synchronization.

### 2.1 React Adapter (index.test.tsx)

The React tests use `@testing-library/react` to verify that the `FileViewer` component correctly manages the underlying `createViewer` instance.

* **Plugin Hot-Swapping**: Verifies that if the `plugins` prop changes, the previous viewer instance is destroyed and a new one is created [packages/react/src/index.test.tsx L12-L33](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L12-L33)
* **Custom Toolbar**: Tests the `renderToolbar` prop, ensuring it receives the `PreviewContext` and can trigger commands like `ctx.next()` [packages/react/src/index.test.tsx L73-L94](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L73-L94)

### 2.2 Vue Adapter (index.test.ts)

The Vue tests verify the `OpenFileViewer` component's reactivity and slot system.

* **Event Emission**: Ensures that when an unsupported file is loaded, the component emits an `unsupported` event [packages/vue/src/index.test.ts L76-L88](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts#L76-L88)
* **Scoped Slots**: Validates the `toolbar` slot, checking that the `ctx` object is correctly passed to the slot template for custom UI rendering [packages/vue/src/index.test.ts L90-L117](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts#L90-L117)

### 2.3 Svelte Adapter (OpenFileViewer.test.ts)

The Svelte tests focus on the `afterUpdate` lifecycle and slot fragments.

* **Cleanup Verification**: Ensures that the `ofv-root` and custom `className` are removed from the container when the component is unmounted [packages/svelte/test/OpenFileViewer.test.ts L58-L76](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts#L58-L76)
* **Toolbar Harness**: Uses a helper component `ToolbarHarness.test.svelte` to test the Svelte `slot="toolbar"` functionality [packages/svelte/test/ToolbarHarness.test.svelte L1-L17](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/ToolbarHarness.test.svelte#L1-L17)  [packages/svelte/test/OpenFileViewer.test.ts L78-L98](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts#L78-L98)

### Adapter Comparison Table

| Feature | React (`FileViewer`) | Vue (`OpenFileViewer`) | Svelte (`OpenFileViewer`) |
| --- | --- | --- | --- |
| **Instance Re-creation** | `useEffect` on `plugins` change | `watch` on `plugins` change | `afterUpdate` (depsChanged) |
| **Custom Toolbar** | `renderToolbar` prop (Function) | `toolbar` slot | `toolbar` slot |
| **Style Hook** | `className` prop | `className` prop | `className` prop |
| **Cleanup** | `unmount()` calls `destroy()` | `onBeforeUnmount` calls `destroy()` | `onDestroy` calls `destroy()` |

Sources: [packages/react/src/index.test.tsx L1-L108](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L1-L108)

, [packages/vue/src/index.test.ts L1-L131](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts#L1-L131)

, [packages/svelte/test/OpenFileViewer.test.ts L1-L112](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts#L1-L112)

---

## 3. CSS & Style Verification

The `style.test.ts` file ensures that the core CSS design system maintains layout integrity. Instead of rendering, it parses the `style.css` file and verifies the presence of critical responsive rules.

### Layout Constraints

The test suite enforces several rules to prevent UI breakage:

* **Containment**: Verifies `.ofv-root` and `.ofv-viewport` have `max-width: 100%` and `min-width: 0` to prevent them from expanding beyond their parent [packages/core/src/style.test.ts L9-L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.test.ts#L9-L18)
* **Toolbar Wrapping**: Ensures `.ofv-toolbar` uses `flex-wrap: wrap` so that controls do not overflow in narrow viewports [packages/core/src/style.test.ts L20-L36](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.test.ts#L20-L36)
* **Local Scrolling**: Checks that large document types (PDF, Code, Markdown, DOCX) are constrained to local scroll regions [packages/core/src/style.test.ts L38-L73](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.test.ts#L38-L73)

**Style Verification Map**

```

```

Sources: [packages/core/src/style.test.ts L1-L112](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/style.test.ts#L1-L112)

---

## 4. Testing Harnesses

### ToolbarHarness.test.svelte

A specialized test utility for the Svelte adapter. It wraps `OpenFileViewer` to provide a concrete implementation of the `toolbar` slot, allowing Vitest to simulate user interaction with the context-aware toolbar buttons [packages/svelte/test/ToolbarHarness.test.svelte L9-L17](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/ToolbarHarness.test.svelte#L9-L17)

### Mock Plugin Factory

A common pattern across framework tests is the `createPlugin` helper. It creates a minimal `PreviewPlugin` that renders a text node containing the file name and tracks its own destruction [packages/react/src/index.test.tsx L97-L108](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L97-L108)

 [packages/vue/src/index.test.ts L120-L131](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/vue/src/index.test.ts#L120-L131)

 [packages/svelte/test/OpenFileViewer.test.ts L101-L112](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/OpenFileViewer.test.ts#L101-L112)

Sources: [packages/svelte/test/ToolbarHarness.test.svelte L1-L18](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/svelte/test/ToolbarHarness.test.svelte#L1-L18)

, [packages/react/src/index.test.tsx L97-L108](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/react/src/index.test.tsx#L97-L108)