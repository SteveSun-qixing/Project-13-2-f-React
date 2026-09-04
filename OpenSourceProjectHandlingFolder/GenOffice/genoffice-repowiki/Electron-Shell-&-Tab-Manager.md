# Electron Shell & Tab Manager

> **Relevant source files**
> * [apps/docs/src/main/atomic-write.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts)
> * [apps/docs/src/main/docs-main.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/docs-main.ts)
> * [apps/docs/src/main/external-change.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/external-change.ts)
> * [apps/docs/src/main/updater.ts](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts)

This page provides a detailed technical overview of `apps/shell`, the central Electron application that acts as the host for the GenOffice suite's editors. It covers the architecture of the shell, including how it manages multiple editor instances as `WebContentsView` tabs, the `TabManager` component, the home screen, onboarding, auto-update, and the persistent storage for application settings and recent files.

## Shell Architecture and WebContentsView Tabs

The `apps/shell` application serves as the primary entry point for the GenOffice suite. It achieves a unified interface by hosting each editor (Docs, Sheets, Slides, PDF, Markdown) within its own `WebContentsView` instance. This approach allows for process isolation between editors while providing a seamless tabbed user experience.

Each editor application is an independent Electron application that can also run in standalone mode. When launched within the shell, they are loaded into a `WebContentsView` [apps/shell/src/main/TabManager.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/shell/src/main/TabManager.ts#L100-L100)

 This provides several benefits:

* **Process Isolation**: Each `WebContentsView` runs in its own renderer process. A crash in one editor does not affect others or the shell itself.
* **Modular Lifecycle**: The shell's main process manages the lifecycle of these views, including creation, destruction, and visibility.

### TabManager

The `TabManager` class [apps/shell/src/main/TabManager.ts L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/shell/src/main/TabManager.ts#L20-L20)

 is the core orchestrator. It maintains a collection of open tabs and manages their state. Key responsibilities include:

* **Tab Creation**: Instantiates a new `WebContentsView` and loads the editor application URL [apps/shell/src/main/TabManager.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/shell/src/main/TabManager.ts#L100-L100)
* **Tab Switching**: Manages which view is currently attached to the `BrowserWindow` and visible to the user.
* **Dirty State Management**: Tracks unsaved changes across tabs to prevent data loss on close.

**Diagram: TabManager Entity Mapping**

```

```

Sources:

* [apps/shell/src/main/TabManager.ts L20](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/shell/src/main/TabManager.ts#L20-L20)
* [apps/shell/src/main/TabManager.ts L100](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/shell/src/main/TabManager.ts#L100-L100)
* [apps/docs/src/shared/ipc.ts L66](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/shared/ipc.ts#L66-L66)

## File Persistence and Atomic Writes

To ensure data integrity, especially during the "round-trip" save process, GenOffice utilizes an atomic write strategy. This is particularly critical for OOXML formats (.docx, .pptx, .xlsx) which are zip-based.

### Atomic Write Implementation

The `atomicWriteFile` function [apps/docs/src/main/atomic-write.ts L18-L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts#L18-L47)

 prevents file truncation during crashes by:

1. Writing to a temporary file in the same directory [apps/docs/src/main/atomic-write.ts L19-L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts#L19-L22)
2. Renaming the temporary file to the target path [apps/docs/src/main/atomic-write.ts L27-L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts#L27-L28)
3. Retrying on Windows-specific transient locks (EPERM, EBUSY) with exponential backoff [apps/docs/src/main/atomic-write.ts L6-L32](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts#L6-L32)

### External Change Detection

The system monitors if a file was modified by another program while open in GenOffice. The `isExternallyModified` function [apps/docs/src/main/external-change.ts L15-L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/external-change.ts#L15-L24)

 compares the current file's `mtimeMs`, `size`, and a content `hash` against a recorded `DiskFileState` [apps/docs/src/main/external-change.ts L2-L6](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/external-change.ts#L2-L6)

**Diagram: Save Pipeline and Integrity Checks**

```

```

Sources:

* [apps/docs/src/main/atomic-write.ts L18-L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/atomic-write.ts#L18-L47)
* [apps/docs/src/main/external-change.ts L1-L24](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/external-change.ts#L1-L24)

## Auto-Update Mechanism

The GenOffice suite incorporates an auto-update mechanism using `electron-updater`. For standalone editors like Docs, the update logic is encapsulated in `apps/docs/src/main/updater.ts`.

* **Provider**: Updates are typically served via a generic provider (e.g., Azure CDN) [apps/docs/src/main/updater.ts L9-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L9-L13)
* **Background Downloads**: Updates download silently. Once ready, a native dialog prompts the user [apps/docs/src/main/updater.ts L184-L198](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L184-L198)
* **Intervals**: The system checks for updates 15 seconds after launch and every 4 hours thereafter [apps/docs/src/main/updater.ts L173-L174](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L173-L174)

**Table: Update Localization Keys**

| Key | Purpose |
| --- | --- |
| `updTitle` | Title of the update dialog [apps/docs/src/main/updater.ts L25](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L25-L25) |
| `updInstall` | Label for the "Restart & Install" button [apps/docs/src/main/updater.ts L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L28-L28) |
| `updLater` | Label for deferring the update [apps/docs/src/main/updater.ts L29](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L29-L29) |

Sources:

* [apps/docs/src/main/updater.ts L3-L13](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L3-L13)
* [apps/docs/src/main/updater.ts L173-L174](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L173-L174)
* [apps/docs/src/main/updater.ts L184-L198](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/updater.ts#L184-L198)

## App Settings and Recent Files Store

The shell manages persistent state via several specialized stores.

### ProjectStore

The `ProjectStore` [packages/project-store/src/main/ProjectStore.ts L1](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/project-store/src/main/ProjectStore.ts#L1-L1)

 tracks recently opened files. This data is used to populate the Home Screen's "Recent" list.

### Application Settings

The shell coordinates settings across all apps, including:

* **AI Settings**: Configuration for providers (Genspark, OpenAI, etc.) and API keys [apps/docs/src/main/docs-main.ts L42-L43](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/docs-main.ts#L42-L43)
* **i18n**: UI language preferences (zh, en, ja, etc.) [apps/docs/src/main/docs-main.ts L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/docs-main.ts#L28-L28)
* **Metrics Cache**: Cached font metrics to speed up document layout [apps/docs/src/main/docs-main.ts L27](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/docs-main.ts#L27-L27)

### IPC Communication

The `apps/docs/src/shared/ipc.ts` file defines the contract for communication between the shell and the editors. This includes:

* `OpenFileResult`: Status of opening a file [apps/docs/src/shared/ipc.ts L68](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/shared/ipc.ts#L68-L68)
* `AttachmentMeta`: Metadata for files attached to the AI assistant [apps/docs/src/shared/ipc.ts L64](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/shared/ipc.ts#L64-L64)

Sources:

* [packages/project-store/src/main/ProjectStore.ts L1](https://github.com/genspark-ai/genoffice/blob/d5558b6b/packages/project-store/src/main/ProjectStore.ts#L1-L1)
* [apps/docs/src/main/docs-main.ts L27-L43](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/main/docs-main.ts#L27-L43)
* [apps/docs/src/shared/ipc.ts L61-L70](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/shared/ipc.ts#L61-L70)