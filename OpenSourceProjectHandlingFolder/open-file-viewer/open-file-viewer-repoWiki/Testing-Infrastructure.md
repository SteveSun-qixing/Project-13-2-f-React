# Testing Infrastructure

> **Relevant source files**
> * [packages/core/README.md](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/README.md?plain=1)
> * [packages/core/src/plugins/render-smoke.test.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts)
> * [scripts/check-package-exports.mjs](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs)
> * [vitest.config.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts)
> * [vitest.setup.ts](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts)

The Open File Viewer testing infrastructure is built on **Vitest** and **jsdom**, providing a fast, browser-simulated environment for verifying the core engine, individual plugins, and framework adapters. The suite ranges from low-level unit tests for file detection logic to complex smoke tests that verify the visual integrity of the viewer inside narrow containers.

## Test Configuration

The test runner is configured via `vitest.config.ts`, which sets up the browser environment and path aliases to allow testing against source files across the monorepo packages.

### Vitest Environment

* **Environment**: Uses `jsdom` to simulate a browser DOM [vitest.config.ts L17](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L17-L17)
* **Aliases**: Resolves `@open-file-viewer/core`, `@open-file-viewer/react`, `@open-file-viewer/vue`, and `@open-file-viewer/svelte` directly to their respective `src` directories for testing uncompiled code [vitest.config.ts L9-L14](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L9-L14)
* **Setup**: Executes `vitest.setup.ts` before tests to polyfill browser APIs not present in jsdom [vitest.config.ts L19](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L19-L19)

### Browser Polyfills (vitest.setup.ts)

Since jsdom lacks several modern browser APIs used by the viewer, the setup file provides stubs:

* `ResizeObserverStub`: Mocks the observer used for responsive layout adjustments [vitest.setup.ts L3-L7](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts#L3-L7)
* `IntersectionObserverStub`: Mocks the observer used for lazy-loading pages in the PDF and Office plugins [vitest.setup.ts L9-L37](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts#L9-L37)
* `matchMedia`: Stubs the theme detection system [vitest.setup.ts L51-L60](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts#L51-L60)
* `HTMLMediaElement`: Mocks `play`, `pause`, and `load` for audio/video plugin testing [vitest.setup.ts L62-L78](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts#L62-L78)

**Sources:** [vitest.config.ts L1-L22](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L1-L22)

 [vitest.setup.ts L1-L79](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.setup.ts#L1-L79)

## Testing Architecture

The following diagram illustrates how the testing infrastructure interacts with the codebase and external assets.

### Test Entity Relationship

"Test Infrastructure Overview"

```

```

**Sources:** [vitest.config.ts L5-L21](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/vitest.config.ts#L5-L21)

 [packages/core/src/plugins/render-smoke.test.ts L1-L21](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L1-L21)

## Plugin & Smoke Testing

Testing is split between verifying specific plugin logic and ensuring the viewer can render various file types without crashing or breaking layout.

### Plugin Unit Tests

Each plugin (e.g., `pdfPlugin`, `officePlugin`) has associated unit tests that verify:

* **Matching Logic**: Does the plugin correctly claim a file based on extension or MIME type?
* **Rendering Flow**: Does the plugin append the expected DOM elements to the container?
* **Command Handling**: Does the plugin respond to zoom, rotate, or search commands?

For details on individual plugin test files and the shared asset directory, see [Plugin Unit Tests](/xushanpei/open-file-viewer/6.1-plugin-unit-tests).

### Render Smoke Tests

The `render-smoke.test.ts` file performs high-level integration testing. It uses `createViewer` to render a wide variety of "smoke cases" into narrow containers (e.g., 280px width) to ensure the UI remains responsive and does not overflow [packages/core/src/plugins/render-smoke.test.ts L108-L142](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L108-L142)

It utilizes `vi.mock` to stub heavy dependencies like `leaflet`, `docx-preview`, and `pptx-renderer` to keep tests fast and deterministic [packages/core/src/plugins/render-smoke.test.ts L23-L51](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L23-L51)

 [packages/core/src/plugins/render-smoke.test.ts L63-L80](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L63-L80)

**Sources:** [packages/core/src/plugins/render-smoke.test.ts L23-L142](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/packages/core/src/plugins/render-smoke.test.ts#L23-L142)

## Framework & Integration Tests

Framework adapters are tested to ensure they correctly wrap the core `createViewer` lifecycle.

* **Lifecycle Verification**: Tests ensure that `createViewer` is called on mount and `viewer.destroy()` is called on unmount.
* **Prop Synchronization**: Verifies that changing props (like the `file` or `theme`) triggers the appropriate updates in the underlying viewer instance.
* **Toolbar Harnesses**: Specific tests for framework-rendered toolbars, such as `ToolbarHarness.test.svelte`.

For details on adapter testing and CSS class verification, see [Framework Adapter Tests & Smoke Tests](/xushanpei/open-file-viewer/6.2-framework-adapter-tests-and-smoke-tests).

## Build & Export Validation

Beyond functional tests, the repository includes scripts to verify the integrity of the package distribution. The `check-package-exports.mjs` script iterates through all packages (`core`, `react`, `vue`, `svelte`) and ensures that every file referenced in the `exports`, `main`, `module`, or `types` fields of `package.json` actually exists on disk [scripts/check-package-exports.mjs L6-L34](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs#L6-L34)

### Build Validation Flow

"Export Integrity Check"

```

```

**Sources:** [scripts/check-package-exports.mjs L1-L54](https://github.com/xushanpei/open-file-viewer/blob/ea5b8aef/scripts/check-package-exports.mjs#L1-L54)