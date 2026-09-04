# i18n, UI Kit, Project Store & Electron Utils

> **Relevant source files**
> * [apps/docs/src/renderer/assets/icon-editor.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-editor.png)
> * [apps/docs/src/renderer/assets/icon-translate.png](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-translate.png)

This section covers the foundational shared packages that provide cross-cutting concerns for the GenOffice suite. These packages facilitate internationalization, provide a unified design language via the UI kit, manage recent file history, and enforce security-critical Electron utilities.

## i18n (Internationalization)

The `@genoffice/i18n` package provides the locale key system used across all applications in the suite. It ensures a consistent user experience regardless of the user's language settings.

### Implementation Details

The system relies on a structured locale key mapping. In the renderer processes, translations are typically accessed via a hook or a global provider that resolves keys based on the current application state. The package includes assets for language-specific UI elements, such as the `icon-translate.png` used in translation-related interfaces [apps/docs/src/renderer/assets/icon-translate.png L1-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-translate.png#L1-L9)

Sources: [apps/docs/src/renderer/assets/icon-translate.png L1-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-translate.png#L1-L9)

---

## UI Kit (@genoffice/ui)

The UI kit is a collection of shared React components and assets. It ensures visual consistency and reduces code duplication across the `docs`, `sheets`, `slides`, `pdf`, and `markdown` applications.

### Key Components

* **AiComposer**: The standard input component for interacting with the AI Agent. It handles user input, attachment displays, and submission states.
* **AiTypingIndicator**: A visual cue used when the AI provider is streaming a response or performing a background task.
* **Markdown**: A specialized renderer for AI-generated responses, supporting syntax highlighting and office-specific formatting.
* **Shared Icons**: A centralized repository of icons, including editor-specific assets like `icon-editor.png` [apps/docs/src/renderer/assets/icon-editor.png L1-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-editor.png#L1-L15)  used in ribbons, sidebars, and context menus.
* **Design Tokens**: Shared CSS variables (tokens.css) that define the color palette, spacing, and typography across all editors.

### Data Flow: AI UI Components

The following diagram illustrates how the UI components interact with the `agent-core` and `ai-provider` packages to facilitate user interaction.

**AI Interaction Data Flow**

```

```

Sources: [apps/docs/src/renderer/assets/icon-editor.png L1-L15](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/assets/icon-editor.png#L1-L15)

---

## Project Store (@genoffice/project-store)

The `@genoffice/project-store` package manages the "Recent Files" list and workspace-specific metadata. It operates across the IPC boundary to ensure persistence.

### ProjectApi

The `ProjectApi` is exposed to the renderer via the `preload` script and attached to the global `window` object [apps/docs/src/renderer/env.d.ts L4-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/env.d.ts#L4-L9)

| Function | Description |
| --- | --- |
| `getRecentFiles()` | Retrieves the list of recently opened documents from the OS-level store. |
| `addToRecentFiles(path)` | Adds a new file path to the history, rotating out old entries. |
| `clearRecentFiles()` | Wipes the history for privacy. |

Sources: [apps/docs/src/renderer/env.d.ts L4-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/env.d.ts#L4-L9)

---

## Electron Utils (@genoffice/electron-utils)

This package contains security-hardened utilities that wrap standard Electron APIs. It is the primary enforcement point for the GenOffice security posture.

### Security Gateways

* **safeExternalUrl**: Every call to `shell.openExternal` must pass through this gate. It enforces a strict protocol allowlist (typically `http:`, `https:`, and `mailto:`) to prevent execution of `file:` or `javascript:` schemes.
* **safeRemoteUrl**: Validates remote resources to prevent unauthorized cross-origin requests.
* **Navigation Guard**: Prevents the renderer from navigating away from the application's bundled code to arbitrary web URLs.

### Security Model & Code Entities

The following diagram maps the security requirements to the specific code entities in `electron-utils` and the main process configuration.

**Security Enforcement Mapping**

```

```

### Process Lockdown

All application windows (docs, sheets, slides, pdf, shell, updater) are configured with a secure profile:

* `contextIsolation: true`
* `nodeIntegration: false`
* `sandbox: true`

This ensures that even if a renderer is compromised, it cannot access Node.js primitives or the host file system directly.

Sources: [apps/docs/src/renderer/env.d.ts L4-L9](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/env.d.ts#L4-L9)