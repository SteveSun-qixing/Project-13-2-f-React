# Shared Infrastructure Packages

> **Relevant source files**
> * [apps/docs/package.json](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json)

This page provides a high-level overview of several shared packages within the GenOffice monorepo that provide foundational infrastructure across the suite of applications. These packages handle concerns such as file parsing, internationalization, common UI components, recent file management, and Electron-specific utilities. Detailed technical information for each package is provided in dedicated child pages.

## Overview of Shared Infrastructure

The `packages/` directory in the GenOffice monorepo contains a collection of reusable libraries and utilities. This page focuses on `file-parse`, `font-metrics`, `i18n`, `ui`, `project-store`, and `electron-utils`. These packages are crucial for various cross-cutting concerns, from handling document content for AI features to providing a consistent user experience and managing application-level settings.

For details on file parsing and the font subsystem, see [File Parsing, Font Subsystem & Font Metrics](/genspark-ai/genoffice/9.1-file-parsing-font-subsystem-and-font-metrics).
For details on internationalization, the UI kit, project store, and Electron utilities, see [i18n, UI Kit, Project Store & Electron Utils](/genspark-ai/genoffice/9.2-i18n-ui-kit-project-store-and-electron-utils).

### File Parsing (packages/file-parse)

The `file-parse` package is responsible for extracting text content from various document formats, primarily for use with AI features like summarization or question-answering. It supports common office document types such as DOCX, PPTX, XLSX, and PDF. This package acts as a bridge between the raw document files and the AI system, providing a standardized text representation for AI attachments.

Sources: `packages/file-parse`, [apps/docs/package.json L26](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L26-L26)

### Font Subsystem & Font Metrics (packages/font-metrics)

The font subsystem manages the fonts used for rendering documents and calculating layout metrics. This includes bundled Open Font License (OFL) fonts like Carlito, Caladea, and Liberation families, as well as the `font-metrics` package which provides `findSystemFont`, `familyVerticalMetrics`, and sfnt table parsing for line-height accuracy. This ensures consistent document rendering across different user environments.

Sources: `packages/font-metrics`, [apps/docs/src/renderer/font-check.ts L1-L87](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L1-L87)

 [apps/docs/src/renderer/font-list.ts L1-L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L1-L75)

 [apps/docs/package.json L94](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L94-L94)

### Internationalization (packages/i18n)

The `i18n` package provides a robust system for managing locale keys and translations across the GenOffice applications. It enables the application to support multiple languages, ensuring that UI elements, messages, and other text content are presented in the user's preferred language.

Sources: `packages/i18n`, [apps/docs/package.json L22](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L22-L22)

### UI Kit (packages/ui)

The `ui` package serves as a shared React component library, providing a consistent look and feel across all GenOffice applications. It includes common UI elements and specialized components such as `AiComposer` for AI interactions, `AiTypingIndicator` for visual feedback during AI processing, and a `Markdown` renderer. It also centralizes design tokens in `tokens.css`.

Sources: `packages/ui`, [apps/docs/package.json L28](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L28-L28)

### Project Store (packages/project-store)

The `project-store` package handles the management of recent files and project-related metadata. It utilizes Electron's Inter-Process Communication (IPC) mechanisms to store and retrieve this information, ensuring that users can easily access their recently opened documents across application sessions.

Sources: `packages/project-store`, [apps/docs/package.json L27](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L27-L27)

### Electron Utilities (packages/electron-utils)

The `electron-utils` package provides a collection of utility functions specifically designed for Electron environments. These utilities address common Electron-specific concerns, such as `safeExternalUrl` and `safeRemoteUrl` for secure handling of external links, and `navigation-guard` for controlling navigation within `WebContentsView` instances.

Sources: `packages/electron-utils`, [apps/docs/package.json L93](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L93-L93)

## Shared Infrastructure Component Diagram

The following diagram illustrates the high-level relationships between the shared infrastructure packages and their primary consumers within the GenOffice ecosystem.

```

```

Sources: [apps/docs/package.json L21-L47](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L21-L47)

 [apps/docs/package.json L93-L97](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L93-L97)

## Font Subsystem Details

The font subsystem is particularly important for `apps/docs` to ensure accurate and consistent rendering of word processing documents. It involves:

* **Bundled Fonts**: GenOffice includes several Open Font License (OFL) fonts directly within the application, such as 'Carlito', 'Caladea', 'Liberation Serif', 'Liberation Sans', and 'Liberation Mono'. [apps/docs/src/renderer/font-check.ts L6-L14](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L6-L14)
* **Font Availability Check**: The `checkMissingFonts` function in `font-check.ts` determines if a font declared in a document is actually available on the system by measuring text width on a canvas. [apps/docs/src/renderer/font-check.ts L37-L59](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L37-L59)
* **Vertical Metrics**: The `font-metrics` package provides `familyVerticalMetrics` to extract ascent, descent, and line gap information from font files, which is critical for accurate pagination and line-height rendering.
* **Locale-Specific Font Lists**: The `fontFamiliesFor` function in `font-list.ts` provides a prioritized list of font candidates based on the UI language (`Lang`). [apps/docs/src/renderer/font-list.ts L39-L52](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L39-L52)

```

```

Sources: [apps/docs/src/renderer/font-check.ts L1-L87](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-check.ts#L1-L87)

 [apps/docs/src/renderer/font-list.ts L1-L75](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/src/renderer/font-list.ts#L1-L75)

 [apps/docs/package.json L94](https://github.com/genspark-ai/genoffice/blob/d5558b6b/apps/docs/package.json#L94-L94)

For a deep dive into the `file-parse` package and the font subsystem, see [File Parsing, Font Subsystem & Font Metrics](/genspark-ai/genoffice/9.1-file-parsing-font-subsystem-and-font-metrics).

For a deep dive into `i18n`, `ui`, `project-store`, and `electron-utils`, see [i18n, UI Kit, Project Store & Electron Utils](/genspark-ai/genoffice/9.2-i18n-ui-kit-project-store-and-electron-utils).